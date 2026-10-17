/* =========================================================
   Données de démonstration : 6 mois d'activité fictive, en
   croissance, jusqu'à environ 50 000 € par mois aujourd'hui.
   Tout est marqué « demo » et se retire en un geste.
   ========================================================= */
import { bestCost } from "./pricing.js";

/* Codes d'affiliés de démonstration (profils créés dans le Salon → Affiliés) */
export const DEMO_AFF = ["LINA", "KARIMZ", "YASBEAUTY", "NORA", "MEHDIFIT"];
const AFF = [["LINA", 30], ["KARIMZ", 18], ["YASBEAUTY", 12], ["NORA", 6], ["MEHDIFIT", 4]];
const DAY = 864e5;
export const DEMO_MONTHLY = 50000;   // chiffre d'affaires visé sur les 30 derniers jours
const DAYS = 180;                     // historique

export function makeDemo(products, known = {}) {
  const rnd = Math.random;
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const wpick = (list) => { const t = list.reduce((s, [, w]) => s + w, 0); let r = rnd() * t; for (const [k, w] of list) if ((r -= w) <= 0) return k; return list[0][0]; };
  const countries = [["FR", 46], ["MA", 12], ["BE", 8], ["DZ", 7], ["CH", 5], ["TN", 5], ["AE", 4], ["DE", 3], ["ES", 3], ["GB", 2], ["SN", 2], ["CA", 2], ["US", 1]];
  const regions = [["IDF", 30], ["ARA", 13], ["PAC", 12], ["HDF", 9], ["OCC", 8], ["GES", 7], ["NAQ", 6], ["PDL", 5], ["BRE", 3], ["NOR", 3], ["CVL", 2], ["BFC", 2], ["COR", 1]];
  const LANG = { FR: "fr", BE: "fr", CH: "fr", SN: "fr", MA: "ar", DZ: "ar", TN: "ar", AE: "ar", DE: "de", ES: "es", GB: "en-GB", US: "en-US", CA: "fr" };
  const names = ["Yasmine", "Karim", "Sofia", "Mehdi", "Inès", "Lucas", "Nora", "Adam", "Lina", "Rayan", "Sarah", "Hugo", "Amel", "Bilal", "Chloé", "Ilyes", "Maya", "Samir", "Jade", "Omar", "Léa", "Nassim", "Emma", "Walid"];
  const live = products.filter((p) => p.active !== false && p.type !== "pack");
  const weights = live.map((p) => [p, p.category === "miel" ? 5 : p.category === "bougie" ? 2 : 1.5]);
  const QTY = [[1, 20], [2, 14], [3, 22], [6, 22], [12, 14], [24, 8]];

  const orders = [], users = [...(known.users || [])], subs = [...(known.subs || [])];
  const newUsers = [], newSubs = [];
  const userSet = new Set(users.map((u) => u.email)), subSet = new Set(subs.map((s) => s.email));
  const pool = 2600; // clients différents
  let n = 0;

  for (let d = DAYS - 1; d >= 0; d--) {
    /* croissance : ~9 % du rythme actuel il y a 6 mois, 100 % aujourd'hui */
    const g = Math.exp(-d / 74) * (0.85 + rnd() * 0.3) * ([0, 6].includes(new Date(Date.now() - d * DAY).getDay()) ? 1.15 : 1);
    let target = (DEMO_MONTHLY / 30 / 0.84) * g; // 0,84 : moyenne de la courbe sur les 30 derniers jours
    if (d === 0) target *= Math.min(1, new Date().getHours() / 24 + 0.05); // journée en cours
    let day = 0;
    while (day < target) {
      const at = new Date(Date.now() - d * DAY);
      at.setHours(rnd() < .6 ? 19 + Math.floor(rnd() * 5) : 9 + Math.floor(rnd() * 10), Math.floor(rnd() * 60), Math.floor(rnd() * 60));
      if (at > new Date()) at.setTime(Date.now() - rnd() * 3 * 36e5);
      const nl = rnd() < .7 ? 1 : rnd() < .8 ? 2 : 3;
      const lines = [];
      for (let k = 0; k < nl; k++) {
        const p = wpick(weights);
        if (lines.some((l) => l.id === p.id)) continue;
        const qty = p.category === "miel" ? wpick(QTY) : 1 + (rnd() < .25 ? 1 : 0);
        const lineEur = Math.round(bestCost(p, qty) * 100) / 100;
        lines.push({ id: p.id, name: p.name, qty, unitEur: Math.round((lineEur / qty) * 10000) / 10000, lineEur, shop: p.shop, category: p.category });
      }
      const sub = Math.round(lines.reduce((s, l) => s + l.lineEur, 0) * 100) / 100;
      const ship = sub < 49 ? 5.9 : 0;
      const who = Math.floor(Math.pow(rnd(), 1.7) * pool);
      const first = names[who % names.length];
      const email = `${first.toLowerCase()}.${who}@exemple.fr`;
      const age = (Date.now() - at) / DAY;
      const status = age < 1 ? pick(["nouvelle", "confirmee", "confirmee"]) : age < 4 ? pick(["confirmee", "expediee"]) : rnd() < .04 ? "annulee" : "livree";
      const country = wpick(countries);
      const ref = rnd() < .4 ? wpick(AFF) : null;
      orders.push({
        id: "ODN-D" + (10000 + n++), at: at.toISOString(), status, source: rnd() < .75 ? "site" : "whatsapp",
        payment: status === "nouvelle" ? null : pick(["carte", "virement", "especes", "carte"]), demo: true,
        customer: { email, firstName: first, optin: rnd() < .55 },
        shipping: { country, region: country === "FR" ? wpick(regions) : null },
        lang: LANG[country] || "fr", lines,
        subtotalEur: sub, discountEur: 0, totalEur: Math.round((sub + ship) * 100) / 100,
        display: { shipEur: ship, ...(ref ? { ref } : {}) },
      });
      if (status !== "annulee") day += sub + ship;
      if (newUsers.length < 400 && rnd() < .3 && !userSet.has(email)) { userSet.add(email); const u = { id: "UD" + n, email, firstName: first, optin: rnd() < .6, lang: "fr", country, createdAt: at.toISOString(), demo: true, pass: "" }; users.push(u); newUsers.push(u); }
      if (newSubs.length < 900 && rnd() < .35 && !subSet.has(email)) { subSet.add(email); const s = { email, source: pick(["commande", "compte", "ordessens"]), lang: "fr", at: at.toISOString(), demo: true }; subs.push(s); newSubs.push(s); }
    }
  }
  orders.sort((a, b) => b.at.localeCompare(a.at));
  return { orders, users: newUsers, subs: newSubs };
}
