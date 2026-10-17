/* =========================================================
   Affiliés : fiches, abonnés, ventes, commissions, relevés.
   EN LIGNE : table Supabase « affiliates » (réservée au gérant).
   APERÇU   : gardé sur l'appareil.
   Les ventes viennent des commandes passées avec le code
   de l'affilié (lien ?ref=CODE).
   ========================================================= */
import { enabled, rest } from "../core/sb.js";
import { allOrders } from "../core/backend.js";
import { PAID } from "./analytics.js";
import * as OFF from "./offline.js";

const KEY = "odn.affiliates";
let list = null;
const r2 = (v) => Math.round(v * 100) / 100;
/* CA commissionnable : produits après remises (hors livraison et emballage cadeau) */
export const revOf = (o) => (o.subtotalEur != null ? o.subtotalEur - (o.discountEur || 0) : o.totalEur) || 0;
const DAY = 864e5;

export const SECTORS = { beaute: "Beauté", mode: "Mode", lifestyle: "Lifestyle", couple: "Couple & relations", fitness: "Sport & fitness", humour: "Humour", food: "Cuisine", musique: "Musique", nuit: "Nuit & événements", boutique: "Boutique / commerce", autre: "Autre" };
export const NETWORKS = ["Snapchat", "TikTok", "Instagram", "YouTube", "Facebook", "X", "Autre"];
export const STATUS = { actif: "Actif", pause: "En pause", fin: "Contrat terminé" };

/* ---------- Stockage ---------- */
export async function load() {
  if (enabled) {
    try {
      if (!OFF.online()) throw Object.assign(new Error("network"), { status: 0 });
      const rows = await rest("affiliates", "select=*&order=updated_at.desc&limit=500");
      list = rows.map((r) => ({ ...r.data, id: r.id }));
      OFF.saveSnap({ affiliates: list });
    } catch (x) {
      if (!OFF.isNetErr(x)) throw x;
      list = OFF.loadSnap()?.affiliates || [];
    }
    for (const op of OFF.queue()) if (op.type === "aff" && !op.failed) put(op.a);
    return list;
  }
  try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch { list = []; }
  return list;
}
export const all = () => list || [];
export const find = (id) => all().find((a) => a.id === id);
function put(a) { const i = all().findIndex((x) => x.id === a.id); if (i >= 0) list[i] = a; else list.unshift(a); }

export async function save(a) {
  a.code = String(a.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
  a.id ||= a.code || "AFF" + Date.now().toString(36);
  put(a);
  if (!enabled) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; } }
  OFF.saveSnap({ affiliates: list });
  try {
    if (!OFF.online()) throw Object.assign(new Error("network"), { status: 0 });
    await replay({ a });
    return true;
  } catch (x) {
    if (!OFF.isNetErr(x)) return false;
    OFF.enqueue({ type: "aff", a: structuredClone(a) });
    return "queued";
  }
}
export async function replay(op) {
  await rest("affiliates", "on_conflict=id", { method: "POST", body: { id: op.a.id, data: op.a, updated_at: new Date().toISOString() }, headers: { Prefer: "resolution=merge-duplicates,return=minimal" } });
}
export async function remove(id) {
  list = all().filter((a) => a.id !== id);
  if (!enabled) { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
  try { await rest("affiliates", `id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }); return true; } catch { return false; }
}

/* ---------- Abonnés ---------- */
export const lastCount = (n) => (n.hist?.length ? n.hist[n.hist.length - 1].n : 0);
export const followers = (a) => (a.networks || []).reduce((s, n) => s + lastCount(n), 0);
/* abonnés à une date donnée (dernière valeur connue avant cette date) */
export function followersAt(a, t) {
  return (a.networks || []).reduce((s, n) => {
    const h = (n.hist || []).filter((x) => new Date(x.at).getTime() <= t);
    return s + (h.length ? h[h.length - 1].n : 0);
  }, 0);
}
export function lastUpdate(a) {
  const ts = (a.networks || []).flatMap((n) => (n.hist || []).map((x) => new Date(x.at).getTime()));
  return ts.length ? Math.max(...ts) : 0;
}
export function addCount(a, netIndex, n) {
  const net = a.networks[netIndex];
  net.hist ||= [];
  net.hist.push({ at: new Date().toISOString(), n: Math.max(0, Math.round(n)) });
}

/* ---------- Ventes ---------- */
export function sales(a) {
  return allOrders().filter((o) => o.display?.ref && o.display.ref.toUpperCase() === a.code && PAID.includes(o.status));
}
function sumSince(orders, from) {
  const os = orders.filter((o) => new Date(o.paidAt || o.at).getTime() >= from);
  return { n: os.length, rev: r2(os.reduce((s, o) => s + revOf(o), 0)) };
}
export function stats(a) {
  const os = sales(a);
  const now = Date.now();
  const w = sumSince(os, now - 7 * DAY), m = sumSince(os, now - 30 * DAY), y = sumSince(os, now - 365 * DAY);
  const pm = (() => { const x = os.filter((o) => { const t = new Date(o.paidAt || o.at).getTime(); return t >= now - 60 * DAY && t < now - 30 * DAY; }); return r2(x.reduce((s, o) => s + revOf(o), 0)); })();
  const pct = Number(a.pct) || 0;
  const total = r2(os.reduce((s, o) => s + revOf(o), 0));
  const earned = r2(total * pct / 100);
  const paid = r2((a.payouts || []).reduce((s, p) => s + Number(p.amount || 0), 0));
  const f = followers(a);
  const last = os.length ? Math.max(...os.map((o) => new Date(o.paidAt || o.at).getTime())) : 0;
  return {
    orders: os, week: w, month: m, year: y, total, count: os.length,
    change: pm ? Math.round(((m.rev - pm) / pm) * 1000) / 10 : m.rev ? 100 : 0,
    earned, paid, due: r2(Math.max(0, earned - paid)),
    perK: f ? r2((m.n / f) * 10000) : 0, // ventes du mois pour 10 000 abonnés
    revPerK: f ? r2((m.rev / f) * 1000) : 0, // CA du mois pour 1 000 abonnés
    followers: f, last, basket: os.length ? r2(total / os.length) : 0,
    tier: m.n >= 20 ? "or" : m.n >= 5 ? "argent" : "bronze",
  };
}

/* CA par semaine (bougies : ouverture = semaine d'avant, clôture = semaine, haut/bas = meilleur/pire jour) */
export function weekly(orders, weeks = 16) {
  const now = new Date(); now.setHours(23, 59, 59, 999);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = now.getTime() - i * 7 * DAY, start = end - 7 * DAY;
    const days = Array.from({ length: 7 }, (_, d) => orders.filter((o) => { const t = new Date(o.paidAt || o.at).getTime(); return t > start + d * DAY && t <= start + (d + 1) * DAY; }).reduce((s, o) => s + revOf(o), 0));
    const close = r2(days.reduce((s, v) => s + v, 0));
    out.push({ start, close, high: r2(Math.max(...days) * 7), low: r2(Math.min(...days) * 7), n: orders.filter((o) => { const t = new Date(o.paidAt || o.at).getTime(); return t > start && t <= end; }).length });
  }
  out.forEach((w, i) => {
    w.open = i ? out[i - 1].close : w.close;
    const top = Math.max(w.open, w.close), bot = Math.min(w.open, w.close);
    /* mèches : rythme des jours, bornées pour garder le graphique lisible */
    w.high = r2(Math.max(top, Math.min(w.high, top * 1.3 + 1)));
    w.low = r2(Math.min(bot, Math.max(w.low, bot * 0.7)));
  });
  return out;
}

/* Relevé mensuel (pour le paiement de la commission) */
export function statement(a, ym) {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1).getTime(), to = new Date(y, m, 1).getTime();
  const os = sales(a).filter((o) => { const t = new Date(o.paidAt || o.at).getTime(); return t >= from && t < to; });
  const rev = r2(os.reduce((s, o) => s + revOf(o), 0));
  return { ym, orders: os, n: os.length, rev, commission: r2(rev * (Number(a.pct) || 0) / 100), paid: (a.payouts || []).some((p) => p.month === ym) };
}

/* ---------- Démo ---------- */
export function demoProfiles() {
  const hist = (base, growth) => Array.from({ length: 10 }, (_, i) => ({ at: new Date(Date.now() - (9 - i) * 12 * DAY).toISOString(), n: Math.round(base * (1 + growth * i / 9) * (0.98 + Math.random() * 0.04)) }));
  return [
    { code: "LINA", name: "Lina B.", handle: "@lina.nuit", age: 27, audienceAge: 24, sector: "lifestyle", pct: 15, promoPct: 10, status: "actif", start: "2026-06-01", phone: "", email: "", notes: "Stories du soir, très bon taux de réponse.", networks: [{ net: "Snapchat", handle: "lina.nuit", hist: hist(42000, .18) }, { net: "TikTok", handle: "@lina.nuit", hist: hist(88000, .35) }] },
    { code: "KARIMZ", name: "Karim Z.", handle: "@karimz", age: 31, audienceAge: 29, sector: "humour", pct: 12, status: "actif", start: "2026-07-10", networks: [{ net: "TikTok", handle: "@karimz", hist: hist(156000, .12) }, { net: "Instagram", handle: "@karimz", hist: hist(34000, .05) }] },
    { code: "YASBEAUTY", name: "Yasmine A.", handle: "@yas.beauty", age: 25, audienceAge: 23, sector: "beaute", pct: 15, promoPct: 10, status: "actif", start: "2026-08-02", networks: [{ net: "Instagram", handle: "@yas.beauty", hist: hist(61000, .22) }] },
    { code: "NORA", name: "Nora K.", handle: "@nora.couple", age: 29, audienceAge: 31, sector: "couple", pct: 10, status: "actif", start: "2026-08-20", networks: [{ net: "Snapchat", handle: "nora.couple", hist: hist(18500, .08) }] },
    { code: "MEHDIFIT", name: "Mehdi F.", handle: "@mehdi.fit", age: 33, audienceAge: 27, sector: "fitness", pct: 10, status: "pause", start: "2026-05-15", networks: [{ net: "Instagram", handle: "@mehdi.fit", hist: hist(97000, -.04) }, { net: "YouTube", handle: "MehdiFit", hist: hist(12000, .02) }] },
  ].map((a) => ({ ...a, id: a.code, demo: true, payouts: [] }));
}
