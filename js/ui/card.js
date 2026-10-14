/* =========================================================
   L'écrin : carte produit en vitrine (arche, projecteur, piédestal)
   + ornements art déco
   ========================================================= */
import { t } from "../core/i18n.js";
import { price } from "../core/money.js";
import { finalPrice, isSoldOut, isLow } from "../core/catalogue.js";
import { OFFER } from "../config.js";
import { ICONS } from "./icons.js";
import { esc } from "../core/util.js";

/* Petit ornement placé devant les sur-titres */
export const ORN = `<svg class="orn" viewBox="0 0 46 12" aria-hidden="true"><path d="M0 6h16M30 6h16" stroke="currentColor" stroke-width=".8"/><path d="M23 1.2l4.2 2.4v4.8L23 10.8l-4.2-2.4V3.6z" fill="none" stroke="currentColor" stroke-width=".9"/><path d="M23 3.8c-1.2 1.7-1.2 2.9 0 3.6 1.2-.7 1.2-1.9 0-3.6z" fill="currentColor"/></svg>`;

/* Grand ornement : filet · losange · alvéole · losange · filet */
export const ornament = (cls = "") => `
  <svg class="ornament ${cls}" viewBox="0 0 220 24" aria-hidden="true">
    <path d="M0 12h86M134 12h86" stroke="currentColor" stroke-width=".8" opacity=".7"/>
    <path d="M92 12l4-4 4 4-4 4zM120 12l4-4 4 4-4 4z" fill="currentColor" opacity=".7"/>
    <path d="M110 3l7.8 4.5v9L110 21l-7.8-4.5v-9z" fill="none" stroke="currentColor" stroke-width="1"/>
    <path d="M110 8.5c-2 3-2 5 0 6.3 2-1.3 2-3.3 0-6.3z" fill="currentColor"/>
  </svg>`;

const CREST = `<svg class="crest" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l7.8 4.5v9L10 19l-7.8-4.5v-9z" fill="var(--color-night)" stroke="currentColor"/><path d="M10 6c-2 3-2 5 0 6.3 2-1.3 2-3.3 0-6.3z" fill="currentColor"/></svg>`;
const PLINTH = `<svg class="plinth" viewBox="0 0 200 60" aria-hidden="true">
  <defs><linearGradient id="pl" x1="0" x2="1"><stop offset="0" stop-color="#2a1e22"/><stop offset=".5" stop-color="#3a2a22"/><stop offset="1" stop-color="#1a1214"/></linearGradient></defs>
  <path d="M10 22v18c0 9 40 16 90 16s90-7 90-16V22" fill="url(#pl)" stroke="currentColor" stroke-opacity=".35"/>
  <ellipse cx="100" cy="22" rx="90" ry="16" fill="#1d1518" stroke="currentColor" stroke-opacity=".6"/>
  <ellipse cx="100" cy="22" rx="70" ry="10" fill="none" stroke="currentColor" stroke-opacity=".2"/></svg>`;
const RING = `<svg class="orbit" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width=".6" stroke-dasharray="1 7"/><circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-width=".4"/></svg>`;

/* La vitrine. src = photo à afficher (sinon la première du produit). */
export function media(p, big = false, src) {
  const shots = [p.img, ...(p.gallery || [])].filter(Boolean);
  const photo = src || shots[0];
  const cut = p.fit === "contain"; // photo détourée (fond transparent) : posée sur le piédestal
  return `
  <div class="ph">
    ${big ? RING : ""}
    <span class="motes" aria-hidden="true"></span>
    <div class="arch"></div>${CREST}
    ${photo && !cut ? "" : PLINTH}
    ${photo
      ? `<img class="photo ${cut ? "cutout" : ""}" src="${esc(photo)}" alt="${esc(p.name)}" loading="lazy">`
      : `<span class="piece">${ICONS[p.category] || ICONS.hex}</span><span class="soon-label">${esc(t("photo_soon"))}</span>`}
  </div>`;
}

export function priceHtml(p) {
  const f = finalPrice(p);
  return f < p.price ? `<span>${price(f)}</span><s>${price(p.price)}</s>` : `<span>${price(p.price)}</span>`;
}

export function ribbon(p, isBest) {
  if (p.frame === "promo") {
    const pct = p.promo && p.promo < p.price ? Math.round((1 - p.promo / p.price) * 100) : 0;
    return `<span class="ribbon promo">${esc(t("b_promo"))}${pct ? ` −${pct} %` : ""}</span>`;
  }
  if (p.frame === "new") return `<span class="ribbon new">${esc(t("b_new"))}</span>`;
  if (p.frame === "fav") return `<span class="ribbon fav">${esc(t("b_fav"))}</span>`;
  if (isBest) return `<span class="ribbon best">${esc(t("b_best"))}</span>`;
  return "";
}

/* « Plus que 3 » quand le stock est bas */
export function stockNote(p) {
  return isLow(p) ? `<span class="low-stock"><i></i>${esc(t("stock_low", { n: p.stock }))}</span>` : "";
}

export function card(p, rank) {
  const href = `produit.html#${encodeURIComponent(p.id)}`;
  return `
  <article class="card f-${p.frame || "none"} ${isSoldOut(p) ? "is-out" : ""} reveal" data-tilt>
    ${ribbon(p, !!rank)}${rank ? `<span class="rank" aria-hidden="true">${rank}</span>` : ""}
    <a class="cover" href="${href}" aria-label="${esc(p.name)}">${media(p)}</a>
    <div class="info">
      <span class="cat">${esc(t("cat_" + p.category))}${p.offer && OFFER.active ? ` <b class="tag31">3+1</b>` : ""}</span>
      <h3><a href="${href}">${esc(p.name)}</a></h3>
      ${stockNote(p)}
      <div class="row">
        <span class="price">${priceHtml(p)}</span>
        ${isSoldOut(p)
          ? `<span class="soldout">${esc(t("sold_out"))}</span>`
          : `<button class="add" type="button" data-add="${esc(p.id)}" aria-label="${esc(t("add"))} · ${esc(p.name)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span>${esc(t("add"))}</span>
        </button>`}
      </div>
    </div>
  </article>`;
}

/* Inclinaison 3D légère des vitrines sous la souris */
export function enableTilt(root = document) {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  root.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.("[data-tilt]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.classList.add("tilting");
    el.style.setProperty("--ry", (x - 0.5) * 8 + "deg");
    el.style.setProperty("--rx", (0.5 - y) * 6 + "deg");
    const ph = el.querySelector(".ph");
    if (ph) { ph.style.setProperty("--mx", x * 100 + "%"); ph.style.setProperty("--my", y * 100 + "%"); }
  });
  root.addEventListener("pointerout", (e) => {
    const el = e.target.closest?.("[data-tilt]");
    if (!el || el.contains(e.relatedTarget)) return;
    el.classList.remove("tilting");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  });
}

export function promises() {
  const items = [["box", "p1_t", "p1"], ["clock", "p2_t", "p2"], ["globe32", "p3_t", "p3"], ["chat", "p4_t", "p4"]];
  return `<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">${items.map(([i, h, p]) => `
    <div class="promise flex flex-col gap-2">${ICONS[i]}<h3>${esc(t(h))}</h3><p class="m-0 text-muted">${esc(t(p))}</p></div>`).join("")}</div>`;
}
