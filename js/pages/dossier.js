/* =========================================================
   Dossier investisseur : page privée (lien à jeton), à jour en
   direct. Uniquement des agrégats : aucun nom, aucune adresse.
   ========================================================= */
import { enabled, rpc } from "../core/sb.js";

const app = document.getElementById("app");
const eur = (v, d = 0) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(v || 0);
const nb = (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const compact = (v) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);
const pct = (v) => `${v >= 0 ? "+" : ""}${(Math.round(v * 10) / 10).toLocaleString("fr-FR")} %`;
const PAID = ["confirmee", "expediee", "livree"];
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

/* Aperçu (sans Supabase) : calcul à partir des données de l'appareil */
function localSnapshot() {
  const orders = read("odn.orders", []).filter((o) => PAID.includes(o.status));
  const by = {};
  orders.forEach((o) => { const ym = o.at.slice(0, 7); by[ym] ||= { ym, n: 0, rev: 0, buyers: new Set() }; by[ym].n++; by[ym].rev += o.totalEur; by[ym].buyers.add((o.customer?.email || "").toLowerCase()); });
  const emails = {}; orders.forEach((o) => { const e = (o.customer?.email || "").toLowerCase(); emails[e] = (emails[e] || 0) + 1; });
  const affs = read("odn.affiliates", []).filter((a) => a.status === "actif");
  const rv = read("odn.reviews", []).filter((r) => r.approved);
  return {
    months: Object.values(by).sort((a, b) => (a.ym < b.ym ? -1 : 1)).map((m) => ({ ...m, buyers: m.buyers.size })),
    orders: orders.length, revenue: orders.reduce((s, o) => s + o.totalEur, 0), buyers: Object.keys(emails).length,
    repeat: Object.values(emails).filter((n) => n > 1).length, countries: new Set(orders.map((o) => o.shipping?.country)).size,
    subscribers: read("odn.subs", []).length, affiliates: affs.length,
    followers: affs.reduce((s, a) => s + (a.networks || []).reduce((t, n) => t + (n.hist?.at(-1)?.n || 0), 0), 0),
    products: (read("odn.catalogue.v1", null)?.products || []).filter((p) => p.active !== false).length || null,
    rating: rv.length ? rv.reduce((s, r) => s + r.rating, 0) / rv.length : null, reviews: rv.length,
    funnel: (() => { const f = {}; const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10); Object.entries(read("odn.events", {})).forEach(([day, v]) => { if (day >= from) for (const k in v) f[k] = (f[k] || 0) + v[k]; }); return f; })(), at: new Date().toISOString(), demo: true,
  };
}

function lastMonths(months, n = 12) {
  const map = Object.fromEntries(months.map((m) => [m.ym, m]));
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); const ym = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; out.push(map[ym] ? { ...map[ym], rev: Number(map[ym].rev) } : { ym, n: 0, rev: 0, buyers: 0 }); }
  return out;
}

function chart(ms) {
  const W = 640, H = 220, pad = 40, max = Math.max(1, ...ms.map((m) => m.rev));
  const bw = (W - pad) / ms.length;
  const y = (v) => H - (v / max) * (H - 20);
  const maxN = Math.max(1, ...ms.map((m) => m.n));
  const ln = ms.map((m, i) => `${i ? "L" : "M"}${(pad + i * bw + bw / 2).toFixed(1)},${(H - (m.n / maxN) * (H - 30)).toFixed(1)}`).join("");
  return `<svg class="ds-chart" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="Chiffre d'affaires mensuel">
    ${[0, .5, 1].map((k) => `<line x1="${pad}" x2="${W}" y1="${y(max * k)}" y2="${y(max * k)}" class="g"/><text x="0" y="${y(max * k) + 4}" class="t">${compact(max * k)}</text>`).join("")}
    ${ms.map((m, i) => `<rect x="${pad + i * bw + bw * .18}" y="${y(m.rev)}" width="${bw * .64}" height="${H - y(m.rev)}" rx="2" class="b"><title>${m.ym} : ${eur(m.rev)} · ${m.n} commandes</title></rect>
      <text x="${pad + i * bw + bw / 2}" y="${H + 16}" text-anchor="middle" class="t">${new Date(m.ym + "-01").toLocaleDateString("fr-FR", { month: "short" })}</text>`).join("")}
    <path d="${ln}" class="l"/>
  </svg>`;
}

async function main() {
  const h = new URLSearchParams(location.hash.slice(1));
  let d;
  try {
    if (enabled && h.get("k")) { d = await rpc("investor_snapshot", { p_token: h.get("k") }); try { d.funnel = await rpc("investor_funnel", { p_token: h.get("k") }); } catch {} }
    else if (!enabled || h.has("demo")) d = localSnapshot();
    else throw new Error("no token");
  } catch {
    app.innerHTML = `<section class="ds-locked"><img src="assets/img/mono.webp" alt=""><h1 class="display">Accès privé</h1><p>Ce lien n'est plus valable. Demande un nouveau lien à la Maison.</p></section>`;
    return;
  }
  const ms = lastMonths(d.months || [], 12);
  const full = ms.slice(0, -1); // mois terminés
  const last = full.at(-1)?.rev || 0, prev = full.at(-2)?.rev || 0;
  const mom = prev ? ((last - prev) / prev) * 100 : 0;
  const nz = full.filter((m) => m.rev > 0);
  const k = Math.min(6, nz.length - 1);
  const cmgr = k > 0 ? (Math.pow(nz.at(-1).rev / nz.at(-1 - k).rev, 1 / k) - 1) * 100 : 0;
  const rev12 = ms.reduce((s, m) => s + m.rev, 0);
  const avg3 = full.slice(-3).reduce((s, m) => s + m.rev, 0) / Math.max(1, Math.min(3, full.length));
  const basket = d.orders ? d.revenue / d.orders : 0;
  const perBuyer = d.buyers ? d.revenue / d.buyers : 0;
  const loyalty = d.buyers ? (d.repeat / d.buyers) * 100 : 0;
  const strengths = [
    cmgr > 0 && `Croissance moyenne de ${pct(cmgr)} par mois sur les ${k} derniers mois.`,
    loyalty >= 15 && `${Math.round(loyalty)} % des clients ont déjà recommandé : la marque fidélise.`,
    d.countries > 1 && `Ventes dans ${d.countries} pays, site disponible en 11 langues et 9 devises.`,
    d.affiliates > 0 && `Réseau de ${d.affiliates} affilié${d.affiliates > 1 ? "s" : ""} actif${d.affiliates > 1 ? "s" : ""}, ${compact(d.followers)} abonnés cumulés : une acquisition payée à la performance.`,
    d.subscribers > 0 && `${nb(d.subscribers)} contacts ayant accepté de recevoir les offres (base propre, conforme RGPD).`,
    d.rating && d.reviews >= 3 && `Note moyenne de ${String(Math.round(d.rating * 10) / 10).replace(".", ",")}/5 sur ${d.reviews} avis vérifiés.`,
    "Technologie propriétaire : boutique, console de gestion, outils pub et vidéo, tout en interne, sans abonnement à une plateforme.",
  ].filter(Boolean);

  app.innerHTML = `
  <header class="ds-head">
    <img src="assets/img/logo.webp" alt="OrDesNuits" width="88" height="88">
    <div><p class="eyebrow">Dossier investisseur · confidentiel</p><h1 class="display">OrDesNuits</h1>
      <p class="ds-sub">Chiffres réels, mis à jour en direct · ${new Date(d.at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}${d.demo ? " · <b>aperçu sur données de démonstration</b>" : ""}</p></div>
    <button type="button" class="adm-btn ghost ds-print" onclick="print()">Enregistrer en PDF</button>
  </header>
  <section class="ds-kpis">
    <div class="lead"><span>CA 12 derniers mois</span><b>${eur(rev12)}</b><small>${eur(d.revenue)} depuis le lancement</small></div>
    <div><span>Croissance mensuelle</span><b>${pct(cmgr)}</b><small>moyenne sur ${Math.max(0, k)} mois · dernier mois ${pct(mom)}</small></div>
    <div><span>Commandes</span><b>${nb(d.orders)}</b><small>panier moyen ${eur(basket, 2)}</small></div>
    <div><span>Clients</span><b>${nb(d.buyers)}</b><small>${eur(perBuyer, 2)} dépensés par client</small></div>
    <div><span>Fidélité</span><b>${Math.round(loyalty)} %</b><small>clients revenus au moins une fois</small></div>
    <div><span>Marchés</span><b>${nb(d.countries)} pays</b><small>11 langues · 9 devises</small></div>
    <div><span>Réseau d'affiliés</span><b>${nb(d.affiliates)}</b><small>${compact(d.followers)} abonnés cumulés</small></div>
    <div><span>Contacts opt-in</span><b>${nb(d.subscribers)}</b><small>avec consentement</small></div>
    ${d.funnel?.visit ? `<div class="lead"><span>Taux de conversion · 30 j</span><b>${((d.funnel.order || 0) / d.funnel.visit * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %</b><small>${nb(d.funnel.visit)} visites → ${nb(d.funnel.cart || 0)} paniers → ${nb(d.funnel.order || 0)} commandes · moyenne e-commerce 1 à 3 %</small></div>` : ""}
  </section>
  <section class="ds-box"><h2 class="display">Chiffre d'affaires mensuel</h2><p class="ds-leg"><i class="b"></i>CA encaissé <i class="l"></i>nombre de commandes</p>${chart(ms)}</section>
  <div class="ds-two">
    <section class="ds-box"><h2 class="display">Points forts</h2><ul class="ds-list">${strengths.map((s) => `<li>${s}</li>`).join("")}</ul></section>
    <section class="ds-box"><h2 class="display">Repère de valorisation</h2>
      <p>Les petites marques e-commerce rentables se négocient souvent entre <b>24 et 36 mois</b> de chiffre d'affaires mensuel moyen, selon la croissance, la marge et la fidélité.</p>
      <p class="ds-val">${eur(avg3 * 24)} – ${eur(avg3 * 36)}</p>
      <p class="ds-note">Calcul : CA mensuel moyen des 3 derniers mois terminés (${eur(avg3)}) × 24 à 36. Repère indicatif uniquement, ce n'est ni une évaluation ni un conseil financier : une valorisation réelle se fait avec un professionnel, sur les comptes certifiés.</p>
    </section>
  </div>
  <footer class="ds-foot">Document généré automatiquement depuis la console OrDesNuits. Données agrégées : aucune information personnelle de client n'y figure.</footer>`;
}
main();
