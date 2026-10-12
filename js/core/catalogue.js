/* =========================================================
   Accès au catalogue.
   AUJOURD'HUI : lit data/catalogue.json
   DEMAIN     : on remplacera uniquement ce fichier par des appels
                Supabase. Le reste du site ne changera pas.
   ========================================================= */
import { DATA_URL } from "../config.js";

let cache = null;

export async function loadCatalogue() {
  if (cache) return cache;
  try {
    const res = await fetch(DATA_URL);
    cache = await res.json();
  } catch {
    cache = { categories: {}, products: [] };
  }
  return cache;
}

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
