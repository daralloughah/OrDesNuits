/* =========================================================
   Croissance : le conseiller du Salon privé
   - Combien tu peux payer au maximum pour gagner un client
   - Simulateur de budget pub (commandes, CA, bénéfice)
   - Objectif du mois et rythme à tenir
   - Plan de test et moments de diffusion
   Tout est calculé à partir de TES commandes ; les hypothèses
   (marge, livraison, frais) se règlent ici et restent sur l'appareil.
   ========================================================= */
import * as A from "./analytics.js";
import { allOrders } from "../core/backend.js";
import { esc } from "../core/util.js";

const KEY = "odn.growth";
const DEF = { margin: 65, ship: 6, fees: 2, goal: 3000, budget: 300, cpa: 0 };
const cfg = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEF }; } };
const keep = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} };
const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: v >= 100 || v <= -100 ? 0 : 2 }).format(v || 0);
const nb = (v) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v || 0);
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/* Les chiffres de base, tirés des 90 derniers jours */
function base(products) {
  const s = A.compute("90", products);
  const c = cfg();
  const paid = allOrders().filter((o) => A.PAID.includes(o.status));
  const byEmail = {};
  paid.forEach((o) => { const e = o.customer?.email || o.customer?.phone || o.id; byEmail[e] = (byEmail[e] || 0) + 1; });
  const buyers = Object.keys(byEmail).length;
  const perBuyer = buyers ? paid.length / buyers : 1;
  const basket = s.basket || 0;
  // marge réelle si les coûts d'achat sont connus, sinon l'hypothèse réglée ici
  const marginPct = s.knownCost && s.revenue ? Math.max(5, Math.min(95, (s.margin / s.revenue) * 100)) : c.margin;
  const perOrder = basket * (marginPct / 100) - c.ship - basket * (c.fees / 100);
  const ltv = perOrder * Math.max(1, perBuyer);
  const monthRev = (() => { const d = new Date(); const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); return paid.filter((o) => new Date(o.paidAt || o.at).getTime() >= from).reduce((a, o) => a + o.totalEur, 0); })();
  return { s, c, basket, marginPct, realMargin: s.knownCost && s.revenue, perOrder, perBuyer, ltv, monthRev, count: s.count };
}

function levels(b) {
  return {
    max: Math.max(0, b.ltv),                 // au-delà : chaque client te fait perdre de l'argent
    first: Math.max(0, b.perOrder),          // rentable dès la première commande
    safe: Math.max(0, b.ltv / 3),            // objectif sain : 1 € de pub rapporte 3 € de marge
  };
}

function simulate(b, budget, cpa) {
  const orders = cpa > 0 ? budget / cpa : 0;
  const revenue = orders * b.basket;
  const margin = orders * b.perOrder;
  const later = orders * b.perOrder * Math.max(0, b.perBuyer - 1); // marge des commandes suivantes
  return { orders, revenue, margin, net: margin - budget, netLtv: margin + later - budget, roas: budget ? revenue / budget : 0 };
}

function simHtml(b, L, budget, cpa) {
  const sim = simulate(b, budget, cpa);
  return `
    <div class="adm2-kpis gr-sim">
      <div class="kpi2"><span>Commandes</span><b>~${Math.round(sim.orders)}</b><small>par mois</small></div>
      <div class="kpi2"><span>Chiffre d'affaires</span><b>${eur(sim.revenue)}</b><small>${nb(sim.roas)} € pour 1 € de pub</small></div>
      <div class="kpi2 ${sim.net >= 0 ? "" : "warn"}"><span>Résultat du mois</span><b>${eur(sim.net)}</b><small>marge − budget pub</small></div>
      <div class="kpi2 ${sim.netLtv >= 0 ? "" : "warn"}"><span>Avec les retours</span><b>${eur(sim.netLtv)}</b><small>en comptant les commandes suivantes</small></div>
    </div>
    <p class="gr-verdict ${cpa <= L.safe ? "ok" : cpa <= L.first ? "mid" : cpa <= L.max ? "warn" : "bad"}">${
      cpa <= L.safe ? "✦ Coût sain : tu peux augmenter le budget de 20 % par semaine tant que ce coût tient."
      : cpa <= L.first ? "Rentable dès la première commande. Garde le budget, et teste de nouveaux visuels pour faire baisser le coût."
      : cpa <= L.max ? "Rentable seulement si le client revient. Ne monte pas le budget : améliore d'abord le visuel ou l'offre."
      : "Ce coût te fait perdre de l'argent. Coupe la pub et change de visuel, de cible ou d'offre."}</p>`;
}

export function growth(root, { products }) {
  const b = base(products);
  const L = levels(b);
  const c = b.c;
  const cpa = c.cpa > 0 ? c.cpa : Math.round(L.safe * 100) / 100 || 10;
  const s = b.s;
  const d = new Date();
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const left = dim - d.getDate() + 1;
  const goalPct = Math.min(100, Math.round((b.monthRev / (c.goal || 1)) * 100));
  const missing = Math.max(0, c.goal - b.monthRev);
  const perDay = missing / left;
  const ordersNeeded = b.basket ? missing / b.basket : 0;
  const budgetForGoal = ordersNeeded * cpa;
  const maxDay = s.byDay.indexOf(Math.max(...s.byDay));
  const maxHour = s.byHour.indexOf(Math.max(...s.byHour));
  const test = Math.max(30, Math.round(cpa * 6));
  const enough = b.count >= 5 && b.basket > 0;

  root.innerHTML = `
  <header class="adm2-head"><p class="eyebrow">Conseiller</p><h1 class="display">Croissance</h1>
    <p class="sub">Combien investir en publicité, et jusqu'où aller, calculé sur tes vraies commandes des 90 derniers jours.</p></header>
  ${enough ? "" : `<p class="demo-flag">✦ Encore peu de commandes : les conseils s'affinent à chaque vente. En attendant, ils reposent sur les hypothèses réglables en bas de page.</p>`}

  <section class="adm2-box gr-hero">
    <div class="gr-ring" style="--p:${goalPct}"><b>${goalPct} %</b><small>de l'objectif</small></div>
    <div class="gr-goal">
      <h2 class="display">Objectif du mois : ${eur(c.goal)}</h2>
      <p>${eur(b.monthRev)} encaissés · ${left} jour${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}.</p>
      <p>${missing > 0 ? `Il manque <b>${eur(missing)}</b>, soit <b>${eur(perDay)} par jour</b> (~${nb(ordersNeeded)} commandes). Avec la pub au coût visé, ça représente environ <b>${eur(budgetForGoal)}</b> de budget.` : `<b>Objectif atteint ✦</b> Tout ce qui rentre maintenant est du bonus : c'est le moment de tester un nouveau visuel.`}</p>
    </div>
  </section>

  <section class="adm2-box">
    <h2 class="display">Combien payer pour gagner un client</h2>
    <p class="at-hint">Marge par commande : <b>${eur(b.perOrder)}</b> (panier moyen ${eur(b.basket)} × marge ${nb(b.marginPct)} %${b.realMargin ? " réelle" : " estimée"}, moins livraison et frais). Un client commande en moyenne <b>${nb(b.perBuyer)} fois</b>.</p>
    <div class="gr-levels">
      <div class="lv safe"><span>Objectif sain</span><b>${eur(L.safe)}</b><small>par commande obtenue grâce à la pub. 1 € investi rapporte 3 € de marge.</small></div>
      <div class="lv first"><span>Rentable tout de suite</span><b>${eur(L.first)}</b><small>la 1ʳᵉ commande paie sa pub. Au-dessus, tu comptes sur le retour du client.</small></div>
      <div class="lv max"><span>Limite à ne jamais dépasser</span><b>${eur(L.max)}</b><small>au-delà, chaque client te fait perdre de l'argent, même s'il revient.</small></div>
    </div>
  </section>

  <section class="adm2-box">
    <h2 class="display">Simulateur de budget</h2>
    <div class="gr-sliders">
      <label><span>Budget pub par mois <b data-out="budget">${eur(c.budget)}</b></span><input type="range" min="0" max="5000" step="25" value="${c.budget}" data-k="budget"></label>
      <label><span>Coût d'une commande via la pub <b data-out="cpa">${eur(cpa)}</b></span><input type="range" min="1" max="${Math.max(60, Math.ceil(L.max * 1.5))}" step="0.5" value="${cpa}" data-k="cpa">
        <small>Par défaut : ton objectif sain. Remplace-le par le chiffre réel de tes pubs dès que tu l'as (Snap et TikTok l'affichent : « coût par achat »).</small></label>
    </div>
    <div id="grSim">${simHtml(b, L, c.budget, cpa)}</div>
  </section>

  <div class="adm2-two">
    <section class="adm2-box">
      <h2 class="display">Plan de test (14 jours)</h2>
      <ol class="gr-plan">
        <li><b>3 visuels</b> différents (Studio pub de l'Atelier) : un « cadeau », un « nuit à deux », un « offre ».</li>
        <li><b>${eur(test)}</b> au total, soit ~${eur(test / 14)} par jour : assez pour que chaque visuel ait sa chance.</li>
        <li>Au bout de 7 jours, <b>coupe</b> le visuel dont le coût par commande dépasse ${eur(L.first)}.</li>
        <li>Remets le budget sur le meilleur et <b>augmente de 20 %</b> par semaine tant que le coût reste sous ${eur(L.safe || L.first)}.</li>
      </ol>
      <p class="at-hint">Règle d'or : on ne juge jamais un visuel avant qu'il ait dépensé au moins 2 fois l'objectif sain.</p>
    </section>
    <section class="adm2-box">
      <h2 class="display">Quand et où diffuser</h2>
      <ul class="gr-when">
        <li><b>Jour fort :</b> ${s.count >= 5 ? DAYS[maxDay] : "pas encore assez de données"}</li>
        <li><b>Heure forte :</b> ${s.count >= 5 ? `vers ${maxHour} h : programme tes stories 1 h avant` : "—"}</li>
        <li><b>Zone n°1 :</b> ${s.regions[0] ? esc(s.regions[0].name) : s.countries[0] ? esc(s.countries[0].name) : "—"}</li>
        <li><b>Réseau :</b> commence là où ta communauté est déjà (Snap), puis ouvre un 2ᵉ réseau quand le coût par commande est stable.</li>
      </ul>
      <p class="at-hint">⚠ Les réseaux encadrent les pubs de produits pour adultes : vérifie leurs règles avant de lancer, reste sur le goût, le cadeau et le moment à deux, jamais sur un effet.</p>
    </section>
  </div>

  <section class="adm2-box">
    <h2 class="display">Tes hypothèses</h2>
    <div class="fld-row three">
      <label class="fld"><span>Marge brute (%) ${b.realMargin ? "· calculée" : ""}</span><input class="adm-input" inputmode="decimal" data-k="margin" value="${c.margin}" ${b.realMargin ? "disabled" : ""}></label>
      <label class="fld"><span>Livraison par commande (€)</span><input class="adm-input" inputmode="decimal" data-k="ship" value="${c.ship}"></label>
      <label class="fld"><span>Frais de paiement (%)</span><input class="adm-input" inputmode="decimal" data-k="fees" value="${c.fees}"></label>
      <label class="fld"><span>Objectif du mois (€)</span><input class="adm-input" inputmode="decimal" data-k="goal" value="${c.goal}"></label>
    </div>
    <p class="at-hint">${b.realMargin ? "La marge vient de tes coûts d'achat (fiche produit). " : "Astuce : renseigne le coût d'achat de tes produits pour une marge exacte. "}Ces réglages restent sur cet appareil.</p>
  </section>`;

  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  const redraw = () => growth(root, { products });
  root.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    const v = parseFloat(String(e.target.value).replace(",", "."));
    const c2 = cfg();
    c2[k] = isNaN(v) ? DEF[k] : v;
    keep(c2);
    if (e.target.type === "range") {
      // pendant le glissement : on ne met à jour que les chiffres (le curseur reste attrapé)
      const out = root.querySelector(`[data-out="${k}"]`);
      if (out) out.textContent = eur(c2[k]);
      const bb = base(products), LL = levels(bb);
      const cp = c2.cpa > 0 ? c2.cpa : Math.round(LL.safe * 100) / 100 || 10;
      root.querySelector("#grSim").innerHTML = simHtml(bb, LL, c2.budget, cp);
    }
  });
  root.addEventListener("change", (e) => { if (e.target.dataset.k && e.target.type !== "range") { const y = scrollY; redraw(); scrollTo({ top: y }); } });
}

/* Petit résumé pour le tableau de bord */
export function growthTeaser(products) {
  const b = base(products);
  const L = levels(b);
  return { safe: L.safe, first: L.first, goal: b.c.goal, month: b.monthRev };
}
