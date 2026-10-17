/* =========================================================
   Espace partenaire : chaque affilié voit SES chiffres en direct
   (ventes, commission, palier, rang), son lien, son QR code,
   et son QR code.
   EN LIGNE : fonction my_affiliate() (uniquement ses propres données).
   APERÇU : partenaire.html?demo=LINA (données de l'appareil).
   ========================================================= */
import { initI18n } from "../core/i18n.js";
import { mountChrome } from "../ui/chrome.js";
import { ORN, ornament } from "../ui/card.js";
import { esc } from "../core/util.js";
import { enabled, rpc } from "../core/sb.js";
import { currentUser, ready } from "../core/backend.js";
import qrcode from "../vendor/qrcode.mjs";
import { nextQuote, quoteHtml } from "../admin/quotes.js";

const app = document.getElementById("app");
const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
const DAY = 864e5;
const PAID = ["confirmee", "expediee", "livree"];
const TIERS = [["bronze", "Bronze", 0], ["argent", "Argent", 5], ["or", "Or", 20]];
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const revOf = (o) => (o.subtotalEur != null ? o.subtotalEur - (o.discountEur || 0) : o.totalEur) || 0;

/* Aperçu : mêmes chiffres que my_affiliate(), calculés sur l'appareil */
function localData(code) {
  const affs = read("odn.affiliates", []);
  const a = affs.find((x) => x.code === code);
  if (!a) return null;
  const orders = read("odn.orders", []).filter((o) => PAID.includes(o.status));
  const mine = orders.filter((o) => (o.display?.ref || "").toUpperCase() === code);
  const since = (d) => { const os = mine.filter((o) => Date.now() - new Date(o.at).getTime() < d * DAY); return { n: os.length, rev: os.reduce((s, o) => s + revOf(o), 0) }; };
  const months = {};
  mine.forEach((o) => { const ym = o.at.slice(0, 7); months[ym] ||= { ym, n: 0, rev: 0 }; months[ym].n++; months[ym].rev += revOf(o); });
  const r30 = (c) => orders.filter((o) => (o.display?.ref || "").toUpperCase() === c && Date.now() - new Date(o.at).getTime() < 30 * DAY).reduce((s, o) => s + revOf(o), 0);
  const active = affs.filter((x) => x.status === "actif");
  const mineR = r30(code);
  return {
    code, name: a.name, pct: a.pct, promoPct: a.promoPct, status: a.status, payouts: a.payouts || [],
    week: since(7), month: since(30), year: since(365), total: since(1e5),
    months: Object.values(months).sort((x, y) => (x.ym < y.ym ? 1 : -1)).slice(0, 12),
    rank: active.filter((x) => r30(x.code) > mineR).length + 1, of: active.length, demo: true,
  };
}

const link = (code) => { const u = new URL("maisons.html", location.href); u.search = ""; u.hash = ""; u.searchParams.set("ref", code); return u.href; };
function qrSvg(text, size = 6) { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: size, margin: 2, scalable: true }); }
function shell(inner) {
  app.innerHTML = `<section class="wrap pt-10 pb-24 pt-space"><p class="eyebrow m-0">${ORN}OrDesNuits · Espace partenaire</p>${inner}</section>`;
}

function view(d) {
  const tier = [...TIERS].reverse().find((t) => d.month.n >= t[2]);
  const next = TIERS[TIERS.indexOf(tier) + 1];
  const pct = Number(d.pct) || 0;
  const com = (v) => v * pct / 100;
  const paid = (d.payouts || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const due = Math.max(0, com(Number(d.total.rev)) - paid);
  const l = link(d.code);
  const tn = Number(d.total.n), tr = Number(d.total.rev);
  const feats = [
    ["Première vente", tn >= 1], ["10 ventes", tn >= 10], ["50 ventes", tn >= 50], ["100 ventes", tn >= 100],
    ["1 000 € générés", tr >= 1000], ["10 000 € générés", tr >= 10000], ["Palier Or", tier[0] === "or"], ["Podium du mois", d.rank <= 3 && d.month.n > 0], ["N° 1 du mois", d.rank === 1 && d.month.n > 0],
  ];
  const goals = [1, 10, 50, 100, 250, 500, 1000];
  const goal = goals.find((g) => tn < g);
  shell(`
    <h1 class="display pt-h">Bonjour ${esc((d.name || "").split(" ")[0])}</h1>
    ${ornament("my-3")}
    ${quoteHtml(nextQuote(), esc)}
    ${d.demo ? `<p class="demo-flag">✦ Aperçu sur les données de démonstration de cet appareil.</p>` : ""}
    <div class="pt-hero">
      <div class="pt-tier ${tier[0]}"><small>Palier du mois</small><b class="display">${tier[1]}</b>
        ${next ? `<i><i style="width:${Math.min(100, (d.month.n / next[2]) * 100).toFixed(0)}%"></i></i><em>${next[2] - d.month.n} vente${next[2] - d.month.n > 1 ? "s" : ""} avant ${next[1]}</em>` : `<em>Palier maximum atteint ✦</em>`}</div>
      <div class="pt-rank"><small>Classement · 30 jours</small><b class="display">${d.rank}<sup>${d.rank === 1 ? "er" : "e"}</sup></b><em>sur ${d.of} partenaire${d.of > 1 ? "s" : ""} actif${d.of > 1 ? "s" : ""}</em></div>
    </div>
    <div class="adm2-kpis pt-kpis">
      <div class="kpi2 lead"><span>Ta commission · 30 j</span><b>${eur(com(Number(d.month.rev)))}</b><small>${pct} % de ${eur(d.month.rev)}</small></div>
      <div class="kpi2"><span>Ventes</span><b>${d.week.n} · ${d.month.n} · ${d.year.n}</b><small>7 jours · 30 jours · 12 mois</small></div>
      <div class="kpi2"><span>Gagné depuis le début</span><b>${eur(com(Number(d.total.rev)))}</b><small>${d.total.n} ventes</small></div>
      <div class="kpi2 ${due > 0 ? "warn" : ""}"><span>À recevoir</span><b>${eur(due)}</b><small>déjà versé ${eur(paid)}</small></div>
    </div>

    <section class="adm2-box">
      <h2 class="display">Tes trophées</h2>
      ${goal ? `<p class="pt-goal">Prochain objectif : <b>${goal} vente${goal > 1 ? "s" : ""}</b> · encore ${goal - tn}</p><div class="pt-gbar"><i style="width:${Math.min(100, (tn / goal) * 100).toFixed(0)}%"></i></div>` : ""}
      <ul class="qg-feats pt-feats">${feats.map(([t, ok]) => `<li class="${ok ? "ok" : ""}"><span class="fh"><svg viewBox="0 0 40 46"><path d="M20 2l17 10v22L20 44 3 34V12z"/></svg><i>${ok ? "✦" : "·"}</i></span><b>${t}</b></li>`).join("")}</ul>
    </section>

    <section class="adm2-box pt-share">
      <h2 class="display">Ton lien et ton code</h2>
      <div class="pt-qr">${qrSvg(l)}</div>
      <div class="pt-codes">
        <p class="pt-code"><small>Code</small><b>${esc(d.code)}</b>${d.promoPct ? `<em>−${d.promoPct} % pour ton audience</em>` : ""}</p>
        <div class="aff-link"><code>${esc(l)}</code><button type="button" class="adm-btn ghost" data-copy="${esc(l)}">Copier</button></div>
        <p class="at-hint">Toute commande passée dans les 30 jours après un clic sur ton lien, ou avec ton code, t'est attribuée.</p>
      </div>
    </section>

    <section class="adm2-box">
      <h2 class="display">Les règles du jeu</h2>
      <ul class="pt-rules">
        <li>Indique toujours qu'il s'agit d'un <b>partenariat commercial</b> (#partenariat, #collab) : c'est la loi.</li>
        <li>Ne promets jamais d'effet sur la santé, la performance ou le désir : parle du goût, du parfum, du coffret, de la discrétion.</li>
        <li>Ne cible jamais les moins de 18 ans.</li>
      </ul>
    </section>

    <section class="adm2-box">
      <h2 class="display">Tes relevés</h2>
      ${d.months.length ? `<ul class="aff-st">${d.months.map((m) => { const ok = (d.payouts || []).some((p) => p.month === m.ym); return `<li><span><b>${new Date(m.ym + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b><small>${m.n} vente${m.n > 1 ? "s" : ""} · ${eur(m.rev)}</small></span><b>${eur(com(Number(m.rev)))}</b>${ok ? `<em class="paid">Versée ✓</em>` : `<em class="muted">à venir</em>`}</li>`; }).join("")}</ul>` : `<p class="at-hint">Tes premières ventes apparaîtront ici.</p>`}
    </section>`);

  app.onclick = async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.copy) { try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copié ✦"; } catch {} return; }
  };
}

async function main() {
  mountChrome({ active: "partenaire" });
  const demo = new URLSearchParams(location.search).get("demo");
  if (!enabled) {
    const d = localData(String(demo || "").toUpperCase()) || localData(read("odn.affiliates", [])[0]?.code);
    if (d) return view(d);
    return shell(`<h1 class="display pt-h">Espace partenaire</h1><p class="text-muted">Aperçu : ajoute d'abord un affilié dans le Salon privé (onglet Affiliés), puis reviens ici.</p>`);
  }
  await ready();
  if (!currentUser()) return shell(`<h1 class="display pt-h">Espace partenaire</h1>${ornament("my-3")}<p class="text-muted">Connecte-toi avec l'e-mail que tu as donné à la Maison pour voir tes ventes et tes commissions.</p><a class="btn btn-gold mt-6" href="compte.html?next=partenaire">Se connecter</a>`);
  let d = null;
  try { d = await rpc("my_affiliate"); } catch {}
  if (!d) return shell(`<h1 class="display pt-h">Espace partenaire</h1>${ornament("my-3")}<p class="text-muted">Ton compte n'est pas encore relié à un contrat partenaire. Demande à la Maison d'enregistrer ton e-mail (${esc(currentUser().email)}) sur ta fiche.</p><a class="btn btn-ghost mt-6" href="affiliation.html">Devenir partenaire</a>`);
  view(d);
}

await initI18n();
main();
