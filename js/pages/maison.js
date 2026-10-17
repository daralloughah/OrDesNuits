/* =========================================================
   La Maison : l'histoire, le choix, la discrétion.
   Page de marque (clients, presse, investisseurs).
   ========================================================= */
import { initI18n, translateDom } from "../core/i18n.js";
import { mountChrome, softImages } from "../ui/chrome.js";
import { ORN, ornament, divider } from "../ui/card.js";

const app = document.getElementById("app");

function render() {
  mountChrome({ active: "maison", onLangChange: render });
  app.innerHTML = `
  <section class="pro-hero mh-hero">
    <div class="bg" aria-hidden="true"><picture><source media="(max-width:700px)" srcset="assets/img/hero_m.webp"><img data-soft src="assets/img/hero.webp" alt=""></picture></div>
    <div class="wrap">
      <p class="eyebrow m-0">${ORN}OrDesNuits · <span data-i="mh_nav"></span></p>
      <h1 class="display" data-i="mh_title"></h1>
      <p class="lead" data-i="mh_lead"></p>
      ${ornament("lg")}
    </div>
  </section>
  <section class="wrap pb-16">
    <ol class="mh-chapters">
      ${[1, 2, 3, 4].map((n) => `<li class="reveal"><span class="mh-num display">${["I", "II", "III", "IV"][n - 1]}</span><div><h2 class="display" data-i="mh_s${n}_t"></h2><p data-i="mh_s${n}"></p></div></li>`).join("")}
    </ol>
    ${divider("my-14")}
    <figure class="word reveal">
      <span class="word-seal"><img src="assets/img/mono.webp" alt="" width="64" height="64"></span>
      <figcaption class="eyebrow" data-i="word_kicker"></figcaption>
      <blockquote class="display" data-i="word_text"></blockquote>
      <p class="word-sign" data-i="word_sign"></p>
    </figure>
    <div class="mh-cta"><a class="btn btn-gold" href="boutique.html#lui" data-i="him"></a><a class="btn btn-ghost" href="boutique.html#elle" data-i="her"></a></div>
  </section>`;
  translateDom(app);
  softImages(app);
}

await initI18n();
render();
