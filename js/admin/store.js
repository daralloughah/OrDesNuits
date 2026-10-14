/* =========================================================
   Produits de l'espace gérant.
   EN LIGNE : tout est enregistré dans Supabase (photos comprises).
   APERÇU   : tout est enregistré sur CET appareil
              (et exportable en un fichier pour le publier sur GitHub).
   ========================================================= */
import { DATA_URL } from "../config.js";
import { LOCAL_KEY, DEFAULT_CATEGORIES, productFromRow, productToRow, categoriesFrom } from "../core/catalogue.js";
import { enabled, rest, rpc, upload } from "../core/sb.js";
export const REMOTE = enabled;

const SALES_KEY = "odn.sales.v1";
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { return false; } // mémoire pleine (photos trop lourdes)
};

let db = null;

export async function load() {
  if (db) return db;
  if (REMOTE) return reload();
  db = read(LOCAL_KEY);
  if (!db?.products) {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    db = await res.json();
  }
  db.categories ||= structuredClone(DEFAULT_CATEGORIES);
  db.products.forEach((p) => { p.stock ??= 0; p.sold ??= 0; p.lowAt ??= 5; });
  return db;
}

/* En ligne : relit les produits (y compris masqués) et les coûts d'achat */
export async function reload() {
  if (!REMOTE) { db = null; return load(); }
  const [rows, costs] = await Promise.all([
    rest("products", "select=*&order=sort.asc,updated_at.desc&limit=2000"),
    rest("product_costs", "select=*&limit=2000"),
  ]);
  const cost = Object.fromEntries(costs.map((c) => [c.product_id, c.cost == null ? null : Number(c.cost)]));
  const products = rows.map((r) => ({ ...productFromRow(r), cost: cost[r.id] ?? null }));
  db = { categories: categoriesFrom(products), products };
  return db;
}

export const save = () => (REMOTE ? true : write(LOCAL_KEY, db));
export const products = () => db.products;
export const find = (id) => db.products.find((p) => p.id === id);

export function slug(name) {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produit";
  let id = base, i = 2;
  while (find(id)) id = `${base}-${i++}`;
  return id;
}

/* Photos : en ligne, une image créée sur le téléphone (data:…) part dans le Storage */
async function pushPhoto(src, id) {
  if (!src || !String(src).startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  const ext = (blob.type.split("/")[1] || "webp").replace("jpeg", "jpg");
  return upload(`${id}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`, blob);
}

/* Enregistre un produit. Renvoie true si c'est bon. */
export async function upsert(p) {
  if (REMOTE) {
    try {
      p.img = await pushPhoto(p.img, p.id);
      p.gallery = await Promise.all((p.gallery || []).map((g) => pushPhoto(g, p.id)));
      await rest("products", "on_conflict=id", { method: "POST", body: productToRow(p), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
      await rest("product_costs", "on_conflict=product_id", { method: "POST", body: { product_id: p.id, cost: p.cost ?? null }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    } catch (x) { console.warn(x); return false; }
  }
  const i = db.products.findIndex((x) => x.id === p.id);
  if (i >= 0) db.products[i] = p; else db.products.unshift(p);
  return REMOTE ? true : save();
}

export async function remove(id) {
  if (REMOTE) {
    try { await rest("products", `id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); }
    catch { return false; }
  }
  db.products = db.products.filter((p) => p.id !== id);
  return REMOTE ? true : save();
}

/* Stock + / − : renvoie le nouveau stock */
export async function adjustStock(id, delta) {
  const p = find(id);
  if (!p) return;
  if (REMOTE) {
    const n = await rpc("admin_adjust_stock", { p_id: id, p_delta: delta });
    p.stock = Number(n);
    return p.stock;
  }
  p.stock = Math.max(0, (p.stock || 0) + delta);
  save();
  return p.stock;
}

/* ---------- Ventes ---------- */
export const sales = () => read(SALES_KEY) || [];

/* Lit un message de commande WhatsApp (celui que le site génère)
   et retrouve les produits et quantités. */
export function parseOrder(text) {
  const lines = [];
  const re = /(\d+)\s*[×x]\s*(.+?)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[2].trim().toLowerCase();
    const p = db.products.find((x) => x.name.toLowerCase() === name)
      || db.products.find((x) => name.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(name));
    lines.push({ qty: Number(m[1]), name: m[2].trim(), id: p?.id || null });
  }
  const total = /Total\s*:\s*([^\n]+)/i.exec(text)?.[1]?.trim() || "";
  return { lines, total };
}

/* Valide une vente : décompte le stock et garde une trace */
export function recordSale({ lines, total }, note = "") {
  const list = sales();
  const euros = lines.reduce((s, l) => {
    const p = l.id && find(l.id);
    return s + (p ? (p.promo && p.promo < p.price ? p.promo : p.price) * l.qty : 0);
  }, 0);
  lines.forEach((l) => {
    const p = l.id && find(l.id);
    if (!p) return;
    p.stock = Math.max(0, (p.stock || 0) - l.qty);
    p.sold = (p.sold || 0) + l.qty;
  });
  list.unshift({ at: new Date().toISOString(), lines, total, euros: Math.round(euros * 100) / 100, note });
  write(SALES_KEY, list.slice(0, 500));
  save();
}

/* ---------- Statistiques ---------- */
export function stats() {
  const ps = db.products;
  const list = sales();
  const today = new Date().toDateString();
  const week = Date.now() - 7 * 864e5;
  return {
    count: ps.length,
    live: ps.filter((p) => p.active !== false).length,
    units: ps.reduce((s, p) => s + (p.stock || 0), 0),
    value: ps.reduce((s, p) => s + (p.stock || 0) * (p.promo && p.promo < p.price ? p.promo : p.price), 0),
    low: ps.filter((p) => p.stock > 0 && p.stock <= (p.lowAt ?? 5)),
    out: ps.filter((p) => (p.stock || 0) <= 0),
    salesToday: list.filter((s) => new Date(s.at).toDateString() === today),
    salesWeek: list.filter((s) => new Date(s.at).getTime() >= week),
    sales: list,
  };
}

/* ---------- Export / import ---------- */
export function exportJson() {
  // le coût d'achat reste privé : il n'est jamais exporté dans le fichier public
  const clean = { _note: "Catalogue OrDesNuits exporté depuis l'espace gérant.", categories: db.categories, products: db.products.map(({ cost, ...p }) => p) };
  return JSON.stringify(clean, null, 1);
}

export async function importJson(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data.products)) throw new Error("format");
  if (REMOTE) {
    await rest("products", "on_conflict=id", { method: "POST", body: data.products.map(productToRow), headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
    await reload();
    return true;
  }
  db = data;
  return save();
}

export async function resetToPublished() {
  if (REMOTE) return reload();
  try { localStorage.removeItem(LOCAL_KEY); } catch {}
  db = null;
  return load();
}

/* Place utilisée dans la mémoire du navigateur (les photos pèsent lourd) */
export function storageUsage() {
  try {
    let bytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      bytes += (k.length + (localStorage.getItem(k) || "").length) * 2;
    }
    return bytes;
  } catch { return 0; }
}
