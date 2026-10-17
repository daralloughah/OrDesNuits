/* =========================================================
   Salon → Affiliés : le tableau de bord du réseau
   « La cote » façon bourse : bougies hebdomadaires, variations,
   abonnés cumulés, commissions, relevés mensuels.
   ========================================================= */
import * as AF from "./affiliates.js";
import { esc } from "../core/util.js";
import { CONTACT } from "../config.js";
import { enabled } from "../core/sb.js";

const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v || 0);
const nb = (v) => new Intl.NumberFormat("fr-FR").format(Math.round(v || 0));
const compact = (v) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v || 0);
const DAY = 864e5;
const ago = (t) => { if (!t) return "jamais"; const d = Math.floor((Date.now() - t) / DAY); return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`; };
const ymLabel = (ym) => new Date(ym + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const TIERS = { bronze: "Bronze", argent: "Argent", or: "Or" };

/* ---------- Graphiques ---------- */
export function candles(weeks, { h = 190 } = {}) {
  const W = 600, H = h, pad = 34;
  const max = Math.max(1, ...weeks.map((w) => w.high));
  const cw = (W - pad) / weeks.length;
  const y = (v) => H - (v / max) * (H - 10) - 2;
  const ticks = [0, .5, 1].map((k) => max * k);
  return `<svg class="candles" viewBox="0 0 ${W} ${H + 22}" role="img" aria-label="Chiffre d'affaires par semaine">
    ${ticks.map((v) => `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="0" y="${y(v) + 3}" class="tick">${compact(v)}</text>`).join("")}
    ${weeks.map((w, i) => {
      const x = pad + i * cw + cw / 2, up = w.close >= w.open;
      const top = y(Math.max(w.open, w.close)), bot = y(Math.min(w.open, w.close));
      return `<g class="${up ? "up" : "down"}"><title>Semaine du ${new Date(w.start + DAY).toLocaleDateString("fr-FR")} : ${eur(w.close)} (${w.n} vente${w.n > 1 ? "s" : ""})</title>
        <line x1="${x}" x2="${x}" y1="${y(w.high)}" y2="${y(w.low)}" class="wick"/>
        <rect x="${x - cw * .3}" y="${top}" width="${cw * .6}" height="${Math.max(2, bot - top)}" rx="1.5" class="body"/>
        ${i % 4 === 3 ? `<text x="${x}" y="${H + 16}" class="lbl" text-anchor="middle">${new Date(w.start + 7 * DAY).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</text>` : ""}</g>`;
    }).join("")}
  </svg>`;
}
export function line(points, { h = 150, label = "" } = {}) {
  const W = 600, H = h, pad = 34;
  if (!points.length) return "";
  const max = Math.max(1, ...points.map((p) => p.v)), min = Math.min(...points.map((p) => p.v)) * 0.96;
  const x = (i) => pad + (i / Math.max(1, points.length - 1)) * (W - pad - 4);
  const y = (v) => H - ((v - min) / Math.max(1, max - min)) * (H - 12) - 4;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const up = points.at(-1).v >= points[0].v;
  return `<svg class="aline ${up ? "up" : "down"}" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="${esc(label)}">
    <defs><linearGradient id="ag${H}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".35"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    ${[min, (min + max) / 2, max].map((v) => `<line x1="${pad}" x2="${W}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="0" y="${y(v) + 3}" class="tick">${compact(v)}</text>`).join("")}
    <path d="${d}L${x(points.length - 1)},${H}L${pad},${H}Z" fill="url(#ag${H})"/>
    <path d="${d}" class="stroke"/>
    ${points.map((p, i) => (i % Math.ceil(points.length / 5) === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H + 15}" class="lbl" text-anchor="middle">${esc(p.l)}</text>` : "").join("")}
  </svg>`;
}
function spark(vals) {
  const W = 92, H = 28, max = Math.max(1, ...vals), min = Math.min(...vals);
  const d = vals.map((v, i) => `${i ? "L" : "M"}${(i / Math.max(1, vals.length - 1)) * W},${H - ((v - min) / Math.max(1, max - min)) * (H - 4) - 2}`).join("");
  const up = vals.at(-1) >= vals[0];
  return `<svg class="spark ${up ? "up" : "down"}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}"/></svg>`;
}
const arrow = (v) => `<span class="chg ${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toLocaleString("fr-FR")} %</span>`;

/* Abonnés cumulés de tout le réseau, semaine par semaine */
function networkFollowers(list, weeks = 16) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const t = Date.now() - i * 7 * DAY;
    out.push({ v: list.reduce((s, a) => s + AF.followersAt(a, t), 0), l: new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) });
  }
  return out;
}

/* ---------- Vue principale ---------- */
export function affView(root, { costTarget = 0, onChange } = {}) {
  const list = AF.all();
  const rows = list.map((a) => ({ a, s: AF.stats(a) }));
  const active = rows.filter((r) => r.a.status === "actif");
  const allOrders = rows.flatMap((r) => r.s.orders);
  const fol = rows.reduce((s, r) => s + r.s.followers, 0);
  const fol30 = list.reduce((s, a) => s + AF.followersAt(a, Date.now() - 30 * DAY), 0);
  const folChg = fol30 ? Math.round(((fol - fol30) / fol30) * 1000) / 10 : 0;
  const sum = (k) => rows.reduce((s, r) => s + r.s[k].n, 0);
  const rev30 = rows.reduce((s, r) => s + r.s.month.rev, 0);
  const due = rows.reduce((s, r) => s + r.s.due, 0);
  const commPerOrder = allOrders.length ? rows.reduce((s, r) => s + r.s.earned, 0) / allOrders.length : 0;
  const weeks = AF.weekly(allOrders, 16);
  const stale = rows.filter((r) => r.a.status === "actif" && Date.now() - AF.lastUpdate(r.a) > 14 * DAY);
  const idle = rows.filter((r) => r.a.status === "actif" && (!r.s.last || Date.now() - r.s.last > 21 * DAY));
  const best = [...rows].sort((x, y) => y.s.month.rev - x.s.month.rev)[0];
  const conv = [...rows].filter((r) => r.s.followers > 0 && r.s.month.n > 0).sort((x, y) => y.s.perK - x.s.perK)[0];
  const sorted = [...rows].sort((x, y) => y.s.month.rev - x.s.month.rev || y.s.followers - x.s.followers);

  root.innerHTML = `
  <header class="adm2-head row"><div><p class="eyebrow">Réseau</p><h1 class="display">Affiliés</h1>
    <p class="sub">${list.length} affilié${list.length > 1 ? "s" : ""} · ${compact(fol)} abonnés cumulés · ventes suivies grâce aux liens ?ref=CODE</p></div>
    <button type="button" class="adm-btn gold" data-afnew>+ Nouvel affilié</button></header>
  ${list.length ? "" : `<section class="adm2-box"><p>Aucun affilié pour l'instant. Ajoute ton premier partenaire, ou charge des profils de démonstration pour voir le tableau de bord vivre.</p>
    <div class="at-row wrap"><button type="button" class="adm-btn gold" data-afnew>+ Nouvel affilié</button><button type="button" class="adm-btn ghost" data-afdemo>Charger des affiliés de démo</button></div></section>`}

  <div class="adm2-kpis">
    <div class="kpi2 lead"><span>Abonnés cumulés</span><b>${compact(fol)}</b><small>${arrow(folChg)} sur 30 jours</small></div>
    <div class="kpi2"><span>Ventes via affiliés</span><b>${nb(sum("month"))}</b><small>${nb(sum("week"))} cette semaine · ${nb(sum("year"))} sur 12 mois</small></div>
    <div class="kpi2"><span>CA via affiliés · 30 j</span><b>${eur(rev30)}</b><small>${active.length} affilié${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""}</small></div>
    <div class="kpi2 ${due > 0 ? "warn" : ""}"><span>Commissions à verser</span><b>${eur(due)}</b><small>cumul non payé</small></div>
  </div>
  ${commPerOrder ? `<p class="af-compare">Un client via affilié te coûte en moyenne <b>${eur(commPerOrder)}</b> de commission${costTarget ? `, contre un objectif pub de <b>${eur(costTarget)}</b> par commande : ${commPerOrder <= costTarget ? "<em class=\"ok\">les affiliés sont plus rentables que la pub ✦</em>" : "<em class=\"ko\">la pub te revient moins cher en ce moment</em>"}` : ""}.</p>` : ""}

  <div class="adm2-two">
    <section class="adm2-box"><div class="adm2-boxhead"><h2 class="display">Le cours du réseau</h2><small class="muted">CA hebdo · 16 semaines</small></div>
      ${candles(weeks)}<p class="at-hint">Bougie verte : semaine meilleure que la précédente. Rouge : moins bonne. Mèches : rythme du meilleur et du pire jour.</p></section>
    <section class="adm2-box"><div class="adm2-boxhead"><h2 class="display">Abonnés cumulés</h2><small class="muted">${arrow(folChg)}</small></div>
      ${line(networkFollowers(list), { label: "Abonnés cumulés" })}</section>
  </div>

  ${list.length ? `<section class="adm2-box">
    <div class="adm2-boxhead"><h2 class="display">La cote</h2><small class="muted">classement des 30 derniers jours</small></div>
    <ul class="ticker">${sorted.map(({ a, s }, i) => `
      <li data-afopen="${esc(a.id)}">
        <span class="tk-rank">${i + 1}</span>
        <span class="tk-id"><i class="tk-av">${esc((a.name || a.code).slice(0, 1))}</i><span><b>${esc(a.name || a.code)}</b><small>${esc(a.handle || "")} · ${esc(AF.SECTORS[a.sector] || "")}</small></span></span>
        <span class="tk-code">${esc(a.code)}<em class="tier ${s.tier}">${TIERS[s.tier]}</em>${a.status !== "actif" ? `<em class="st">${AF.STATUS[a.status]}</em>` : ""}</span>
        <span class="tk-num tf"><b>${compact(s.followers)}</b><small>abonnés</small></span>
        <span class="tk-num tv"><b>${s.week.n} · ${s.month.n} · ${s.year.n}</b><small>ventes 7 j · 30 j · 1 an</small></span>
        <span class="tk-num tr"><b>${eur(s.month.rev)}</b><small>${arrow(s.change)}</small></span>
        ${spark(AF.weekly(s.orders, 10).map((w) => w.close))}
        <span class="tk-num td ${s.due > 0 ? "due" : ""}"><b>${eur(s.due)}</b><small>${a.pct || 0} % · à verser</small></span>
      </li>`).join("")}</ul>
  </section>

  <section class="adm2-box insights"><h2 class="display">Pistes</h2><ul>
    ${best && best.s.month.rev ? `<li class="ins bien"><i></i><p>${esc(best.a.name)} est ton meilleur affilié du mois (${eur(best.s.month.rev)}). Propose-lui un code exclusif ou un palier de commission supérieur pour le garder motivé.</p></li>` : ""}
    ${conv ? `<li class="ins idee"><i></i><p>Meilleure conversion : ${esc(conv.a.name)}, ${conv.s.perK.toLocaleString("fr-FR")} ventes pour 10 000 abonnés. Son audience achète : cherche des profils qui lui ressemblent (${esc(AF.SECTORS[conv.a.sector] || "même univers")}, ~${conv.a.audienceAge || "?"} ans).</p></li>` : ""}
    ${stale.length ? `<li class="ins stock"><i></i><p>Abonnés à mettre à jour : ${stale.map((r) => esc(r.a.name)).join(", ")} (plus de 14 jours). Demande-leur une capture de leur profil.</p></li>` : ""}
    ${idle.length ? `<li class="ins urgent"><i></i><p>Aucune vente depuis 3 semaines : ${idle.map((r) => esc(r.a.name)).join(", ")}. Un petit message, un nouveau visuel du Studio pub, ou une mise en pause du contrat.</p></li>` : ""}
    <li class="ins idee"><i></i><p>Paliers automatiques suggérés : Bronze (moins de 5 ventes/mois), Argent (5 à 19), Or (20 et plus). Annonce-les dans le contrat : c'est la meilleure motivation.</p></li>
  </ul></section>

  <section class="adm2-box"><h2 class="display">Relevés</h2>
    <p class="at-hint">Le relevé du mois de chaque affilié (ventes, CA, commission), à télécharger pour ta comptabilité ou à envoyer sur WhatsApp depuis sa fiche.</p>
    <div class="at-row wrap"><button type="button" class="adm-btn ghost" data-afcsv="0">Relevé du mois en cours (CSV)</button><button type="button" class="adm-btn ghost" data-afcsv="1">Relevé du mois dernier (CSV)</button></div>
  </section>` : ""}`;

  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-afnew],[data-afdemo],[data-afopen],[data-afcsv]");
    if (!b) return;
    if (b.hasAttribute("data-afnew")) return sheet(null, () => { affView(root, { costTarget, onChange }); onChange?.(); });
    if (b.hasAttribute("data-afdemo")) { for (const a of AF.demoProfiles()) await AF.save(a); affView(root, { costTarget, onChange }); return; }
    if (b.dataset.afopen) return sheet(b.dataset.afopen, () => { affView(root, { costTarget, onChange }); onChange?.(); });
    if (b.dataset.afcsv) {
      const d = new Date(); d.setMonth(d.getMonth() - Number(b.dataset.afcsv));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const rowsCsv = [["Mois", "Code", "Affilié", "Ventes", "CA (€)", "Commission (%)", "Commission (€)", "Payée"], ...AF.all().map((a) => { const st = AF.statement(a, ym); return [ym, a.code, a.name, st.n, st.rev.toFixed(2).replace(".", ","), a.pct, st.commission.toFixed(2).replace(".", ","), st.paid ? "oui" : "non"]; })];
      const csv = "﻿" + rowsCsv.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `releve-affilies-${ym}.csv` });
      document.body.append(a); a.click(); a.remove();
    }
  });
}

/* ---------- Fiche d'un affilié ---------- */
function sheet(id, done) {
  const base = id ? AF.find(id) : null;
  const a = base ? structuredClone(base) : { code: "", name: "", handle: "", age: "", audienceAge: "", sector: "lifestyle", pct: 10, status: "actif", start: new Date().toISOString().slice(0, 10), phone: "", email: "", notes: "", networks: [{ net: "Snapchat", handle: "", hist: [] }], payouts: [] };
  const el = document.createElement("div");
  el.className = "adm-editor aff-sheet";
  document.body.append(el);
  document.documentElement.classList.add("no-scroll");
  const close = () => { el.remove(); document.documentElement.classList.remove("no-scroll"); };
  const link = () => { const u = new URL("maisons.html", location.href); u.search = ""; u.hash = ""; u.searchParams.set("ref", a.code || "CODE"); return u.href; };
  const opts = (o, cur) => Object.entries(o).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(v)}</option>`).join("");
  const f = (label, html) => `<label class="fld"><span>${label}</span>${html}</label>`;

  function months(n = 6) {
    const out = []; const d = new Date(); d.setDate(1);
    for (let i = 0; i < n; i++) { out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() - 1); }
    return out;
  }

  function render() {
    const s = base ? AF.stats(a) : null;
    el.innerHTML = `
    <header class="at-top"><button type="button" class="at-icon" data-x aria-label="Fermer">✕</button><b class="display">${base ? esc(a.name || a.code) : "Nouvel affilié"}</b>
      <button type="button" class="adm-btn gold" data-save>Enregistrer</button></header>
    <div class="ed-body one">
      ${s ? `
      <section class="adm2-box">
        <div class="aff-top"><i class="tk-av big">${esc((a.name || a.code).slice(0, 1))}</i><div><h2 class="display">${esc(a.name)}</h2><p class="muted">${esc(a.handle || "")} · code <b>${esc(a.code)}</b> · <em class="tier ${s.tier}">${TIERS[s.tier]}</em> · ${AF.STATUS[a.status]}</p></div></div>
        <div class="adm2-kpis">
          <div class="kpi2"><span>Ventes</span><b>${s.week.n} · ${s.month.n} · ${s.year.n}</b><small>7 jours · 30 jours · 12 mois</small></div>
          <div class="kpi2"><span>CA · 30 j</span><b>${eur(s.month.rev)}</b><small>${arrow(s.change)} vs mois d'avant</small></div>
          <div class="kpi2"><span>Commission</span><b>${eur(s.earned)}</b><small>${a.pct} % · payé ${eur(s.paid)} · <b>à verser ${eur(s.due)}</b></small></div>
          <div class="kpi2"><span>Conversion</span><b>${s.perK.toLocaleString("fr-FR")}</b><small>ventes / 10 000 abonnés · ${eur(s.revPerK)} pour 1 000</small></div>
          <div class="kpi2"><span>Abonnés</span><b>${compact(s.followers)}</b><small>mis à jour ${ago(AF.lastUpdate(a))}</small></div>
          <div class="kpi2"><span>Panier moyen</span><b>${eur(s.basket)}</b><small>dernière vente ${ago(s.last)}</small></div>
          <div class="kpi2"><span>CA total</span><b>${eur(s.total)}</b><small>${s.count} ventes depuis le début</small></div>
          <div class="kpi2"><span>Âge · audience</span><b>${a.age || "?"} · ${a.audienceAge || "?"} ans</b><small>${esc(AF.SECTORS[a.sector] || "")}</small></div>
        </div>
      </section>
      <section class="adm2-box"><div class="adm2-boxhead"><h2 class="display">Son cours</h2><small class="muted">CA hebdo · 16 semaines</small></div>${candles(AF.weekly(s.orders, 16))}</section>` : ""}

      <section class="adm2-box"><h2 class="display">Abonnés par réseau</h2>
        ${(a.networks || []).map((n, i) => `
          <div class="aff-net">
            <div class="fld-row three">
              ${f("Réseau", `<select class="adm-input" data-net="${i}" data-k="net">${AF.NETWORKS.map((x) => `<option ${x === n.net ? "selected" : ""}>${x}</option>`).join("")}</select>`)}
              ${f("Pseudo", `<input class="adm-input" data-net="${i}" data-k="handle" value="${esc(n.handle || "")}">`)}
              ${f(`Abonnés aujourd'hui <small>(actuel : ${nb(AF.lastCount(n))}, ${ago(n.hist?.length ? new Date(n.hist.at(-1).at).getTime() : 0)})</small>`, `<input class="adm-input" data-net="${i}" data-k="count" inputmode="numeric" placeholder="${AF.lastCount(n) || "Ex. 25000"}">`)}
              <button type="button" class="adm-btn ghost" data-rmnet="${i}">Retirer</button>
            </div>
            ${n.hist?.length > 1 ? line(n.hist.map((x) => ({ v: x.n, l: new Date(x.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) })), { h: 90, label: n.net }) : ""}
          </div>`).join("")}
        <button type="button" class="adm-btn ghost" data-addnet>+ Ajouter un réseau</button>
        <p class="at-hint">Saisis le chiffre du jour : l'historique et la courbe se construisent tout seuls. Le Salon te signale les profils pas mis à jour depuis 14 jours. Une mise à jour automatique sera possible plus tard via les API officielles TikTok et Instagram, avec l'accord de l'affilié (Snapchat ne le permet pas).</p>
      </section>

      <section class="adm2-box"><h2 class="display">Fiche</h2>
        <div class="fld-row">${f("Prénom et nom", `<input class="adm-input" data-k="name" value="${esc(a.name)}">`)}${f("Pseudo principal", `<input class="adm-input" data-k="handle" value="${esc(a.handle || "")}">`)}</div>
        <div class="fld-row">${f("Code (lien ?ref=)", `<input class="adm-input" data-k="code" value="${esc(a.code)}" ${base ? "readonly" : ""} placeholder="LINA">`)}${f("Commission (%)", `<input class="adm-input" data-k="pct" inputmode="decimal" value="${a.pct ?? ""}">`)}</div>
        <div class="fld-row">${f("Remise pour son audience (%)", `<input class="adm-input" data-k="promoPct" inputmode="decimal" placeholder="0 = aucune" value="${a.promoPct ?? ""}">`)}<p class="at-hint" style="align-self:end">Son code donne cette remise à ses abonnés (30 % max), et la vente lui est attribuée. Commission calculée après remise.</p></div>
        <div class="fld-row three">${f("Âge", `<input class="adm-input" data-k="age" inputmode="numeric" value="${a.age ?? ""}">`)}${f("Âge moyen de l'audience", `<input class="adm-input" data-k="audienceAge" inputmode="numeric" value="${a.audienceAge ?? ""}">`)}${f("Milieu", `<select class="adm-input" data-k="sector">${opts(AF.SECTORS, a.sector)}</select>`)}${f("Statut", `<select class="adm-input" data-k="status">${opts(AF.STATUS, a.status)}</select>`)}</div>
        <div class="fld-row three">${f("Début du contrat", `<input class="adm-input" type="date" data-k="start" value="${esc(a.start || "")}">`)}${f("Téléphone (WhatsApp)", `<input class="adm-input" data-k="phone" inputmode="tel" value="${esc(a.phone || "")}">`)}${f("E-mail (accès à son espace)", `<input class="adm-input" data-k="email" inputmode="email" value="${esc(a.email || "")}">`)}</div>
        ${f("Notes", `<textarea class="adm-input" data-k="notes" rows="3">${esc(a.notes || "")}</textarea>`)}
        <p class="at-label">Son lien</p>
        <div class="aff-link"><code>${esc(link())}</code><button type="button" class="adm-btn ghost" data-copylink>Copier</button></div>
        ${base ? `<p class="at-hint">Son espace partenaire : <a class="adm-link" href="partenaire.html${enabled ? "" : `?demo=${encodeURIComponent(a.code)}`}" target="_blank">partenaire.html</a> (il s'y connecte avec l'e-mail ci-dessus, et voit ses ventes, son palier, son QR code et son kit).</p>` : ""}
      </section>

      ${base ? `<section class="adm2-box"><h2 class="display">Relevés mensuels</h2>
        <ul class="aff-st">${months().map((ym) => { const st = AF.statement(a, ym); return `<li><span><b>${ymLabel(ym)}</b><small>${st.n} vente${st.n > 1 ? "s" : ""} · CA ${eur(st.rev)}</small></span><b>${eur(st.commission)}</b>
          ${st.commission > 0 ? (st.paid ? `<em class="paid">Payée ✓</em>` : `<button type="button" class="adm-btn ghost" data-pay="${ym}">Marquer payée</button>`) : `<em class="muted">—</em>`}
          ${st.n ? `<button type="button" class="adm-btn ghost" data-wa="${ym}">WhatsApp</button>` : ""}</li>`; }).join("")}</ul></section>
      <button type="button" class="adm-btn danger" data-del>Supprimer cet affilié</button>` : ""}
    </div>`;
  }

  function read() {
    el.querySelectorAll("[data-k]").forEach((i) => {
      if (i.dataset.net != null) {
        const n = a.networks[Number(i.dataset.net)];
        if (i.dataset.k === "count") { const v = parseInt(i.value.replace(/\s/g, ""), 10); n._new = isNaN(v) ? null : v; }
        else n[i.dataset.k] = i.value;
      } else a[i.dataset.k] = ["pct", "promoPct", "age", "audienceAge"].includes(i.dataset.k) ? (i.value === "" ? "" : Number(String(i.value).replace(",", "."))) : i.value.trim();
    });
  }

  render();
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if ("x" in d) return close();
    if ("addnet" in d) { read(); a.networks.push({ net: "TikTok", handle: "", hist: [] }); return render(); }
    if (d.rmnet) { read(); a.networks.splice(Number(d.rmnet), 1); return render(); }
    if ("copylink" in d) { read(); try { await navigator.clipboard.writeText(link()); b.textContent = "Copié ✦"; } catch {} return; }
    if (d.pay) { read(); const st = AF.statement(a, d.pay); a.payouts = [...(a.payouts || []), { month: d.pay, amount: st.commission, at: new Date().toISOString() }]; await AF.save(a); return render(); }
    if (d.wa) {
      const st = AF.statement(a, d.wa);
      const msg = `Bonjour ${a.name?.split(" ")[0] || ""}, voici ton relevé OrDesNuits de ${ymLabel(d.wa)} :\n• ${st.n} vente${st.n > 1 ? "s" : ""} avec ton code ${a.code}\n• Chiffre d'affaires : ${eur(st.rev)}\n• Ta commission (${a.pct} %) : ${eur(st.commission)}${st.paid ? " (versée ✓)" : ""}\nMerci pour ton travail ✦`;
      const phone = String(a.phone || "").replace(/\D/g, "");
      window.open(`https://wa.me/${phone || CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
      return;
    }
    if ("del" in d) { if (confirm(`Supprimer ${a.name || a.code} ?`)) { await AF.remove(a.id); close(); done(); } return; }
    if ("save" in d) {
      read();
      if (!a.code || !a.name) { alert("Indique au moins un nom et un code."); return; }
      if (!base && AF.find(a.code.toUpperCase())) { alert("Ce code existe déjà."); return; }
      a.networks.forEach((n, i) => { if (n._new != null) AF.addCount(a, i, n._new); delete n._new; });
      const ok = await AF.save(a);
      if (!ok) { alert("Enregistrement impossible."); return; }
      close(); done();
    }
  });
}
