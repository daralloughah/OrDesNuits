/* =========================================================
   Entonnoir de conversion : compteurs anonymes par jour.
   Aucun cookie, aucune donnée personnelle : juste « +1 ».
   Une fois par visite pour chaque étape (sauf les commandes).
   Ton propre appareil de gérant n'est jamais compté.
   ========================================================= */
import { enabled, rpc } from "./sb.js";

export const STEPS = [["visit", "Visites"], ["product", "Fiches produit vues"], ["cart", "Ajouts au panier"], ["checkout", "Commandes commencées"], ["order", "Commandes passées"]];

export function track(name) {
  try {
    if (localStorage.getItem("odn.admin.ok") || localStorage.getItem("odn.pin")) return; // le gérant ne se compte pas
    if (name !== "order") { const k = "odn.t." + name; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); }
  } catch { return; }
  if (enabled) { rpc("track", { p_name: name }).catch(() => {}); return; }
  try {
    const all = JSON.parse(localStorage.getItem("odn.events") || "{}");
    const d = new Date().toISOString().slice(0, 10);
    all[d] ||= {}; all[d][name] = (all[d][name] || 0) + 1;
    localStorage.setItem("odn.events", JSON.stringify(all));
  } catch {}
}

/* Gérant : totaux sur N jours */
export async function funnel(days = 30) {
  const out = Object.fromEntries(STEPS.map(([k]) => [k, 0]));
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  if (enabled) {
    const { rest } = await import("./sb.js");
    try { (await rest("events_daily", `select=name,n&day=gte.${from}`)).forEach((r) => { if (r.name in out) out[r.name] += r.n; }); } catch {}
    return out;
  }
  try { Object.entries(JSON.parse(localStorage.getItem("odn.events") || "{}")).forEach(([d, v]) => { if (d >= from) for (const k in v) if (k in out) out[k] += v[k]; }); } catch {}
  return out;
}

/* Démo : un trafic cohérent avec les commandes de démonstration (≈ 2,8 % de conversion) */
export function seedDemoEvents(orders) {
  const all = {};
  orders.forEach((o) => { const d = o.at.slice(0, 10); all[d] ||= { order: 0 }; all[d].order++; });
  for (const d in all) {
    const n = all[d].order, r = () => 0.85 + Math.random() * 0.3;
    const checkout = Math.round(n / 0.62 * r()), cart = Math.round(checkout / 0.48 * r()), product = Math.round(cart / 0.17 * r()), visit = Math.round(product / 0.58 * r());
    all[d] = { visit, product, cart, checkout, order: n };
  }
  try { localStorage.setItem("odn.events", JSON.stringify(all)); } catch {}
}
