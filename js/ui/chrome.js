/* =========================================================
   Habillage commun à toutes les pages :
   bandeau, en-tête, pied de page, contact à droite,
   panier, choix de la langue, notifications.
   ========================================================= */
import { CONTACT, LANGS, OFFER } from "../config.js";
import { t, translateDom, currentLang, langInfo, setLang } from "../core/i18n.js";
import { format } from "../core/money.js";
import * as cart from "../core/cart.js";
import { ICONS } from "./icons.js";
import { mountFx } from "./fx.js";
import { toggle as toggleConcierge, resetConcierge } from "./concierge.js";
import { esc } from "../core/util.js";
export { esc };

/* ---------- Notification ---------- */
let toastTimer;
export function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.append(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------- Fenêtre ---------- */
export function openSheet(html) {
  const root = document.createElement("div");
  root.className = "scrim";
  root.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="x" type="button" data-close aria-label="${esc(t("close"))}">×</button>${html}</div>`;
  const close = () => root.remove();
  root.addEventListener("click", (e) => { if (e.target === root || e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", function onKey(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } });
  document.body.append(root);
  return { root, close };
}

export function langPicker(onChange) {
  const cur = currentLang();
  const { root, close } = openSheet(`
    <h2 class="display text-center text-3xl italic text-[var(--accent-hi)]">${esc(t("lang_title"))}</h2>
    <div class="langs-grid" style="width:100%">${LANGS.map((l) => `
      <button type="button" class="lang-tile" data-lang="${l.code}" aria-current="${l.code === cur}">
        <b lang="${l.html}">${l.name}</b><small>${l.region} · ${l.cur}</small>
      </button>`).join("")}</div>`);
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    await setLang(b.dataset.lang);
    close();
    onChange?.();
  });
}

/* ---------- En-tête ---------- */
function headerHtml(active) {
  const info = langInfo();
  return `
  ${OFFER.active ? `<div class="announce" data-i="offer_banner"></div>` : ""}
  <header class="site-head">
    <div class="wrap bar relative">
      <a class="brand" href="maisons.html" aria-label="OrDesNuits"><img src="assets/img/mono.webp" alt="" width="42" height="42"><span>OrDesNuits</span></a>
      <svg class="drip" viewBox="0 0 14 70" aria-hidden="true" style="inset-inline-start:calc(clamp(16px,4vw,40px) + 14px)">
        <defs><linearGradient id="dg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f3d28c"/><stop offset="1" stop-color="#b8792a"/></linearGradient></defs>
        <path class="stem" d="M3 0h8c0 10-1 16-2 22a2 2 0 0 1-4 0C4 16 3 10 3 0z" fill="url(#dg)"/><circle class="drop" cx="7" cy="26" r="2.6" fill="url(#dg)"/>
      </svg>
      <nav class="nav hidden lg:flex" aria-label="Menu">
        <a href="maisons.html" data-i="nav_houses" ${active === "maisons" ? 'aria-current="page"' : ""}></a>
        <a href="boutique.html#lui" data-i="him" ${active === "lui" ? 'aria-current="page"' : ""}></a>
        <a href="boutique.html#elle" data-i="her" ${active === "elle" ? 'aria-current="page"' : ""}></a>
      </nav>
      <button class="pill-btn" type="button" id="langBtn" data-ia="lang_title">
        ${ICONS.globe}<span class="hidden sm:inline">${esc(info.name)}</span><span class="sm:hidden">${info.code.split("-")[0].toUpperCase()}</span><span class="cur">${info.cur}</span>
      </button>
      <button class="icon-btn" type="button" id="cartBtn" data-ia="cart">${ICONS.bag}<span class="badge" id="badge" hidden>0</span></button>
    </div>
  </header>`;
}

function footerHtml() {
  return `
  <footer class="site-foot mt-auto">
    <div class="wrap grid gap-10 py-14 pb-28 md:grid-cols-[auto_1fr] md:items-center">
      <img src="assets/img/logo.webp" alt="OrDesNuits" width="140" height="140" loading="lazy" class="mx-auto h-[140px] w-[140px] rounded-full md:mx-0">
      <div class="flex flex-col gap-4 text-center md:text-start">
        <p class="display m-0 text-2xl italic text-gold-hi" data-i="tagline"></p>
        <div class="flex flex-wrap justify-center gap-x-7 gap-y-2 text-sm text-muted md:justify-start">
          <a href="maisons.html" data-i="nav_houses"></a>
          <a href="#" data-i="legal"></a>
          <a href="#" data-i="terms"></a>
          <a href="#" data-i="privacy"></a>
          <button type="button" id="footLang" data-i="lang_title"></button>
        </div>
        <p class="m-0 text-xs text-muted" data-i="adult"></p>
      </div>
    </div>
  </footer>
  <div class="rail" aria-label="Contact">
    <button type="button" class="cg" id="conciergeBtn" aria-expanded="false" data-ia="chat_title"><img src="assets/img/mono.webp" alt="" width="54" height="54"><span data-i="chat_title"></span></button>
    <a class="wa" href="https://wa.me/${CONTACT.whatsapp}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONS.whatsapp}<span>WhatsApp</span></a>
    <a class="sc" href="https://www.snapchat.com/add/${CONTACT.snapchat}" target="_blank" rel="noopener" aria-label="Snapchat">${ICONS.snapchat}<span>Snapchat</span></a>
  </div>
  <aside class="drawer" id="drawer" aria-label="Panier">
    <button class="x" type="button" id="closeCart" data-ia="close">×</button>
    <h2 class="display mb-5 text-3xl italic text-[var(--accent-hi)]" data-i="cart"></h2>
    <div class="flex flex-1 flex-col gap-4 overflow-auto" id="cartLines"></div>
    <div class="flex flex-col gap-2 border-t border-[var(--line)] pt-4 tabular-nums" id="cartTotals"></div>
  </aside>`;
}

/* ---------- Panier ---------- */
async function renderCart() {
  const s = await cart.summary();
  const badge = document.getElementById("badge");
  if (badge) { badge.hidden = !s.count; badge.textContent = s.count; }
  const lines = document.getElementById("cartLines");
  const totals = document.getElementById("cartTotals");
  if (!lines) return;
  lines.innerHTML = s.lines.length
    ? s.lines.map((l) => `
      <div class="cart-line">
        <b>${esc(l.p.name)}</b><span class="text-end text-[var(--accent-hi)]">${format(l.unit * l.q)}</span>
        <div class="qty"><button type="button" data-q="${l.p.id}" data-d="-1" aria-label="−">−</button><span>${l.q}</span><button type="button" data-q="${l.p.id}" data-d="1" aria-label="+">+</button></div>
        <span class="text-end text-sm text-muted">${esc(t("cat_" + l.p.category))}</span>
      </div>`).join("")
    : `<p class="display mt-10 text-center text-xl italic text-muted">${esc(t("cart_empty"))}</p>`;
  if (!s.lines.length) { totals.innerHTML = ""; return; }
  const progress = s.nElig
    ? `<div class="rounded-xl bg-wine/40 px-4 py-2.5 text-center text-sm text-gold-hi">${esc(s.missing === 0 ? t("cart_unlocked", { n: s.freeN }) : t("cart_more", { n: s.missing }))}</div>`
    : "";
  totals.innerHTML = `${progress}
    <div class="flex justify-between text-muted"><span>${esc(t("subtotal"))}</span><span>${format(s.subtotal)}</span></div>
    ${s.discount ? `<div class="flex justify-between text-rose"><span>${esc(t("free"))}</span><span>−${format(s.discount)}</span></div>` : ""}
    <div class="display flex justify-between text-xl"><span>${esc(t("total"))}</span><span>${format(s.total)}</span></div>
    <a class="btn btn-gold mt-2 w-full" id="checkout" target="_blank" rel="noopener" href="${cart.whatsappLink(s)}">${ICONS.whatsapp.replace("<svg", '<svg width="18" height="18"')}${esc(t("checkout"))}</a>`;
}

export function addToCart(id, qty = 1, btn) {
  cart.add(id, qty);
  toast(t("toast_added"));
  if (btn?.classList.contains("add")) {
    const label = btn.querySelector("span") || btn;
    btn.classList.add("done");
    label.textContent = t("added");
    setTimeout(() => { btn.classList.remove("done"); label.textContent = t("add"); }, 1300);
  }
}

/* ---------- Montage ---------- */
export function mountChrome({ active, onLangChange } = {}) {
  const top = document.getElementById("top");
  const bottom = document.getElementById("bottom");
  if (top) top.innerHTML = headerHtml(active);
  if (bottom) bottom.innerHTML = footerHtml();
  translateDom();

  const relang = () => { mountChrome({ active, onLangChange }); resetConcierge(); onLangChange?.(); };
  document.getElementById("conciergeBtn")?.addEventListener("click", () => toggleConcierge());
  document.getElementById("langBtn")?.addEventListener("click", () => langPicker(relang));
  document.getElementById("footLang")?.addEventListener("click", () => langPicker(relang));
  const drawer = document.getElementById("drawer");
  document.getElementById("cartBtn")?.addEventListener("click", () => drawer.classList.add("open"));
  document.getElementById("closeCart")?.addEventListener("click", () => drawer.classList.remove("open"));
  drawer?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-q]");
    if (b) { const id = b.dataset.q; cart.summary().then((s) => { const l = s.lines.find((x) => x.p.id === id); cart.setQty(id, (l?.q || 0) + Number(b.dataset.d)); }); }
    if (e.target.closest("#checkout")) setTimeout(() => cart.clear(), 400);
  });
  if (!mountChrome.bound) {
    mountChrome.bound = true;
    cart.onCartChange(renderCart);
    mountFx();
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.getElementById("drawer")?.classList.remove("open");
      toggleConcierge(false);
    });
  }
  renderCart();
}

/* Image avec repli : si le fichier n'existe pas encore, on garde le décor */
export function softImages(root = document) {
  root.querySelectorAll("img[data-soft]").forEach((img) => {
    const hide = () => { img.hidden = true; };
    if (img.complete && img.naturalWidth === 0) hide();
    else img.addEventListener("error", hide, { once: true });
  });
}
