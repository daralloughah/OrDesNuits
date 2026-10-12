/* Page des deux maisons : OrDesNuits et OrDesSens (bientôt) */
import { CONTACT } from "../config.js";
import { initI18n, t, translateDom } from "../core/i18n.js";
import { mountChrome, softImages } from "../ui/chrome.js";
import { esc } from "../core/util.js";
import { promises, ornament } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";

function render() {
  document.getElementById("app").innerHTML = `
  <section class="wrap pt-14 pb-10 text-center md:pt-20">
    ${ornament("mx-auto mb-5 w-52 text-gold reveal")}
    <p class="eyebrow m-0 reveal" data-i="h_eyebrow"></p>
    <h1 class="display mx-auto mt-4 mb-0 max-w-3xl text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] reveal d1" data-ih="h_title"></h1>
    <p class="mx-auto mt-5 mb-0 max-w-xl text-muted reveal d2" data-i="h_sub"></p>
  </section>

  <section class="wrap pb-20">
    <div class="houses">
      <article class="house nuits reveal d2">
        <div class="bg"><picture><source media="(max-width:860px)" srcset="assets/img/hero_m.webp"><img src="assets/img/hero.webp" alt=""></picture></div>
        <img class="house-mono" src="assets/img/mono.webp" alt="" width="58" height="58">
        <span class="tag" data-i="nuits_tag"></span>
        <h2 class="name">OrDesNuits</h2>
        <p data-i="nuits_desc"></p>
        <div class="doors">
          <a class="door lui" href="boutique.html#lui"><span data-i="him"></span>${ICONS.arrow}</a>
          <a class="door elle" href="boutique.html#elle"><span data-i="her"></span>${ICONS.arrow}</a>
        </div>
      </article>

      <article class="house sens reveal d3">
        <div class="bg"><img data-soft src="assets/img/ordessens.webp" alt=""></div>
        <div class="silk" aria-hidden="true"></div>
        <span class="soon" data-i="soon"></span>
        <span class="tag" data-i="sens_tag"></span>
        <h2 class="name">OrDesSens</h2>
        <p data-i="sens_desc"></p>
        <div class="doors">
          <span class="door off"><span data-i="him"></span><small data-i="soon_short"></small></span>
          <span class="door off"><span data-i="her"></span><small data-i="soon_short"></small></span>
        </div>
        <a class="btn btn-rose self-start" href="https://www.snapchat.com/add/${esc(CONTACT.snapchat)}" target="_blank" rel="noopener">${ICONS.snapchat.replace("<svg", '<svg width="18" height="18"')}<span data-i="sens_follow"></span></a>
      </article>
    </div>
  </section>

  <section class="offer-band">
    <div class="wrap grid items-center gap-8 py-14 text-center md:grid-cols-[auto_1fr] md:text-start">
      <div class="big31" aria-hidden="true">3<small>+</small>1</div>
      <div><p class="eyebrow m-0" data-i="offer_kicker"></p><h2 class="display mt-2 mb-2 text-[clamp(1.7rem,3.4vw,2.5rem)] leading-tight" data-i="offer_title"></h2><p class="m-0 text-muted" data-i="offer_text"></p></div>
    </div>
  </section>

  <section class="wrap py-16">${promises()}</section>`;
  translateDom(document.getElementById("app"));
  softImages();
}

await initI18n();
mountChrome({ active: "maisons", onLangChange: render });
render();
