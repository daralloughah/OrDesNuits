/* =========================================================
   Le QG : la console du gérant façon jeu de stratégie.
   Tout est calculé à partir des vraies données (commandes,
   stock, affiliés, inscrits) : ressources, rang de la Maison,
   missions, carte des territoires, hauts faits, généraux,
   conseillers. Aucune donnée inventée.
   ========================================================= */
import * as A from "./analytics.js";
import * as AF from "./affiliates.js";
import { growthTeaser } from "./growth.js";
import { esc } from "../core/util.js";
import { flag } from "../core/places.js";
import { allOrders } from "../core/backend.js";

const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v || 0);
const nb = (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const compact = (v) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);
const DAY = 864e5;

/* ---------- Icônes (traits dorés) ---------- */
const I = {
  or: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/></svg>',
  cmd: '<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8M12 12v8"/></svg>',
  infl: '<svg viewBox="0 0 24 24"><path d="M4 18l3-9 5 5 5-8 3 12z"/><circle cx="12" cy="4" r="1.4"/></svg>',
  res: '<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M8 9V6a4 4 0 018 0v3"/></svg>',
  rank: '<svg viewBox="0 0 24 24"><path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.8 6.5 19.5l1-6.3L3 8.9 9 8z"/></svg>',
  quest: '<svg viewBox="0 0 24 24"><path d="M6 3h10l2 3-2 3H6zM6 3v18"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M12 2l8.7 5v10L12 22l-8.7-5V7z"/></svg>',
};

/* Gouvernail (dessin original) */
const HELM = `<svg class="qg-helm" viewBox="0 0 200 200" aria-hidden="true">
  <g stroke="currentColor" fill="none">
    <circle cx="100" cy="100" r="66" stroke-width="9"/><circle cx="100" cy="100" r="66" stroke-width="1.2" stroke="#fff1c9" opacity=".5"/>
    <circle cx="100" cy="100" r="58" stroke-width="1.5" opacity=".6"/>
    ${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4, c = Math.cos(a), s2 = Math.sin(a);
      return `<line x1="${100 + c * 30}" y1="${100 + s2 * 30}" x2="${100 + c * 86}" y2="${100 + s2 * 86}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${100 + c * 92}" cy="${100 + s2 * 92}" r="6.5" fill="currentColor"/>`; }).join("")}
  </g></svg>`;
/* Rose des vents */
export const COMPASS = `<svg class="qg-compass" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="50" cy="50" r="44" stroke-width=".8"/><circle cx="50" cy="50" r="38" stroke-width=".4" stroke-dasharray="1 3"/></g>
  <g fill="currentColor"><path d="M50 4l5 46-5 4-5-4z"/><path d="M50 96l-5-46 5-4 5 4z" opacity=".55"/><path d="M96 50l-46 5-4-5 4-5z" opacity=".55"/><path d="M4 50l46-5 4 5-4 5z" opacity=".55"/></g>
  <text x="50" y="16" text-anchor="middle" font-size="9" fill="currentColor" font-family="serif">N</text></svg>`;

/* ---------- Rangs de la Maison ---------- */
export const RANKS = [
  [0, "Atelier"], [1000, "Comptoir"], [5000, "Boutique"], [20000, "Maison"], [60000, "Grande Maison"],
  [150000, "Manufacture"], [400000, "Maison Royale"], [1000000, "Empire"], [3000000, "Dynastie"], [10000000, "Légende"], [30000000, "Mythe"], [100000000, "Éternel"],
]
export function rankOf(xp) {
  let i = 0;
  while (i < RANKS.length - 1 && xp >= RANKS[i + 1][0]) i++;
  const [from, name] = RANKS[i];
  const next = RANKS[i + 1];
  return { level: i + 1, name, xp, from, next: next?.[0] ?? null, nextName: next?.[1] ?? null, pct: next ? Math.min(100, ((xp - from) / (next[0] - from)) * 100) : 100 };
}

/* ---------- Quête ultime : 30 M€ de chiffre d'affaires par an ---------- */
export const ULTIMATE = 30000000;
export const TITLES = [
  [0, "Mousse", "Le voyage commence."],
  [100000, "Marchand", "100 k€ par an : la Maison vit de son commerce."],
  [250000, "Négociant", "250 k€ par an : le comptoir déborde."],
  [500000, "Armateur", "500 k€ par an : ta propre flotte prend la mer."],
  [1000000, "Baron", "1 M€ par an : le cap du million."],
  [2500000, "Comte", "2,5 M€ par an : une marque qui compte."],
  [5000000, "Duc", "5 M€ par an : un duché commercial."],
  [10000000, "Prince", "10 M€ par an : prince du négoce."],
  [20000000, "Roi", "20 M€ par an : un royaume."],
  [30000000, "Calife des Mille et une Nuits", "30 M€ par an : la quête ultime est accomplie."],
];
export function titleOf(year) {
  let i = 0;
  while (i < TITLES.length - 1 && year >= TITLES[i + 1][0]) i++;
  return { i, name: TITLES[i][1], next: TITLES[i + 1] || null };
}

/* ---------- Bénéfice réel depuis le début ----------
   Exact quand les coûts sont connus (coût d'achat saisi sur les produits,
   commissions des affiliés), estimé sinon (réglages de Croissance et Compta). */
export function profit(products, all, affStats) {
  let g = {}, c = {};
  try { g = { margin: 65, ship: 6, fees: 2, budget: 300, ...JSON.parse(localStorage.getItem("odn.growth") || "{}") }; } catch {}
  try { c = { urssaf: 12.3, ...JSON.parse(localStorage.getItem("odn.compta") || "{}") }; } catch {}
  const paid = all.paid;
  let known = 0, est = 0;
  const cogs = paid.reduce((s, o) => s + o.lines.reduce((a, l) => {
    const p = products.find((x) => x.id === l.id);
    const line = (l.lineEur ?? l.unitEur * l.qty);
    if (p?.cost) { known++; return a + p.cost * l.qty; }
    est++; return a + line * (1 - (Number(g.margin) || 65) / 100);
  }, 0), 0);
  const ship = paid.length * (Number(g.ship) || 0);
  const fees = all.revenue * (Number(g.fees) || 0) / 100;
  const comm = affStats.reduce((s, r) => s + r.s.earned, 0);
  const first = paid.length ? Math.min(...paid.map((o) => new Date(o.at).getTime())) : Date.now();
  const months = Math.max(1, (Date.now() - first) / (30.4 * DAY));
  const ads = months * (Number(g.budget) || 0);
  const urssaf = all.revenue * (Number(c.urssaf) || 0) / 100;
  const net = all.revenue - cogs - ship - fees - comm - ads - urssaf;
  return { revenue: all.revenue, cogs, ship, fees, comm, ads, urssaf, net, rate: all.revenue ? net / all.revenue : 0, exactCost: est === 0 && known > 0, months };
}

/* ---------- Territoires (carte de France en alvéoles) ---------- */
const HEX = [
  // [code, nom court, x (en demi-colonnes), rangée]
  ["DOM", "Outre-mer", 0, 0], ["HDF", "Nord", 3, 0],
  ["NOR", "Normandie", 1.5, 1], ["IDF", "Île-de-Fr.", 2.5, 1], ["GES", "Grand Est", 3.5, 1],
  ["BRE", "Bretagne", 0, 2], ["PDL", "Loire", 1, 2], ["CVL", "Centre", 2, 2], ["BFC", "Bourgogne", 3, 2],
  ["NAQ", "Aquitaine", 1.5, 3], ["ARA", "Rhône-Alpes", 2.5, 3],
  ["OCC", "Occitanie", 2, 4], ["PAC", "Provence", 3, 4], ["COR", "Corse", 4.1, 4.15],
];
export const TERR = [[0, "Brouillard", "fog"], [1, "Avant-poste", "l1"], [3, "Comptoir", "l2"], [10, "Bastion", "l3"], [30, "Capitale", "l4"]];
const terr = (n) => { let t = TERR[0]; for (const x of TERR) if (n >= x[0]) t = x; return t; };

function hexMap(regions) {
  const by = Object.fromEntries(regions.map((r) => [r.key, r]));
  const R = 34, w = Math.sqrt(3) * R, pad = 6;
  const pts = (cx, cy) => Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 180) * (60 * k - 90); return `${(cx + (R - 2) * Math.cos(a)).toFixed(1)},${(cy + (R - 2) * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const W = w * 5 + pad * 2, H = R * 1.5 * 4 + R * 2 + pad * 2;
  return `<svg class="qg-hexmap" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="Carte des territoires">
    ${HEX.map(([k, label, x, row]) => {
      const cx = pad + w / 2 + x * w, cy = pad + R + row * R * 1.5;
      const r = by[k]; const n = r?.orders || 0; const t = terr(n);
      return `<g class="hx ${t[2]}" data-terr="${k}"><title>${esc(r?.name || label)} : ${n} commande${n > 1 ? "s" : ""} · ${t[1]}${r ? ` · ${eur(r.revenue)}` : ""}</title>
        <polygon points="${pts(cx, cy)}"/>
        <text x="${cx}" y="${cy - 3}" text-anchor="middle" class="hx-l">${esc(label)}</text>
        <text x="${cx}" y="${cy + 12}" text-anchor="middle" class="hx-n">${n ? nb(n) : "?"}</text></g>`;
    }).join("")}
  </svg>`;
}

/* ---------- Toutes les données du QG ---------- */
let memo = { t: 0, n: -1, v: null };
export function state(products) {
  const n = allOrders().length + AF.all().length * 1e6;
  if (memo.v && memo.n === n && Date.now() - memo.t < 3000) return memo.v;
  memo = { t: Date.now(), n, v: computeState(products) };
  return memo.v;
}
function computeState(products) {
  const m = A.compute("30", products);
  const all = A.compute("all", products);
  const w = A.compute("7", products);
  const affs = AF.all();
  const aStats = affs.map((a) => ({ a, s: AF.stats(a) }));
  const followers = aStats.reduce((s, r) => s + r.s.followers, 0);
  const activeAff = affs.filter((a) => a.status === "actif").length;
  const stale = aStats.filter((r) => r.a.status === "actif" && Date.now() - AF.lastUpdate(r.a) > 14 * DAY);
  const stock = products.filter((p) => p.active !== false);
  const low = stock.filter((p) => p.stock > 0 && p.stock <= (p.lowAt ?? 5)), out = stock.filter((p) => (p.stock || 0) <= 0);
  const stockValue = stock.reduce((s, p) => s + (p.stock || 0) * (p.cost || p.price || 0), 0);
  const xp = Math.round(all.revenue + all.count * 20);
  let g = { goal: 0, month: 0 };
  try { g = growthTeaser(products); } catch {}
  const metroRegions = all.regions.filter((r) => r.key !== "DOM").length;
  /* Semaines (lundi → dimanche) et jours : records et semaine en cours */
  const paid = allOrders().filter((o) => A.PAID.includes(o.status) || o.status === "nouvelle");
  const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };
  const weeks = {}, days = {};
  paid.forEach((o) => { const k = monday(o.at); weeks[k] = (weeks[k] || 0) + 1; const dk = o.at.slice(0, 10); days[dk] ||= { n: 0, rev: 0 }; days[dk].n++; days[dk].rev += o.totalEur; });
  const thisWeek = weeks[monday(Date.now())] || 0;
  const bestWeek = Math.max(0, ...Object.values(weeks));
  const todayK = new Date().toISOString().slice(0, 10);
  const today = days[todayK] || { n: 0, rev: 0 };
  const bestDay = Math.max(0, ...Object.values(days).map((x) => x.n));
  const weekDay = ((new Date().getDay() + 6) % 7) + 1; // 1 = lundi
  const y = A.compute("365", products);
  const pr = profit(products, all, aStats);
  return { y, pr, title: titleOf(y.revenue), weeks: { thisWeek, bestWeek, weekDay }, today, bestDay, m, all, w, affs, aStats, followers, activeAff, stale, low, out, stockValue, xp, rank: rankOf(xp), goal: g, metroRegions };
}

/* ---------- Bandeau de ressources (sur toutes les pages du Salon) ---------- */
export function hud(st) {
  const d = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  const chg = (v) => `<em class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"}${Math.abs(v)}%</em>`;
  const warn = st.out.length + st.low.length;
  return `<div class="qg-hud" role="status">
    <button type="button" class="res" data-view="compta" title="Or : chiffre d'affaires encaissé sur 30 jours">${I.or}<span><small>Or · 30 j</small><b>${eur(st.m.revenue)}</b></span>${chg(d(st.m.revenue, st.m.prevRevenue))}</button>
    <button type="button" class="res" data-view="commandes" title="Commandes payées sur 30 jours">${I.cmd}<span><small>Commandes</small><b>${nb(st.m.count)}</b></span>${st.m.pending.length ? `<i class="alert">${st.m.pending.length}</i>` : ""}</button>
    <button type="button" class="res" data-view="affilies" title="Influence : abonnés cumulés de tes affiliés">${I.infl}<span><small>Influence</small><b>${compact(st.followers)}</b></span></button>
    <button type="button" class="res ${warn ? "warn" : ""}" data-view="produits" title="Réserves : valeur du stock">${I.res}<span><small>Réserves</small><b>${compact(st.stockValue)} €</b></span>${warn ? `<i class="alert">${warn}</i>` : ""}</button>
    <button type="button" class="res rank" data-view="qg" title="Rang de la Maison">${I.rank}<span><small>Niv. ${st.rank.level} · ${esc(st.rank.name)}</small><i class="xp"><i style="width:${st.rank.pct.toFixed(1)}%"></i></i></span></button>
  </div>`;
}

/* ---------- Missions ---------- */
function missions(st) {
  const out = [];
  const step = (v, steps) => steps.find((s) => v < s) ?? null;
  if (st.m.pending.length) out.push({ tone: "urgent", t: "Honorer les commandes", d: `${st.m.pending.length} client${st.m.pending.length > 1 ? "s attendent" : " attend"} ta confirmation.`, cur: 0, goal: st.m.pending.length, go: "commandes", r: "Fidélité ↑" });
  if (st.out.length + st.low.length) out.push({ tone: "urgent", t: "Ravitailler les réserves", d: `${st.out.length} épuisé${st.out.length > 1 ? "s" : ""}, ${st.low.length} presque vide${st.low.length > 1 ? "s" : ""}.`, cur: 0, goal: st.out.length + st.low.length, go: "produits", r: "Ventes protégées" });
  { const nw = WEEK_TIERS.find((g) => st.weeks.thisWeek < g); if (nw) out.push({ tone: "main", t: "Défi de la semaine", d: `${nb(st.weeks.thisWeek)} commandes depuis lundi. Atteins ${nb(nw)} avant dimanche soir.`, cur: st.weeks.thisWeek, goal: nw, go: "qg", r: "Trophée" }); }
  if (st.goal.goal) out.push(st.goal.month >= st.goal.goal
    ? { tone: "main", t: "Objectif du mois atteint ✦", d: `${eur(st.goal.month)} encaissés pour un objectif de ${eur(st.goal.goal)}. Relève la barre dans Croissance : vise ${eur(Math.ceil(st.goal.month * 1.3 / 1000) * 1000)}.`, cur: 1, goal: 1, go: "croissance", r: "Nouvel objectif" }
    : { tone: "main", t: "Objectif du mois", d: `${eur(st.goal.month)} sur ${eur(st.goal.goal)} encaissés ce mois-ci.`, cur: st.goal.month, goal: st.goal.goal, go: "croissance", r: `+${nb(Math.round(st.goal.goal))} XP` });
  if (st.stale.length) out.push({ tone: "side", t: "Mettre à jour les renseignements", d: `Abonnés à actualiser : ${st.stale.slice(0, 3).map((r) => esc(r.a.name)).join(", ")}${st.stale.length > 3 ? "…" : ""}.`, cur: 0, goal: st.stale.length, go: "affilies", r: "Carte à jour" });
  const nA = step(st.activeAff, [1, 3, 5, 10, 25, 50]);
  if (nA) out.push({ tone: "side", t: "Recruter l'équipage", d: `${st.activeAff} affilié${st.activeAff > 1 ? "s" : ""} actif${st.activeAff > 1 ? "s" : ""}. Prochain palier : ${nA}.`, cur: st.activeAff, goal: nA, go: "affilies", r: "Influence ↑" });
  const nC = step(st.all.countries.length, [1, 3, 5, 10, 20]);
  if (nC) out.push({ tone: "side", t: "Conquérir de nouveaux ports", d: `${st.all.countries.length} pays conquis. Prochain palier : ${nC}.`, cur: st.all.countries.length, goal: nC, go: "atelier", r: "Nouveau territoire" });
  const nR = step(st.all.repeat, [5, 10, 25, 50, 100]);
  if (nR) out.push({ tone: "side", t: "Forger la fidélité", d: `${st.all.repeat} client${st.all.repeat > 1 ? "s" : ""} déjà revenu${st.all.repeat > 1 ? "s" : ""}. Objectif : ${nR}.`, cur: st.all.repeat, goal: nR, go: "clients", r: "Rente ↑" });
  const nO = step(st.all.optins, [10, 50, 100, 500, 1000, 5000]);
  if (nO) out.push({ tone: "side", t: "Élargir le cercle", d: `${st.all.optins} inscrit${st.all.optins > 1 ? "s" : ""} aux offres privées (avec accord). Objectif : ${nO}.`, cur: st.all.optins, goal: nO, go: "clients", r: "Portée ↑" });
  if (st.m.basket) { const target = Math.ceil((st.m.basket + 5) / 5) * 5; out.push({ tone: "side", t: "Remplir les coffres", d: `Panier moyen ${eur(st.m.basket)}. Vise ${eur(target)} avec les coffrets et l'option « Offrir ».`, cur: st.m.basket, goal: target, go: "salon", r: "Or ↑" }); }
  return out;
}

/* ---------- Hauts faits ---------- */
export const WEEK_TIERS = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000];
function feats(st) {
  const A2 = st.all;
  const list = [
    ["Première conquête", "1ʳᵉ commande payée", A2.count, 1],
    ...[[10, "Les dix"], [100, "La centurie"], [1000, "Le millier"], [5000, "La flotte"], [10000, "L'armada"], [50000, "La légion"], [100000, "Les cent mille"]].map(([g, t]) => [t, `${nb(g)} commandes`, A2.count, g]),
    ...[[1000, "Premier trésor"], [10000, "Coffre plein"], [50000, "Galion d'or"], [100000, "Fortune"], [500000, "Trésor royal"], [1000000, "Le million"], [10000000, "Dix millions"]].map(([g, t]) => [t, `${nb(g)} € encaissés`, A2.revenue, g]),
    ...WEEK_TIERS.map((g) => [`Semaine de ${nb(g)}`, `${nb(g)} commandes en une semaine`, st.weeks.bestWeek, g]),
    ...[[10, "Grand jour"], [50, "Jour de gloire"], [100, "Jour de légende"]].map(([g, t]) => [t, `${g} commandes en un jour`, st.bestDay, g]),
    ["Ambassadeur", "3 pays conquis", A2.countries.length, 3],
    ["Conquérant", "10 pays conquis", A2.countries.length, 10],
    ["Tour de France", "7 régions conquises", st.metroRegions, 7],
    ["Grand Chelem", "13 régions de métropole", st.metroRegions, 13],
    ["Premier matelot", "1 affilié actif", st.activeAff, 1],
    ["Équipage complet", "10 affiliés actifs", st.activeAff, 10],
    ["Voix forte", "100 k abonnés cumulés", st.followers, 100000],
    ["Voix d'empire", "1 M d'abonnés cumulés", st.followers, 1000000],
    ...[[10, "Clientèle fidèle"], [100, "Les habitués"], [1000, "Le cercle d'or"]].map(([g, t]) => [t, `${nb(g)} clients revenus`, A2.repeat, g]),
    ...[[100, "Le cercle"], [1000, "La foule"], [10000, "La nation"]].map(([g, t]) => [t, `${nb(g)} inscrits aux offres`, A2.optins, g]),
  ];
  return list.map(([t, d, v, g]) => ({ t, d, v, g, ok: v >= g, pct: Math.min(100, (v / g) * 100) }));
}

/* ---------- Conseillers ---------- */
const ADV = {
  urgent: ["Le Second", "S"], stock: ["Le Cambusier", "C"], bien: ["Le Trésorier", "T"], idee: ["Le Navigateur", "N"],
};

/* ---------- La vue ---------- */
export function qgView(root, { products, insights = [] }) {
  const st = state(products);
  const ms = missions(st);
  const fs = feats(st);
  const done = fs.filter((f) => f.ok).length;
  const shownFeats = [...fs.filter((f) => f.ok), ...fs.filter((f) => !f.ok).sort((a, b) => b.pct - a.pct).slice(0, 6)];
  /* La production : rythme moyen des 30 derniers jours, comme une ressource de jeu */
  const perSec = st.m.revenue / (30 * 86400), perDayN = st.m.count / 30;
  const wk = st.weeks, nextW = WEEK_TIERS.find((g) => wk.thisWeek < g) || WEEK_TIERS.at(-1) * 2;
  const projW = Math.round((wk.thisWeek / Math.max(1, wk.weekDay - 1 + new Date().getHours() / 24)) * 7);
  const gens = [...st.aStats].filter((r) => r.a.status !== "fin").sort((a, b) => b.s.month.rev - a.s.month.rev).slice(0, 3);
  const maxF = Math.max(1, ...gens.map((r) => r.s.followers)), maxK = Math.max(0.01, ...gens.map((r) => r.s.perK)), maxR = Math.max(1, ...gens.map((r) => r.s.month.rev));
  const bestRegion = st.w.regions[0], bestGen = [...st.aStats].sort((a, b) => b.s.week.rev - a.s.week.rev)[0];
  const h = new Date().getHours();

  root.innerHTML = `
  <header class="qg-head">
    <div class="qg-wheel">${HELM}<div class="qg-crest"><img src="assets/img/mono.webp" alt=""><b>${st.rank.level}</b></div></div>
    <div class="qg-title">
      <p class="eyebrow">${h < 6 ? "Quart de nuit" : h < 12 ? "Quart du matin" : h < 18 ? "Quart de l'après-midi" : "Quart du soir"} · Pont du capitaine</p>
      <h1 class="display">${esc(st.rank.name)}</h1>
      <div class="qg-xp"><i style="width:${st.rank.pct.toFixed(1)}%"></i></div>
      <p class="qg-xpl">${nb(st.xp)} XP${st.rank.next ? ` · ${nb(st.rank.next - st.xp)} XP avant <b>${esc(st.rank.nextName)}</b>` : " · rang ultime atteint"}<small> (1 € encaissé = 1 XP, chaque commande = 20 XP)</small></p>
    </div>
  </header>

  <section class="qg-treasure">
    <div><small>Trésor de la Maison · depuis le premier jour</small><b class="display" data-countup="${st.all.revenue}">${eur(0)}</b>
      <em>${nb(st.all.count)} commandes payées · ${nb(st.all.buyers)} clients</em></div>
  </section>

  ${(() => { const runRate = perSec * 86400 * 365, t = st.title, nx = t.next; const pctU = Math.min(100, (st.y.revenue / ULTIMATE) * 100);
    return `<section class="qg-ultimate">
    <div class="qu-top"><span class="qu-k">Quête ultime</span><b class="display">30 000 000 € par an</b></div>
    <div class="qu-bar"><i style="width:${Math.max(1, Math.log10(Math.max(1e4, st.y.revenue) / 1e4) / Math.log10(ULTIMATE / 1e4) * 100).toFixed(2)}%"></i>${TITLES.slice(1).map(([v, n]) => `<span class="qu-mark ${st.y.revenue >= v ? "won" : ""}" style="left:${(Math.log10(v / 1e4) / Math.log10(ULTIMATE / 1e4) * 100).toFixed(1)}%" title="${esc(n)} · ${eur(v)} / an"></span>`).join("")}</div>
    <p class="qu-txt">12 derniers mois : <b>${eur(st.y.revenue)}</b> · rythme actuel : <b>${eur(runRate)}</b> / an · ${pctU < 0.01 ? "&lt; 0,01" : pctU.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % de la quête</p>
    <div class="qu-title"><span>Ton titre</span><b class="display">${esc(t.name)}</b>${nx ? `<em>Prochain : <b>${esc(nx[1])}</b> à ${eur(nx[0])} / an · encore ${eur(Math.max(0, nx[0] - st.y.revenue))}</em>` : `<em>${esc(TITLES.at(-1)[2])}</em>`}</div>
    <ol class="qu-ladder">${TITLES.slice(1).map(([v, n, d], i) => `<li class="${st.y.revenue >= v ? "won" : i + 1 === t.i + 1 ? "now" : ""}"><i></i><b>${esc(n)}</b><small>${eur(v)} / an</small></li>`).join("")}</ol>
  </section>`; })()}

  <section class="qg-panel qg-profit">
    <div class="qg-ph">${I.or}<h2 class="display">Bénéfice depuis le début</h2><small>${st.pr.exactCost ? "coûts réels" : "en partie estimé"}</small></div>
    <b class="pf-net display ${st.pr.net < 0 ? "neg" : ""}">${eur(st.pr.net)}</b>
    <p class="pf-rate">soit <b>${Math.round(st.pr.rate * 100)} %</b> du chiffre d'affaires, sur ${Math.round(st.pr.months)} mois</p>
    <details class="pf-det"><summary>Le détail du calcul</summary>
      <ul>
        <li><span>Chiffre d'affaires encaissé</span><b>${eur(st.pr.revenue)}</b></li>
        <li><span>− Coût d'achat des produits${st.pr.exactCost ? "" : " (estimé si coût non saisi)"}</span><b>${eur(-st.pr.cogs)}</b></li>
        <li><span>− Envois (par commande, réglage Croissance)</span><b>${eur(-st.pr.ship)}</b></li>
        <li><span>− Frais de paiement</span><b>${eur(-st.pr.fees)}</b></li>
        <li><span>− Commissions des affiliés</span><b>${eur(-st.pr.comm)}</b></li>
        <li><span>− Publicité (budget mensuel × mois)</span><b>${eur(-st.pr.ads)}</b></li>
        <li><span>− Cotisations URSSAF</span><b>${eur(-st.pr.urssaf)}</b></li>
        <li class="tot"><span>= Bénéfice</span><b>${eur(st.pr.net)}</b></li>
      </ul>
      <p class="at-hint">Pour un bénéfice 100 % réel : saisis le coût d'achat de chaque produit (Produits → fiche), tes frais d'envoi et ton budget pub (Croissance), ton taux URSSAF (Compta).</p>
    </details>
  </section>

  <section class="qg-panel qg-forge">
    <div class="qg-ph">${I.or}<h2 class="display">La production</h2><small>rythme des 30 derniers jours</small></div>
    <div class="forge-main">
      <span class="forge-l">Produit aujourd'hui au rythme moyen</span>
      <b class="forge-tick display" id="forgeTick" data-rate="${perSec}">${eur(0)}</b>
      <span class="forge-real">Réel aujourd'hui : <b>${eur(st.today.rev)}</b> · ${nb(st.today.n)} commande${st.today.n > 1 ? "s" : ""}</span>
    </div>
    <div class="forge-rates">
      <div><b>${perSec >= 0.1 ? perSec.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : perSec.toLocaleString("fr-FR", { maximumFractionDigits: 4 })} €</b><small>par seconde</small></div>
      <div><b>${eur(perSec * 3600)}</b><small>par heure</small></div>
      <div><b>${eur(perSec * 86400)}</b><small>par jour</small></div>
      <div><b>${perDayN.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</b><small>commandes / jour${perDayN ? ` · 1 toutes les ${Math.max(1, Math.round(1440 / perDayN))} min` : ""}</small></div>
    </div>
    <p class="forge-proj">À ce rythme : <b>${eur(perSec * 86400 * 30)}</b> par mois, <b>${eur(perSec * 86400 * 365)}</b> par an.</p>
  </section>

  <section class="qg-panel qg-defis">
    <div class="qg-ph">${I.rank}<h2 class="display">Défis de la semaine</h2><small>jour ${wk.weekDay} / 7</small></div>
    <div class="defi">
      <div class="defi-top"><b>${nb(wk.thisWeek)} commandes cette semaine</b><em>palier ${nb(nextW)}</em></div>
      <div class="qm-bar big"><i style="width:${Math.min(100, (wk.thisWeek / nextW) * 100).toFixed(1)}%"></i></div>
      <p>Encore <b>${nb(Math.max(0, nextW - wk.thisWeek))}</b> pour décrocher le trophée « Semaine de ${nb(nextW)} ». Projection à dimanche : <b>${nb(projW)}</b>${projW >= nextW ? " ✦ en route pour le réussir" : ""}. Record : <b>${nb(wk.bestWeek)}</b>.</p>
    </div>
    <ol class="defi-ladder">${WEEK_TIERS.map((g) => `<li class="${wk.bestWeek >= g ? "won" : ""} ${g === nextW ? "now" : ""}"><i></i><span>${nb(g)}</span></li>`).join("")}</ol>
    <div class="defi day"><div class="defi-top"><b>Aujourd'hui : ${nb(st.today.n)} commande${st.today.n > 1 ? "s" : ""}</b><em>record ${nb(st.bestDay)}</em></div>
      <div class="qm-bar"><i style="width:${Math.min(100, (st.today.n / Math.max(1, st.bestDay)) * 100).toFixed(1)}%"></i></div></div>
  </section>

  <section class="qg-report parchment">
    <span class="eyebrow">Journal de bord · 7 derniers jours</span>
    <p>${st.w.count ? `${nb(st.w.count)} commande${st.w.count > 1 ? "s" : ""} pour ${eur(st.w.revenue)}${bestRegion ? `, cap le plus actif : <b>${esc(bestRegion.name)}</b>` : ""}${bestGen && bestGen.s.week.rev ? `, meilleur second : <b>${esc(bestGen.a.name)}</b> (${eur(bestGen.s.week.rev)})` : ""}.` : "Mer d'huile cette semaine : aucune commande. Hisse les voiles avec une campagne depuis l'Atelier."}</p>
  </section>

  <div class="qg-grid">
    <section class="qg-panel">
      <div class="qg-ph">${I.quest}<h2 class="display">Cap du jour</h2><small>${ms.length} en cours</small></div>
      <ul class="qg-missions">${ms.map((q) => `
        <li class="${q.tone}" ${q.go ? `data-view="${q.go}"` : ""}>
          <div class="qm-top"><b>${esc(q.t)}</b><em>${esc(q.r)}</em></div>
          <p>${q.d}</p>
          ${q.tone === "urgent" ? `<span class="qm-cta">Agir →</span>` : `<div class="qm-bar"><i style="width:${Math.min(100, (q.cur / q.goal) * 100).toFixed(1)}%"></i></div><small>${q.goal >= 100 ? `${nb(q.cur)} / ${nb(q.goal)}` : `${Math.round(q.cur * 100) / 100} / ${q.goal}`}</small>`}
        </li>`).join("")}</ul>
    </section>

    <section class="qg-panel map-panel">
      ${COMPASS}
      <div class="qg-ph">${I.map}<h2 class="display">Carte au trésor</h2><small>${st.metroRegions} / 13 régions · ${st.all.countries.length} pays</small></div>
      ${hexMap(st.all.regions)}
      <div class="qg-legend">${TERR.map(([n, l, c]) => `<span class="${c}"><i></i>${l}${n ? ` (${n}+)` : ""}</span>`).join("")}</div>
      ${st.all.countries.length ? `<h3 class="mini-h">Ports conquis</h3><ul class="qg-flags">${st.all.countries.slice(0, 12).map((c) => { const t = terr(c.orders); return `<li class="${t[2]}" title="${esc(c.name)} · ${t[1]}">${flag(c.key)}<span>${esc(c.name)}</span><b>${nb(c.orders)}</b></li>`; }).join("")}</ul>` : ""}
    </section>
  </div>

  <section class="qg-panel">
    <div class="qg-ph">${I.infl}<h2 class="display">L'équipage</h2><small>${st.activeAff} actif${st.activeAff > 1 ? "s" : ""} · ${compact(st.followers)} d'influence</small></div>
    ${gens.length ? `<div class="qg-gens">${gens.map(({ a, s }, i) => `
      <article class="qg-gen ${s.tier}" data-view="affilies">
        <span class="g-rank">${["I", "II", "III"][i]}</span>
        <i class="tk-av">${esc((a.name || a.code).slice(0, 1))}</i>
        <b>${esc(a.name)}</b><small>${esc(a.handle || a.code)} · ${s.tier === "or" ? "Or" : s.tier === "argent" ? "Argent" : "Bronze"}</small>
        <dl>
          <dt>Influence</dt><dd><i style="width:${(s.followers / maxF * 100).toFixed(0)}%"></i><span>${compact(s.followers)}</span></dd>
          <dt>Précision</dt><dd><i style="width:${(s.perK / maxK * 100).toFixed(0)}%"></i><span>${s.perK.toLocaleString("fr-FR")} / 10 k</span></dd>
          <dt>Butin 30 j</dt><dd><i style="width:${(s.month.rev / maxR * 100).toFixed(0)}%"></i><span>${eur(s.month.rev)}</span></dd>
        </dl>
      </article>`).join("")}</div>` : `<p class="at-hint">Personne à bord pour l'instant. Recrute ton premier affilié dans l'onglet Affiliés.</p>`}
  </section>

  <div class="qg-grid">
    <section class="qg-panel">
      <div class="qg-ph">${I.rank}<h2 class="display">Trophées</h2><small>${done} / ${fs.length}</small></div>
      <ul class="qg-feats">${shownFeats.map((f) => `<li class="${f.ok ? "ok" : ""}" title="${esc(f.d)}"><span class="fh"><svg viewBox="0 0 40 46"><path d="M20 2l17 10v22L20 44 3 34V12z"/></svg><i>${f.ok ? "✦" : Math.floor(f.pct) + "%"}</i></span><b>${esc(f.t)}</b><small>${esc(f.d)}</small></li>`).join("")}</ul>
    </section>
    <section class="qg-panel">
      <div class="qg-ph">${I.quest}<h2 class="display">Conseil des officiers</h2><small>tes officiers parlent</small></div>
      <ul class="qg-advice">${insights.slice(0, 5).map((x) => { const [n, l] = ADV[x.tone] || ADV.idee; return `<li class="${x.tone}" ${x.go ? `data-view="${x.go}"` : ""}><span class="adv">${l}</span><div><b>${n}</b><p>${esc(x.text)}</p></div></li>`; }).join("")}</ul>
    </section>
  </div>`;
}

/* Compteurs vivants : le trésor qui monte, la production qui tourne */
let tickT = null, lastTreasure = null;
export function startTickers(root) {
  clearInterval(tickT);
  const c = root.querySelector("[data-countup]");
  if (c) {
    const target = Number(c.dataset.countup) || 0, t0 = performance.now(), dur = target === lastTreasure ? 0 : 1600;
    lastTreasure = target;
    const step = (t) => { const k = dur ? Math.min(1, (t - t0) / dur) : 1; c.textContent = eur(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const f = root.querySelector("#forgeTick");
  if (!f) return;
  const rate = Number(f.dataset.rate) || 0;
  const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paint = () => {
    if (!f.isConnected) { clearInterval(tickT); return; }
    const d = new Date(), mid = new Date(d); mid.setHours(0, 0, 0, 0);
    f.textContent = fmt.format(rate * ((d - mid) / 1000));
  };
  paint();
  tickT = setInterval(paint, 100);
}

/* Montée de rang : petite cérémonie, une seule fois par rang */
export function checkRankUp(st) {
  document.body.dataset.title = st.title.i;
  let lt = -1;
  try { lt = Number(localStorage.getItem("odn.title") ?? -1); localStorage.setItem("odn.title", st.title.i); } catch {}
  if (lt >= 0 && st.title.i > lt) {
    const el = document.createElement("div");
    el.className = "qg-levelup title";
    el.innerHTML = `<div><img src="assets/img/mono.webp" alt=""><small>Nouveau titre</small><b class="display">${esc(st.title.name)}</b><em>${esc(TITLES[st.title.i][2])}</em></div>`;
    el.addEventListener("click", () => el.remove());
    document.body.append(el);
    setTimeout(() => el.remove(), 5000);
    return;
  }
  let last = 0;
  try { last = Number(localStorage.getItem("odn.rank")) || 0; } catch {}
  try { localStorage.setItem("odn.rank", st.rank.level); } catch {}
  if (!last || st.rank.level <= last) return;
  const el = document.createElement("div");
  el.className = "qg-levelup";
  el.innerHTML = `<div><img src="assets/img/mono.webp" alt=""><small>Nouveau rang</small><b class="display">${esc(st.rank.name)}</b><em>Niveau ${st.rank.level}</em></div>`;
  el.addEventListener("click", () => el.remove());
  document.body.append(el);
  try { navigator.vibrate?.([20, 60, 30]); } catch {}
  setTimeout(() => el.remove(), 4200);
}
