/* Page des deux maisons : OrDesNuits et OrDesSens (bientôt) */
import { CONTACT, OFFER } from "../config.js";
import { initI18n, t, translateDom } from "../core/i18n.js";
import { mountChrome, softImages } from "../ui/chrome.js";
import { esc } from "../core/util.js";
import { subscribe, isEmail } from "../core/backend.js";
import { promises, ornament } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { publicStats } from "../core/shop.js";

function render() {
  document.getElementById("app").innerHTML = `
  <section class="cine-hero">
    <div class="cine-bg" aria-hidden="true"><img src="assets/img/chargement.webp" alt="" fetchpriority="high"></div>
    <div class="wrap cine-in text-center">
    ${ornament("mx-auto mb-5 w-52 text-gold reveal")}
    <p class="eyebrow m-0 reveal" data-i="h_eyebrow"></p>
    <h1 class="display mx-auto mt-4 mb-0 max-w-3xl text-[clamp(2.4rem,6vw,4.4rem)] leading-[1.05] reveal d1" data-ih="h_title"></h1>
    <p class="mx-auto mt-5 mb-0 max-w-xl text-muted reveal d2" data-i="h_sub"></p>
    <p class="proof reveal d2" id="proof" hidden></p>
    </div>
    <span class="cine-scroll" aria-hidden="true"></span>
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
        <form class="sens-form" id="sensForm" novalidate>
          <input type="email" id="sensEmail" autocomplete="email" data-ph="sens_email_ph" aria-label="E-mail">
          <button type="submit" class="btn btn-rose" data-i="sens_notify"></button>
        </form>
        <a class="sens-snap" href="https://www.snapchat.com/add/${esc(CONTACT.snapchat)}" target="_blank" rel="noopener">${ICONS.snapchat.replace("<svg", '<svg width="16" height="16"')}<span data-i="sens_follow"></span></a>
      </article>
    </div>
  </section>

  ${OFFER.active ? `<section class="offer-band">
    <div class="wrap grid items-center gap-8 py-14 text-center md:grid-cols-[auto_1fr] md:text-start">
      <div class="big31" aria-hidden="true">3<small>+</small>1</div>
      <div><p class="eyebrow m-0" data-i="offer_kicker"></p><h2 class="display mt-2 mb-2 text-[clamp(1.7rem,3.4vw,2.5rem)] leading-tight" data-i="offer_title"></h2><p class="m-0 text-muted" data-i="offer_text"></p></div>
    </div>
  </section>` : ""}

  <section class="wrap"><a class="af-band" href="affiliation.html"><span><small data-i="af_nav"></small><b class="display" data-i="af_title"></b><em data-i="af_band"></em></span><i>→</i></a></section>
  <section class="wrap py-16">${promises()}</section>
  <section class="wrap pb-24">
    <figure class="word reveal">
      <span class="word-seal"><img src="assets/img/mono.webp" alt="" width="64" height="64"></span>
      <figcaption class="eyebrow" data-i="word_kicker"></figcaption>
      <blockquote class="display" data-i="word_text"></blockquote>
      <p class="word-sign" data-i="word_sign"></p>
    </figure>
  </section>`;
  translateDom(document.getElementById("app"));
  document.querySelectorAll("[data-ph]").forEach((el) => (el.placeholder = t(el.dataset.ph)));
  softImages();
  /* Preuve sociale réelle : affichée seulement quand les chiffres sont parlants */
  publicStats().then((st) => {
    const el = document.getElementById("proof");
    if (!el || !st) return;
    const bits = [];
    if (st.shipped >= 20) bits.push(`<span>${ICONS.seal}${esc(t("counter", { n: new Intl.NumberFormat(document.documentElement.lang).format(st.shipped) }))}</span>`);
    if (st.reviews >= 3 && st.rating) bits.push(`<span class="stars">★★★★★</span><b>${String(st.rating).replace(".", ",")}/5</b><small>(${st.reviews})</small>`);
    if (bits.length) { el.innerHTML = bits.join(""); el.hidden = false; }
  });
  document.getElementById("sensForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const input = document.getElementById("sensEmail");
    if (!isEmail(input.value)) { input.classList.add("bad"); input.focus(); return; }
    form.querySelector("button")?.setAttribute("disabled", "");
    if (!(await subscribe(input.value, "ordessens", document.documentElement.lang))) { form.querySelector("button")?.removeAttribute("disabled"); input.classList.add("bad"); input.focus(); return; }
    form.outerHTML = `<p class="sens-thanks">✦ ${t("sens_thanks")}</p>`;
  });
}

await initI18n();
mountChrome({ active: "maisons", onLangChange: render });
render();
