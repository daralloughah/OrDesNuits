/* Fiche produit : produit.html#identifiant */
import { initI18n, t, translateDom, currentLang } from "../core/i18n.js";
import { findProduct, productsOf, bestOf } from "../core/catalogue.js";
import { mountChrome, addToCart, esc } from "../ui/chrome.js";
import { card, media, priceHtml, ribbon, ORN, ornament, enableTilt, stockNote } from "../ui/card.js";
import { isSoldOut } from "../core/catalogue.js";
import { OFFER } from "../config.js";

let qty = 1;
let gallery = [];
let current = null;
const idFromHash = () => decodeURIComponent(location.hash.slice(1));

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
  document.title = `${p.name} · OrDesNuits`;
  qty = 1;
  current = p;
  gallery = [p.img, ...(p.gallery || [])].filter(Boolean);

  const best = (await bestOf(p.shop)).some((b) => b.id === p.id);
  const others = (await productsOf(p.shop)).filter((x) => x.id !== p.id);
  const related = [...others.filter((x) => x.category === p.category), ...others.filter((x) => x.category !== p.category)].slice(0, 4);
  const lang = currentLang().split("-")[0];
  const desc = p.desc?.[lang] || p.desc?.en || p.desc?.fr || t("desc_default");

  app.innerHTML = `
  <section class="wrap pt-10 pb-20">
    <a class="mb-8 inline-flex items-center gap-2 text-xs uppercase tracking-[.18em] text-muted hover:text-[var(--accent-hi)]" href="boutique.html#${p.shop}">← <span data-i="back_${p.shop}"></span></a>
    <div class="grid items-start gap-10 md:grid-cols-[1.05fr_1fr] md:gap-16">
      <div class="reveal">
        <div class="pp-media f-${p.frame || "none"}" data-tilt>${ribbon(p, best)}<div id="stage">${media(p, true)}</div></div>
        ${gallery.length > 1 ? `<div class="thumbs">${gallery.map((src, i) => `<button type="button" data-shot="${i}" aria-pressed="${i === 0}" aria-label="${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
      </div>
      <div class="flex flex-col gap-5 md:sticky md:top-28 reveal d1">
        <p class="eyebrow m-0">${ORN}<span data-i="${p.shop === "lui" ? "him" : "her"}"></span> · <span data-i="cat_${p.category}"></span></p>
        <h1 class="display m-0 text-[clamp(2.4rem,5vw,3.8rem)] italic leading-[1.02]">${esc(p.name)}</h1>
        ${ornament("w-44 self-start text-[var(--accent)]")}
        <span class="price text-3xl">${priceHtml(p)}</span>
        ${stockNote(p)}
        <p class="m-0 max-w-[52ch] whitespace-pre-line text-muted">${esc(desc)}</p>
        ${p.offer && OFFER.active ? `<div class="note">✦ <span data-i="offer_note"></span></div>` : ""}
        <div class="flex flex-wrap items-center gap-3">
          <div class="stepper"><button type="button" data-step="-1" aria-label="−">−</button><output id="qty">1</output><button type="button" data-step="1" aria-label="+">+</button></div>
          ${isSoldOut(p) ? `<span class="btn btn-ghost pointer-events-none opacity-70" data-i="sold_out"></span>` : `<button class="btn btn-gold" type="button" data-buy="${esc(p.id)}" data-i="add"></button>`}
        </div>
        <div class="grid grid-cols-3 gap-3 border-t border-[var(--line-soft)] pt-5 text-sm text-muted">
          <div class="flex flex-col gap-1"><span data-i="ship"></span><b class="font-normal text-ivory" data-i="ship_v"></b></div>
          <div class="flex flex-col gap-1"><span data-i="pack_l"></span><b class="font-normal text-ivory" data-i="pack_v"></b></div>
          <div class="flex flex-col gap-1"><span data-i="pay"></span><b class="font-normal text-ivory" data-i="pay_v"></b></div>
        </div>
      </div>
    </div>
    ${related.length ? `
    <div class="section-head mt-24"><div><p class="eyebrow m-0">${ORN}<span data-i="collection"></span></p><h2 class="display" data-i="related"></h2></div></div>
    <div class="grid-products">${related.map((x) => card(x)).join("")}</div>` : ""}
  </section>`;
  translateDom(app);
}

const app = document.getElementById("app");
app.addEventListener("click", (e) => {
  const shot = e.target.closest("[data-shot]");
  if (shot) {
    document.getElementById("stage").innerHTML = media(current, true, gallery[shot.dataset.shot]);
    app.querySelectorAll("[data-shot]").forEach((b) => b.setAttribute("aria-pressed", b === shot));
    return;
  }
  const step = e.target.closest("[data-step]");
  if (step) { qty = Math.max(1, qty + Number(step.dataset.step)); document.getElementById("qty").textContent = qty; return; }
  const buy = e.target.closest("[data-buy]");
  if (buy) { addToCart(buy.dataset.buy, qty); return; }
  const add = e.target.closest("[data-add]");
  if (add) addToCart(add.dataset.add, 1, add);
});
window.addEventListener("hashchange", () => { render(); window.scrollTo({ top: 0 }); });

enableTilt(app);
await initI18n();
render();
