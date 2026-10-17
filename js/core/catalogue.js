/* =========================================================
   Accès au catalogue.
   EN LIGNE  : lit les produits dans Supabase (table products)
   APERÇU    : lit data/catalogue.json, ou la version modifiée
               dans l'espace gérant sur cet appareil
   ========================================================= */
import { DATA_URL } from "../config.js";
import { enabled, rest } from "./sb.js";

let cache = null;
export const DEFAULT_CATEGORIES = { lui: ["miel", "huile", "bougie", "gel"], elle: ["miel", "huile", "bougie", "soin"] };

/* Modifications faites dans l'espace gérant (mode aperçu uniquement) */
export const LOCAL_KEY = "odn.catalogue.v1";
function localCatalogue() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch { return null; }
}

/* Conversions base ⇄ site */
const n = (v) => (v == null ? null : Number(v));
export function productFromRow(r) {
  return {
    id: r.id, shop: r.shop, category: r.category, type: r.type || undefined, name: r.name,
    price: n(r.price), promo: n(r.promo), frame: r.frame, offer: r.offer, pinned: r.pinned, active: r.active,
    stock: r.stock, lowAt: r.low_at, sold: r.sold, img: r.img, gallery: r.gallery || [], fit: r.fit,
    desc: r.descr || {}, sort: r.sort,
    ...(r.extra || {}), // formats, fiche détaillée, revendeurs
  };
}
const EXTRA = ["tiers", "unitName", "facts", "usage", "compo", "warn", "wholesale"];
export function productToRow(p) {
  return {
    id: p.id, shop: p.shop, category: p.category, type: p.type || null, name: p.name,
    price: Number(p.price) || 0, promo: p.promo ? Number(p.promo) : null, frame: p.frame || "none",
    offer: !!p.offer, pinned: !!p.pinned, active: p.active !== false, stock: Math.max(0, Math.round(p.stock || 0)),
    low_at: p.lowAt ?? 5, sold: p.sold || 0, img: p.img || null, gallery: p.gallery || [], fit: p.fit || "cover",
    descr: p.desc || {}, sort: p.sort ?? 0, updated_at: new Date().toISOString(),
    extra: Object.fromEntries(EXTRA.filter((k) => p[k] != null).map((k) => [k, p[k]])),
  };
}
export function categoriesFrom(products) {
  const out = { lui: [...DEFAULT_CATEGORIES.lui], elle: [...DEFAULT_CATEGORIES.elle] };
  products.forEach((p) => { if (p.type !== "pack" && out[p.shop] && !out[p.shop].includes(p.category)) out[p.shop].push(p.category); });
  return out;
}

async function fromJson() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-cache" });
    return await res.json();
  } catch {
    return { categories: {}, products: [] };
  }
}

export async function loadCatalogue() {
  if (cache) return cache;
  if (enabled) {
    try {
      const rows = await rest("products", "select=*&active=is.true&order=sort.asc,name.asc");
      if (rows.length) {
        const products = rows.map(productFromRow);
        return (cache = { categories: categoriesFrom(products), products });
      }
    } catch {}
    cache = await fromJson(); // base vide ou injoignable : catalogue publié
    cache.products.forEach((p, i) => { p.sort ??= i; });
    return cache;
  }
  const local = localCatalogue();
  cache = local?.products ? local : await fromJson();
  cache.products.forEach((p, i) => { p.sort ??= i; });
  return cache;
}

/* Stock : épuisé, ou presque */
export const isSoldOut = (p) => typeof p.stock === "number" && p.stock <= 0;
export const isLow = (p) => typeof p.stock === "number" && p.stock > 0 && p.stock <= (p.lowAt ?? 5);

/* Prix réellement payé (promo si elle existe) */
export const finalPrice = (p) => (p.promo && p.promo < p.price ? p.promo : p.price);

export const isLive = (p) => p.active !== false;

export async function productsOf(shop) {
  const c = await loadCatalogue();
  return c.products.filter((p) => p.shop === shop && isLive(p) && p.type !== "pack");
}

export async function packsOf(shop) {
  const c = await loadCatalogue();
  return c.products.filter((p) => p.shop === shop && isLive(p) && p.type === "pack");
}

/* Meilleures ventes : produits épinglés d'abord, puis par nombre de ventes */
export async function bestOf(shop, n = 4) {
  const list = await productsOf(shop);
  return [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.sold - a.sold).slice(0, n);
}

export async function findProduct(id) {
  const c = await loadCatalogue();
  return c.products.find((p) => p.id === id) || null;
}

export async function categoriesOf(shop) {
  const c = await loadCatalogue();
  return c.categories[shop] || [];
}
