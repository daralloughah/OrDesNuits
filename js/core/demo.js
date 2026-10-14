/* Données de démonstration : 140 commandes fictives pour voir le tableau de bord vivre */
export function makeDemo(products, known = {}) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const weighted = [["FR", 46], ["MA", 12], ["BE", 8], ["DZ", 7], ["CH", 5], ["TN", 5], ["AE", 4], ["DE", 3], ["ES", 3], ["GB", 2], ["SN", 2], ["CA", 2], ["US", 1]];
  const regions = [["IDF", 30], ["ARA", 13], ["PAC", 12], ["HDF", 9], ["OCC", 8], ["GES", 7], ["NAQ", 6], ["PDL", 5], ["BRE", 3], ["NOR", 3], ["CVL", 2], ["BFC", 2]];
  const wpick = (list) => { const t = list.reduce((s, [, w]) => s + w, 0); let r = Math.random() * t; for (const [k, w] of list) if ((r -= w) <= 0) return k; return list[0][0]; };
  const names = ["Yasmine", "Karim", "Sofia", "Mehdi", "Inès", "Lucas", "Nora", "Adam", "Lina", "Rayan", "Sarah", "Hugo", "Amel", "Bilal", "Chloé", "Ilyes", "Maya", "Samir"];
  const live = products.filter((p) => p.active !== false && p.type !== "pack");
  const orders = [], users = [...(known.users || [])], subs = [...(known.subs || [])];
  const newUsers = [], newSubs = [];
  for (let i = 0; i < 140; i++) {
    const at = new Date(Date.now() - Math.pow(Math.random(), 1.6) * 120 * 864e5);
    at.setHours(Math.random() < .6 ? 19 + Math.floor(Math.random() * 5) : 10 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
    if (at > new Date()) at.setDate(at.getDate() - 1);
    const country = wpick(weighted);
    const n = 1 + Math.floor(Math.random() * 3);
    const lines = Array.from({ length: n }, () => { const p = pick(live); return { id: p.id, name: p.name, qty: p.category === "miel" ? 1 + Math.floor(Math.random() * 4) : 1, unitEur: p.promo && p.promo < p.price ? p.promo : p.price, shop: p.shop, category: p.category }; });
    const subtotal = lines.reduce((s, l) => s + l.unitEur * l.qty, 0);
    const honey = lines.filter((l) => l.category === "miel").reduce((s, l) => s + l.qty, 0);
    const discount = Math.floor(honey / 4) * 4.5;
    const who = Math.floor(Math.pow(Math.random(), 1.8) * 70);
    const first = names[who % names.length];
    const email = `${first.toLowerCase()}.${who}@exemple.fr`;
    const age = (Date.now() - at) / 864e5;
    const status = age < 1.5 ? pick(["nouvelle", "confirmee"]) : age < 4 ? pick(["confirmee", "expediee"]) : Math.random() < .05 ? "annulee" : "livree";
    orders.push({
      id: "ODN-D" + (1000 + i), at: at.toISOString(), status, source: Math.random() < .7 ? "site" : "whatsapp",
      payment: status === "nouvelle" ? null : pick(["carte", "virement", "especes", "carte"]), demo: true,
      customer: { email, firstName: first, lastName: "", phone: "", optin: Math.random() < .55 },
      shipping: { country, region: country === "FR" ? wpick(regions) : null, city: "", postcode: "", address: "" },
      lang: { FR: "fr", BE: "fr", CH: "fr", SN: "fr", MA: "ar", DZ: "ar", TN: "ar", AE: "ar", DE: "de", ES: "es", GB: "en-GB", US: "en-US", CA: "fr" }[country] || "fr",
      lines, subtotalEur: subtotal, discountEur: discount, totalEur: Math.max(0, subtotal - discount),
    });
    if (Math.random() < .45 && !users.some((u) => u.email === email)) { const u = { id: "UD" + i, email, firstName: first, optin: Math.random() < .6, lang: "fr", country, createdAt: at.toISOString(), demo: true, pass: "" }; users.push(u); newUsers.push(u); }
    if (Math.random() < .5 && !subs.some((s) => s.email === email)) { const s = { email, source: pick(["commande", "compte", "ordessens"]), lang: "fr", at: at.toISOString(), demo: true }; subs.push(s); newSubs.push(s); }
  }
  orders.sort((a, b) => b.at.localeCompare(a.at));
  return { orders, users: newUsers, subs: newSubs };
}

