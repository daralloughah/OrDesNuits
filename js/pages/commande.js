/* Tunnel de commande : coordonnées → livraison → validation */
import { CONTACT, OFFER, EDITION } from "../config.js";
import { initI18n, t, translateDom, currentLang } from "../core/i18n.js";
import { format, price, priceLux } from "../core/money.js";
import * as SHOPX from "../core/shop.js";
import { track } from "../core/track.js";
import * as cart from "../core/cart.js";
import { finalPrice } from "../core/catalogue.js";
import { countries, regionFromPostcode, FR_REGIONS } from "../core/places.js";
import { countryFromIp } from "../core/geo.js";
import { createOrder, currentUser, isEmail, ready } from "../core/backend.js";
import { mountChrome } from "../ui/chrome.js";
import { esc } from "../core/util.js";
import { ORN, ornament } from "../ui/card.js";

const app = document.getElementById("app");
/* Code d'affilié reçu via un lien ?ref=CODE (valable 30 jours) */
const affiliate = () => { try { const r = JSON.parse(localStorage.getItem("odn.ref")); return r && Date.now() - r.at < 30 * 864e5 ? r.code : null; } catch { return null; } };
const DRAFT = "odn.checkout";
const draft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)) || {}; } catch { return {}; } };
const keep = (d) => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch {} };


let promo = null, cfg = null;
async function render() {
  const s = await cart.summary();
  [cfg, promo] = await Promise.all([SHOPX.settings(), SHOPX.activePromo()]);
  if (s.lines.length) track("checkout");
  if (!s.lines.length) {
    app.innerHTML = `<section class="wrap py-28 text-center">${ornament("mx-auto mb-6")}<p class="display text-3xl italic text-muted" data-i="co_empty"></p><a class="btn btn-gold mt-8" href="maisons.html" data-i="co_back"></a></section>`;
    translateDom(app);
    return;
  }
  const d = { ...draft() };
  const user = currentUser();
  if (user) { d.email ||= user.email; d.firstName ||= user.firstName; }
  d.country ||= (await countryFromIp()) || { fr: "FR", ar: "MA", es: "ES", pt: "BR", ru: "RU", de: "DE", zh: "CN", ja: "JP", ko: "KR", "en-US": "US", "en-GB": "GB" }[currentLang()] || "FR";
  const list = countries(currentLang());
  const f = (id, key, type = "text", extra = "") => `<label class="co-f"><span data-i="${key}"></span><input class="co-in" id="${id}" name="${id}" type="${type}" value="${esc(d[id] || "")}" ${extra}></label>`;

  app.innerHTML = `
  <section class="wrap pt-10 pb-24">
    <p class="eyebrow m-0">${ORN}OrDesNuits</p>
    <h1 class="display mt-3 mb-8 text-[clamp(2.4rem,6vw,3.8rem)] italic leading-none text-gold-hi" data-i="co_title"></h1>
    <div class="co-grid">
      <form class="co-form" id="coForm" novalidate>
        ${user ? "" : `<p class="co-login"><a href="compte.html?next=commande" data-i="co_login"></a></p>`}
        <fieldset><legend class="display" data-i="co_contact"></legend>
          ${f("email", "co_email", "email", 'autocomplete="email" required')}
          <div class="co-row">${f("firstName", "co_first", "text", 'autocomplete="given-name" required')}${f("lastName", "co_last", "text", 'autocomplete="family-name" required')}</div>
          ${f("phone", "co_phone", "tel", 'autocomplete="tel" required')}
        </fieldset>
        <fieldset><legend class="display" data-i="co_ship"></legend>
          <label class="co-f"><span data-i="co_country"></span><select class="co-in" id="country" autocomplete="country">${list.map((c) => `<option value="${c.code}" ${c.code === d.country ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
          ${f("address", "co_address", "text", 'autocomplete="street-address" required')}
          <div class="co-row">${f("postcode", "co_postcode", "text", 'autocomplete="postal-code" inputmode="numeric" required')}${f("city", "co_city", "text", 'autocomplete="address-level2" required')}</div>
          <p class="co-region" id="region" hidden></p>
        </fieldset>
        <fieldset><legend class="display" data-i="co_pay"></legend><p class="co-note" data-i="co_pay_note"></p></fieldset>
        <label class="co-check"><input type="checkbox" id="optin" ${d.optin ? "checked" : ""}><span data-i="co_optin"></span></label>
        <label class="co-check"><input type="checkbox" id="terms" required><span><span data-i="co_terms"></span> <a href="legal.html#cgv" target="_blank" class="underline">CGV</a></span></label>
        <p class="co-err" id="err" role="alert" hidden></p>
        <button class="btn btn-gold w-full" type="submit" data-i="co_submit"></button>
      </form>

      <aside class="co-sum">
        <h2 class="display" data-i="co_summary"></h2>
        <ul>${s.lines.map((l) => `<li><span><b>${esc(l.p.name)}</b><small>× ${l.q}</small></span><span>${format(l.total)}</span></li>`).join("")}</ul>
        <div class="co-promo"><input class="co-in" id="promo" autocomplete="off" autocapitalize="characters" value="${esc(promo?.code || SHOPX.typedPromo() || "")}" placeholder="${esc(t("promo_ph"))}"><button type="button" class="btn btn-ghost" id="promoBtn">${esc(t("promo_apply"))}</button></div>
        <p class="co-promo-msg" id="promoMsg" ${promo ? "" : "hidden"}>${promo ? esc(t("promo_ok", { code: promo.code, pct: promo.pct })) : ""}</p>
        <label class="co-check co-gift"><input type="checkbox" id="gift" ${d.gift ? "checked" : ""}><span>${esc(t("gift_opt", { eur: price(cfg.giftFee) }))}</span></label>
        <div id="coLines"></div>
        <a href="boutique.html#lui" class="co-edit" data-i="co_edit"></a>
      </aside>
    </div>
  </section>`;
  translateDom(app);
  showRegion();
  paintSum(s);

  const form = document.getElementById("coForm");
  const sync = () => { const d = readForm(); keep(d); showRegion(); paintSum(s); remember(s, d); };
  form.addEventListener("input", sync);
  form.addEventListener("change", sync);
  app.querySelector(".co-sum").addEventListener("change", sync);
  const applyPromo = async () => {
    const code = document.getElementById("promo").value.trim().toUpperCase();
    const msg = document.getElementById("promoMsg");
    const pct = code ? await SHOPX.promoPct(code) : 0;
    SHOPX.setPromo(pct ? code : null);
    promo = pct ? { code, pct } : await SHOPX.activePromo();
    msg.hidden = !code;
    msg.className = "co-promo-msg" + (pct ? "" : " bad");
    msg.textContent = pct ? t("promo_ok", { code, pct }) : t("promo_bad");
    paintSum(s);
  };
  document.getElementById("promoBtn").addEventListener("click", applyPromo);
  document.getElementById("promo").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); submit(s); });
}

function readForm() {
  const v = (id) => document.getElementById(id)?.value.trim() || "";
  return { email: v("email"), firstName: v("firstName"), lastName: v("lastName"), phone: v("phone"), country: v("country"), address: v("address"), postcode: v("postcode"), city: v("city"), optin: document.getElementById("optin")?.checked, gift: !!document.getElementById("gift")?.checked };
}

/* Récapitulatif : remises, livraison, cadeau, total */
function paintSum(s) {
  const x = SHOPX.totals(s.lines, { promo, gift: !!document.getElementById("gift")?.checked }, cfg);
  const el = document.getElementById("coLines");
  if (!el) return x;
  el.innerHTML = `
    ${x.offer ? `<p class="co-line rose"><span>${esc(t("free"))}</span><span>−${price(x.offer)}</span></p>` : ""}
    ${x.promo ? `<p class="co-line gold"><span>${esc(t("promo_line", { code: promo.code }))} · −${promo.pct} %</span><span>−${price(x.promo)}</span></p>` : ""}
    ${cfg.shipFee > 0 ? `<p class="co-line"><span>${esc(t("ship_line"))}</span><span>${x.ship ? price(x.ship) : esc(t("ship_free"))}</span></p>${x.missing ? `<p class="co-hint">${esc(t("ship_free_in", { eur: price(x.missing) }))}</p>` : ""}` : ""}
    ${x.gift ? `<p class="co-line"><span>${esc(t("gift_line"))}</span><span>${price(x.gift)}</span></p>` : ""}
    <p class="co-line total"><span>${esc(t("total"))}</span><span class="lux-price">${priceLux(x.total)}</span></p>`;
  return x;
}
/* Panier en attente : gardé seulement si le client a coché l'accord */
function remember(s, d) {
  if (!d.optin || !isEmail(d.email)) return;
  const x = SHOPX.totals(s.lines, { promo, gift: d.gift }, cfg);
  SHOPX.saveCart({ email: d.email, optin: true, firstName: d.firstName, phone: d.phone, lang: currentLang(), total: price(x.total), lines: s.lines.map((l) => ({ id: l.p.id, name: l.p.name, qty: l.q })) });
}

function showRegion() {
  const d = readForm();
  const r = d.country === "FR" ? regionFromPostcode(d.postcode) : null;
  const el = document.getElementById("region");
  el.hidden = !r;
  if (r) el.textContent = `${t("co_region")} : ${FR_REGIONS[r]}`;
}

async function submit(s) {
  const d = readForm();
  const err = document.getElementById("err");
  document.querySelectorAll(".co-in").forEach((i) => i.classList.remove("bad"));
  const missing = ["email", "firstName", "lastName", "phone", "address", "postcode", "city"].filter((k) => !d[k]);
  if (d.email && !isEmail(d.email)) missing.push("email");
  missing.forEach((k) => document.getElementById(k)?.classList.add("bad"));
  if (missing.length || !document.getElementById("terms").checked) {
    err.hidden = false;
    err.textContent = missing.includes("email") && d.email ? t("co_invalid_email") : t("co_required");
    (document.getElementById(missing[0]) || document.getElementById("terms")).focus();
    return;
  }
  const lines = s.lines.map((l) => ({ id: l.p.id, name: l.p.name, qty: l.q, unitEur: Math.round((l.eur / l.q) * 10000) / 10000, lineEur: l.eur, shop: l.p.shop, category: l.p.category }));
  const x = SHOPX.totals(s.lines, { promo, gift: d.gift }, cfg);
  const region = d.country === "FR" ? regionFromPostcode(d.postcode) : null;
  const btn = document.querySelector("#coForm button[type=submit]");
  btn.disabled = true;
  let order;
  try {
    order = await createOrder({
    customer: { email: d.email, firstName: d.firstName, lastName: d.lastName, phone: d.phone, optin: !!d.optin },
    shipping: { country: d.country, region, address: d.address, postcode: d.postcode, city: d.city },
    lang: currentLang(), lines,
    subtotalEur: x.sub, discountEur: x.disc, totalEur: x.total,
    promo: promo?.code || null, gift: d.gift,
    display: { total: price(x.total), shipEur: x.ship, giftEur: x.gift, promoEur: x.promo, ...(d.gift ? { gift: true } : {}), ...(promo ? { promo: promo.code, promoPct: promo.pct, ref: promo.code } : affiliate() ? { ref: affiliate() } : {}) },
    });
  } catch (x) {
    btn.disabled = false;
    err.hidden = false;
    err.textContent = x.message === "sold_out" ? t("co_err_soldout", { name: x.detail || "" }) : x.message === "email" ? t("co_invalid_email") : t("co_err_network");
    return;
  }
  cart.clear();
  track("order");
  SHOPX.setPromo(null);
  SHOPX.forgetCart(d.email);
  try { localStorage.removeItem(DRAFT); } catch {}
  done(order, s);
}

function done(o, s) {
  const msg = `Bonjour OrDesNuits, voici ma commande ${o.id} :\n` +
    o.lines.map((l) => `• ${l.qty} × ${l.name}`).join("\n") +
    `\nTotal : ${o.display.total}\n\n${o.customer.firstName} ${o.customer.lastName}\n${o.shipping.address}, ${o.shipping.postcode} ${o.shipping.city}, ${o.shipping.country}\n${o.customer.phone}`;
  app.innerHTML = `
  <section class="wrap py-20 text-center">
    <div class="co-done">
      <div class="unbox" aria-hidden="true">
        <span class="rays"></span>
        <span class="ub-base"></span>
        <span class="ub-seal"><img src="assets/img/mono.webp" alt=""></span>
        <span class="ub-lid"><i></i></span>
      </div>
      <p class="eyebrow ub-k" data-i="unbox_kicker"></p>
      <h1 class="display text-[clamp(2rem,6vw,3.2rem)] italic text-gold-hi" data-i="co_done_title"></h1>
      ${ornament("lg mx-auto")}
      <p class="eyebrow" data-i="co_done_num"></p>
      <p class="co-num engrave">${[...String(o.id)].map((c, i) => `<span style="--i:${i}">${esc(c)}</span>`).join("")}</p>
      ${EDITION.active && o.lines.some((l) => l.qty >= EDITION.min) ? `<p class="co-ed">${esc(t("ed_num", { n: o.id }))}</p>` : ""}
      <p class="mx-auto max-w-md text-muted" data-i="co_done_text"></p>
      <a class="btn btn-gold" target="_blank" rel="noopener" href="https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}"><span data-i="co_done_wa"></span></a>
      <a class="btn btn-ghost" href="compte.html" data-i="co_done_account"></a>
    </div>
  </section>`;
  translateDom(app);
  window.scrollTo({ top: 0 });
}

await initI18n();
mountChrome({ onLangChange: render });
await ready();
render();
