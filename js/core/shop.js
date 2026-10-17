/* =========================================================
   Règles de vente partagées par le panier et la commande :
   livraison offerte dès X €, emballage cadeau, code promo
   d'affilié, compteur public, avis vérifiés, paniers en attente.
   En ligne, le serveur (place_order) recalcule tout : ces
   calculs ne servent qu'à l'affichage.
   ========================================================= */
import { SHOP, OFFER } from "../config.js";
import { enabled, rest, rpc } from "./sb.js";

const r2 = (v) => Math.round(v * 100) / 100;
const ls = {
  get: (k, d = null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

/* ---------- Réglages ---------- */
let cfg = null;
export async function settings() {
  if (cfg) return cfg;
  cfg = { ...SHOP, ...(!enabled ? ls.get("odn.shop", {}) || {} : {}) };
  if (enabled) {
    try {
      const rows = await rest("settings", "key=eq.shop&select=value");
      const v = rows[0]?.value;
      if (v) cfg = { shipFee: Number(v.ship_fee ?? SHOP.shipFee), freeFrom: Number(v.free_from ?? SHOP.freeFrom), giftFee: Number(v.gift_fee ?? SHOP.giftFee) };
    } catch {}
  }
  return cfg;
}

/* ---------- Code promo (code d'affilié avec remise pour son audience) ---------- */
const REF = "odn.ref", PROMO = "odn.promo";
export function refCode() { const r = ls.get(REF); return r && Date.now() - r.at < 30 * 864e5 ? r.code : null; }
export const typedPromo = () => ls.get(PROMO);
export const setPromo = (code) => ls.set(PROMO, code ? String(code).toUpperCase().trim() : null);
const promoCache = {};
export async function promoPct(code) {
  code = String(code || "").toUpperCase().trim();
  if (!code) return 0;
  if (code in promoCache) return promoCache[code];
  let pct = 0;
  if (enabled) { try { pct = Number(await rpc("check_promo", { p_code: code })) || 0; } catch {} }
  else {
    const a = (ls.get("odn.affiliates", []) || []).find((x) => x.code === code && x.status === "actif");
    pct = Math.min(30, Math.max(0, Number(a?.promoPct) || 0));
  }
  return (promoCache[code] = pct);
}
/* Le code actif : celui tapé par le client, sinon celui du lien d'affilié */
export async function activePromo() {
  for (const c of [typedPromo(), refCode()]) { if (c) { const pct = await promoPct(c); if (pct > 0) return { code: c, pct }; } }
  return null;
}

/* ---------- Totaux (en euros) ---------- */
export function totals(lines, { promo = null, gift = false } = {}, c = cfg || SHOP) {
  const sub = lines.reduce((s, l) => s + l.eur, 0);
  const units = OFFER.active ? lines.filter((l) => l.p.offer).flatMap((l) => Array(l.q).fill(l.eur / l.q)).sort((a, b) => a - b) : [];
  const offer = units.slice(0, Math.floor(units.length / (OFFER.buy + 1))).reduce((s, v) => s + v, 0);
  const promoEur = promo ? r2((sub - offer) * promo.pct / 100) : 0;
  const after = sub - offer - promoEur;
  const ship = lines.length && after < c.freeFrom ? c.shipFee : 0;
  const giftEur = gift ? c.giftFee : 0;
  return { sub: r2(sub), offer: r2(offer), promo: promoEur, disc: r2(offer + promoEur), ship, gift: giftEur, total: r2(after + ship + giftEur), missing: r2(Math.max(0, c.freeFrom - after)), freeFrom: c.freeFrom };
}

/* ---------- Le rituel : un produit assorti proposé dans le panier ---------- */
const PAIR = { miel: ["bougie", "huile"], huile: ["bougie", "gel", "soin"], bougie: ["huile", "miel"], gel: ["huile", "soin"], soin: ["huile", "bougie"], pack: ["bougie", "huile"] };
export function ritual(lines, products) {
  if (!lines.length) return null;
  const inCart = new Set(lines.map((l) => l.p.id));
  const main = [...lines].sort((a, b) => b.eur - a.eur)[0].p;
  const want = PAIR[main.category] || ["bougie"];
  const ok = (p) => !inCart.has(p.id) && p.active !== false && (p.stock == null || p.stock > 0);
  for (const cat of want) {
    const pick = products.filter((p) => ok(p) && p.category === cat).sort((a, b) => (b.shop === main.shop) - (a.shop === main.shop) || (b.sold || 0) - (a.sold || 0))[0];
    if (pick) return pick;
  }
  return products.filter(ok).sort((a, b) => (b.sold || 0) - (a.sold || 0))[0] || null;
}

/* ---------- Panier en attente (seulement avec l'accord du client) ---------- */
let saveT;
export function saveCart(payload) {
  clearTimeout(saveT);
  if (!payload.optin || !payload.email || !payload.lines?.length) return;
  saveT = setTimeout(async () => {
    if (enabled) { try { await rpc("save_cart", { p: payload }); } catch {} return; }
    const all = ls.get("odn.carts", {}) || {};
    all[payload.email.toLowerCase()] = { data: payload, updated_at: new Date().toISOString() };
    ls.set("odn.carts", all);
  }, 1500);
}
export async function pendingCarts() {
  if (enabled) { try { return await rest("carts", "select=*&order=updated_at.desc&limit=100"); } catch { return []; } }
  return Object.entries(ls.get("odn.carts", {}) || {}).map(([email, v]) => ({ email, ...v })).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}
export async function dropCart(email) {
  if (enabled) { try { await rest("carts", `email=eq.${encodeURIComponent(email)}`, { method: "DELETE" }); } catch {} return; }
  const all = ls.get("odn.carts", {}) || {}; delete all[email]; ls.set("odn.carts", all);
}
export function forgetCart(email) { if (!enabled && email) { const all = ls.get("odn.carts", {}) || {}; delete all[email.toLowerCase()]; ls.set("odn.carts", all); } }

/* ---------- Compteur public et avis vérifiés ---------- */
export async function publicStats() {
  if (enabled) { try { return await rpc("public_stats"); } catch { return null; } }
  const orders = ls.get("odn.orders", []) || [];
  const rv = (ls.get("odn.reviews", []) || []).filter((r) => r.approved);
  return { shipped: orders.filter((o) => ["expediee", "livree"].includes(o.status)).length, reviews: rv.length, rating: rv.length ? r2(rv.reduce((s, r) => s + r.rating, 0) / rv.length) : null };
}
export async function reviewsOf(productId) {
  if (enabled) { try { return await rest("reviews", `select=rating,body,name,created_at,lang&approved=eq.true&product_id=eq.${encodeURIComponent(productId)}&order=created_at.desc&limit=20`); } catch { return []; } }
  return (ls.get("odn.reviews", []) || []).filter((r) => r.approved && r.product_id === productId);
}
export async function submitReview({ order, product, rating, body, name, lang }) {
  if (enabled) { await rpc("submit_review", { p_order: order, p_product: product, p_rating: rating, p_body: body, p_name: name, p_lang: lang }); return true; }
  const all = (ls.get("odn.reviews", []) || []).filter((r) => r.order_id !== order);
  all.unshift({ id: Date.now(), order_id: order, product_id: product, rating, body, name, lang, approved: false, created_at: new Date().toISOString() });
  ls.set("odn.reviews", all);
  return true;
}
/* Gérant : modération */
export async function allReviews() {
  if (enabled) { try { return await rest("reviews", "select=*&order=created_at.desc&limit=200"); } catch { return []; } }
  return ls.get("odn.reviews", []) || [];
}
export async function moderate(id, approved) {
  if (enabled) {
    if (approved === null) await rest("reviews", `id=eq.${id}`, { method: "DELETE" });
    else await rest("reviews", `id=eq.${id}`, { method: "PATCH", body: { approved } });
    return;
  }
  let all = ls.get("odn.reviews", []) || [];
  all = approved === null ? all.filter((r) => r.id !== id) : all.map((r) => (r.id === id ? { ...r, approved } : r));
  ls.set("odn.reviews", all);
}
