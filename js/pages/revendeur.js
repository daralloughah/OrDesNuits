/* =========================================================
   Espace revendeurs : panier mélangé de boîtes.
   La remise dépend du MONTANT TOTAL (grille par montant tirée
   des paliers du produit de référence) : 3 boîtes à 30 €,
   3 à 50 € et 3 à 60 € ont la même remise qu'une seule sorte
   de boîte pour le même montant.
   Demande envoyée sur WhatsApp (validation manuelle).
   ========================================================= */
import { initI18n, t, translateDom, currentLang } from "../core/i18n.js";
import { loadCatalogue } from "../core/catalogue.js";
import { mountChrome, esc, toast, softImages } from "../ui/chrome.js";
import { media, ORN, ornament } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { price } from "../core/money.js";
import { CONTACT } from "../config.js";
import { wholesale, proGrid, proQuote } from "../core/pricing.js";

const app = document.getElementById("app");
const KEY = "odn.pro2";
const lang = () => currentLang().split("-")[0];
const pick = (o) => (o && (typeof o === "string" ? o : o[lang()] || o.en || o.fr)) || "";
let items = [], grid = null;
let picks = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(picks)); } catch {} };
const qty = (id) => picks[id] || 0;

function rowHtml(p) {
  const w = wholesale(p);
  return `
  <article class="pro-row reveal" data-id="${esc(p.id)}">
    <a class="pro-thumb" href="produit.html#${encodeURIComponent(p.id)}" aria-label="${esc(p.name)}">${media(p)}</a>
    <div class="pro-info">
      <p class="eyebrow m-0"><span data-i="cat_${p.category}"></span></p>
      <h2 class="display">${esc(p.name)}</h2>
      <p class="pro-unit">${ICONS.crate}<span>${esc(pick(w.unit))}</span></p>
      <p class="pro-base">${esc(t("rv_per", { price: price(w.base) }))}</p>
    </div>
    <div class="pro-step">
      <button type="button" data-d="-1" aria-label="−">−</button>
      <output data-n>${qty(p.id)}</output>
      <button type="button" data-d="1" aria-label="+">+</button>
      <div class="pro-quick">${[5, 10].map((n) => `<button type="button" data-plus="${n}">+${n}</button>`).join("")}</div>
      <small class="pro-line" data-line></small>
    </div>
  </article>`;
}

function gridHtml() {
  const steps = grid.steps.filter((s) => s.from > 0 && s.pct > 0.0005);
  return `<ul class="pro-ladder">${steps.map((s) => `<li data-from="${s.from}"><b>−${Math.round(s.pct * 100)} %</b><small>${esc(t("rv_from_amt", { eur: price(s.from) }))}</small></li>`).join("")}</ul>`;
}

function paint() {
  const lines = items.map((p) => ({ p, n: qty(p.id) }));
  const q = proQuote(lines, grid);
  // lignes
  app.querySelectorAll(".pro-row").forEach((row) => {
    const n = qty(row.dataset.id);
    row.querySelector("[data-n]").textContent = n;
    row.classList.toggle("on", n > 0);
    const r = q.rows.find((x) => x.p.id === row.dataset.id);
    row.querySelector("[data-line]").innerHTML = r ? `${r.total < r.base ? `<s>${price(r.base)}</s> ` : ""}<b>${price(r.total)}</b>` : "";
  });
  // échelle des remises
  app.querySelectorAll(".pro-ladder li").forEach((li) => li.classList.toggle("on", q.base >= Number(li.dataset.from) - 0.001));
  const steps = grid.steps.filter((s) => s.pct > 0.0005);
  const topFrom = steps.at(-1)?.from || 1;
  const bar = document.getElementById("proBar");
  if (bar) bar.style.setProperty("--fill", Math.min(100, (q.base / topFrom) * 100) + "%");

  // résumé
  const box = document.getElementById("proSum");
  if (!q.boxes) {
    box.innerHTML = `<p class="text-muted m-0">${ICONS.crate}</p><p class="text-muted m-0">${esc(t("rv_empty"))}</p>`;
    return q;
  }
  box.innerHTML = `
    <ul>${q.rows.map((r) => `<li><span><b>${esc(r.p.name)}</b><small>${esc(t("rv_boxes", { n: r.n }))}</small></span><span>${price(r.total)}</span></li>`).join("")}</ul>
    <p class="co-line"><span>${esc(t("rv_subtotal"))}</span><span>${price(q.base)}</span></p>
    ${q.eur > 0 ? `<p class="co-line rose"><span>${esc(t("rv_discount", { pct: q.pct }))}</span><span>−${price(q.eur)}</span></p>` : ""}
    <p class="co-line total"><span>${esc(t("rv_total"))}</span><span>${price(q.total)}</span></p>
    ${q.next ? `<p class="pq-next">✦ ${esc(t("rv_next_amt", { eur: price(q.next.missing), pct: q.next.pct }))}</p>` : `<p class="pq-next">✦ ${esc(t("rv_top"))}</p>`}
    ${q.okMin ? "" : `<p class="pro-warn">${ICONS.warn}<span>${esc(t("rv_min", { n: q.minBoxes }))}</span></p>`}
    <label class="co-f"><span>Société / boutique</span><input class="co-in" id="proCo" autocomplete="organization" value="${esc(picks._co || "")}"></label>
    <label class="co-f"><span data-i="co_city"></span><input class="co-in" id="proCity" autocomplete="address-level2" value="${esc(picks._city || "")}"></label>
    <button type="button" class="btn btn-gold w-full" id="proSend" ${q.okMin ? "" : "disabled"}>${ICONS.whatsapp}<span data-i="rv_order"></span></button>`;
  translateDom(box);
  return q;
}

async function render() {
  mountChrome({ active: "pro", onLangChange: render });
  const { products } = await loadCatalogue();
  items = products.filter((p) => p.active !== false && wholesale(p));
  grid = proGrid(items);
  app.innerHTML = `
  <section class="pro-hero">
    <div class="bg" aria-hidden="true"><picture><source media="(max-width:700px)" srcset="assets/img/pro-hero-m.webp"><img data-soft src="assets/img/pro-hero.webp" alt=""></picture></div>
    <div class="wrap">
      <p class="eyebrow m-0">${ORN}OrDesNuits · Pro</p>
      <h1 class="display" data-i="rv_title"></h1>
      <p class="lead" data-i="rv_sub"></p>
      ${ornament("w-52 text-[var(--accent)]")}
      <ul class="pro-why">
        <li>${ICONS.seal}<span data-i="rv_why1"></span></li>
        <li>${ICONS.lock}<span data-i="rv_why2"></span></li>
        <li>${ICONS.box}<span data-i="rv_why3"></span></li>
      </ul>
    </div>
  </section>
  <section class="wrap pro-layout pb-28">
    <div class="pro-list">
      <div class="pro-scale">
        <p class="eyebrow m-0">${ORN}<span data-i="rv_grid"></span></p>
        <p class="text-muted m-0" data-i="rv_mix"></p>
        <div class="pro-bar" id="proBar"><i></i></div>
        ${gridHtml()}
      </div>
      ${items.map(rowHtml).join("") || `<p class="text-muted">—</p>`}
    </div>
    <aside class="pro-aside">
      <h2 class="display" data-i="rv_order"></h2>
      <div id="proSum"></div>
      <p class="at-hint" data-i="rv_note"></p>
    </aside>
  </section>`;
  translateDom(app);
  softImages(app);
  paint();
}

function setQty(id, n) {
  const w = wholesale(items.find((x) => x.id === id));
  picks[id] = Math.max(0, Math.min(w.max, n));
  if (!picks[id]) delete picks[id];
  keep(); paint();
}

app.addEventListener("input", (e) => {
  if (e.target.id === "proCo") { picks._co = e.target.value; keep(); }
  if (e.target.id === "proCity") { picks._city = e.target.value; keep(); }
});
app.addEventListener("click", (e) => {
  const row = e.target.closest(".pro-row");
  const d = e.target.closest("[data-d]");
  if (d && row) { setQty(row.dataset.id, qty(row.dataset.id) + Number(d.dataset.d)); return; }
  const plus = e.target.closest("[data-plus]");
  if (plus && row) { setQty(row.dataset.id, qty(row.dataset.id) + Number(plus.dataset.plus)); return; }
  if (e.target.closest("#proSend")) {
    const q = proQuote(items.map((p) => ({ p, n: qty(p.id) })), grid);
    if (!q.okMin) return;
    const msg = `Bonjour OrDesNuits, demande revendeur :\n${q.rows.map((r) => `• ${r.n} × ${pick(wholesale(r.p).unit) || "boîte"} ${r.p.name}`).join("\n")}` +
      `\nSous-total : ${price(q.base)}${q.eur ? `\nRemise pro −${q.pct} % : −${price(q.eur)}` : ""}\nTotal : ${price(q.total)}` +
      `\nSociété : ${picks._co || ""}\nVille : ${picks._city || ""}`;
    window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
    toast(t("toast_added"));
  }
});

await initI18n();
render();
