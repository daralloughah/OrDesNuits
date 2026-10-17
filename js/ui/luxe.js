/* =========================================================
   Gestes de la Maison :
   - ouverture cérémonielle (une fois par visite, on passe d'un toucher)
   - goutte de miel qui coule jusqu'au panier (+ micro-vibration)
   - reflet d'or qui suit l'inclinaison du téléphone (ou la souris)
   - fil d'or de lecture en haut de l'écran
   ========================================================= */
import { t } from "../core/i18n.js";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return "1"; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };

/* ---------- Ouverture : une nuit des Mille et une nuits ----------
   Pleine lune sur le désert, étoiles, le sceau de la Maison.
   Si assets/img/chargement.webp existe (image Gemini), elle sert de décor. */
const PHRASES_FR = ["Les plus belles nuits commencent par un secret.", "L'or a mille reflets. La nuit en a mille et un.", "Un murmure, un parfum, une nuit qui vous appartient.", "Ici, tout se dit à voix basse.", "Le miel des nuits rares.", "Chez OrDesNuits, le temps ralentit."];
function phrase() {
  const n = 1 + Math.floor(Math.random() * 6);
  try { const v = t(`lp_${n}`); if (v && v !== `lp_${n}`) return v; } catch {}
  return PHRASES_FR[n - 1];
}
export function scene(text = phrase(), cls = "") {
  const stars = Array.from({ length: 46 }, () => `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 55).toFixed(1)}%;--d:${(1.5 + Math.random() * 3).toFixed(1)}s;--s:${(1 + Math.random() * 1.6).toFixed(1)}px"></i>`).join("");
  return `<div class="nuit ${cls}" aria-hidden="true">
    <img class="nuit-bg" src="assets/img/chargement.webp" alt="" onerror="this.remove()">
    <div class="nuit-stars">${stars}</div>
    <div class="nuit-moon"></div>
    <div class="nuit-glow"></div>
    <svg class="nuit-dunes" viewBox="0 0 1200 400" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dn1" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3f22"/><stop offset=".45" stop-color="#2c1e12"/><stop offset="1" stop-color="#140e09"/></linearGradient>
        <linearGradient id="dn2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3e2b18"/><stop offset=".5" stop-color="#1c140d"/><stop offset="1" stop-color="#0d0907"/></linearGradient>
        <linearGradient id="dnr" x1="0" x2="1"><stop offset="0" stop-color="#f3d28c" stop-opacity="0"/><stop offset=".7" stop-color="#f3d28c" stop-opacity=".75"/><stop offset="1" stop-color="#fff1c9" stop-opacity=".9"/></linearGradient>
      </defs>
      <path class="d1" d="M0 250 C200 170 380 210 560 240 S900 180 1200 220 V400 H0Z"/>
      <path class="rim" d="M0 250 C200 170 380 210 560 240 S900 180 1200 220"/>
      <path class="d2" d="M0 300 C160 250 360 280 520 300 S860 250 1200 290 V400 H0Z"/>
      <path class="rim" d="M0 300 C160 250 360 280 520 300 S860 250 1200 290" opacity=".6"/>
      <path class="d3" d="M0 350 C220 320 420 345 640 352 S1000 320 1200 340 V400 H0Z"/>
    </svg>
    <div class="nuit-dust">${Array.from({ length: 22 }, () => `<i style="left:${(Math.random() * 100).toFixed(1)}%;--s:${(1.5 + Math.random() * 2.5).toFixed(1)}px;--d:${(5 + Math.random() * 6).toFixed(1)}s;--w:${(Math.random() * 4).toFixed(1)}s;--x:${(Math.random() * 80 - 40).toFixed(0)}px"></i>`).join("")}</div>
    <div class="nuit-seal"><img src="assets/img/logo.webp" alt=""></div>
    <p class="nuit-name">OrDesNuits</p>
    <p class="nuit-phrase">${text}</p>
  </div>`;
}
export function intro() {
  if (reduce || ss.get("odn.intro") || document.body.classList.contains("is-admin")) return;
  ss.set("odn.intro", "1");
  const el = document.createElement("div");
  el.className = "intro";
  el.innerHTML = scene();
  document.body.append(el);
  document.documentElement.classList.add("no-scroll");
  let gone = false;
  const end = () => {
    if (gone) return; gone = true;
    el.classList.add("out");
    document.documentElement.classList.remove("no-scroll");
    setTimeout(() => el.remove(), 900);
  };
  el.addEventListener("click", end);
  /* avec l'image du désert, on laisse le temps de la contempler */
  setTimeout(() => setTimeout(end, el.querySelector(".nuit-bg") ? 2600 : 1000), 2200);
}

/* ---------- Goutte de miel jusqu'au panier ---------- */
export function honeyDrop(from) {
  const bag = document.getElementById("cartBtn");
  try { navigator.vibrate?.(14); } catch {}
  if (!bag) return;
  const pulse = () => { bag.classList.remove("filled"); void bag.offsetWidth; bag.classList.add("filled"); };
  if (reduce) return pulse();
  const a = (from || bag).getBoundingClientRect(), b = bag.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const dx = b.left + b.width / 2 - x0, dy = b.top + b.height / 2 - y0;
  const wrap = document.createElement("div");
  wrap.className = "drop-fly";
  wrap.style.left = x0 + "px"; wrap.style.top = y0 + "px";
  wrap.innerHTML = `<i></i>`;
  document.body.append(wrap);
  const dur = Math.min(900, 420 + Math.hypot(dx, dy) * 0.5);
  /* deux axes, deux rythmes : la goutte décrit une courbe */
  wrap.animate([{ transform: "translateX(0)" }, { transform: `translateX(${dx}px)` }], { duration: dur, easing: "cubic-bezier(.3,0,.7,1)", fill: "forwards" });
  const drop = wrap.firstChild;
  drop.animate([
    { transform: "translateY(0) scale(.6)", opacity: 0 },
    { transform: `translateY(${Math.min(-60, dy - 80) * 0.6}px) scale(1)`, opacity: 1, offset: .35 },
    { transform: `translateY(${dy}px) scale(.55)`, opacity: 1 },
  ], { duration: dur, easing: "cubic-bezier(.45,0,.6,1)", fill: "forwards" }).onfinish = () => { wrap.remove(); pulse(); };
}

/* ---------- Reflet d'or ---------- */
export function sheen() {
  if (reduce || sheen.on) return;
  sheen.on = true;
  const root = document.documentElement.style;
  let raf = 0, gx = 50, gy = 30;
  const paint = () => { raf = 0; root.setProperty("--gx", gx.toFixed(1) + "%"); root.setProperty("--gy", gy.toFixed(1) + "%"); };
  const queue = () => { if (!raf) raf = requestAnimationFrame(paint); };
  addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    gx = 50 + Math.max(-35, Math.min(35, e.gamma)) * 1.6;
    gy = 30 + Math.max(-30, Math.min(30, (e.beta || 45) - 45)) * 1.4;
    queue();
  }, { passive: true });
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    gx = (e.clientX / innerWidth) * 100; gy = (e.clientY / innerHeight) * 100;
    queue();
  }, { passive: true });
}

/* ---------- Fil d'or de lecture ---------- */
export function readBar() {
  if (readBar.on) return;
  readBar.on = true;
  const bar = document.createElement("div");
  bar.className = "read-bar";
  bar.setAttribute("aria-hidden", "true");
  document.body.append(bar);
  let raf = 0;
  const upd = () => {
    raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 40 ? Math.min(1, scrollY / max) : 0})`;
  };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  upd();
}

/* ---------- Transition entre les pages : voile de nuit + sceau qui respire ---------- */
export function pageVeil() {
  if (pageVeil.on || reduce) return;
  pageVeil.on = true;
  const v = document.createElement("div");
  v.className = "page-veil";
  v.setAttribute("aria-hidden", "true");
  v.innerHTML = `<img src="assets/img/mono.webp" alt="">`;
  document.body.append(v);
  if (ss.get("odn.veil") === "1") { v.classList.add("on"); ss.set("odn.veil", ""); requestAnimationFrame(() => setTimeout(() => v.classList.remove("on"), 120)); }
  addEventListener("pageshow", () => v.classList.remove("on"));
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank" || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
    if (!/\.html$|\/$/.test(u.pathname)) return;
    e.preventDefault();
    v.classList.add("on");
    ss.set("odn.veil", "1");
    setTimeout(() => (location.href = u.href), 320);
  });
}

/* ---------- Apparition au défilement : chaque bloc se révèle quand on l'atteint ---------- */
export function scrollReveal() {
  if (reduce || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("sr-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  const scan = () => document.querySelectorAll(".card, .promise, .section-head, .word, .af-band, .house, .mh-chapters li, .reviews li, .orn-sep, .offer, .acc").forEach((el) => {
    if (el.dataset.sr) return;
    el.dataset.sr = "1";
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.92) return; // déjà visible : on ne touche à rien
    el.classList.add("sr");
    io.observe(el);
  });
  scan();
  new MutationObserver(() => requestAnimationFrame(scan)).observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
}

export function mountLuxe() { intro(); sheen(); readBar(); pageVeil(); scrollReveal(); }
