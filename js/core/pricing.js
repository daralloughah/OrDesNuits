/* =========================================================
   Prix par lots (1 stick, 2 sticks, 3, 6, 12, boîte de 24…)
   et prix revendeur (5 à 50 boîtes).
   Le pourcentage d'économie est TOUJOURS calculé ici,
   jamais saisi à la main : impossible de se tromper.
   ========================================================= */
import { finalPrice } from "./catalogue.js";

const r2 = (v) => Math.round(v * 100) / 100;

/* Prix de référence d'une unité (promo comprise) */
export const unitPrice = (p) => finalPrice(p);

/* Les offres du produit, triées, avec l'unité toujours présente */
export function tiers(p) {
  const list = (p.tiers || [])
    .map((x) => ({ q: Math.round(Number(x.q)), p: Number(x.p), label: x.label || "" }))
    .filter((x) => x.q >= 1 && x.p > 0);
  if (!list.some((x) => x.q === 1)) list.push({ q: 1, p: unitPrice(p), label: "" });
  else list.find((x) => x.q === 1).p = Math.min(list.find((x) => x.q === 1).p, unitPrice(p));
  return list.sort((a, b) => a.q - b.q);
}
export const hasTiers = (p) => tiers(p).length > 1;

/* Économie d'une offre par rapport au prix à l'unité */
export function saving(p, tier) {
  const full = unitPrice(p) * tier.q;
  const eur = r2(full - tier.p);
  const pct = full > 0 ? Math.round((1 - tier.p / full) * 100) : 0;
  return { eur: Math.max(0, eur), pct: Math.max(0, pct), per: r2(tier.p / tier.q) };
}

/* Meilleure économie de toutes les offres (pour « jusqu'à −44 % ») */
export function maxSaving(p) {
  return tiers(p).reduce((m, x) => Math.max(m, saving(p, x).pct), 0);
}

/* Prix le plus bas par unité (pour « dès 2,75 € le stick ») */
export const fromPer = (p) => Math.min(...tiers(p).map((x) => x.p / x.q));

/* Prix le plus avantageux pour qty unités, en combinant les lots
   (ex. 5 sticks = lot de 3 + lot de 2). Jamais plus cher qu'une quantité
   supérieure : si 23 sticks coûtaient plus que la boîte de 24, on facture
   le prix de la boîte. */
export function bestCost(p, qty) {
  qty = Math.max(0, Math.round(qty));
  if (!qty) return 0;
  const list = tiers(p);
  const top = qty + Math.max(...list.map((x) => x.q));
  const best = new Array(top + 1).fill(Infinity);
  best[0] = 0;
  for (let n = 1; n <= top; n++) {
    for (const t of list) if (t.q <= n && best[n - t.q] + t.p < best[n]) best[n] = best[n - t.q] + t.p;
  }
  return r2(Math.min(...best.slice(qty)));
}

/* L'offre « le plus choisi » : désignée par le gérant, sinon celle du milieu */
export function popularTier(p) {
  const list = tiers(p);
  const marked = list.find((x) => x.label === "popular");
  if (marked) return marked.q;
  return list.length > 2 ? list[Math.floor(list.length / 2)].q : null;
}
/* L'offre « meilleure valeur » : la plus forte économie */
export function bestValueTier(p) {
  const list = tiers(p);
  if (list.length < 2) return null;
  return list.reduce((a, b) => (saving(p, b).pct > saving(p, a).pct ? b : a)).q;
}

/* ---------- Revendeurs ---------- */
/* Chaque produit pro a un prix de base par boîte (ex. 30 €).
   Les paliers d'un produit de référence (5 = 150 €, 10 = 290 €, 25 = 600 €,
   50 = 1150 €) deviennent une GRILLE PAR MONTANT valable pour tout le panier :
   150 € → 0 %, 300 € → −3,3 %, 750 € → −20 %, 1 500 € → −23,3 %.
   Un panier mélangé (3 boîtes à 30 €, 3 à 50 €, 3 à 60 €) reçoit donc
   exactement la même remise qu'une seule sorte de boîte pour le même montant. */
export function wholesale(p) {
  const w = p.wholesale;
  if (!w?.active) return null;
  const list = (w.tiers || []).map((x) => ({ q: Math.round(Number(x.q)), p: Number(x.p) })).filter((x) => x.q > 0 && x.p > 0).sort((a, b) => a.q - b.q);
  const base = Number(w.base) > 0 ? Number(w.base) : list.length ? list[0].p / list[0].q : 0;
  if (!base) return null;
  return { unit: w.unit || "", base: r2(base), min: Math.max(1, Number(w.min) || list[0]?.q || 1), max: Math.max(1, Number(w.max) || 50), tiers: list, ref: !!w.ref };
}

/* La grille par montant, tirée du produit de référence
   (celui coché « référence », sinon le premier qui a au moins 2 paliers) */
export function proGrid(products) {
  const ws = products.map((p) => ({ p, w: wholesale(p) })).filter((x) => x.w);
  const ref = ws.find((x) => x.w.ref && x.w.tiers.length > 1) || ws.find((x) => x.w.tiers.length > 1);
  if (!ref) return { steps: [{ from: 0, pct: 0 }], minBoxes: ws[0]?.w.min || 1 };
  const b = ref.w.base;
  const steps = ref.w.tiers.map((x) => ({ from: r2(x.q * b), pct: Math.max(0, 1 - x.p / (x.q * b)), boxes: x.q })).sort((a, c) => a.from - c.from);
  steps[0] = { ...steps[0], pct: Math.max(0, steps[0].pct) };
  return { steps: [{ from: 0, pct: 0 }, ...steps.filter((x) => x.from > 0)], minBoxes: ref.w.min };
}

/* Devis d'un panier pro : lines = [{ p, n }] */
export function proQuote(lines, grid) {
  const rows = lines.filter((l) => l.n > 0).map((l) => ({ ...l, base: r2(wholesale(l.p).base * l.n) }));
  const base = r2(rows.reduce((s, l) => s + l.base, 0));
  const boxes = rows.reduce((s, l) => s + l.n, 0);
  const steps = grid.steps;
  const step = [...steps].reverse().find((x) => x.from <= base + 0.001) || steps[0];
  const next = steps.find((x) => x.from > base + 0.001);
  let total = base * (1 - step.pct);
  // jamais plus cher qu'une commande plus grosse au palier suivant
  if (next) total = Math.min(total, next.from * (1 - next.pct));
  total = r2(total);
  const pct = base ? 1 - total / base : 0;
  // répartition ligne par ligne ; la dernière ligne absorbe l'arrondi
  const out = rows.map((l) => ({ ...l, total: r2(l.base * (1 - pct)) }));
  if (out.length) out.at(-1).total = r2(total - out.slice(0, -1).reduce((s, l) => s + l.total, 0));
  return {
    rows: out,
    base, total, boxes, eur: r2(base - total), pct: Math.round(pct * 100),
    next: next ? { pct: Math.round(next.pct * 100), missing: r2(next.from - base) } : null,
    okMin: boxes >= grid.minBoxes, minBoxes: grid.minBoxes,
  };
}

/* Ancien calcul « un seul produit » (gardé pour la fiche produit) */
export function wholesaleQuote(p, n) {
  const w = wholesale(p);
  if (!w) return null;
  const q = proQuote([{ p, n }], proGrid([p]));
  return { n, per: r2(q.total / n), total: q.total, base: w.base, pct: q.pct, eur: q.eur, next: q.next };
}
