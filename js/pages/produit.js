/* =========================================================
   Fiche produit : produit.html#identifiant
   Galerie · formats avec économies calculées · rituel,
   composition, mises en garde · barre d'achat collante
   ========================================================= */
import { initI18n, t, translateDom, currentLang } from "../core/i18n.js";
import { findProduct, productsOf, bestOf, isSoldOut } from "../core/catalogue.js";
import { mountChrome, addToCart, esc } from "../ui/chrome.js";
import { card, media, ribbon, ORN, ornament, divider, enableTilt, stockNote } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { price, priceLux } from "../core/money.js";
import { reviewsOf } from "../core/shop.js";
import { track } from "../core/track.js";
import { CONTACT, EDITION } from "../config.js";
import { tiers, hasTiers, saving, unitPrice, popularTier, bestValueTier } from "../core/pricing.js";

let gallery = [];
let current = null;
let sel = 1;     // format choisi (nombre d'unités)
let qty = 1;     // produits sans formats : quantité
const idFromHash = () => decodeURIComponent(location.hash.slice(1));
const lang = () => currentLang().split("-")[0];

/* Texte dans la langue du visiteur (sinon anglais, sinon français) */
const pick = (obj) => (obj && (obj[lang()] || obj.en || obj.fr)) || "";

/* « 6 sticks », « 1 stick »… (sinon « × 6 ») */
function unitLabel(p, q) {
  const u = p.unitName?.[lang()] || p.unitName?.en || p.unitName?.fr;
  return u ? `${q} ${q > 1 ? u[1] : u[0]}` : `× ${q}`;
}

function offersHtml(p) {
  const list = tiers(p);
  const pop = popularTier(p), bestQ = bestValueTier(p);
  return `
  <fieldset class="offers" aria-describedby="ppPer">
    <legend class="eyebrow">${ORN}<span>${esc(t("pp_choose"))}</span></legend>
    ${list.map((x) => {
      const s = saving(p, x);
      const flag = x.q === bestQ && x.q !== 1 ? "best" : x.q === pop ? "popular" : "";
      return `
      <label class="offer ${flag ? "has-flag" : ""}" data-q="${x.q}">
        <input type="radio" name="offer" value="${x.q}" ${x.q === sel ? "checked" : ""}>
        ${flag ? `<span class="o-flag ${flag}">${esc(t(flag === "best" ? "pp_best" : "pp_popular"))}</span>` : ""}
        <span class="o-qty"><b>${x.q}</b></span>
        <span class="o-mid"><span class="o-name">${esc(unitLabel(p, x.q))}</span>
          <span class="o-per">${esc(t("pp_per", { price: price(s.per) }))}</span></span>
        <span class="o-price"><b class="lux-price">${priceLux(x.p)}</b>${EDITION.active && x.q >= EDITION.min ? `<em class="o-ed">${esc(t("ed_badge"))}</em>` : ""}${s.pct > 0 ? `<s>${price(unitPrice(p) * x.q)}</s>` : ""}</span>
        ${s.pct > 0 ? `<span class="o-save">−${s.pct} %</span>` : `<span class="o-save ghost"></span>`}
      </label>`;
    }).join("")}
  </fieldset>`;
}

/* Avis vérifiés (uniquement des clients livrés, relus par le gérant) */
async function paintReviews(p) {
  const list = await reviewsOf(p.id);
  const el = document.getElementById("reviews");
  if (!el || !list.length) return;
  const avg = list.reduce((s, r) => s + r.rating, 0) / list.length;
  const stars = (n) => `<span class="stars" aria-label="${n}/5">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`;
  el.innerHTML = `${divider("mt-20 mb-10")}
    <div class="section-head"><div><p class="eyebrow m-0">${ORN}<span>${esc(t("rev_verified"))}</span></p><h2 class="display">${esc(t("rev_title"))}</h2></div><p class="rv-avg">${stars(avg)} <b>${avg.toFixed(1).replace(".", ",")}</b> · ${list.length}</p></div>
    <ul class="reviews">${list.slice(0, 6).map((r) => `<li>${stars(r.rating)}<p>${esc(r.body)}</p><small>${esc(r.name || "—")} · ${new Date(r.created_at).toLocaleDateString(currentLang(), { month: "long", year: "numeric" })} · <em>${esc(t("rev_verified"))}</em></small></li>`).join("")}</ul>`;
}

/* Prix affiché pour le format choisi */
function currentDeal(p) {
  if (!hasTiers(p)) {
    const u = unitPrice(p);
    return { q: qty, total: u * qty, was: p.promo && p.promo < p.price ? p.price * qty : 0, per: u, save: 0 };
  }
  const x = tiers(p).find((y) => y.q === sel) || tiers(p)[0];
  const s = saving(p, x);
  return { q: x.q, total: x.p, was: s.pct > 0 ? unitPrice(p) * x.q : 0, per: s.per, save: s.eur, pct: s.pct };
}

function paintDeal() {
  const p = current;
  if (!p) return;
  const d = currentDeal(p);
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set("ppNow", priceLux(d.total));
  set("ppWas", d.was ? `<s>${price(d.was)}</s>` : "");
  set("ppPer", d.q > 1 ? esc(t("pp_per", { price: price(d.per) })) : "");
  set("ppSave", d.save > 0 ? `${ICONS.seal}<span>${esc(t("pp_save", { eur: price(d.save) }))}</span>` : "");
  document.getElementById("ppSave")?.toggleAttribute("hidden", !(d.save > 0));
  set("stkName", esc(hasTiers(p) ? unitLabel(p, d.q) : `${p.name}`));
  set("stkPrice", price(d.total));
  document.querySelectorAll("[data-buy-total]").forEach((el) => (el.textContent = price(d.total)));
  document.querySelectorAll(".offer").forEach((o) => o.classList.toggle("on", Number(o.dataset.q) === d.q));
}

function waLink(p) {
  const d = currentDeal(p);
  const msg = `Bonjour OrDesNuits, je souhaite commander :\n• ${d.q} × ${p.name} (${price(d.total)})`;
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function accordion(key, body, { open = false, cls = "", icon = "" } = {}) {
  if (!body) return "";
  return `<details class="acc ${cls}" ${open ? "open" : ""}>
    <summary>${icon}<span>${esc(t(key))}</span><i aria-hidden="true"></i></summary>
    <div class="acc-body">${body}</div></details>`;
}
const paras = (txt) => txt ? esc(txt).split(/\n+/).map((l) => `<p>${l}</p>`).join("") : "";
const bullets = (txt) => txt ? `<ul>${esc(txt).split(/\n+/).map((l) => `<li>${l}</li>`).join("")}</ul>` : "";

async function render() {
  const p = await findProduct(idFromHash());
  const app = document.getElementById("app");
  if (p) document.body.dataset.shop = p.shop;
  mountChrome({ active: p?.shop, onLangChange: render });
  if (!p) {
    app.innerHTML = `<section class="wrap py-28 text-center"><h1 class="display text-4xl italic" data-i="not_found"></h1><a class="btn btn-gold mt-8" href="maisons.html" data-i="nav_houses"></a></section>`;
    translateDom(app);
    return;
  }
  document.title = document.documentElement.classList.contains("discreet") ? "Boutique" : `${p.name} · OrDesNuits`;
  if (current?.id !== p.id) { sel = popularTier(p) || 1; qty = 1; }
  current = p;
  gallery = [p.img, ...(p.gallery || [])].filter(Boolean);

  const best = (await bestOf(p.shop)).some((b) => b.id === p.id);
  const others = (await productsOf(p.shop)).filter((x) => x.id !== p.id);
  const related = [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, 4);
  const desc = pick(p.desc) || t("desc_default");
  const facts = p.facts?.[lang()] || p.facts?.en || p.facts?.fr || [];
  const out = isSoldOut(p);

  app.innerHTML = `
  <section class="wrap pp2 pt-8 pb-20">
    <a class="crumb" href="boutique.html#${p.shop}">← <span data-i="back_${p.shop}"></span></a>
    <div class="pp2-grid">
      <div class="pp2-gallery reveal">
        <div class="pp-media f-${p.frame || "none"}" data-tilt><span class="sheen" aria-hidden="true"></span>${ribbon(p, best)}<div id="stage">${media(p, true)}</div></div>
        ${gallery.length > 1 ? `<div class="thumbs">${gallery.map((src, i) => `<button type="button" data-shot="${i}" aria-pressed="${i === 0}" aria-label="${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      </div>

      <div class="pp2-buy reveal d1">
        <p class="eyebrow m-0">${ORN}<span data-i="${p.shop === "lui" ? "him" : "her"}"></span> · <span data-i="cat_${p.category}"></span></p>
        <h1 class="display pp2-title">${esc(p.name)}</h1>
        ${ornament("pp2-orn")}
        ${facts.length ? `<ul class="facts">${facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}

        <div class="pp2-price">
          <span class="now" id="ppNow"></span><span class="was" id="ppWas"></span>
          <span class="per" id="ppPer"></span>
        </div>
        <p class="save-pill" id="ppSave" hidden></p>
        ${stockNote(p)}

        ${hasTiers(p) ? offersHtml(p) : `<div class="stepper self-start"><button type="button" data-step="-1" aria-label="−">−</button><output id="qty">${qty}</output><button type="button" data-step="1" aria-label="+">+</button></div>`}

        <div class="pp2-cta" id="mainCta">
          ${out ? `<span class="btn btn-ghost pointer-events-none opacity-70" data-i="sold_out"></span>`
            : `<button class="btn btn-gold buy" type="button" data-buy><span data-i="add"></span><b aria-hidden="true">·</b><b data-buy-total></b></button>`}
          <a class="btn btn-ghost wa-btn" href="${waLink(p)}" target="_blank" rel="noopener" id="waBuy">${ICONS.whatsapp}<span data-i="pp_wa"></span></a>
        </div>

        <ul class="trust">
          <li>${ICONS.box}<span data-i="tr_1"></span></li>
          <li>${ICONS.clock}<span data-i="tr_2"></span></li>
          <li>${ICONS.lock}<span data-i="tr_3"></span></li>
          <li>${ICONS.chat}<span data-i="tr_4"></span></li>
        </ul>

        <div class="accs">
          ${accordion("acc_desc", paras(desc), { open: true })}
          ${accordion("acc_usage", paras(pick(p.usage)))}
          ${accordion("acc_compo", paras(pick(p.compo)))}
          ${accordion("acc_warn", bullets(pick(p.warn)), { cls: "warn", icon: ICONS.warn })}
          ${accordion("acc_ship", `<p>${esc(t("acc_ship_txt"))}</p>`)}
        </div>
        <p class="adult-note">${ICONS.seal}<span data-i="adult"></span></p>
      </div>
    </div>

    <div id="reviews"></div>
    ${related.length ? `
    ${divider("mt-20 mb-10")}
    <div class="section-head"><div><p class="eyebrow m-0">${ORN}<span data-i="collection"></span></p><h2 class="display" data-i="related"></h2></div></div>
    <div class="grid-products">${related.map((x) => card(x)).join("")}</div>` : ""}
  </section>

  ${out ? "" : `<div class="pp2-sticky" id="sticky" aria-hidden="true">
    <div class="wrap">
      <span class="stk-info"><b>${esc(p.name)}</b><small id="stkName"></small></span>
      <button class="btn btn-gold" type="button" data-buy tabindex="-1"><span data-i="add"></span><b aria-hidden="true">·</b><b id="stkPrice"></b></button>
    </div></div>`}`;
  translateDom(app);
  paintReviews(p);
  track("product");
  paintDeal();

  /* La barre collante apparaît quand le bouton principal sort de l'écran */
  const sticky = document.getElementById("sticky");
  const cta = document.getElementById("mainCta");
  if (sticky && cta && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      const show = !e.isIntersecting && e.boundingClientRect.top < 0;
      sticky.classList.toggle("show", show);
      sticky.setAttribute("aria-hidden", !show);
      document.documentElement.classList.toggle("has-sticky", show);
    }).observe(cta);
  }
}

const app = document.getElementById("app");
app.addEventListener("change", (e) => {
  if (e.target.name === "offer") { sel = Number(e.target.value); paintDeal(); document.getElementById("waBuy").href = waLink(current); }
});
app.addEventListener("click", (e) => {
  const shot = e.target.closest("[data-shot]");
  if (shot) {
    document.getElementById("stage").innerHTML = media(current, true, gallery[shot.dataset.shot]);
    app.querySelectorAll("[data-shot]").forEach((b) => b.setAttribute("aria-pressed", b === shot));
    return;
  }
  const step = e.target.closest("[data-step]");
  if (step) { qty = Math.max(1, qty + Number(step.dataset.step)); document.getElementById("qty").textContent = qty; paintDeal(); return; }
  const buy = e.target.closest("[data-buy]");
  if (buy) { addToCart(current.id, currentDeal(current).q, null, buy); return; }
  const add = e.target.closest("[data-add]");
  if (add) addToCart(add.dataset.add, 1, add);
});
window.addEventListener("hashchange", () => { render(); window.scrollTo({ top: 0 }); });

enableTilt(app);
await initI18n();
render();
