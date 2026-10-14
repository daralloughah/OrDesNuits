/* =========================================================
   L'Atelier : studio photo de l'espace gérant.
   Recadrer, filtres « maison », texte, logo, badges promo,
   cadre art déco. Le résultat devient la photo du produit.
   ========================================================= */
import { esc } from "../core/util.js";

const FORMATS = { "4:5": [900, 1125], "1:1": [1000, 1000], "16:9": [1600, 900] };
const COLORS = { or: "#f3d28c", ivoire: "#f3e9d9", nuit: "#0b0809", rose: "#e6b4a0", vin: "#9b2a3e" };
const FONTS = { display: '"Bodoni Moda", Didot, Georgia, serif', sans: 'Jost, "Avenir Next", system-ui, sans-serif' };
const FILTERS = {
  aucun: "Naturel",
  nuit: "Nuit",
  or: "Or",
  velours: "Velours",
  noir: "Noir & or",
};

const loadImg = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
const fileToImg = (file) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => loadImg(r.result).then(ok, ko); r.onerror = ko; r.readAsDataURL(file); });

export async function openStudio({ src = null, format = "4:5", title = "Atelier" } = {}) {
  await Promise.all([
    document.fonts.load('italic 60px "Bodoni Moda"'),
    document.fonts.load('400 60px "Bodoni Moda"'),
    document.fonts.load('400 40px Jost'),
  ]).catch(() => {});
  const [mono, medal] = await Promise.all([loadImg("assets/img/mono.webp"), loadImg("assets/img/logo.webp")]).catch(() => [null, null]);

  return new Promise((resolve) => {
    const S = {
      fmt: format, img: null, zoom: 1, ox: 0, oy: 0,
      filter: "aucun", frame: false, layers: [], sel: -1,
    };
    let W = FORMATS[S.fmt][0], H = FORMATS[S.fmt][1];

    const root = document.createElement("div");
    root.className = "atelier";
    root.innerHTML = `
      <header class="at-top">
        <button type="button" class="at-icon" data-act="close" aria-label="Fermer">✕</button>
        <b class="display">${esc(title)}</b>
        <button type="button" class="adm-btn gold" data-act="use">Utiliser</button>
      </header>
      <div class="at-stage"><canvas id="atCanvas" aria-label="Aperçu de la photo"></canvas>
        <label class="at-empty" id="atEmpty"><input type="file" accept="image/*" id="atFile" hidden>
          <span class="at-plus">+</span><span>Choisir une photo</span><small>ou une photo prise avec ton téléphone</small></label>
      </div>
      <nav class="at-tabs" role="tablist">
        ${["Photo", "Texte", "Logo", "Badges", "Cadre"].map((t, i) => `<button type="button" role="tab" data-tab="${i}" aria-selected="${i === 0}">${t}</button>`).join("")}
      </nav>
      <div class="at-panel" id="atPanel"></div>`;
    document.body.append(root);
    document.documentElement.classList.add("no-scroll");

    const cv = root.querySelector("#atCanvas");
    const ctx = cv.getContext("2d");
    const panel = root.querySelector("#atPanel");
    let tab = 0;

    const stage = root.querySelector(".at-stage");
    function fit() {
      const r = stage.getBoundingClientRect();
      const k = Math.min((r.width - 28) / W, (r.height - 28) / H);
      cv.style.width = Math.max(40, W * k) + "px";
      cv.style.height = Math.max(40, H * k) + "px";
    }
    addEventListener("resize", fit);
    function setFormat(f) {
      S.fmt = f; [W, H] = FORMATS[f]; cv.width = W; cv.height = H; fit(); draw();
    }

    /* ---------- Dessin ---------- */
    function drawBase() {
      ctx.fillStyle = "#120d0f";
      ctx.fillRect(0, 0, W, H);
      if (!S.img) return;
      const r = Math.max(W / S.img.width, H / S.img.height) * S.zoom;
      const w = S.img.width * r, h = S.img.height * r;
      const maxX = Math.max(0, (w - W) / 2), maxY = Math.max(0, (h - H) / 2);
      S.ox = Math.min(maxX, Math.max(-maxX, S.ox));
      S.oy = Math.min(maxY, Math.max(-maxY, S.oy));
      const filters = { aucun: "none", nuit: "contrast(1.08) brightness(.88) saturate(1.05)", or: "sepia(.35) saturate(1.25) brightness(1.02) contrast(1.05)", velours: "saturate(1.15) contrast(1.1) brightness(.92) hue-rotate(-8deg)", noir: "grayscale(1) contrast(1.15) brightness(.95)" };
      ctx.save();
      ctx.filter = filters[S.filter] || "none";
      ctx.drawImage(S.img, (W - w) / 2 + S.ox, (H - h) / 2 + S.oy, w, h);
      ctx.restore();
      ctx.filter = "none";
      /* Lumières de la maison */
      if (S.filter === "nuit" || S.filter === "velours") {
        const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75);
        v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(5,2,4,.72)");
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
      if (S.filter === "velours") { ctx.fillStyle = "rgba(107,26,40,.18)"; ctx.globalCompositeOperation = "soft-light"; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; }
      if (S.filter === "or" || S.filter === "noir") {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, "rgba(243,210,140,.22)"); g.addColorStop(1, "rgba(138,99,38,.08)");
        ctx.globalCompositeOperation = S.filter === "noir" ? "color" : "soft-light";
        ctx.fillStyle = S.filter === "noir" ? "rgba(214,161,75,.18)" : g; ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = "source-over";
      }
    }

    function goldFill(x, y, w, h) {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, "#8a6326"); g.addColorStop(.35, "#f3d28c"); g.addColorStop(.6, "#d6a14b"); g.addColorStop(1, "#f3d28c");
      return g;
    }

    function hexDrop(cx, cy, r, color) {
      ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * .12;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i - Math.PI / 2; ctx[i ? "lineTo" : "moveTo"](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - r * .45); ctx.bezierCurveTo(cx - r * .5, cy + r * .1, cx - r * .3, cy + r * .5, cx, cy + r * .5); ctx.bezierCurveTo(cx + r * .3, cy + r * .5, cx + r * .5, cy + r * .1, cx, cy - r * .45); ctx.fill();
      ctx.restore();
    }

    function drawFrame() {
      if (!S.frame) return;
      const m = Math.round(W * .035), m2 = m + Math.round(W * .012);
      ctx.save();
      ctx.strokeStyle = goldFill(0, 0, W, H); ctx.lineWidth = Math.max(2, W * .003);
      ctx.strokeRect(m, m, W - 2 * m, H - 2 * m);
      ctx.globalAlpha = .55; ctx.lineWidth = Math.max(1, W * .0015);
      ctx.strokeRect(m2, m2, W - 2 * m2, H - 2 * m2);
      ctx.globalAlpha = 1;
      const r = W * .018;
      [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([x, y]) => {
        ctx.fillStyle = "#0b0809"; ctx.beginPath(); ctx.arc(x, y, r * 1.15, 0, Math.PI * 2); ctx.fill();
        hexDrop(x, y, r, "#f3d28c");
      });
      ctx.restore();
    }

    function drawLayer(L) {
      const x = L.x * W, y = L.y * H;
      ctx.save();
      if (L.type === "text") {
        const size = L.size * W;
        ctx.font = `${L.italic ? "italic " : ""}${L.font === "sans" ? 400 : 400} ${size}px ${FONTS[L.font]}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (L.font === "sans") ctx.letterSpacing = `${size * .18}px`;
        const text = L.font === "sans" ? L.text.toUpperCase() : L.text;
        const lines = text.split("\n");
        const lh = size * 1.12;
        const widths = lines.map((t) => ctx.measureText(t).width);
        const w = Math.max(...widths, 10), h = lh * lines.length;
        if (L.shadow) { ctx.shadowColor = "rgba(0,0,0,.65)"; ctx.shadowBlur = size * .35; ctx.shadowOffsetY = size * .05; }
        ctx.fillStyle = L.color === "or" ? goldFill(x - w / 2, y - h / 2, w, h) : COLORS[L.color];
        lines.forEach((t, i) => ctx.fillText(t, x, y - h / 2 + lh * (i + .5)));
        L._box = [x - w / 2, y - h / 2, w, h];
      } else if (L.type === "logo") {
        const s = L.size * W;
        ctx.globalAlpha = L.opacity;
        if (L.style === "signature") {
          ctx.font = `italic 400 ${s * .42}px ${FONTS.display}`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const w = ctx.measureText("OrDesNuits").width;
          ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = s * .12;
          ctx.fillStyle = goldFill(x - w / 2, y - s * .2, w, s * .4);
          ctx.fillText("OrDesNuits", x, y);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#d6a14b"; ctx.lineWidth = Math.max(1, s * .01);
          const ly = y + s * .3;
          ctx.beginPath(); ctx.moveTo(x - w * .55, ly); ctx.lineTo(x - s * .12, ly); ctx.moveTo(x + s * .12, ly); ctx.lineTo(x + w * .55, ly); ctx.stroke();
          hexDrop(x, ly, s * .07, "#f3d28c");
          L._box = [x - w / 2 - 10, y - s * .25, w + 20, s * .65];
        } else {
          const img = L.style === "medaillon" ? medal : mono;
          ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = s * .15;
          ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.closePath();
          ctx.fillStyle = "#0b0809"; ctx.fill();
          ctx.shadowBlur = 0; ctx.save(); ctx.clip();
          if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
          ctx.restore();
          ctx.strokeStyle = goldFill(x - s / 2, y - s / 2, s, s); ctx.lineWidth = Math.max(2, s * .035);
          ctx.beginPath(); ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke();
          L._box = [x - s / 2, y - s / 2, s, s];
        }
      } else if (L.type === "badge") {
        const s = L.size * W;
        if (L.style === "seal") {
          ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = s * .2;
          ctx.fillStyle = goldFill(x - s / 2, y - s / 2, s, s);
          ctx.beginPath();
          for (let i = 0; i < 48; i++) { const a = Math.PI * 2 * i / 48, rr = i % 2 ? s / 2 : s / 2 * .92; ctx[i ? "lineTo" : "moveTo"](x + rr * Math.cos(a), y + rr * Math.sin(a)); }
          ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(11,8,9,.45)"; ctx.lineWidth = s * .015; ctx.beginPath(); ctx.arc(x, y, s * .38, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#0b0809"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.font = `italic 400 ${s * .3}px ${FONTS.display}`; ctx.fillText(L.text, x, y - s * .04);
          ctx.font = `500 ${s * .085}px ${FONTS.sans}`; ctx.letterSpacing = `${s * .02}px`; ctx.fillText(L.sub || "", x, y + s * .2);
          L._box = [x - s / 2, y - s / 2, s, s];
        } else {
          const pal = { promo: ["#9b2a3e", "#f3d28c"], nouveau: ["#f3e9d9", "#0b0809"], limite: ["#0b0809", "#f3d28c"] }[L.style];
          ctx.font = `500 ${s * .32}px ${FONTS.sans}`; ctx.letterSpacing = `${s * .06}px`;
          const label = L.text.toUpperCase();
          const tw = ctx.measureText(label).width, ph = s * .62, pw = tw + s * .7;
          ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = s * .25;
          ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.roundRect(x - pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
          ctx.shadowBlur = 0;
          if (L.style === "limite") { ctx.strokeStyle = goldFill(x - pw / 2, y, pw, 1); ctx.lineWidth = s * .03; ctx.stroke(); }
          ctx.fillStyle = pal[1]; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, x + s * .03, y + s * .01);
          L._box = [x - pw / 2, y - ph / 2, pw, ph];
        }
      }
      ctx.restore();
    }

    function draw() {
      drawBase();
      drawFrame();
      S.layers.forEach(drawLayer);
      const L = S.layers[S.sel];
      if (L?._box) {
        const [x, y, w, h] = L._box, p = W * .012;
        ctx.save(); ctx.setLineDash([W * .012, W * .008]); ctx.strokeStyle = "rgba(243,210,140,.9)"; ctx.lineWidth = Math.max(2, W * .0025);
        ctx.strokeRect(x - p, y - p, w + 2 * p, h + 2 * p); ctx.restore();
      }
      root.querySelector("#atEmpty").hidden = !!S.img;
    }

    /* ---------- Toucher : déplacer un élément ou la photo ---------- */
    let drag = null;
    const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.addEventListener("pointerdown", (e) => {
      const [px, py] = toCanvas(e);
      let hit = -1;
      for (let i = S.layers.length - 1; i >= 0; i--) {
        const b = S.layers[i]._box; if (!b) continue;
        const pad = W * .02;
        if (px >= b[0] - pad && px <= b[0] + b[2] + pad && py >= b[1] - pad && py <= b[1] + b[3] + pad) { hit = i; break; }
      }
      S.sel = hit;
      drag = { px, py, ox: S.ox, oy: S.oy, lx: S.layers[hit]?.x, ly: S.layers[hit]?.y };
      cv.setPointerCapture(e.pointerId);
      if (hit >= 0 && tab !== tabOf(S.layers[hit])) showTab(tabOf(S.layers[hit])); else renderPanel();
      draw();
    });
    cv.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const [px, py] = toCanvas(e);
      const L = S.layers[S.sel];
      if (L) { L.x = Math.min(.98, Math.max(.02, drag.lx + (px - drag.px) / W)); L.y = Math.min(.98, Math.max(.02, drag.ly + (py - drag.py) / H)); }
      else { S.ox = drag.ox + (px - drag.px); S.oy = drag.oy + (py - drag.py); }
      draw();
    });
    cv.addEventListener("pointerup", () => (drag = null));
    cv.addEventListener("pointercancel", () => (drag = null));

    const tabOf = (L) => ({ text: 1, logo: 2, badge: 3 }[L.type] ?? 0);

    /* ---------- Panneaux ---------- */
    const chips = (name, items, cur) => `<div class="at-chips">${Object.entries(items).map(([k, v]) => `<button type="button" data-${name}="${k}" aria-pressed="${k === cur}">${v}</button>`).join("")}</div>`;
    const range = (id, label, min, max, step, val) => `<label class="at-range"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></label>`;
    const selected = (type) => (S.layers[S.sel]?.type === type ? S.layers[S.sel] : null);
    const layerTools = `<div class="at-row"><button type="button" class="adm-btn ghost" data-act="del">Supprimer cet élément</button><button type="button" class="adm-btn ghost" data-act="deselect">Terminé</button></div>`;

    function renderPanel() {
      if (tab === 0) {
        panel.innerHTML = `
          <div class="at-row"><label class="adm-btn ghost"><input type="file" accept="image/*" id="atFile2" hidden>${S.img ? "Changer de photo" : "Choisir une photo"}</label></div>
          <p class="at-label">Format</p>${chips("fmt", { "4:5": "Produit 4:5", "1:1": "Carré 1:1", "16:9": "Bannière 16:9" }, S.fmt)}
          <p class="at-label">Ambiance</p>${chips("filter", FILTERS, S.filter)}
          ${range("atZoom", "Zoom", 1, 3, .01, S.zoom)}
          <p class="at-hint">Fais glisser la photo avec le doigt pour la cadrer.</p>`;
      } else if (tab === 1) {
        const L = selected("text");
        panel.innerHTML = L ? `
          <textarea id="atText" rows="2" class="adm-input">${esc(L.text)}</textarea>
          ${chips("font", { display: "Élégante", sans: "Moderne" }, L.font)}
          ${chips("color", { or: "Or", ivoire: "Ivoire", nuit: "Nuit", rose: "Rose", vin: "Vin" }, L.color)}
          <div class="at-chips"><button type="button" data-toggle="italic" aria-pressed="${L.italic}">Italique</button><button type="button" data-toggle="shadow" aria-pressed="${L.shadow}">Ombre douce</button></div>
          ${range("atSize", "Taille", .03, .2, .002, L.size)}${layerTools}`
          : `<p class="at-hint">Ajoute un texte, puis place-le du doigt sur la photo.</p>
          <div class="at-presets">
            <button type="button" data-addtext="Nuit d'Ambre|display|or|1">Nom du produit</button>
            <button type="button" data-addtext="Offre de lancement|sans|ivoire|0">Accroche</button>
            <button type="button" data-addtext="−20 % ce week-end|display|or|1">Promo</button>
            <button type="button" data-addtext="Quand le désir prend la forme de miel|display|ivoire|1">Slogan</button>
          </div>`;
      } else if (tab === 2) {
        const L = selected("logo");
        panel.innerHTML = `
          <p class="at-label">${L ? "Logo sélectionné" : "Ajouter ton logo"}</p>
          ${chips("logo", { sceau: "Sceau ON", medaillon: "Médaillon", signature: "Signature" }, L?.style)}
          <p class="at-label">Position</p>
          <div class="at-grid9">${["hg", "hc", "hd", "mg", "mc", "md", "bg", "bc", "bd"].map((k) => `<button type="button" data-pos="${k}" aria-label="${k}"><i></i></button>`).join("")}</div>
          ${L ? range("atLsize", "Taille", .06, .45, .005, L.size) + range("atOpacity", "Opacité", .2, 1, .01, L.opacity) + layerTools : ""}`;
      } else if (tab === 3) {
        const L = selected("badge");
        panel.innerHTML = L ? `
          <input id="atBadgeText" class="adm-input" value="${esc(L.text)}">
          ${L.style === "seal" ? `<input id="atBadgeSub" class="adm-input" value="${esc(L.sub || "")}" placeholder="Petit texte">` : ""}
          ${range("atBsize", "Taille", .08, .45, .005, L.size)}${layerTools}`
          : `<div class="at-presets">
            <button type="button" data-badge="promo|−20 %">Promo −20 %</button>
            <button type="button" data-badge="seal|3+1|OFFERT">Sceau 3+1</button>
            <button type="button" data-badge="nouveau|Nouveau">Nouveau</button>
            <button type="button" data-badge="limite|Édition limitée">Édition limitée</button>
          </div><p class="at-hint">Touche un badge sur la photo pour changer son texte (−30 %, −50 %…).</p>`;
      } else {
        panel.innerHTML = `
          <div class="at-chips"><button type="button" data-toggle-frame aria-pressed="${S.frame}">Cadre art déco doré</button></div>
          <p class="at-hint">Un double filet d'or avec des alvéoles aux quatre coins, comme sur une étiquette de grand cru.</p>`;
      }
    }

    function showTab(i) {
      tab = i;
      requestAnimationFrame(fit);
      root.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", Number(b.dataset.tab) === i));
      renderPanel();
    }

    const POS = { h: .12, m: .5, b: .88, g: .2, c: .5, d: .8 };
    async function useFile(f) { if (!f) return; S.img = await fileToImg(f); S.zoom = 1; S.ox = S.oy = 0; draw(); renderPanel(); }

    root.addEventListener("change", (e) => {
      if (e.target.matches("#atFile, #atFile2")) useFile(e.target.files[0]);
    });
    root.addEventListener("input", (e) => {
      const L = S.layers[S.sel];
      const v = Number(e.target.value);
      switch (e.target.id) {
        case "atZoom": S.zoom = v; break;
        case "atSize": L.size = v; break;
        case "atLsize": L.size = v; break;
        case "atOpacity": L.opacity = v; break;
        case "atBsize": L.size = v; break;
        case "atText": L.text = e.target.value || " "; break;
        case "atBadgeText": L.text = e.target.value || " "; break;
        case "atBadgeSub": L.sub = e.target.value; break;
        default: return;
      }
      draw();
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("button, [data-tab]");
      if (!b) return;
      const d = b.dataset;
      if (d.tab) { S.sel = -1; showTab(Number(d.tab)); draw(); return; }
      if (d.fmt) { setFormat(d.fmt); renderPanel(); return; }
      if (d.filter) { S.filter = d.filter; draw(); renderPanel(); return; }
      if (d.addtext) {
        const [text, font, color, italic] = d.addtext.split("|");
        S.layers.push({ type: "text", text, font, color, italic: italic === "1", shadow: true, size: font === "sans" ? .045 : .085, x: .5, y: .5 });
        S.sel = S.layers.length - 1; draw(); renderPanel(); return;
      }
      if (d.font || d.color) { const L = selected("text"); if (L) { if (d.font) L.font = d.font; if (d.color) L.color = d.color; draw(); renderPanel(); } return; }
      if (d.toggle) { const L = selected("text"); if (L) { L[d.toggle] = !L[d.toggle]; draw(); renderPanel(); } return; }
      if (d.logo) {
        const L = selected("logo");
        if (L) L.style = d.logo;
        else { S.layers.push({ type: "logo", style: d.logo, size: d.logo === "signature" ? .34 : .16, opacity: 1, x: .5, y: .88 }); S.sel = S.layers.length - 1; }
        draw(); renderPanel(); return;
      }
      if (d.pos) {
        let L = selected("logo");
        if (!L) { S.layers.push({ type: "logo", style: "sceau", size: .16, opacity: 1, x: .5, y: .88 }); S.sel = S.layers.length - 1; L = S.layers[S.sel]; }
        L.y = POS[d.pos[0]]; L.x = POS[d.pos[1]]; draw(); renderPanel(); return;
      }
      if (d.badge) {
        const [style, text, sub] = d.badge.split("|");
        S.layers.push({ type: "badge", style, text, sub, size: style === "seal" ? .26 : .16, x: style === "seal" ? .8 : .5, y: style === "seal" ? .16 : .1 });
        S.sel = S.layers.length - 1; draw(); renderPanel(); return;
      }
      if (b.hasAttribute("data-toggle-frame")) { S.frame = !S.frame; draw(); renderPanel(); return; }
      if (d.act === "del") { S.layers.splice(S.sel, 1); S.sel = -1; draw(); renderPanel(); return; }
      if (d.act === "deselect") { S.sel = -1; draw(); renderPanel(); return; }
      if (d.act === "close") { finish(null); return; }
      if (d.act === "use") {
        if (!S.img && !S.layers.length) { finish(null); return; }
        S.sel = -1; draw();
        finish(cv.toDataURL("image/webp", .8));
      }
    });

    function finish(result) {
      removeEventListener("resize", fit);
      root.remove();
      document.documentElement.classList.remove("no-scroll");
      resolve(result);
    }

    cv.width = W; cv.height = H;
    renderPanel();
    requestAnimationFrame(fit);
    if (src) loadImg(src).then((i) => { S.img = i; draw(); renderPanel(); }).catch(draw); else draw();
  });
}

/* Réduit une photo importée telle quelle (sans passer par l'Atelier) */
export async function compress(file, max = 1000) {
  const img = await fileToImg(file);
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", .8);
}
