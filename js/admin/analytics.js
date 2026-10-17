/* =========================================================
   Analyses du Salon privé : chiffres, classements, comptabilité,
   et pistes stratégiques calculées à partir des commandes.
   ========================================================= */
import { OFFER } from "../config.js";
import { allOrders, customers, subscribers } from "../core/backend.js";
import { countryName, FR_REGIONS } from "../core/places.js";

export const PAID = ["confirmee", "expediee", "livree"];
export const STATUS = { nouvelle: "À confirmer", confirmee: "Confirmée", expediee: "Expédiée", livree: "Livrée", annulee: "Annulée" };
export const PAYMENTS = { carte: "Carte", virement: "Virement", especes: "Espèces", whatsapp: "Lien WhatsApp" };
export const PERIODS = { "7": "7 jours", "30": "30 jours", "90": "3 mois", "365": "12 mois", all: "Tout" };
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const since = (period) => (period === "all" ? 0 : Date.now() - Number(period) * 864e5);
const units = (o) => o.lines.reduce((s, l) => s + l.qty, 0);
const round = (v) => Math.round(v * 100) / 100;

export function compute(period = "30", products = []) {
  const from = since(period);
  const all = allOrders();
  const inP = all.filter((o) => new Date(o.at).getTime() >= from);
  const paid = inP.filter((o) => PAID.includes(o.status));
  const prevFrom = period === "all" ? 0 : from - (Date.now() - from);
  const prevPaid = period === "all" ? [] : all.filter((o) => { const t = new Date(o.at).getTime(); return t >= prevFrom && t < from && PAID.includes(o.status); });

  const revenue = paid.reduce((s, o) => s + o.totalEur, 0);
  const prevRevenue = prevPaid.reduce((s, o) => s + o.totalEur, 0);
  const costOf = (id) => products.find((p) => p.id === id)?.cost || 0;
  const cogs = paid.reduce((s, o) => s + o.lines.reduce((a, l) => a + costOf(l.id) * l.qty, 0), 0);
  const knownCost = products.some((p) => p.cost);

  /* Clients */
  const users = customers();
  const subs = subscribers();
  const byEmail = {};
  all.filter((o) => PAID.includes(o.status)).forEach((o) => { const e = o.customer?.email; if (e) byEmail[e] = (byEmail[e] || 0) + 1; });
  const buyers = Object.keys(byEmail).length;
  const repeat = Object.values(byEmail).filter((n) => n > 1).length;

  /* Géographie */
  const group = (list, key) => {
    const m = {};
    list.forEach((o) => { const k = key(o); if (!k) return; m[k] ||= { key: k, orders: 0, revenue: 0, last: o.at }; m[k].orders++; m[k].revenue += PAID.includes(o.status) ? o.totalEur : 0; if (o.at > m[k].last) m[k].last = o.at; });
    return Object.values(m).sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);
  };
  const live = inP.filter((o) => o.status !== "annulee");
  const countries = group(live, (o) => o.shipping?.country).map((c) => ({ ...c, name: countryName(c.key, "fr") }));
  const regions = group(live.filter((o) => o.shipping?.country === "FR"), (o) => o.shipping?.region).map((r) => ({ ...r, name: FR_REGIONS[r.key] || r.key }));

  /* Produits, boutiques, catégories */
  const prod = {}, shop = { lui: 0, elle: 0 }, cat = {};
  paid.forEach((o) => o.lines.forEach((l) => {
    prod[l.id] ||= { id: l.id, name: l.name, qty: 0, revenue: 0 };
    prod[l.id].qty += l.qty; prod[l.id].revenue += l.unitEur * l.qty;
    if (l.shop in shop) shop[l.shop] += l.unitEur * l.qty;
    cat[l.category] = (cat[l.category] || 0) + l.unitEur * l.qty;
  }));
  const topProducts = Object.values(prod).sort((a, b) => b.qty - a.qty);

  /* Moments */
  const byDay = Array(7).fill(0), byHour = Array(24).fill(0);
  live.forEach((o) => { const d = new Date(o.at); byDay[d.getDay()]++; byHour[d.getHours()]++; });

  /* Série temporelle du chiffre d'affaires */
  const series = timeline(paid, period);

  /* Offre 3+1 */
  const honeyOrders = paid.filter((o) => o.lines.some((l) => l.category === "miel"));
  const offerUsed = honeyOrders.filter((o) => o.discountEur > 0).length;

  return {
    period, orders: inP, paid, revenue: round(revenue), prevRevenue: round(prevRevenue),
    count: paid.length, prevCount: prevPaid.length, pending: all.filter((o) => o.status === "nouvelle"),
    basket: paid.length ? round(revenue / paid.length) : 0, units: paid.reduce((s, o) => s + units(o), 0),
    cogs: round(cogs), margin: round(revenue - cogs), knownCost,
    users: users.length, newUsers: users.filter((u) => new Date(u.createdAt).getTime() >= from).length,
    subs: subs.length, optins: new Set([...subs.map((s) => s.email), ...users.filter((u) => u.optin).map((u) => u.email)]).size,
    buyers, repeat, repeatRate: buyers ? Math.round((repeat / buyers) * 100) : 0,
    countries, regions, topProducts, shop, cat, byDay, byHour, series,
    honeyOrders: honeyOrders.length, offerUsed,
  };
}

function timeline(paid, period) {
  const monthly = period === "365" || period === "all";
  const buckets = new Map();
  const key = (d) => (monthly ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : d.toISOString().slice(0, 10));
  const n = monthly ? (period === "all" ? 12 : 12) : Number(period) > 30 ? 13 : Number(period);
  const weekly = !monthly && Number(period) > 30;
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    if (monthly) { d.setDate(1); d.setMonth(d.getMonth() - i); }
    else if (weekly) d.setDate(d.getDate() - i * 7);
    else d.setDate(d.getDate() - i);
    buckets.set(weekly ? i : key(d), { label: monthly ? d.toLocaleDateString("fr-FR", { month: "short" }) : weekly ? `S-${i}` : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), value: 0 });
  }
  paid.forEach((o) => {
    const d = new Date(o.at);
    const k = weekly ? Math.floor((now - d) / (7 * 864e5)) : key(d);
    const b = buckets.get(k); if (b) b.value += o.totalEur;
  });
  return [...buckets.values()].map((b) => ({ ...b, value: round(b.value) }));
}

/* ---------- Pistes stratégiques ---------- */
export function insights(s, products) {
  const out = [];
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  if (s.pending.length) out.push({ tone: "urgent", text: `${s.pending.length} commande${s.pending.length > 1 ? "s attendent" : " attend"} ta confirmation. Un client confirmé vite est un client qui revient.` , go: "commandes" });
  const liveCount = s.countries.reduce((a, c) => a + c.orders, 0);
  const foreign = s.countries.filter((c) => c.key !== "FR");
  if (foreign[0] && pct(foreign[0].orders, liveCount) >= 8) {
    out.push({ tone: "idee", text: `${foreign[0].name} pèse ${pct(foreign[0].orders, liveCount)} % de tes commandes. Une story dans sa langue et une offre de livraison dédiée pourraient doubler ce marché.` });
  }
  if (s.regions[0] && s.regions.length > 1) out.push({ tone: "idee", text: `En France, ${s.regions[0].name} arrive en tête (${s.regions[0].orders} commandes). Cible cette région en priorité dans tes publicités Snap.` });
  const maxDay = s.byDay.indexOf(Math.max(...s.byDay));
  const maxHour = s.byHour.indexOf(Math.max(...s.byHour));
  if (s.orders.length >= 8) out.push({ tone: "idee", text: `Tes clients commandent surtout le ${DAYS[maxDay]}, vers ${maxHour} h. Programme tes stories une heure avant pour arriver au bon moment.` });
  if (OFFER.active && s.honeyOrders >= 5) {
    const r = pct(s.offerUsed, s.honeyOrders);
    out.push(r >= 30
      ? { tone: "bien", text: `L'offre 3+1 fonctionne : ${r} % des commandes de miel en profitent. Garde-la, c'est ton meilleur levier.` }
      : { tone: "idee", text: `Seulement ${r} % des commandes de miel atteignent l'offre 3+1. Mets-la davantage en avant sur la fiche produit et dans le panier.` });
  }
  if (s.buyers >= 10 && s.repeatRate < 25) out.push({ tone: "idee", text: `${s.repeatRate} % de tes clients ont recommandé. Envoie une offre de retour aux ${s.optins} personnes inscrites à tes offres.` });
  if (s.buyers >= 10 && s.repeatRate >= 25) out.push({ tone: "bien", text: `${s.repeatRate} % de tes clients reviennent : ta clientèle est fidèle. Pense à un programme « client privilégié ».` });
  const totalShop = s.shop.lui + s.shop.elle;
  if (totalShop > 0) {
    const elle = pct(s.shop.elle, totalShop);
    if (elle < 35) out.push({ tone: "idee", text: `La boutique Pour elle ne représente que ${elle} % des ventes. Un coup de cœur mis en avant et une story dédiée peuvent rééquilibrer.` });
  }
  if (s.basket && s.basket < 25) out.push({ tone: "idee", text: `Panier moyen de ${s.basket.toFixed(2).replace(".", ",")} €. Un coffret découverte autour de 29 € pourrait le faire monter.` });
  /* Couverture du stock au rythme actuel */
  const days = s.period === "all" ? 120 : Number(s.period);
  s.topProducts.slice(0, 8).forEach((tp) => {
    const p = products.find((x) => x.id === tp.id);
    if (!p || !tp.qty) return;
    const perDay = tp.qty / days;
    const left = Math.floor((p.stock || 0) / perDay);
    if (left < 14) out.push({ tone: left < 5 ? "urgent" : "stock", text: `${p.name} : environ ${left} jour${left > 1 ? "s" : ""} de stock au rythme actuel (${p.stock} restants). Pense à recommander.`, go: "produits" });
  });
  if (s.knownCost && s.revenue) out.push({ tone: "bien", text: `Marge brute estimée : ${pct(s.margin, s.revenue)} % sur la période.` });
  if (!out.length) out.push({ tone: "idee", text: "Pas encore assez de commandes pour des conseils fiables. Ils apparaîtront ici au fil des ventes." });
  return out;
}

/* ---------- Comptabilité (micro-entreprise) ---------- */
export function ledger(year) {
  return allOrders()
    .filter((o) => PAID.includes(o.status) && new Date(o.paidAt || o.at).getFullYear() === year)
    .sort((a, b) => (a.paidAt || a.at).localeCompare(b.paidAt || b.at));
}

export function monthly(year) {
  const m = Array.from({ length: 12 }, (_, i) => ({ month: i, revenue: 0, count: 0 }));
  ledger(year).forEach((o) => { const i = new Date(o.paidAt || o.at).getMonth(); m[i].revenue += o.totalEur; m[i].count++; });
  return m.map((x) => ({ ...x, revenue: round(x.revenue) }));
}

export function csv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
}

export const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
};
