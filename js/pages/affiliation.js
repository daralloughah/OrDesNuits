/* =========================================================
   Programme d'affiliation : présentation + candidature WhatsApp.
   Le suivi des ventes passe par un code (?ref=CODE dans le lien),
   enregistré avec la commande et visible dans le Salon privé.
   ========================================================= */
import { initI18n, t, translateDom } from "../core/i18n.js";
import { mountChrome, esc, softImages } from "../ui/chrome.js";
import { ORN, ornament } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { CONTACT } from "../config.js";

const app = document.getElementById("app");

function render() {
  mountChrome({ active: "affiliation", onLangChange: render });
  app.innerHTML = `
  <section class="pro-hero af-hero">
    <div class="bg" aria-hidden="true"><picture><source media="(max-width:700px)" srcset="assets/img/hero_m.webp"><img data-soft src="assets/img/hero.webp" alt=""></picture></div>
    <div class="wrap">
      <p class="eyebrow m-0">${ORN}OrDesNuits · <span data-i="af_nav"></span></p>
      <h1 class="display" data-i="af_title"></h1>
      <p class="lead" data-i="af_sub"></p>
      ${ornament("w-52")}
      <a class="btn btn-gold mt-4" href="#candidature" data-i="af_cta"></a>
    </div>
  </section>
  <section class="wrap pb-24">
    <ol class="af-steps">
      ${[["chat", 1], ["seal", 2], ["crate", 3]].map(([ic, n]) => `<li><i>${ICONS[ic]}</i><b class="display" data-i="af_s${n}_t"></b><p data-i="af_s${n}"></p></li>`).join("")}
    </ol>
    <p class="af-who" data-i="af_who"></p>
    <form class="af-form" id="candidature" novalidate>
      <h2 class="display" data-i="af_cta"></h2>
      <label class="co-f"><span data-i="af_name"></span><input class="co-in" id="afName" autocomplete="name"></label>
      <label class="co-f"><span data-i="af_handle"></span><input class="co-in" id="afHandle"></label>
      <label class="co-f"><span data-i="af_audience"></span><input class="co-in" id="afAud" inputmode="numeric"></label>
      <button class="btn btn-gold w-full" type="submit">${ICONS.whatsapp}<span data-i="af_cta"></span></button>
      <p class="at-hint" data-i="af_note"></p>
    </form>
    <p class="af-portal"><a href="partenaire.html">Espace partenaire ✦</a></p>
  </section>`;
  translateDom(app);
  softImages(app);
  document.getElementById("candidature").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (id) => document.getElementById(id).value.trim();
    const msg = `Bonjour OrDesNuits, je souhaite devenir affilié·e.\nNom : ${v("afName")}\nRéseau : ${v("afHandle")}\nCommunauté : ${v("afAud")}`;
    window.open(`https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });
}

await initI18n();
render();
