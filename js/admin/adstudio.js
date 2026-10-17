/* =========================================================
   Studio pub : une publicité prête à poster en 1 minute.
   Produit → angle → format → accroche → visuel + légende.
   Aucune promesse d'effet (la loi l'interdit sur un aliment) :
   les accroches parlent de goût, de cadeau, de moment à deux.
   ========================================================= */
import { esc } from "../core/util.js";
import { compress } from "./studio.js";

const eur = (v) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(v || 0);
const FORMATS = { story: { w: 1080, h: 1920, label: "Story 9:16" }, feed: { w: 1080, h: 1350, label: "Feed 4:5" }, carre: { w: 1080, h: 1080, label: "Carré 1:1" } };
const STYLES = { velours: "Velours", coffret: "Coffret", minimal: "Minimal" };
const CTAS = ["Commander sur WhatsApp", "Lien en bio", "Découvrir", "Offrez-le ce soir"];
const ANGLES = {
  cadeau: { label: "Cadeau", t: ["Le cadeau qu'on n'attend pas", "Offrez une nuit dorée", "Une parenthèse pour deux"], s: ["{name} · dès {from}", "Livré en colis neutre, sous 48 h", "Le coffret qui fait son effet… sur la table"] },
  nuit: { label: "Nuit à deux", t: ["Ce soir, le temps s'arrête", "Pour les nuits qui comptent", "Quand le désir prend la forme de miel"], s: ["{name}, à partager", "Un rituel doré, à deux", "Glissez-le dans la poche, gardez le secret"] },
  offre: { label: "Offre", t: ["Jusqu'à {save} sur la boîte", "Plus vous en prenez, plus c'est doux", "La boîte de {bq} à {box}"], s: ["Dès {from} l'unité", "{name} · prix dégressifs automatiques", "Économie calculée au centime"] },
  nouveau: { label: "Nouveauté", t: ["Nouveau : {name}", "Il vient d'arriver", "La nouvelle signature OrDesNuits"], s: ["Édition limitée, stock compté", "À découvrir dès ce soir", "Dès {from}"] },
  discret: { label: "Discrétion", t: ["Personne ne saura. Sauf vous deux.", "Discret de A à Z", "Livré dans un colis 100 % neutre"], s: ["Aucune mention sur le colis", "Paiement sécurisé · envoi sous 48 h", "{name} · dès {from}"] },
};

function vars(p) {
  if (!p) return { name: "OrDesNuits", from: "", save: "", box: "", bq: "" };
  const unit = p.promo && p.promo < p.price ? p.promo : p.price;
  const tiers = [{ q: 1, p: unit }, ...(p.tiers || []).filter((x) => x.q > 1 && x.p > 0)];
  const best = tiers.reduce((a, x) => (1 - x.p / (x.q * unit) > 1 - a.p / (a.q * unit) ? x : a), tiers[0]);
  const from = Math.min(...tiers.map((x) => x.p / x.q));
  const pct = Math.round((1 - best.p / (best.q * unit)) * 100);
  return { name: p.name, from: eur(from), save: pct > 0 ? `−${pct} %` : "", box: eur(best.p), bq: best.q, pct };
}
const fill = (txt, v) => txt.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

/* ---------- Dessin ---------- */
function loadImg(src) {
  return new Promise((ok) => { if (!src) return ok(null); const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
}
function cover(ctx, img, W, H) {
  const r = Math.max(W / img.width, H / img.height);
  const w = img.width * r, h = img.height * r;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
function wrap(ctx, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const GOLD = (ctx, x0, y0, x1, y1) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, "#f6dc9c"); g.addColorStop(.5, "#d6a14b"); g.addColorStop(1, "#9a6c2c"); return g; };

export async function drawAd(canvas, st, imgs) {
  const { w: W, h: H } = FORMATS[st.format];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const u = W / 1080;
  // fond
  if (imgs.photo) cover(ctx, imgs.photo, W, H);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1f0f15"); g.addColorStop(1, "#0b0809"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r = ctx.createRadialGradient(W / 2, H * .38, 10, W / 2, H * .38, W * .7); r.addColorStop(0, "rgba(214,161,75,.35)"); r.addColorStop(1, "rgba(214,161,75,0)"); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
    if (imgs.mono) { ctx.globalAlpha = .12; const s = W * .7; ctx.drawImage(imgs.mono, (W - s) / 2, H * .38 - s / 2, s, s); ctx.globalAlpha = 1; }
  }
  // voiles pour la lisibilité
  let v = ctx.createLinearGradient(0, 0, 0, H * .3); v.addColorStop(0, "rgba(8,5,6,.75)"); v.addColorStop(1, "rgba(8,5,6,0)"); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H * .3);
  v = ctx.createLinearGradient(0, H * .42, 0, H); v.addColorStop(0, "rgba(8,5,6,0)"); v.addColorStop(.55, "rgba(8,5,6,.82)"); v.addColorStop(1, "rgba(8,5,6,.96)"); ctx.fillStyle = v; ctx.fillRect(0, H * .42, W, H * .58);

  // cadre
  if (st.style === "velours") {
    ctx.strokeStyle = "rgba(214,161,75,.75)"; ctx.lineWidth = 2 * u; ctx.strokeRect(34 * u, 34 * u, W - 68 * u, H - 68 * u);
    ctx.strokeStyle = "rgba(214,161,75,.35)"; ctx.lineWidth = 1.5 * u; ctx.strokeRect(46 * u, 46 * u, W - 92 * u, H - 92 * u);
    ctx.strokeStyle = "#e8c27a"; ctx.lineWidth = 3 * u; const c = 46 * u, L = 60 * u;
    [[c, c, 1, 1], [W - c, c, -1, 1], [c, H - c, 1, -1], [W - c, H - c, -1, -1]].forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke(); });
  } else if (st.style === "coffret") {
    ctx.lineWidth = 16 * u; ctx.strokeStyle = GOLD(ctx, 0, 0, W, H); ctx.strokeRect(8 * u, 8 * u, W - 16 * u, H - 16 * u);
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = "rgba(243,210,140,.5)"; ctx.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u);
  }

  // logo
  const ls = 120 * u;
  if (imgs.mono) ctx.drawImage(imgs.mono, (W - ls) / 2, 80 * u, ls, ls);
  ctx.textAlign = "center"; ctx.fillStyle = "#f3d28c";
  ctx.font = `400 ${30 * u}px "Bodoni Moda", Georgia, serif`;
  try { ctx.letterSpacing = `${6 * u}px`; } catch {}
  ctx.fillText("ORDESNUITS", W / 2, 80 * u + ls + 46 * u);
  try { ctx.letterSpacing = "0px"; } catch {}

  // badge économie
  if (st.showSave && st.v.pct > 0) {
    const r = 92 * u, cx = W - 90 * u - r, cy = 110 * u + r;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = "#7a1c2e"; ctx.fill();
    ctx.lineWidth = 3 * u; ctx.strokeStyle = GOLD(ctx, cx - r, cy - r, cx + r, cy + r); ctx.stroke();
    ctx.fillStyle = "#f6dc9c"; ctx.font = `600 ${22 * u}px Jost, Arial, sans-serif`; ctx.fillText("JUSQU'À", cx, cy - 18 * u);
    ctx.font = `italic 500 ${54 * u}px "Bodoni Moda", Georgia, serif`; ctx.fillText(`−${st.v.pct}%`, cx, cy + 40 * u);
  }

  // textes
  const bottom = st.format === "story" ? H * .62 : st.format === "feed" ? H * .58 : H * .5;
  ctx.font = `italic 500 ${(st.format === "carre" ? 78 : 90) * u}px "Bodoni Moda", Georgia, serif`;
  const lines = wrap(ctx, st.title, W - 200 * u).slice(0, 3);
  const lh = (st.format === "carre" ? 88 : 102) * u;
  let y = bottom;
  ctx.fillStyle = GOLD(ctx, 0, y - lh, 0, y + lh * lines.length);
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 24 * u;
  lines.forEach((l) => { ctx.fillText(l, W / 2, y); y += lh; });
  ctx.shadowBlur = 0;
  // filet
  y += 4 * u;
  ctx.strokeStyle = "rgba(214,161,75,.8)"; ctx.lineWidth = 1.5 * u;
  ctx.beginPath(); ctx.moveTo(W / 2 - 110 * u, y); ctx.lineTo(W / 2 - 16 * u, y); ctx.moveTo(W / 2 + 16 * u, y); ctx.lineTo(W / 2 + 110 * u, y); ctx.stroke();
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.PI / 4); ctx.strokeRect(-7 * u, -7 * u, 14 * u, 14 * u); ctx.restore();
  y += 62 * u;
  ctx.fillStyle = "#f3e9d9"; ctx.font = `300 ${38 * u}px Jost, Arial, sans-serif`;
  wrap(ctx, st.sub, W - 220 * u).slice(0, 2).forEach((l) => { ctx.fillText(l, W / 2, y); y += 52 * u; });

  // bouton d'appel
  if (st.cta) {
    ctx.font = `600 ${30 * u}px Jost, Arial, sans-serif`;
    try { ctx.letterSpacing = `${4 * u}px`; } catch {}
    const txt = st.cta.toUpperCase();
    const bw = Math.min(W - 180 * u, ctx.measureText(txt).width + 120 * u), bh = 96 * u;
    const by = Math.min(H - 210 * u, y + 40 * u);
    rrect(ctx, (W - bw) / 2, by, bw, bh, bh / 2); ctx.fillStyle = GOLD(ctx, (W - bw) / 2, by, (W + bw) / 2, by + bh); ctx.fill();
    ctx.fillStyle = "#140c0e"; ctx.fillText(txt, W / 2, by + bh / 2 + 11 * u);
    try { ctx.letterSpacing = "0px"; } catch {}
  }
  // pied
  ctx.fillStyle = "rgba(243,233,217,.7)"; ctx.font = `400 ${24 * u}px Jost, Arial, sans-serif`;
  ctx.fillText("Colis 100 % neutre · Expédié sous 48 h · 18+", W / 2, H - 80 * u);
}

/* ---------- Le panneau ---------- */
export async function adStudio({ products }) {
  const list = products.filter((p) => p.active !== false);
  const st = { pid: list[0]?.id || "", angle: "cadeau", pick: 0, format: "story", style: "velours", cta: CTAS[0], showSave: true, photo: null, title: "", sub: "" };
  const imgs = { mono: await loadImg("assets/img/mono.webp"), photo: null };
  try { await Promise.all([document.fonts.load('italic 500 60px "Bodoni Moda"'), document.fonts.load('300 30px Jost'), document.fonts.load('600 30px Jost')]); } catch {}

  const sheet = document.createElement("div");
  sheet.className = "adm-editor ad-studio";
  document.body.append(sheet);
  document.documentElement.classList.add("no-scroll");
  const prod = () => list.find((p) => p.id === st.pid);
  const chips = (obj, cur, key) => Object.entries(obj).map(([k, v]) => `<button type="button" data-${key}="${k}" aria-pressed="${k === cur}">${esc(typeof v === "string" ? v : v.label)}</button>`).join("");

  function texts() {
    const a = ANGLES[st.angle], v = vars(prod());
    st.v = v;
    st.title = fill(a.t[st.pick % a.t.length], v);
    st.sub = fill(a.s[st.pick % a.s.length], v);
  }
  async function loadPhoto() {
    imgs.photo = st.photo ? await loadImg(st.photo) : await loadImg(prod()?.img);
  }

  function ui() {
    sheet.innerHTML = `
    <header class="at-top"><button type="button" class="at-icon" data-x aria-label="Fermer">✕</button><b class="display">Studio pub</b>
      <button type="button" class="adm-btn gold" data-dl>Télécharger</button></header>
    <div class="ad-body">
      <div class="ad-stage"><canvas id="adCanvas"></canvas></div>
      <div class="ad-ctrl">
        <label class="fld"><span>Produit</span><select class="adm-input" id="adProd">${list.map((p) => `<option value="${esc(p.id)}" ${p.id === st.pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}<option value="">— Sans produit (image de marque)</option></select></label>
        <p class="at-label">Angle</p><div class="at-chips">${chips(ANGLES, st.angle, "angle")}</div>
        <p class="at-label">Accroche <small>(touche une variante)</small></p>
        <div class="ad-vars" id="adVars"></div>
        <label class="fld"><span>Titre</span><input class="adm-input" id="adTitle" value="${esc(st.title)}"></label>
        <label class="fld"><span>Sous-titre</span><input class="adm-input" id="adSub" value="${esc(st.sub)}"></label>
        <p class="at-label">Format</p><div class="at-chips">${chips(Object.fromEntries(Object.entries(FORMATS).map(([k, f]) => [k, f.label])), st.format, "fmt")}</div>
        <p class="at-label">Style</p><div class="at-chips">${chips(STYLES, st.style, "sty")}</div>
        <p class="at-label">Bouton</p><div class="at-chips">${CTAS.map((c) => `<button type="button" data-cta="${esc(c)}" aria-pressed="${c === st.cta}">${esc(c)}</button>`).join("")}<button type="button" data-cta="" aria-pressed="${!st.cta}">Aucun</button></div>
        <div class="ed-switches"><button type="button" class="sw" role="switch" data-save aria-checked="${st.showSave}"><i></i>Pastille « jusqu'à −X % »</button></div>
        <div class="at-row wrap">
          <label class="adm-btn ghost">Ma photo<input type="file" accept="image/*" id="adFile" hidden></label>
          ${st.photo ? `<button type="button" class="adm-btn ghost" data-nophoto>Photo du produit</button>` : ""}
          <button type="button" class="adm-btn ghost" data-share>Partager</button>
        </div>
        <section class="adm2-box ad-caption"><h3 class="mini-h">Légende prête à coller</h3><textarea class="adm-input" id="adCap" rows="7"></textarea>
          <button type="button" class="adm-btn ghost" data-copycap>Copier la légende</button></section>
        <p class="at-hint">Les accroches parlent de goût, de cadeau et de moment à deux : jamais d'effet promis (c'est interdit pour un aliment et refusé par les réseaux).</p>
      </div>
    </div>`;
    paint();
  }

  function caption() {
    const p = prod(), v = st.v;
    return `${st.title}\n\n${p ? `${p.name}${v.from ? ` · dès ${v.from}` : ""}\n` : ""}✦ Colis 100 % neutre · Expédié sous 48 h\n${st.cta ? `👉 ${st.cta}` : "👉 Lien en bio"}\n\n#OrDesNuits #miel #cadeau #nuitadeux #luxe #artdevivre`;
  }

  async function paint() {
    const cv = sheet.querySelector("#adCanvas");
    await drawAd(cv, st, imgs);
    sheet.querySelector("#adCap").value = caption();
    // vignettes des 3 accroches
    const a = ANGLES[st.angle];
    const box = sheet.querySelector("#adVars");
    box.innerHTML = a.t.map((_, i) => `<button type="button" data-pick="${i}" aria-pressed="${i === st.pick % a.t.length}"><canvas></canvas></button>`).join("");
    const keepTitle = st.title, keepSub = st.sub, keepPick = st.pick;
    for (const [i, btn] of [...box.children].entries()) {
      st.pick = i; texts();
      await drawAd(btn.querySelector("canvas"), { ...st }, imgs);
    }
    st.pick = keepPick; st.title = keepTitle; st.sub = keepSub;
  }

  texts(); await loadPhoto(); ui();

  sheet.addEventListener("input", (e) => {
    if (e.target.id === "adTitle") { st.title = e.target.value; drawAd(sheet.querySelector("#adCanvas"), st, imgs); sheet.querySelector("#adCap").value = caption(); }
    if (e.target.id === "adSub") { st.sub = e.target.value; drawAd(sheet.querySelector("#adCanvas"), st, imgs); }
  });
  sheet.addEventListener("change", async (e) => {
    if (e.target.id === "adProd") { st.pid = e.target.value; st.photo = null; texts(); await loadPhoto(); ui(); }
    if (e.target.id === "adFile" && e.target.files[0]) { st.photo = await compress(e.target.files[0], 1600); await loadPhoto(); ui(); }
  });
  sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if ("x" in d) { sheet.remove(); document.documentElement.classList.remove("no-scroll"); return; }
    if (d.angle) { st.angle = d.angle; st.pick = 0; texts(); ui(); return; }
    if (d.pick != null) { st.pick = Number(d.pick); texts(); ui(); return; }
    if (d.fmt) { st.format = d.fmt; ui(); return; }
    if (d.sty) { st.style = d.sty; ui(); return; }
    if (d.cta != null) { st.cta = d.cta; ui(); return; }
    if ("save" in d) { st.showSave = !st.showSave; ui(); return; }
    if ("nophoto" in d) { st.photo = null; await loadPhoto(); ui(); return; }
    if ("copycap" in d) { try { await navigator.clipboard.writeText(caption()); b.textContent = "Copiée ✦"; } catch { sheet.querySelector("#adCap").select(); } return; }
    if ("dl" in d || "share" in d) {
      const cv = sheet.querySelector("#adCanvas");
      const blob = await new Promise((ok) => cv.toBlob(ok, "image/png"));
      const name = `pub-${st.pid || "ordesnuits"}-${st.format}.png`;
      const file = new File([blob], name, { type: "image/png" });
      if ("share" in d && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: caption() }); } catch {} return; }
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
      document.body.append(a); a.click(); a.remove();
    }
  });
}
