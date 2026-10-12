/* Boutique OrDesNuits : #lui ou #elle */
import { initI18n, t, translateDom } from "../core/i18n.js";
import { productsOf, packsOf, bestOf, categoriesOf } from "../core/catalogue.js";
import { mountChrome, softImages, addToCart, esc } from "../ui/chrome.js";
import { card, promises, ORN, enableTilt } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { OFFER } from "../config.js";

let cat = "all";
const shopFromHash = () => (location.hash === "#elle" ? "elle" : "lui");

async function render() {
  const shop = shopFromHash();
  document.body.dataset.shop = shop;
  document.title = `${t(shop === "lui" ? "him" : "her")} · OrDesNuits`;

  const [all, packs, best, cats] = await Promise.all([productsOf(shop), packsOf(shop), bestOf(shop), categoriesOf(shop)]);
  const list = cat === "all" ? all : all.filter((p) => p.category === cat);
  const banner = `assets/img/banniere-${shop}`;

  document.getElementById("app").innerHTML = `
  <section class="shop-hero">
    <div class="bg"><picture><source media="(max-width:700px)" srcset="${banner}-m.webp"><img data-soft src="${banner}.webp" alt="" fetchpriority="high"></picture></div>
    <div class="wrap w-full pt-28 pb-12">
      <div class="flex max-w-2xl flex-col gap-5">
        <p class="eyebrow m-0 reveal">OrDesNuits · <span data-i="collection"></span></p>
        <h1 class="display reveal d1" data-i="${shop === "lui" ? "him" : "her"}"></h1>
        <p class="m-0 max-w-md text-lg text-muted reveal d2" data-i="${shop}_sub"></p>
        <nav class="switch-shop self-start reveal d3" aria-label="Boutique">
          <a href="#lui" ${shop === "lui" ? 'aria-current="page"' : ""} data-i="him"></a>
          <a href="#elle" ${shop === "elle" ? 'aria-current="page"' : ""} data-i="her"></a>
        </nav>
      </div>
    </div>
  </section>

  <div class="cats"><div class="wrap"><div class="row" role="toolbar" aria-label="Catégories">
    <button type="button" class="chip" data-cat="all" aria-pressed="${cat === "all"}"><span data-i="cat_all"></span><em>${all.length}</em></button>
    ${cats.map((c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${cat === c}">${ICONS[c] || ""}<span data-i="cat_${c}"></span><em>${all.filter((p) => p.category === c).length}</em></button>`).join("")}
  </div></div></div>

  ${cat === "all" && best.length ? `
  <section class="wrap pt-16 md:pt-20">
    <div class="section-head"><div><p class="eyebrow m-0">${ORN}<span data-i="best_kicker"></span></p><h2 class="display gold-text" data-i="best"></h2></div><p data-i="best_sub"></p></div>
    <div class="grid-products">${best.map((p, i) => card(p, i + 1)).join("")}</div>
  </section>` : ""}

  <section class="wrap py-16 md:py-20" id="collection">
    <div class="section-head"><div><p class="eyebrow m-0">${ORN}<span data-i="collection"></span></p><h2 class="display" data-i="${cat === "all" ? "all_products" : "cat_" + cat}"></h2></div>
      <span class="rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[.7rem] uppercase tracking-[.16em] text-muted" data-i="demo_note"></span></div>
    ${list.length ? `<div class="grid-products">${list.map((p) => card(p)).join("")}</div>` : `<div class="slot">${ICONS.hex}<span data-i="cat_empty"></span></div>`}
  </section>

  ${cat === "all" ? `
  <section class="wrap pb-20" id="packs">
    <div class="section-head"><div><p class="eyebrow m-0">${ORN}<span data-i="collection"></span></p><h2 class="display gold-text" data-i="packs"></h2></div><p data-i="packs_sub"></p></div>
    ${packs.length
      ? `<div class="grid-products">${packs.map((p) => card(p)).join("")}</div>`
      : `<div class="grid gap-4 md:grid-cols-3">${[0, 1, 2].map((i) => `<div class="slot ${i ? "hidden md:flex" : ""}">${ICONS.pack}<span data-i="packs_empty"></span></div>`).join("")}</div>`}
  </section>` : ""}

  ${OFFER.active ? `<section class="offer-band">
    <div class="wrap grid items-center gap-8 py-14 text-center md:grid-cols-[auto_1fr] md:text-start">
      <div class="big31" aria-hidden="true">3<small>+</small>1</div>
      <div><p class="eyebrow m-0" data-i="offer_kicker"></p><h2 class="display mt-2 mb-2 text-[clamp(1.7rem,3.4vw,2.5rem)] leading-tight" data-i="offer_title"></h2><p class="m-0 text-muted" data-i="offer_text"></p></div>
    </div></section>` : ""}

  <section class="wrap py-16">${promises()}</section>`;

  translateDom(document.getElementById("app"));
  softImages();
}

document.getElementById("app").addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) { addToCart(add.dataset.add, 1, add); return; }
  const chip = e.target.closest("[data-cat]");
  if (chip) {
    cat = chip.dataset.cat;
    render().then(() => document.querySelector(".cats")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
});

window.addEventListener("hashchange", () => {
  cat = "all";
  mountChrome({ active: shopFromHash(), onLangChange: render });
  render();
  window.scrollTo({ top: 0 });
});

enableTilt(document.getElementById("app"));
await initI18n();
mountChrome({ active: shopFromHash(), onLangChange: render });
render();
