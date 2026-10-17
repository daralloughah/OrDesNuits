/* =========================================================
   Effaceur : passe le pinceau sur un texte, un logo ou un
   petit défaut, puis « Effacer » : la zone est reconstruite
   à partir des pixels autour (sur le téléphone, sans internet).
   Idéal sur fond uni, dégradé, marbre, tissu. Pour les fonds
   très détaillés, une version IA pourra s'ajouter plus tard.
   ========================================================= */
import { compress } from "./studio.js";

/* Reconstruction couche par couche, du bord vers le centre */
export function inpaint(img, mask, w, h) {
  const d = img.data;
  const known = new Uint8Array(w * h);
  let left = 0;
  for (let i = 0; i < w * h; i++) { if (mask[i]) left++; else known[i] = 1; }
  if (!left || left === w * h) return;
  const R = 3;
  const filled = [];
  const queued = new Uint8Array(w * h);
  let front = [];
  for (let i = 0; i < w * h; i++) {
    if (known[i]) continue;
    const x = i % w, y = (i / w) | 0;
    if ((x > 0 && known[i - 1]) || (x < w - 1 && known[i + 1]) || (y > 0 && known[i - w]) || (y < h - 1 && known[i + w])) { front.push(i); queued[i] = 1; }
  }
  while (front.length) {
    const colors = new Float32Array(front.length * 3);
    front.forEach((i, k) => {
      const x = i % w, y = (i / w) | 0;
      let r = 0, g = 0, b = 0, sw = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w || (!dx && !dy)) continue;
          const j = yy * w + xx; if (!known[j]) continue;
          const wt = 1 / (dx * dx + dy * dy);
          r += d[j * 4] * wt; g += d[j * 4 + 1] * wt; b += d[j * 4 + 2] * wt; sw += wt;
        }
      }
      colors[k * 3] = r / sw; colors[k * 3 + 1] = g / sw; colors[k * 3 + 2] = b / sw;
    });
    const next = [];
    front.forEach((i, k) => {
      d[i * 4] = colors[k * 3]; d[i * 4 + 1] = colors[k * 3 + 1]; d[i * 4 + 2] = colors[k * 3 + 2];
      known[i] = 1; filled.push(i);
    });
    front.forEach((i) => {
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < w * h && !known[j] && !queued[j]) { queued[j] = 1; next.push(j); }
      }
    });
    front = next;
  }
  // lissage léger + grain discret pour que la zone ne paraisse pas « plastique »
  const copy = new Uint8ClampedArray(d);
  for (const i of filled) {
    const x = i % w, y = (i / w) | 0;
    for (let c = 0; c < 3; c++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        s += copy[(yy * w + xx) * 4 + c]; n++;
      }
      d[i * 4 + c] = s / n + (Math.random() - .5) * 5;
    }
  }
}

function loadImg(src) { return new Promise((ok, ko) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => ok(i); i.onerror = ko; i.src = src; }); }

/* Ouvre l'effaceur. Renvoie l'image modifiée (dataURL WebP) ou null. */
export function openEraser({ src = null } = {}) {
  return new Promise((resolve) => {
    const sheet = document.createElement("div");
    sheet.className = "adm-editor vstudio eraser";
    document.body.append(sheet);
    document.documentElement.classList.add("no-scroll");
    sheet.innerHTML = `
      <header class="at-top"><button type="button" class="at-icon" data-x aria-label="Fermer">✕</button><b class="display">Effaceur</b>
        <button type="button" class="adm-btn gold" data-ok disabled>${src ? "Utiliser" : "Télécharger"}</button></header>
      <div class="ad-body">
        <div class="ad-stage er-stage">
          <div class="er-wrap"><canvas id="erImg"></canvas><canvas id="erMask"></canvas></div>
          <label class="v-empty" id="erEmpty" ${src ? "hidden" : ""}><input type="file" accept="image/*" id="erFile" hidden><b>✦ Choisir une photo</b><small>Puis passe le doigt sur ce qu'il faut effacer</small></label>
        </div>
        <div class="ad-ctrl">
          <label class="fld"><span>Taille du pinceau <b id="erSizeOut">40</b></span><input type="range" id="erSize" min="8" max="140" value="40"></label>
          <div class="at-row wrap">
            <button type="button" class="adm-btn gold" data-erase>✦ Effacer la zone</button>
            <button type="button" class="adm-btn ghost" data-undo>Annuler</button>
            <button type="button" class="adm-btn ghost" data-clear>Retirer le pinceau</button>
          </div>
          <p class="at-hint">Astuce : déborde un peu autour du texte, et efface en plusieurs fois pour les grandes zones. Le résultat est parfait sur fond uni, dégradé, marbre ou tissu.</p>
        </div>
      </div>`;
    const ci = sheet.querySelector("#erImg"), cm = sheet.querySelector("#erMask");
    const xi = ci.getContext("2d", { willReadFrequently: true }), xm = cm.getContext("2d", { willReadFrequently: true });
    const undo = [];
    let size = 40, drawing = false, last = null;

    async function setImage(url) {
      const img = await loadImg(url);
      const r = Math.min(1, 1600 / Math.max(img.width, img.height));
      ci.width = cm.width = Math.round(img.width * r); ci.height = cm.height = Math.round(img.height * r);
      xi.drawImage(img, 0, 0, ci.width, ci.height);
      xm.clearRect(0, 0, cm.width, cm.height);
      sheet.querySelector("#erEmpty").hidden = true;
      sheet.querySelector("[data-ok]").disabled = false;
    }
    const pos = (e) => { const b = cm.getBoundingClientRect(); return { x: (e.clientX - b.left) * (cm.width / b.width), y: (e.clientY - b.top) * (cm.height / b.height) }; };
    function dot(p) {
      xm.fillStyle = "rgba(255,60,90,.55)"; xm.strokeStyle = "rgba(255,60,90,.55)";
      xm.lineWidth = size * (cm.width / cm.getBoundingClientRect().width); xm.lineCap = "round";
      if (last) { xm.beginPath(); xm.moveTo(last.x, last.y); xm.lineTo(p.x, p.y); xm.stroke(); }
      xm.beginPath(); xm.arc(p.x, p.y, xm.lineWidth / 2, 0, Math.PI * 2); xm.fill();
      last = p;
    }
    cm.addEventListener("pointerdown", (e) => { if (!ci.width) return; drawing = true; last = null; cm.setPointerCapture(e.pointerId); dot(pos(e)); e.preventDefault(); });
    cm.addEventListener("pointermove", (e) => { if (drawing) { dot(pos(e)); e.preventDefault(); } });
    cm.addEventListener("pointerup", () => { drawing = false; last = null; });
    cm.addEventListener("pointercancel", () => { drawing = false; last = null; });

    function erase() {
      const m = xm.getImageData(0, 0, cm.width, cm.height).data;
      const mask = new Uint8Array(cm.width * cm.height);
      let any = false;
      for (let i = 0; i < mask.length; i++) if (m[i * 4 + 3] > 10) { mask[i] = 1; any = true; }
      if (!any) return;
      undo.push(xi.getImageData(0, 0, ci.width, ci.height));
      if (undo.length > 8) undo.shift();
      const img = xi.getImageData(0, 0, ci.width, ci.height);
      inpaint(img, mask, ci.width, ci.height);
      xi.putImageData(img, 0, 0);
      xm.clearRect(0, 0, cm.width, cm.height);
    }
    const close = (val) => { sheet.remove(); document.documentElement.classList.remove("no-scroll"); resolve(val); };

    if (src) setImage(src).catch(() => { sheet.querySelector("#erEmpty").hidden = false; });
    sheet.addEventListener("input", (e) => { if (e.target.id === "erSize") { size = Number(e.target.value); sheet.querySelector("#erSizeOut").textContent = size; } });
    sheet.addEventListener("change", async (e) => { if (e.target.id === "erFile" && e.target.files[0]) setImage(await compress(e.target.files[0], 1600)); });
    sheet.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const d = b.dataset;
      if ("x" in d) return close(null);
      if ("erase" in d) { b.textContent = "Reconstruction…"; requestAnimationFrame(() => setTimeout(() => { erase(); b.textContent = "✦ Effacer la zone"; }, 20)); return; }
      if ("undo" in d) { const u = undo.pop(); if (u) xi.putImageData(u, 0, 0); return; }
      if ("clear" in d) { xm.clearRect(0, 0, cm.width, cm.height); return; }
      if ("ok" in d) {
        const out = ci.toDataURL("image/webp", 0.88);
        if (!src) { const a = Object.assign(document.createElement("a"), { href: out, download: `ordesnuits-retouche-${Date.now()}.webp` }); document.body.append(a); a.click(); a.remove(); return; }
        close(out);
      }
    });
  });
}
