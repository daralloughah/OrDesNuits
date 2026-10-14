/* =========================================================
   Le Salon privé : espace gérant d'OrDesNuits
   Tableau de bord, commandes, produits, clients,
   comptabilité, atelier photo, réglages.
   ========================================================= */
import { initI18n } from "../core/i18n.js";
import { card } from "../ui/card.js";
import { ICONS } from "../ui/icons.js";
import { esc } from "../core/util.js";
import * as store from "../admin/store.js";
import * as A from "../admin/analytics.js";
import { openStudio, compress } from "../admin/studio.js";
import { allOrders, updateOrder, createOrder, customers, subscribers, seedDemo, clearDemo, hasDemo, BACKEND_MODE, loadAdminData, setOrderStatus, adminCreateOrder, isAdmin, signIn, signOut, currentUser, ready } from "../core/backend.js";
import { countries, countryName, flag, FR_REGIONS } from "../core/places.js";

const app = document.getElementById("app");
const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
const nb = (v) => new Intl.NumberFormat("fr-FR").format(v || 0);
const dt = (iso) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
const CATS = { miel: "Miel", huile: "Huile", bougie: "Bougie", gel: "Gel retardant", soin: "Soin intime", pack: "Coffret" };
const SHOPS = { lui: "Pour lui", elle: "Pour elle" };
const FRAMES = { none: "Aucun", promo: "Promo", new: "Nouveau", fav: "Coup de cœur" };
const COMPTA_KEY = "odn.compta";
let view = "salon";
let period = "30";
let filter = { shop: "all", q: "" };
let ofilter = "all";
let ctab = "comptes";
let year = new Date().getFullYear();

/* ---------- Petits outils ---------- */
function toast(msg) {
  let t = document.getElementById("admToast");
  if (!t) { t = Object.assign(document.createElement("div"), { id: "admToast", className: "toast" }); t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
}
async function sha(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("odn:" + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
const comptaCfg = () => ({ urssaf: 12.3, plafond: 188700, tva: 85000, ...(JSON.parse(ls.get(COMPTA_KEY) || "{}")) });

function confirmSheet(title, text, ok = "Confirmer") {
  return new Promise((resolve) => {
    const s = document.createElement("div");
    s.className = "scrim";
    s.innerHTML = `<div class="sheet adm-sheet"><h2 class="display">${esc(title)}</h2><p>${esc(text)}</p>
      <div class="at-row"><button type="button" class="adm-btn ghost" data-r="0">Annuler</button><button type="button" class="adm-btn gold" data-r="1">${esc(ok)}</button></div></div>`;
    s.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b || e.target === s) { s.remove(); resolve(b?.dataset.r === "1"); } });
    document.body.append(s);
  });
}
function panel(html) {
  const sheet = document.createElement("div");
  sheet.className = "adm-editor";
  sheet.innerHTML = html;
  document.body.append(sheet);
  document.documentElement.classList.add("no-scroll");
  const close = () => { sheet.remove(); document.documentElement.classList.remove("no-scroll"); };
  sheet.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  return { sheet, close };
}
function download(name, data, type) {
  const a = document.createElement("a");
  a.href = data.startsWith("data:") ? data : URL.createObjectURL(new Blob([data], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast("Copié"); }
  catch { const ta = Object.assign(document.createElement("textarea"), { value: text }); document.body.append(ta); ta.select(); try { document.execCommand("copy"); toast("Copié"); } catch { toast("Copie impossible"); } ta.remove(); }
}

/* Fiole de stock */
function vial(p) {
  const max = Math.max(p.stock, (p.lowAt || 5) * 4, 1);
  const pct = Math.round(Math.min(1, p.stock / max) * 100);
  const state = p.stock <= 0 ? "out" : p.stock <= (p.lowAt || 5) ? "low" : "ok";
  return `<span class="vial ${state}" style="--lvl:${pct}%" aria-hidden="true"><i></i></span>`;
}
const thumb = (p) => `<span class="adm-thumb">${p.img ? `<img src="${esc(p.img)}" alt="">` : ICONS[p.category] || ICONS.hex}</span>`;
const delta = (cur, prev) => {
  if (!prev) return "";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `<em class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d)} %</em>`;
};
/* Barres horizontales (classements) */
const hbars = (rows, fmt = (r) => r.orders, max = Math.max(1, ...rows.map((r) => r.v))) => `<ul class="hb">${rows.map((r) => `
  <li><span class="hb-l">${r.label}</span><span class="hb-t"><i style="width:${Math.max(2, (r.v / max) * 100)}%"></i></span><span class="hb-v">${fmt(r)}</span></li>`).join("")}</ul>`;
/* Colonnes (chiffre d'affaires dans le temps) */
function columns(series) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const W = 600, H = 180, gap = 4, bw = (W - gap * (series.length - 1)) / series.length;
  const every = Math.ceil(series.length / 8);
  const ticks = [0, .5, 1].map((k) => Math.round(max * k));
  return `<svg class="cols" viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="Chiffre d'affaires dans le temps">
    ${ticks.map((v) => { const y = H - (v / max) * H; return `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="grid"/><text x="0" y="${y - 4}" class="tick">${nb(v)} €</text>`; }).join("")}
    ${series.map((s, i) => { const h = Math.max(s.value ? 3 : 0, (s.value / max) * H); const x = i * (bw + gap); return `<g><title>${esc(s.label)} : ${eur(s.value)}</title><rect x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="3" class="bar"/>${i % every === 0 ? `<text x="${x + bw / 2}" y="${H + 18}" class="lbl" text-anchor="middle">${esc(s.label)}</text>` : ""}</g>`; }).join("")}
  </svg>`;
}

/* ---------- Connexion ---------- */
/* En ligne : vraie connexion (e-mail + mot de passe) d'un compte déclaré gérant */
async function remoteGate() {
  await ready();
  if (currentUser() && (await isAdmin())) return true;
  const u = currentUser();
  app.innerHTML = `
    <section class="adm-gate">
      <div class="seal"><img src="assets/img/logo.webp" alt="OrDesNuits"></div>
      <h1 class="display">Le Salon privé</h1>
      <p>${u ? `Le compte ${esc(u.email)} n'est pas gérant.` : "Connecte-toi avec ton compte gérant."}</p>
      <form class="adm-login" id="admLogin" novalidate>
        <input class="adm-input" id="a-email" type="email" autocomplete="username" placeholder="E-mail" value="${esc(u?.email || "")}" required>
        <input class="adm-input" id="a-pass" type="password" autocomplete="current-password" placeholder="Mot de passe" required>
        <button class="adm-btn gold" type="submit">Entrer</button>
      </form>
      <p class="at-hint">Connexion sécurisée Supabase. Seuls les comptes déclarés dans la table <code>admins</code> peuvent entrer.</p>
      <a class="adm-link" href="maisons.html">← Retour à la boutique</a>
    </section>`;
  return new Promise((resolve) => {
    const f = document.getElementById("admLogin");
    f.querySelector(u ? "#a-pass" : "#a-email").focus();
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = f.querySelector("button");
      btn.disabled = true; btn.textContent = "Connexion…";
      try {
        await signIn({ email: f.querySelector("#a-email").value, password: f.querySelector("#a-pass").value });
        if (await isAdmin()) { resolve(true); return; }
        toast("Ce compte n'est pas gérant");
      } catch (x) {
        toast(x.message === "unconfirmed" ? "Confirme d'abord ton e-mail (lien reçu)" : x.message === "network" ? "Pas de connexion internet" : "E-mail ou mot de passe incorrect");
      }
      btn.disabled = false; btn.textContent = "Entrer";
    });
  });
}

async function gate() {
  if (store.REMOTE) return remoteGate();
  const saved = ls.get("odn.pin");
  if (ss.get("odn.admin") === saved && saved) return true;
  const first = !saved;
  app.innerHTML = `
    <section class="adm-gate">
      <div class="seal"><img src="assets/img/logo.webp" alt="OrDesNuits"></div>
      <h1 class="display">Le Salon privé</h1>
      <p>${first ? "Première visite : choisis ton code secret à 4 chiffres." : "Entre ton code secret."}</p>
      <div class="pin" id="pin">${[0, 1, 2, 3].map((i) => `<input inputmode="numeric" maxlength="1" aria-label="Chiffre ${i + 1}" autocomplete="off" id="pin${i}">`).join("")}</div>
      <p class="at-hint">Ton code reste sur cet appareil. Avec Supabase, il sera remplacé par une vraie connexion sécurisée.</p>
      <a class="adm-link" href="maisons.html">← Retour à la boutique</a>
    </section>`;
  return new Promise((resolve) => {
    const ins = [...app.querySelectorAll(".pin input")];
    ins[0].focus();
    ins.forEach((inp, i) => {
      inp.addEventListener("input", async () => {
        inp.value = inp.value.replace(/\D/g, "");
        if (inp.value && ins[i + 1]) ins[i + 1].focus();
        const code = ins.map((x) => x.value).join("");
        if (code.length < 4) return;
        const h = await sha(code);
        if (first) { ls.set("odn.pin", h); ss.set("odn.admin", h); resolve(true); return; }
        if (h === saved) { ss.set("odn.admin", h); resolve(true); return; }
        toast("Code incorrect");
        ins.forEach((x) => (x.value = "")); ins[0].focus();
      });
      inp.addEventListener("keydown", (e) => { if (e.key === "Backspace" && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
    });
  });
}

/* ---------- Habillage ---------- */
const IC = {
  salon: '<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z"/></svg>',
  commandes: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
  produits: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  clients: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/></svg>',
  compta: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h8"/></svg>',
  atelier: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  reglages: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
};
const NAV = [["salon", "Tableau"], ["commandes", "Commandes"], ["produits", "Produits"], ["clients", "Clients"], ["compta", "Compta"], ["atelier", "Atelier"], ["reglages", "Réglages"]];
const MOBILE = ["salon", "commandes", "produits", "clients"];
function shell(inner) {
  const pend = allOrders().filter((o) => o.status === "nouvelle").length;
  const badge = (k) => (k === "commandes" && pend ? `<b class="nav-badge">${pend}</b>` : "");
  app.innerHTML = `
  <div class="adm2">
    <aside class="adm2-nav">
      <a class="adm2-brand" href="maisons.html" title="Voir la boutique"><img src="assets/img/mono.webp" alt=""><span class="display">Salon privé</span></a>
      ${NAV.map(([k, l]) => `<button type="button" class="${MOBILE.includes(k) ? "" : "desk"}" data-view="${k}" aria-current="${k === view}">${IC[k]}<span>${l}</span>${badge(k)}</button>`).join("")}
      <button type="button" class="mob" data-more aria-current="${!MOBILE.includes(view)}">${IC.plus}<span>Plus</span></button>
    </aside>
    <main class="adm2-main">${inner}</main>
  </div>`;
}
function moreSheet() {
  const s = document.createElement("div");
  s.className = "scrim";
  s.innerHTML = `<div class="sheet adm-more">${[["compta", "Comptabilité", "Livre des recettes, URSSAF, marges"], ["atelier", "Atelier", "Visuels promo, logo, badges"], ["reglages", "Réglages", "Sauvegarde, code, données de démo"]].map(([k, l, d]) => `
    <button type="button" data-go="${k}">${IC[k]}<span><b>${l}</b><small>${d}</small></span></button>`).join("")}
    <a href="maisons.html" class="adm-link">Voir la boutique →</a></div>`;
  s.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { view = b.dataset.go; route(); } if (b || e.target === s) s.remove(); });
  document.body.append(s);
}
const periodChips = () => `<div class="at-chips">${Object.entries(A.PERIODS).map(([k, v]) => `<button type="button" data-period="${k}" aria-pressed="${period === k}">${v}</button>`).join("")}</div>`;
const demoBanner = () => (hasDemo() ? `<p class="demo-flag">✦ Données de démonstration affichées. Tu peux les retirer dans Réglages.</p>` : "");
/* ---------- Fiche produit (éditeur) ---------- */
async function editor(id) {
  const base = id ? store.find(id) : null;
  const p = base ? structuredClone(base) : {
    id: "", shop: filter.shop === "elle" ? "elle" : "lui", category: "miel", name: "", price: 4.5, promo: null, frame: "none",
    offer: true, pinned: false, active: true, stock: 20, lowAt: 5, sold: 0, img: null, gallery: [], fit: "cover", desc: { fr: "", en: "" },
  };
  p.gallery ||= []; p.desc ||= { fr: "", en: "" };
  const sheet = document.createElement("div");
  sheet.className = "adm-editor";
  document.body.append(sheet);
  document.documentElement.classList.add("no-scroll");

  const field = (label, html, cls = "") => `<label class="fld ${cls}"><span>${label}</span>${html}</label>`;
  const opts = (obj, cur) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${v}</option>`).join("");
  const sw = (key, label) => `<button type="button" class="sw" role="switch" data-sw="${key}" aria-checked="${!!p[key]}"><i></i>${label}</button>`;

  function photos() {
    return `<div class="ed-photos">
      ${[p.img, ...p.gallery].map((src, i) => src ? `<figure><img src="${esc(src)}" alt=""><figcaption>${i ? "Galerie" : "Principale"}</figcaption>
        <div><button type="button" data-studio="${i}">Atelier</button><button type="button" data-rmphoto="${i}">Retirer</button>${i ? `<button type="button" data-main="${i}">★</button>` : ""}</div></figure>` : "").join("")}
      <div class="ed-add">
        <button type="button" data-studio="new">✦ Créer dans l'Atelier</button>
        <label>Importer une photo<input type="file" accept="image/*" id="edFile" hidden></label>
      </div></div>`;
  }

  function render() {
    sheet.innerHTML = `
    <header class="at-top"><button type="button" class="at-icon" data-ed="close" aria-label="Fermer">✕</button>
      <b class="display">${base ? "Modifier" : "Nouveau produit"}</b>
      <button type="button" class="adm-btn gold" data-ed="save">Enregistrer</button></header>
    <div class="ed-body">
      <section class="ed-preview"><p class="at-label">Aperçu en vitrine</p><div class="ed-card" id="edPreview"></div></section>
      <section class="ed-form">
        <p class="at-label">Photos</p>${photos()}
        ${field("Nom", `<input class="adm-input" id="f-name" value="${esc(p.name)}" placeholder="Ex. Nuit d'Ambre">`)}
        <div class="fld-row">
          ${field("Boutique", `<select class="adm-input" id="f-shop">${opts(SHOPS, p.shop)}</select>`)}
          ${field("Catégorie", `<select class="adm-input" id="f-category">${opts(CATS, p.category)}</select>`)}
        </div>
        <div class="fld-row">
          ${field("Prix (€)", `<input class="adm-input" id="f-price" inputmode="decimal" value="${p.price ?? ""}">`)}
          ${field("Prix promo (€)", `<input class="adm-input" id="f-promo" inputmode="decimal" value="${p.promo ?? ""}" placeholder="Aucun">`)}
        </div>
        ${field("Coût d'achat unitaire (€) · privé, pour calculer ta marge", `<input class="adm-input" id="f-cost" inputmode="decimal" value="${p.cost ?? ""}" placeholder="Ex. 1,20">`)}
        <div class="fld-row">
          ${field("Stock", `<input class="adm-input" id="f-stock" inputmode="numeric" value="${p.stock}">`)}
          ${field("Alerte stock bas à", `<input class="adm-input" id="f-lowAt" inputmode="numeric" value="${p.lowAt ?? 5}">`)}
        </div>
        <p class="at-label">Encadrement en vitrine</p>
        <div class="at-chips">${Object.entries(FRAMES).map(([k, v]) => `<button type="button" data-frame="${k}" aria-pressed="${p.frame === k}">${v}</button>`).join("")}</div>
        <p class="at-label">Rendu de la photo</p>
        <div class="at-chips"><button type="button" data-fit="cover" aria-pressed="${p.fit !== "contain"}">Remplit la vitrine</button><button type="button" data-fit="contain" aria-pressed="${p.fit === "contain"}">Posée sur le piédestal (détourée)</button></div>
        <div class="ed-switches">${sw("active", "Visible sur le site")}${sw("offer", "Offre 3 achetés, le 4ᵉ offert")}${sw("pinned", "Épingler en tête des meilleures ventes")}</div>
        ${field("Description (français)", `<textarea class="adm-input" id="f-desc-fr" rows="3">${esc(p.desc.fr || "")}</textarea>`)}
        ${field("Description (anglais, pour l'international)", `<textarea class="adm-input" id="f-desc-en" rows="3">${esc(p.desc.en || "")}</textarea>`)}
        <p class="at-hint">Pas d'allégation santé (« aphrodisiaque », « booste… ») : la loi l'interdit sur les aliments. Parle des saveurs, des textures, du moment.</p>
        ${base ? `<button type="button" class="adm-btn danger" data-ed="delete">Supprimer ce produit</button>` : ""}
      </section>
    </div>`;
    preview();
  }

  function read() {
    const v = (id) => sheet.querySelector(id)?.value ?? "";
    const num = (id) => { const n = parseFloat(v(id).replace(",", ".")); return isNaN(n) ? null : n; };
    p.name = v("#f-name").trim();
    p.shop = v("#f-shop"); p.category = v("#f-category");
    p.type = p.category === "pack" ? "pack" : undefined;
    p.price = num("#f-price") ?? 0; p.promo = num("#f-promo"); p.cost = num("#f-cost");
    p.stock = Math.max(0, Math.round(num("#f-stock") ?? 0)); p.lowAt = Math.max(0, Math.round(num("#f-lowAt") ?? 5));
    p.desc = { fr: v("#f-desc-fr"), en: v("#f-desc-en") };
  }
  function preview() {
    const prev = { ...p, name: p.name || "Nom du produit" };
    sheet.querySelector("#edPreview").innerHTML = card(prev).replace(/href="[^"]*"/g, "");
    sheet.querySelector("#edPreview .card")?.setAttribute("data-shop", p.shop);
  }

  sheet.addEventListener("input", (e) => { if (e.target.closest(".ed-form")) { read(); preview(); } });
  sheet.addEventListener("change", async (e) => {
    if (e.target.id === "edFile" && e.target.files[0]) {
      const data = await compress(e.target.files[0]);
      if (!p.img) p.img = data; else p.gallery.push(data);
      read(); render();
    } else if (e.target.closest(".ed-form")) { read(); preview(); }
  });
  sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.frame) { p.frame = d.frame; read(); render(); return; }
    if (d.fit) { p.fit = d.fit; read(); render(); return; }
    if (d.sw) { p[d.sw] = !p[d.sw]; b.setAttribute("aria-checked", p[d.sw]); preview(); return; }
    if (d.studio) {
      read();
      const i = d.studio === "new" ? -1 : Number(d.studio);
      const src = i < 0 ? null : i === 0 ? p.img : p.gallery[i - 1];
      const out = await openStudio({ src, format: "4:5", title: p.name || "Atelier" });
      if (out) {
        if (i < 0) { if (!p.img) p.img = out; else p.gallery.push(out); }
        else if (i === 0) p.img = out; else p.gallery[i - 1] = out;
        render();
      }
      return;
    }
    if (d.rmphoto) { const i = Number(d.rmphoto); if (i === 0) { p.img = p.gallery.shift() || null; } else p.gallery.splice(i - 1, 1); read(); render(); return; }
    if (d.main) { const i = Number(d.main); const [g] = p.gallery.splice(i - 1, 1); if (p.img) p.gallery.unshift(p.img); p.img = g; read(); render(); return; }
    if (d.ed === "close") { close(); return; }
    if (d.ed === "delete") {
      if (await confirmSheet("Supprimer ?", `« ${p.name} » disparaîtra du site.`, "Supprimer")) { if (!(await store.remove(p.id))) { toast("Suppression impossible (connexion ?)"); return; } close(); toast("Produit supprimé"); route(); }
      return;
    }
    if (d.ed === "save") {
      read();
      if (!p.name) { toast("Donne un nom au produit"); sheet.querySelector("#f-name").focus(); return; }
      if (!p.id) p.id = store.slug(p.name);
      const btn = sheet.querySelector('[data-ed="save"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Enregistrement…"; }
      const ok = await store.upsert(p);
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      if (!ok) { toast(store.REMOTE ? "Enregistrement impossible : vérifie ta connexion" : "Mémoire pleine : retire une photo ou exporte ton catalogue"); return; }
      close(); toast(base ? "Modifications enregistrées" : "Produit ajouté à la boutique"); route();
    }
  });
  function close() { sheet.remove(); document.documentElement.classList.remove("no-scroll"); }
  render();
}


/* ---------- Tableau de bord ---------- */
function salon() {
  const products = store.products();
  const s = A.compute(period, products);
  const ins = A.insights(s, products);
  const st = store.stats();
  const h = new Date().getHours();
  const hello = h < 6 ? "Belle nuit" : h < 18 ? "Bonjour" : "Bonsoir";
  const liveTotal = s.countries.reduce((a, c) => a + c.orders, 0) || 1;
  const lastOrder = allOrders()[0];
  shell(`
    <header class="adm2-head"><p class="eyebrow">OrDesNuits</p><h1 class="display">${hello} Abd</h1>
      <p class="sub">${lastOrder ? `<span class="live-dot"></span>Dernière commande ${A.ago(lastOrder.at)}${lastOrder.shipping?.country ? ` · ${flag(lastOrder.shipping.country)} ${esc(countryName(lastOrder.shipping.country, "fr"))}` : ""}` : "Aucune commande pour l'instant."}</p></header>
    ${demoBanner()}
    ${periodChips()}
    ${s.pending.length ? `<button type="button" class="pending" data-view="commandes" data-of="nouvelle"><b>${s.pending.length}</b><span>commande${s.pending.length > 1 ? "s" : ""} à confirmer</span><i>→</i></button>` : ""}
    <div class="adm2-kpis">
      <div class="kpi2 lead"><span>Chiffre d'affaires</span><b>${eur(s.revenue)}</b><small>encaissé ${delta(s.revenue, s.prevRevenue)}</small></div>
      <div class="kpi2"><span>Commandes</span><b>${nb(s.count)}</b><small>${nb(s.units)} articles ${delta(s.count, s.prevCount)}</small></div>
      <div class="kpi2"><span>Panier moyen</span><b>${eur(s.basket)}</b><small>par commande</small></div>
      <div class="kpi2"><span>Clients fidèles</span><b>${s.repeatRate} %</b><small>${s.repeat} sur ${s.buyers} ont recommandé</small></div>
      <div class="kpi2"><span>Comptes clients</span><b>${nb(s.users)}</b><small>+${s.newUsers} sur la période</small></div>
      <div class="kpi2"><span>E-mails (offres)</span><b>${nb(s.optins)}</b><small>avec consentement</small></div>
      <div class="kpi2"><span>Marge brute</span><b>${s.knownCost ? eur(s.margin) : "—"}</b><small>${s.knownCost ? "CA − coût d'achat" : "ajoute tes coûts d'achat"}</small></div>
      <div class="kpi2 ${st.low.length + st.out.length ? "warn" : ""}"><span>Stock</span><b>${eur(st.value)}</b><small>${st.out.length} épuisé · ${st.low.length} bas</small></div>
    </div>

    <section class="adm2-box insights">
      <h2 class="display">Pistes stratégiques</h2>
      <ul>${ins.map((i) => `<li class="ins ${i.tone}" ${i.go ? `data-view="${i.go}"` : ""}><i></i><p>${esc(i.text)}</p></li>`).join("")}</ul>
    </section>

    <section class="adm2-box">
      <div class="adm2-boxhead"><h2 class="display">Chiffre d'affaires</h2><small class="muted">${A.PERIODS[period]}</small></div>
      ${columns(s.series)}
    </section>

    <div class="adm2-two">
      <section class="adm2-box">
        <div class="adm2-boxhead"><h2 class="display">Top pays</h2><small class="muted"><span class="live-dot"></span>${nb(liveTotal === 1 && !s.countries.length ? 0 : liveTotal)} commandes</small></div>
        ${s.countries.length ? hbars(s.countries.slice(0, 10).map((c) => ({ label: `${flag(c.key)} ${esc(c.name)}`, v: c.orders, c })), (r) => `<b>${r.c.orders}</b><small>${Math.round((r.c.orders / liveTotal) * 100)} % · ${eur(r.c.revenue)}</small>`) : `<p class="at-hint">Les pays apparaîtront avec les premières commandes.</p>`}
      </section>
      <section class="adm2-box">
        <div class="adm2-boxhead"><h2 class="display">France par région</h2><small class="muted">${flag("FR")} ${nb(s.regions.reduce((a, r) => a + r.orders, 0))} commandes</small></div>
        ${s.regions.length ? hbars(s.regions.map((r) => ({ label: esc(r.name), v: r.orders, r })), (x) => `<b>${x.r.orders}</b><small>${eur(x.r.revenue)}</small>`) : `<p class="at-hint">Aucune commande en France sur la période.</p>`}
      </section>
    </div>

    <div class="adm2-two">
      <section class="adm2-box">
        <h2 class="display">Produits phares</h2>
        ${s.topProducts.length ? hbars(s.topProducts.slice(0, 6).map((p) => ({ label: esc(p.name), v: p.qty, p })), (x) => `<b>${x.p.qty}</b><small>${eur(x.p.revenue)}</small>`) : `<p class="at-hint">Pas encore de ventes.</p>`}
      </section>
      <section class="adm2-box">
        <h2 class="display">Pour lui · Pour elle</h2>
        ${(() => { const t = s.shop.lui + s.shop.elle || 1; const l = Math.round((s.shop.lui / t) * 100); return `<div class="split"><i style="width:${l}%"></i></div><div class="split-l"><span>Pour lui <b>${l} %</b> · ${eur(s.shop.lui)}</span><span>Pour elle <b>${100 - l} %</b> · ${eur(s.shop.elle)}</span></div>`; })()}
        <h3 class="mini-h">Par catégorie</h3>
        ${Object.keys(s.cat).length ? hbars(Object.entries(s.cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: CATS[k] || k, v })), (r) => `<b>${eur(r.v)}</b>`) : `<p class="at-hint">—</p>`}
      </section>
    </div>

    <section class="adm2-box">
      <h2 class="display">Quand tes clients commandent</h2>
      <div class="adm2-two tight">
        <div><h3 class="mini-h">Jours</h3>${hbars(["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((d, i) => ({ label: d, v: s.byDay[(i + 1) % 7] })), (r) => `<b>${r.v}</b>`)}</div>
        <div><h3 class="mini-h">Heures</h3><div class="hours">${s.byHour.map((v, i) => `<span style="--h:${Math.round((v / Math.max(1, ...s.byHour)) * 100)}%" title="${i} h : ${v}"><i></i>${i % 3 === 0 ? `<em>${i}h</em>` : ""}</span>`).join("")}</div></div>
      </div>
    </section>

    <section class="adm2-box">
      <div class="adm2-boxhead"><h2 class="display">À réassortir</h2><button type="button" class="adm-link" data-view="produits">Tout le stock →</button></div>
      ${[...st.out, ...st.low].length ? `<ul class="adm2-list">${[...st.out, ...st.low].map(rowStock).join("")}</ul>` : `<p class="at-hint">Tout est bien approvisionné. ✦</p>`}
    </section>`);
}

function rowStock(p) {
  return `<li class="adm2-row ${p.active === false ? "off" : ""}" data-edit="${esc(p.id)}">
    ${thumb(p)}
    <div class="grow"><b>${esc(p.name)}</b><small>${SHOPS[p.shop] || ""} · ${CATS[p.category] || ""} · ${eur(p.promo && p.promo < p.price ? p.promo : p.price)}</small></div>
    ${vial(p)}
    <div class="stepper2" data-stop>
      <button type="button" data-stock="${esc(p.id)}" data-d="-1" aria-label="Retirer 1">−</button>
      <output>${p.stock}</output>
      <button type="button" data-stock="${esc(p.id)}" data-d="1" aria-label="Ajouter 1">+</button>
    </div>
  </li>`;
}

/* ---------- Commandes ---------- */
const pill = (s) => `<span class="st st-${s}">${A.STATUS[s]}</span>`;
function commandes() {
  const all = allOrders();
  const counts = Object.fromEntries(Object.keys(A.STATUS).map((k) => [k, all.filter((o) => o.status === k).length]));
  const list = all.filter((o) => ofilter === "all" || o.status === ofilter);
  shell(`
    <header class="adm2-head row"><div><p class="eyebrow">Caisse</p><h1 class="display">Commandes</h1><p class="sub">${all.length} au total</p></div>
      <button type="button" class="adm-btn gold" data-wa>+ Commande WhatsApp</button></header>
    ${demoBanner()}
    <div class="at-chips scroll"><button type="button" data-of="all" aria-pressed="${ofilter === "all"}">Toutes</button>${Object.entries(A.STATUS).map(([k, v]) => `<button type="button" data-of="${k}" aria-pressed="${ofilter === k}">${v} <small>${counts[k]}</small></button>`).join("")}</div>
    ${list.length ? `<ul class="adm2-list orders">${list.slice(0, 200).map((o) => `<li class="adm2-row" data-order="${esc(o.id)}">
      <span class="o-flag">${flag(o.shipping?.country)}</span>
      <div class="grow"><b>${esc([o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || o.customer?.email || "Client")}</b>
        <small>${esc(o.id)} · ${dt(o.at)} · ${o.lines.reduce((a, l) => a + l.qty, 0)} art.${o.source === "whatsapp" ? " · WhatsApp" : ""}</small></div>
      <div class="o-end"><b>${eur(o.totalEur)}</b>${pill(o.status)}</div></li>`).join("")}</ul>`
      : `<div class="adm2-empty">${ICONS.bag}<p>Aucune commande ${ofilter === "all" ? "pour l'instant" : "dans cette catégorie"}.</p></div>`}`);
}

function applyStock(o, sign) {
  o.lines.forEach((l) => { if (l.id && store.find(l.id)) { store.adjustStock(l.id, sign * l.qty); const p = store.find(l.id); if (sign < 0) p.sold = (p.sold || 0) + l.qty; else p.sold = Math.max(0, (p.sold || 0) - l.qty); } });
  store.save();
}

function orderSheet(id) {
  const o = allOrders().find((x) => x.id === id);
  if (!o) return;
  const c = o.customer || {}, sh = o.shipping || {};
  const waMsg = `Bonjour ${c.firstName || ""}, ici OrDesNuits. Merci pour votre commande ${o.id} (${eur(o.totalEur)}).`;
  const phone = String(c.phone || "").replace(/\D/g, "");
  const { sheet, close } = panel(`
    <header class="at-top"><button type="button" class="at-icon" data-close aria-label="Fermer">✕</button><b class="display">${esc(o.id)}</b>${pill(o.status)}</header>
    <div class="ed-body one">
      <section class="adm2-box">
        <h2 class="display">${esc([c.firstName, c.lastName].filter(Boolean).join(" ") || "Client")}</h2>
        <p class="o-info">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a><br>` : ""}${c.phone ? esc(c.phone) + "<br>" : ""}
        ${flag(sh.country)} ${esc([sh.address, [sh.postcode, sh.city].filter(Boolean).join(" "), countryName(sh.country || "FR", "fr")].filter(Boolean).join(", "))}${sh.region ? `<br>Région : ${esc(FR_REGIONS[sh.region] || sh.region)}` : ""}</p>
        <p class="at-hint">Passée le ${dt(o.at)} · ${o.source === "whatsapp" ? "via WhatsApp" : "sur le site"} · langue ${esc(o.lang || "fr")}${c.optin ? " · accepte les offres" : ""}</p>
        ${phone ? `<a class="adm-btn ghost mt" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}">Écrire sur WhatsApp</a>` : ""}
      </section>
      <section class="adm2-box">
        <h2 class="display">Contenu</h2>
        <ul class="o-lines">${o.lines.map((l) => `<li><span>${l.qty} × ${esc(l.name)}</span><span>${eur(l.unitEur * l.qty)}</span></li>`).join("")}</ul>
        ${o.discountEur ? `<p class="o-tot rose"><span>Offert (3+1)</span><span>−${eur(o.discountEur)}</span></p>` : ""}
        <p class="o-tot"><span>Total</span><b>${eur(o.totalEur)}</b></p>
      </section>
      <section class="adm2-box">
        <h2 class="display">Suivi</h2>
        ${o.status === "nouvelle" ? `<p class="at-label">Mode de paiement reçu</p>
          <div class="at-chips">${Object.entries(A.PAYMENTS).map(([k, v]) => `<button type="button" data-pay="${k}" aria-pressed="${o.payment === k}">${v}</button>`).join("")}</div>
          <div class="at-row wrap"><button type="button" class="adm-btn gold" data-st="confirmee">Confirmer · paiement reçu</button><button type="button" class="adm-btn ghost" data-st="annulee">Annuler</button></div>
          <p class="at-hint">En confirmant, le stock des produits se décompte tout seul.</p>`
        : o.status === "confirmee" ? `<p>Payée ${o.payment ? `par ${A.PAYMENTS[o.payment].toLowerCase()}` : ""}.</p><div class="at-row wrap"><button type="button" class="adm-btn gold" data-st="expediee">Marquer expédiée</button><button type="button" class="adm-btn ghost" data-st="annulee">Annuler et remettre en stock</button></div>`
        : o.status === "expediee" ? `<div class="at-row wrap"><button type="button" class="adm-btn gold" data-st="livree">Marquer livrée</button></div>`
        : `<p class="at-hint">Commande ${A.STATUS[o.status].toLowerCase()}.</p>`}
      </section>
    </div>`);
  let pay = o.payment;
  sheet.addEventListener("click", async (e) => {
    const p = e.target.closest("[data-pay]");
    if (p) { pay = p.dataset.pay; sheet.querySelectorAll("[data-pay]").forEach((b) => b.setAttribute("aria-pressed", b === p)); return; }
    const b = e.target.closest("[data-st]");
    if (!b) return;
    const next = b.dataset.st;
    if (next === "confirmee" && !pay) { toast("Choisis le mode de paiement"); return; }
    if (next === "annulee" && !(await confirmSheet("Annuler la commande ?", o.stockApplied ? "Les articles seront remis en stock." : "La commande sera marquée annulée."))) return;
    if (store.REMOTE) {
      try { await setOrderStatus(o.id, next, next === "confirmee" ? pay : null); await store.reload(); }
      catch { toast("Action impossible : vérifie ta connexion"); return; }
      close(); toast(`Commande ${A.STATUS[next].toLowerCase()}`); route();
      return;
    }
    const patch = { status: next };
    if (next === "confirmee") { patch.payment = pay; patch.paidAt = new Date().toISOString(); if (!o.stockApplied) { applyStock(o, -1); patch.stockApplied = true; } }
    if (next === "annulee" && o.stockApplied) { applyStock(o, +1); patch.stockApplied = false; }
    if (next === "expediee") patch.shippedAt = new Date().toISOString();
    updateOrder(o.id, patch);
    close(); toast(`Commande ${A.STATUS[next].toLowerCase()}`); route();
  });
}

function whatsappEntry() {
  const list = countries("fr");
  const { sheet, close } = panel(`
    <header class="at-top"><button type="button" class="at-icon" data-close aria-label="Fermer">✕</button><b class="display">Commande WhatsApp</b><span></span></header>
    <div class="ed-body one">
      <section class="adm2-box">
        <p class="at-hint">Colle le message de commande reçu sur WhatsApp. Je retrouve les produits et les quantités.</p>
        <textarea class="adm-input" id="order" rows="5" placeholder="Bonjour OrDesNuits, je souhaite commander :&#10;• 2 × Nuit d'Ambre (3,90 €)…"></textarea>
        <div class="at-row"><button type="button" class="adm-btn ghost" data-parse>Analyser</button></div>
        <div id="parsed"></div>
      </section>
      <section class="adm2-box">
        <h2 class="display">Client</h2>
        <div class="fld-row"><label class="fld"><span>Prénom</span><input class="adm-input" id="w-first"></label><label class="fld"><span>Téléphone</span><input class="adm-input" id="w-phone" inputmode="tel"></label></div>
        <label class="fld"><span>E-mail (facultatif)</span><input class="adm-input" id="w-email" inputmode="email"></label>
        <div class="fld-row"><label class="fld"><span>Pays</span><select class="adm-input" id="w-country">${list.map((c) => `<option value="${c.code}" ${c.code === "FR" ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label>
        <label class="fld"><span>Région (France)</span><select class="adm-input" id="w-region"><option value="">—</option>${Object.entries(FR_REGIONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label></div>
        <p class="at-label">Paiement reçu</p>
        <div class="at-chips">${Object.entries(A.PAYMENTS).map(([k, v]) => `<button type="button" data-pay="${k}" aria-pressed="false">${v}</button>`).join("")}</div>
        <div class="at-row"><button type="button" class="adm-btn gold" data-save>Enregistrer et décompter le stock</button></div>
      </section>
    </div>`);
  let parsed = null, pay = null;
  sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-parse")) {
      parsed = store.parseOrder(sheet.querySelector("#order").value);
      const box = sheet.querySelector("#parsed");
      box.innerHTML = parsed.lines.length ? `<ul class="adm2-list">${parsed.lines.map((l, i) => `<li class="adm2-row"><div class="grow"><b>${l.qty} × ${esc(l.name)}</b>
        <select class="adm-input" data-match="${i}"><option value="">— Produit introuvable —</option>${store.products().map((p) => `<option value="${esc(p.id)}" ${p.id === l.id ? "selected" : ""}>${esc(p.name)} (stock ${p.stock})</option>`).join("")}</select></div></li>`).join("")}</ul>`
        : `<p class="at-hint">Aucun produit trouvé. Vérifie que c'est bien un message de commande du site.</p>`;
      return;
    }
    if (b.dataset.pay) { pay = b.dataset.pay; sheet.querySelectorAll("[data-pay]").forEach((x) => x.setAttribute("aria-pressed", x === b)); return; }
    if (b.hasAttribute("data-save")) {
      if (!parsed?.lines.length) { toast("Colle et analyse d'abord la commande"); return; }
      sheet.querySelectorAll("[data-match]").forEach((s) => (parsed.lines[Number(s.dataset.match)].id = s.value || null));
      const lines = parsed.lines.filter((l) => l.id).map((l) => { const p = store.find(l.id); return { id: p.id, name: p.name, qty: l.qty, unitEur: p.promo && p.promo < p.price ? p.promo : p.price, shop: p.shop, category: p.category }; });
      if (!lines.length) { toast("Associe au moins un produit"); return; }
      const sub = lines.reduce((s, l) => s + l.unitEur * l.qty, 0);
      const honey = lines.filter((l) => store.find(l.id)?.offer).flatMap((l) => Array(l.qty).fill(l.unitEur)).sort((a, b) => a - b);
      const disc = honey.slice(0, Math.floor(honey.length / 4)).reduce((s, v) => s + v, 0);
      const v = (id) => sheet.querySelector(id).value.trim();
      const country = v("#w-country");
      if (store.REMOTE) {
        b.disabled = true;
        try {
          await adminCreateOrder({
            source: "whatsapp", payment: pay || "whatsapp",
            customer: { firstName: v("#w-first"), lastName: "", email: v("#w-email"), phone: v("#w-phone"), optin: false },
            shipping: { country, region: country === "FR" ? v("#w-region") || null : null },
            lang: "fr", lines, subtotalEur: sub, discountEur: disc, totalEur: Math.max(0, sub - disc),
          });
          await store.reload();
        } catch { b.disabled = false; toast("Enregistrement impossible : vérifie ta connexion"); return; }
        close(); toast("Commande enregistrée, stock mis à jour"); route();
        return;
      }
      const o = createOrder({
        source: "whatsapp", status: "confirmee", payment: pay || "whatsapp", paidAt: new Date().toISOString(), stockApplied: true,
        customer: { firstName: v("#w-first"), lastName: "", email: v("#w-email"), phone: v("#w-phone"), optin: false },
        shipping: { country, region: country === "FR" ? v("#w-region") || null : null },
        lang: "fr", lines, subtotalEur: sub, discountEur: disc, totalEur: Math.max(0, sub - disc),
      });
      applyStock(o, -1);
      close(); toast("Commande enregistrée, stock mis à jour"); route();
    }
  });
}

/* ---------- Produits ---------- */
function produits() {
  const q = filter.q.toLowerCase();
  const list = store.products().filter((p) => (filter.shop === "all" || p.shop === filter.shop) && (!q || p.name.toLowerCase().includes(q)));
  shell(`
    <header class="adm2-head row"><div><p class="eyebrow">Catalogue</p><h1 class="display">Produits</h1><p class="sub">${store.products().length} produits</p></div>
      <button type="button" class="adm-btn gold" data-new>+ Nouveau</button></header>
    <div class="adm2-tools">
      <input type="search" class="adm-input" id="q" placeholder="Rechercher…" value="${esc(filter.q)}">
      <div class="at-chips">${Object.entries({ all: "Tout", lui: "Pour lui", elle: "Pour elle" }).map(([k, v]) => `<button type="button" data-shopf="${k}" aria-pressed="${filter.shop === k}">${v}</button>`).join("")}</div>
    </div>
    ${list.length ? `<ul class="adm2-list">${list.map(rowStock).join("")}</ul>`
      : `<div class="adm2-empty">${ICONS.hex}<p>Aucun produit ici.</p><button type="button" class="adm-btn gold" data-new>Créer le premier</button></div>`}`);
  const qi = document.getElementById("q");
  qi.addEventListener("input", () => { filter.q = qi.value; const pos = qi.selectionStart; produits(); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ---------- Clients ---------- */
function clients() {
  const users = customers();
  const subs = subscribers();
  const orders = allOrders().filter((o) => A.PAID.includes(o.status));
  const spent = {};
  orders.forEach((o) => { const e = (o.customer?.email || "").toLowerCase(); if (!e) return; spent[e] ||= { n: 0, v: 0, last: o.at }; spent[e].n++; spent[e].v += o.totalEur; if (o.at > spent[e].last) spent[e].last = o.at; });
  const optinEmails = [...new Set([...subs.map((s) => s.email), ...users.filter((u) => u.optin).map((u) => u.email)])];
  const q = filter.q.toLowerCase();
  shell(`
    <header class="adm2-head"><p class="eyebrow">Clientèle</p><h1 class="display">Clients</h1>
      <p class="sub">${users.length} comptes · ${optinEmails.length} e-mails avec consentement</p></header>
    ${demoBanner()}
    <div class="ac-tabs adm"><button type="button" data-ctab="comptes" aria-selected="${ctab === "comptes"}">Comptes (${users.length})</button><button type="button" data-ctab="emails" aria-selected="${ctab === "emails"}">E-mails offres (${optinEmails.length})</button></div>
    <input type="search" class="adm-input" id="cq" placeholder="Rechercher un e-mail, un prénom…" value="${esc(filter.q)}">
    ${ctab === "comptes" ? (users.length ? `<ul class="adm2-list mt">${users.filter((u) => !q || (u.email + u.firstName).toLowerCase().includes(q)).sort((a, b) => (spent[b.email]?.v || 0) - (spent[a.email]?.v || 0)).map((u) => `<li class="adm2-row">
        <span class="o-flag">${flag(u.country)}</span>
        <div class="grow"><b>${esc(u.firstName || "—")}</b><small>${esc(u.email)} · inscrit ${new Date(u.createdAt).toLocaleDateString("fr-FR")}${u.optin ? " · offres ✓" : ""}</small></div>
        <div class="o-end"><b>${eur(spent[u.email]?.v || 0)}</b><small>${spent[u.email]?.n || 0} cmd</small></div></li>`).join("")}</ul>` : `<div class="adm2-empty">${IC.clients}<p>Les comptes clients apparaîtront ici.</p></div>`)
    : `<div class="at-row wrap"><button type="button" class="adm-btn gold" data-copyemails>Copier tous les e-mails</button><button type="button" class="adm-btn ghost" data-csvemails>Exporter (CSV)</button></div>
       <p class="at-hint">Uniquement les personnes qui ont accepté de recevoir tes offres. Le RGPD interdit d'écrire aux autres.</p>
       ${optinEmails.length ? `<ul class="email-list">${optinEmails.filter((e) => !q || e.includes(q)).map((e) => { const s = subs.find((x) => x.email === e); return `<li><span>${esc(e)}</span><small>${s ? esc(s.source) : "compte"}</small></li>`; }).join("")}</ul>` : `<p class="at-hint mt">Aucun inscrit pour l'instant.</p>`}`}`);
  const qi = document.getElementById("cq");
  qi.addEventListener("input", () => { filter.q = qi.value; const pos = qi.selectionStart; clients(); const n = document.getElementById("cq"); n.focus(); n.setSelectionRange(pos, pos); });
}

/* ---------- Comptabilité ---------- */
function compta() {
  const cfg = comptaCfg();
  const rows = A.ledger(year);
  const months = A.monthly(year);
  const total = rows.reduce((s, o) => s + o.totalEur, 0);
  const products = store.products();
  const cogs = rows.reduce((s, o) => s + o.lines.reduce((a, l) => a + (products.find((p) => p.id === l.id)?.cost || 0) * l.qty, 0), 0);
  const thisMonth = months[new Date().getMonth()];
  const years = [...new Set(allOrders().map((o) => new Date(o.paidAt || o.at).getFullYear()).concat(new Date().getFullYear()))].sort((a, b) => b - a);
  const pl = Math.min(100, (total / cfg.plafond) * 100), tv = Math.min(100, (total / cfg.tva) * 100);
  shell(`
    <header class="adm2-head row"><div><p class="eyebrow">Micro-entreprise</p><h1 class="display">Comptabilité</h1></div>
      <select class="adm-input w-auto" id="year">${years.map((y) => `<option ${y === year ? "selected" : ""}>${y}</option>`).join("")}</select></header>
    ${demoBanner()}
    <div class="adm2-kpis">
      <div class="kpi2 lead"><span>CA ${year}</span><b>${eur(total)}</b><small>${rows.length} ventes encaissées</small></div>
      <div class="kpi2"><span>Ce mois-ci</span><b>${eur(thisMonth.revenue)}</b><small>${thisMonth.count} ventes</small></div>
      <div class="kpi2"><span>Cotisations estimées</span><b>${eur(total * cfg.urssaf / 100)}</b><small>${String(cfg.urssaf).replace(".", ",")} % du CA</small></div>
      <div class="kpi2"><span>Marge brute</span><b>${products.some((p) => p.cost) ? eur(total - cogs) : "—"}</b><small>${products.some((p) => p.cost) ? "après coût d'achat" : "ajoute tes coûts d'achat"}</small></div>
    </div>
    <section class="adm2-box">
      <h2 class="display">Seuils de l'année</h2>
      <p class="mini-h">Plafond micro-entreprise · ${eur(cfg.plafond)}</p><div class="meter"><i style="width:${pl}%"></i></div><p class="at-hint">${Math.round(pl)} % atteint</p>
      <p class="mini-h">Franchise de TVA · ${eur(cfg.tva)}</p><div class="meter"><i style="width:${tv}%"></i></div><p class="at-hint">${Math.round(tv)} % atteint</p>
    </section>
    <section class="adm2-box">
      <h2 class="display">Mois par mois</h2>
      ${columns(months.map((m) => ({ label: new Date(year, m.month, 1).toLocaleDateString("fr-FR", { month: "short" }), value: m.revenue })))}
    </section>
    <section class="adm2-box">
      <div class="adm2-boxhead"><h2 class="display">Livre des recettes</h2><button type="button" class="adm-btn ghost" data-csvledger>Exporter (CSV)</button></div>
      <p class="at-hint">Document obligatoire en micro-entreprise : date, client, nature, mode de paiement, montant. L'export s'ouvre dans Excel ou Google Sheets.</p>
      ${rows.length ? `<div class="tbl"><table><thead><tr><th>Date</th><th>N°</th><th>Client</th><th>Paiement</th><th class="num">Montant</th></tr></thead><tbody>
        ${rows.slice().reverse().slice(0, 30).map((o) => `<tr><td>${new Date(o.paidAt || o.at).toLocaleDateString("fr-FR")}</td><td>${esc(o.id)}</td><td>${esc([o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" ") || "—")}</td><td>${esc(A.PAYMENTS[o.payment] || "—")}</td><td class="num">${eur(o.totalEur)}</td></tr>`).join("")}
      </tbody></table></div>${rows.length > 30 ? `<p class="at-hint">30 dernières ventes affichées sur ${rows.length}. L'export contient tout.</p>` : ""}` : `<p class="at-hint">Aucune vente encaissée en ${year}.</p>`}
    </section>
    <section class="adm2-box">
      <h2 class="display">Paramètres</h2>
      <div class="fld-row three">
        <label class="fld"><span>Taux URSSAF (%)</span><input class="adm-input" id="c-urssaf" inputmode="decimal" value="${cfg.urssaf}"></label>
        <label class="fld"><span>Plafond CA (€)</span><input class="adm-input" id="c-plafond" inputmode="numeric" value="${cfg.plafond}"></label>
        <label class="fld"><span>Seuil TVA (€)</span><input class="adm-input" id="c-tva" inputmode="numeric" value="${cfg.tva}"></label>
      </div>
      <p class="at-hint">Valeurs indicatives pour la vente de marchandises. Vérifie les taux et seuils en vigueur sur autoentrepreneur.urssaf.fr.</p>
      <div class="at-row"><button type="button" class="adm-btn ghost" data-savecfg>Enregistrer</button></div>
    </section>`);
  document.getElementById("year").onchange = (e) => { year = Number(e.target.value); compta(); };
}

/* ---------- Atelier (visuels libres) ---------- */
function atelier() {
  shell(`
    <header class="adm2-head"><p class="eyebrow">Création</p><h1 class="display">L'Atelier</h1>
      <p class="sub">Crée un visuel de promo pour Snapchat, une story ou une bannière : texte, logo, badges, cadre doré.</p></header>
    <section class="adm2-actions">
      <button type="button" class="action" data-free="4:5"><b>4:5</b><span>Publication</span></button>
      <button type="button" class="action" data-free="1:1"><b>1:1</b><span>Carré</span></button>
      <button type="button" class="action" data-free="16:9"><b>16:9</b><span>Bannière</span></button>
    </section>
    <div id="freeOut"></div>`);
}

/* ---------- Réglages ---------- */
function reglages() {
  const kb = Math.round(store.storageUsage() / 1024);
  const pct = Math.min(100, Math.round((kb / 5000) * 100));
  shell(`
    <header class="adm2-head"><p class="eyebrow">Coffre</p><h1 class="display">Réglages</h1></header>
    <section class="adm2-box">
      <h2 class="display">Données de démonstration</h2>
      <p>Remplis le tableau de bord avec 140 commandes fictives (pays, régions, clients) pour voir toutes les analyses fonctionner. Elles sont marquées « démo » et se retirent en un geste.</p>
      <div class="at-row wrap">${hasDemo() ? `<button type="button" class="adm-btn danger" data-cleardemo>Retirer les données de démo</button>` : `<button type="button" class="adm-btn gold" data-seed>Charger les données de démo</button>`}</div>
    </section>
    <section class="adm2-box">
      <h2 class="display">Où sont tes données ?</h2>
      ${BACKEND_MODE === "local" ? `<p>Mode aperçu : produits, commandes et clients sont enregistrés <b>sur cet appareil</b>. Avec Supabase, tout sera synchronisé en direct entre le site, tes clients et ton téléphone.</p>
      <div class="meter"><i style="width:${pct}%"></i></div><p class="at-hint">Mémoire utilisée : ${kb} Ko sur environ 5 000 Ko (les photos prennent le plus de place).</p>`
      : `<p><span class="live-dot"></span> Connecté à la base en ligne : produits, stock, commandes et clients sont partagés en direct entre le site et tous tes appareils. Les photos sont hébergées dans Supabase Storage.</p>
      <p class="at-hint">Connecté en tant que ${esc(currentUser()?.email || "")}.</p>`}
      <div class="at-row wrap">
        <button type="button" class="adm-btn gold" data-export>Exporter le catalogue</button>
        <label class="adm-btn ghost">Importer un catalogue<input type="file" accept="application/json,.json" id="imp" hidden></label>
      </div>
      <p class="at-hint">${BACKEND_MODE === "local" ? "Pour publier tes produits avant Supabase : exporte, puis remplace <code>data/catalogue.json</code> sur GitHub." : "L'export sert de sauvegarde. L'import ajoute ou met à jour les produits du fichier dans la base."}</p>
    </section>
    <section class="adm2-box">
      <h2 class="display">Sécurité</h2>
      <div class="at-row wrap">${BACKEND_MODE === "local" ? `<button type="button" class="adm-btn ghost" data-newpin>Changer mon code</button>` : ""}<button type="button" class="adm-btn ghost" data-logout>${BACKEND_MODE === "local" ? "Verrouiller le salon" : "Se déconnecter"}</button></div>
    </section>
    ${BACKEND_MODE === "local" ? `<section class="adm2-box">
      <h2 class="display">Repartir de la version publiée</h2>
      <p class="at-hint">Efface les produits modifiés sur cet appareil et recharge le catalogue en ligne.</p>
      <button type="button" class="adm-btn danger" data-reset>Réinitialiser le catalogue</button>
    </section>` : `<section class="adm2-box">
      <h2 class="display">Actualiser</h2>
      <p class="at-hint">Le salon se met à jour tout seul toutes les 30 secondes. Ce bouton force la mise à jour.</p>
      <button type="button" class="adm-btn ghost" data-reset>Actualiser maintenant</button>
    </section>`}`);
}

/* ---------- Navigation ---------- */
function route(keepScroll = false) {
  const y = window.scrollY;
  ({ salon, commandes, produits, clients, compta, atelier, reglages }[view] || salon)();
  window.scrollTo({ top: keepScroll ? y : 0 });
}

/* En ligne : le salon se rafraîchit tout seul (nouvelles commandes, stock) */
let poll = null;
function startPolling() {
  if (!store.REMOTE || poll) return;
  poll = setInterval(async () => {
    if (document.hidden) return;
    const before = allOrders().filter((o) => o.status === "nouvelle").length;
    try { await Promise.all([loadAdminData(), store.reload()]); } catch { return; }
    const after = allOrders().filter((o) => o.status === "nouvelle").length;
    if (after > before) toast(after - before > 1 ? `${after - before} nouvelles commandes` : "Nouvelle commande !");
    const busy = document.querySelector(".adm-editor, .scrim, .atelier") || app.contains(document.activeElement) && document.activeElement.matches("input, textarea, select");
    if (!busy && ["salon", "commandes", "clients", "produits"].includes(view)) route(true);
  }, 30000);
}

app.addEventListener("click", async (e) => {
  const b = e.target.closest("button, li[data-edit], li[data-order], li[data-view]");
  if (!b) return;
  const d = b.dataset;
  if (b.hasAttribute("data-more")) { moreSheet(); return; }
  if (d.view) { view = d.view; if (d.of) ofilter = d.of; filter.q = ""; route(); return; }
  if (d.period) { period = d.period; salon(); return; }
  if (d.stock) {
    e.stopPropagation();
    let n;
    try { n = await store.adjustStock(d.stock, Number(d.d)); } catch { toast("Stock non modifié : vérifie ta connexion"); return; }
    const row = b.closest(".adm2-row");
    row.querySelector("output").textContent = n;
    row.querySelector(".vial").outerHTML = vial(store.find(d.stock));
    return;
  }
  if (e.target.closest("[data-stop]")) return;
  if (b.hasAttribute("data-new")) { editor(null); return; }
  if (d.edit) { editor(d.edit); return; }
  if (d.order) { orderSheet(d.order); return; }
  if (d.of) { ofilter = d.of; commandes(); return; }
  if (b.hasAttribute("data-wa")) { whatsappEntry(); return; }
  if (d.shopf) { filter.shop = d.shopf; produits(); return; }
  if (d.ctab) { ctab = d.ctab; filter.q = ""; clients(); return; }
  if (b.hasAttribute("data-copyemails") || b.hasAttribute("data-csvemails")) {
    const subs = subscribers(), users = customers();
    const emails = [...new Set([...subs.map((s) => s.email), ...users.filter((u) => u.optin).map((u) => u.email)])];
    if (b.hasAttribute("data-copyemails")) copy(emails.join(", "));
    else download("ordesnuits-emails.csv", A.csv([["E-mail", "Source", "Date"], ...emails.map((em) => { const s = subs.find((x) => x.email === em); return [em, s?.source || "compte", (s?.at || "").slice(0, 10)]; })]), "text/csv");
    return;
  }
  if (b.hasAttribute("data-csvledger")) {
    const rows = A.ledger(year);
    download(`livre-recettes-${year}.csv`, A.csv([["Date", "N° commande", "Client", "Nature", "Mode de paiement", "Montant (€)"], ...rows.map((o) => [new Date(o.paidAt || o.at).toLocaleDateString("fr-FR"), o.id, [o.customer?.firstName, o.customer?.lastName].filter(Boolean).join(" "), "Vente de marchandises", A.PAYMENTS[o.payment] || "", o.totalEur.toFixed(2).replace(".", ",")])]), "text/csv");
    return;
  }
  if (b.hasAttribute("data-savecfg")) {
    const n = (id) => parseFloat(document.getElementById(id).value.replace(",", ".").replace(/\s/g, ""));
    ls.set(COMPTA_KEY, JSON.stringify({ urssaf: n("c-urssaf") || 12.3, plafond: n("c-plafond") || 188700, tva: n("c-tva") || 85000 }));
    toast("Paramètres enregistrés"); compta(); return;
  }
  if (d.free) {
    const out = await openStudio({ format: d.free, title: "Atelier" });
    if (out) {
      document.getElementById("freeOut").innerHTML = `<section class="adm2-box"><h2 class="display">Ton visuel</h2><img class="free-img" src="${out}" alt="Visuel créé">
        <div class="at-row"><button type="button" class="adm-btn gold" data-dl>Télécharger</button></div><p class="at-hint">Sur téléphone, tu peux aussi appuyer longuement sur l'image pour l'enregistrer.</p></section>`;
      document.querySelector("[data-dl]").onclick = () => download(`ordesnuits-${Date.now()}.webp`, out);
    }
    return;
  }
  if (b.hasAttribute("data-seed")) {
    b.disabled = true; b.textContent = "Chargement…";
    try { await seedDemo(store.products()); } catch { toast("Chargement impossible"); reglages(); return; }
    toast("Données de démo chargées"); view = "salon"; route(); return;
  }
  if (b.hasAttribute("data-cleardemo")) {
    if (await confirmSheet("Retirer la démo ?", "Les commandes, comptes et e-mails fictifs seront supprimés. Tes vraies données restent.", "Retirer")) {
      try { await clearDemo(); } catch { toast("Action impossible"); return; }
      toast("Démo retirée"); reglages();
    }
    return;
  }
  if (b.hasAttribute("data-export")) { download("catalogue.json", store.exportJson(), "application/json"); toast("Catalogue exporté"); return; }
  if (b.hasAttribute("data-newpin")) { try { localStorage.removeItem("odn.pin"); sessionStorage.removeItem("odn.admin"); } catch {} start(); return; }
  if (b.hasAttribute("data-logout")) { if (store.REMOTE) signOut(); try { sessionStorage.removeItem("odn.admin"); } catch {} start(); return; }
  if (b.hasAttribute("data-reset")) {
    if (store.REMOTE) { await store.reload(); await loadAdminData(); toast("Données rechargées"); route(); return; }
    if (await confirmSheet("Réinitialiser ?", "Les produits, stocks et photos modifiés sur cet appareil seront effacés.", "Réinitialiser")) { await store.resetToPublished(); store.save(); toast("Catalogue rechargé"); route(); }
  }
});
app.addEventListener("change", async (e) => {
  if (e.target.id === "imp" && e.target.files[0]) {
    try { await store.importJson(await e.target.files[0].text()); toast("Catalogue importé"); route(); }
    catch { toast("Ce fichier n'est pas un catalogue OrDesNuits"); }
  }
});

async function start() {
  await initI18n("fr");
  document.documentElement.lang = "fr"; document.documentElement.dir = "ltr";
  if (store.REMOTE) {
    if (!(await gate())) return;
    app.innerHTML = `<section class="adm-gate"><div class="seal"><img src="assets/img/logo.webp" alt=""></div><p>Ouverture du salon…</p></section>`;
    try { await Promise.all([store.load(), loadAdminData()]); }
    catch { app.innerHTML = `<section class="adm-gate"><h1 class="display">Connexion impossible</h1><p>Vérifie ta connexion internet, puis recharge la page.</p></section>`; return; }
    route(); startPolling();
    return;
  }
  await store.load();
  if (await gate()) route();
}
start();
