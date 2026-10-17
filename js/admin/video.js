/* =========================================================
   Atelier vidéo : clips courts pour Snap, TikTok, Insta.
   Couper le début et la fin, choisir le format (story, carré,
   feed), ajouter le logo et deux textes, puis exporter.
   Tout se passe sur le téléphone : rien n'est envoyé en ligne.
   ========================================================= */
import { esc } from "../core/util.js";

const FORMATS = { story: [720, 1280, "Story 9:16"], feed: [720, 900, "Feed 4:5"], carre: [720, 720, "Carré 1:1"] };
const MAX = 60; // secondes exportées au maximum

function pickMime() {
  const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return list.find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || "";
}

export function openVideo() {
  const st = { format: "story", start: 0, end: 0, top: "", bottom: "Commander sur WhatsApp", logo: "haut", gold: true, muted: false, dur: 0 };
  const sheet = document.createElement("div");
  sheet.className = "adm-editor vstudio";
  document.body.append(sheet);
  document.documentElement.classList.add("no-scroll");
  const video = document.createElement("video");
  video.playsInline = true; video.preload = "auto"; video.crossOrigin = "anonymous";
  const logo = new Image(); logo.src = "assets/img/mono.webp";
  let raf = 0, audio = null, url = null, recording = null;

  sheet.innerHTML = `
    <header class="at-top"><button type="button" class="at-icon" data-x aria-label="Fermer">✕</button><b class="display">Atelier vidéo</b>
      <button type="button" class="adm-btn gold" data-export disabled>Exporter</button></header>
    <div class="ad-body">
      <div class="ad-stage v-stage">
        <canvas id="vCanvas"></canvas>
        <label class="v-empty" id="vEmpty"><input type="file" accept="video/*" id="vFile" hidden><b>✦ Choisir une vidéo</b><small>Clip de ${MAX} s maximum à l'export</small></label>
        <div class="v-play"><button type="button" data-play>▶︎</button><output id="vTime">0:00</output></div>
      </div>
      <div class="ad-ctrl">
        <p class="at-label">Format</p><div class="at-chips">${Object.entries(FORMATS).map(([k, f]) => `<button type="button" data-fmt="${k}" aria-pressed="${k === st.format}">${f[2]}</button>`).join("")}</div>
        <p class="at-label">Couper <small id="vCut"></small></p>
        <label class="fld"><span>Début</span><input type="range" id="vStart" min="0" max="1" step="0.1" value="0"></label>
        <label class="fld"><span>Fin</span><input type="range" id="vEnd" min="0" max="1" step="0.1" value="1"></label>
        <label class="fld"><span>Texte du haut</span><input class="adm-input" id="vTop" placeholder="Ex. Ce soir, le temps s'arrête"></label>
        <label class="fld"><span>Texte du bas</span><input class="adm-input" id="vBottom" value="${esc(st.bottom)}"></label>
        <p class="at-label">Logo</p><div class="at-chips">${["haut", "bas", "aucun"].map((k) => `<button type="button" data-logo="${k}" aria-pressed="${k === st.logo}">${k === "aucun" ? "Aucun" : k === "haut" ? "En haut" : "En bas"}</button>`).join("")}</div>
        <div class="ed-switches">
          <button type="button" class="sw" role="switch" data-gold aria-checked="${st.gold}"><i></i>Cadre doré</button>
          <button type="button" class="sw" role="switch" data-mute aria-checked="${st.muted}"><i></i>Couper le son</button>
        </div>
        <div id="vOut"></div>
        <p class="at-hint">L'export se fait en temps réel : un clip de 20 s prend 20 s. Garde l'écran allumé pendant l'export.</p>
      </div>
    </div>`;

  const cv = sheet.querySelector("#vCanvas");
  const ctx = cv.getContext("2d");
  const fmt = () => FORMATS[st.format];
  const time = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  function size() { const [w, h] = fmt(); cv.width = w; cv.height = h; }
  function text(t, y, sizePx) {
    if (!t) return;
    const [W] = fmt();
    ctx.font = `italic 500 ${sizePx}px "Bodoni Moda", Georgia, serif`;
    ctx.textAlign = "center";
    const words = t.split(" "); const lines = []; let line = "";
    for (const w of words) { const x = line ? line + " " + w : w; if (ctx.measureText(x).width > W - 80 && line) { lines.push(line); line = w; } else line = x; }
    if (line) lines.push(line);
    ctx.shadowColor = "rgba(0,0,0,.75)"; ctx.shadowBlur = 18;
    const g = ctx.createLinearGradient(0, y - sizePx, 0, y + sizePx * lines.length); g.addColorStop(0, "#f6dc9c"); g.addColorStop(1, "#c98f3d");
    ctx.fillStyle = g;
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, W / 2, y + i * sizePx * 1.12));
    ctx.shadowBlur = 0;
  }
  function frame() {
    const [W, H] = fmt();
    ctx.fillStyle = "#0b0809"; ctx.fillRect(0, 0, W, H);
    if (video.videoWidth) {
      const r = Math.max(W / video.videoWidth, H / video.videoHeight);
      const w = video.videoWidth * r, h = video.videoHeight * r;
      ctx.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
    }
    let g = ctx.createLinearGradient(0, 0, 0, H * .25); g.addColorStop(0, "rgba(8,5,6,.6)"); g.addColorStop(1, "rgba(8,5,6,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .25);
    g = ctx.createLinearGradient(0, H * .7, 0, H); g.addColorStop(0, "rgba(8,5,6,0)"); g.addColorStop(1, "rgba(8,5,6,.75)"); ctx.fillStyle = g; ctx.fillRect(0, H * .7, W, H * .3);
    if (st.gold) { ctx.strokeStyle = "rgba(214,161,75,.85)"; ctx.lineWidth = 2; ctx.strokeRect(18, 18, W - 36, H - 36); ctx.strokeStyle = "rgba(214,161,75,.35)"; ctx.strokeRect(26, 26, W - 52, H - 52); }
    if (st.logo !== "aucun" && logo.complete) { const s = W * .14; ctx.drawImage(logo, (W - s) / 2, st.logo === "haut" ? 40 : H - s - 40, s, s); }
    text(st.top, st.logo === "haut" ? W * .14 + 110 : 110, W * .075);
    text(st.bottom, H - (st.logo === "bas" ? W * .14 + 90 : 90), W * .055);
  }
  function loop() {
    frame();
    if (!video.paused && video.currentTime >= st.end) {
      if (recording) { if (recording.state === "recording") recording.stop(); } else { video.currentTime = st.start; }
    }
    sheet.querySelector("#vTime").textContent = time(Math.max(0, video.currentTime - st.start));
    raf = requestAnimationFrame(loop);
  }

  async function load(file) {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(file);
    video.src = url;
    await new Promise((ok) => { video.onloadedmetadata = ok; });
    st.dur = video.duration || 0;
    st.start = 0; st.end = Math.min(st.dur, MAX);
    const s = sheet.querySelector("#vStart"), e = sheet.querySelector("#vEnd");
    s.max = e.max = st.dur.toFixed(1); s.value = 0; e.value = st.end.toFixed(1);
    cut();
    sheet.querySelector("#vEmpty").hidden = true;
    sheet.querySelector("[data-export]").disabled = false;
    video.currentTime = 0.05;
    try { await document.fonts.load('italic 500 40px "Bodoni Moda"'); } catch {}
  }
  function cut() {
    sheet.querySelector("#vCut").textContent = `${time(st.start)} → ${time(st.end)} (${Math.round(st.end - st.start)} s)`;
  }
  function audioStream() {
    if (!audio) {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const src = ac.createMediaElementSource(video);
        const dest = ac.createMediaStreamDestination();
        const gain = ac.createGain();
        src.connect(gain); gain.connect(dest); gain.connect(ac.destination);
        audio = { ac, dest, gain };
      } catch { audio = { failed: true }; }
    }
    if (audio.gain) audio.gain.gain.value = st.muted ? 0 : 1;
    return audio.dest?.stream;
  }

  async function exportClip() {
    const mime = pickMime();
    if (!mime || !cv.captureStream) { sheet.querySelector("#vOut").innerHTML = `<p class="at-hint">Ce navigateur ne sait pas exporter de vidéo. Essaie avec Chrome à jour.</p>`; return; }
    const btn = sheet.querySelector("[data-export]");
    btn.disabled = true; btn.textContent = "Export…";
    const stream = cv.captureStream(30);
    const a = audioStream();
    if (a && !st.muted) a.getAudioTracks().forEach((t) => stream.addTrack(t));
    if (audio?.ac?.state === "suspended") await audio.ac.resume();
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((ok) => (rec.onstop = ok));
    video.pause(); video.currentTime = st.start;
    await new Promise((ok) => (video.onseeked = ok));
    recording = rec;
    rec.start(250);
    await video.play();
    await done;
    video.pause(); recording = null;
    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const href = URL.createObjectURL(blob);
    sheet.querySelector("#vOut").innerHTML = `<section class="adm2-box"><h3 class="mini-h">Ta vidéo est prête · ${(blob.size / 1e6).toFixed(1)} Mo</h3>
      <video src="${href}" controls playsinline class="v-result"></video>
      <div class="at-row wrap"><a class="adm-btn gold" href="${href}" download="ordesnuits-${st.format}.${ext}">Télécharger</a><button type="button" class="adm-btn ghost" data-vshare>Partager</button></div>
      ${ext === "webm" ? `<p class="at-hint">Format WebM : accepté par TikTok et YouTube. Pour Snap, si besoin, ouvre-la dans CapCut et réenregistre-la.</p>` : ""}</section>`;
    sheet.querySelector("[data-vshare]").onclick = async () => {
      const f = new File([blob], `ordesnuits-${st.format}.${ext}`, { type: blob.type });
      if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch {} }
    };
    btn.disabled = false; btn.textContent = "Exporter";
  }

  size(); loop();

  sheet.addEventListener("change", (e) => { if (e.target.id === "vFile" && e.target.files[0]) load(e.target.files[0]); });
  sheet.addEventListener("input", (e) => {
    const id = e.target.id;
    if (id === "vStart" || id === "vEnd") {
      let s = Number(sheet.querySelector("#vStart").value), en = Number(sheet.querySelector("#vEnd").value);
      if (en - s < 1) { if (id === "vStart") s = Math.max(0, en - 1); else en = Math.min(st.dur, s + 1); }
      if (en - s > MAX) { if (id === "vStart") en = s + MAX; else s = en - MAX; }
      st.start = s; st.end = en;
      sheet.querySelector("#vStart").value = s; sheet.querySelector("#vEnd").value = en;
      video.currentTime = id === "vStart" ? s : en - 0.05;
      cut();
    }
    if (id === "vTop") st.top = e.target.value;
    if (id === "vBottom") st.bottom = e.target.value;
  });
  sheet.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if ("x" in d) { cancelAnimationFrame(raf); video.pause(); if (url) URL.revokeObjectURL(url); audio?.ac?.close?.(); sheet.remove(); document.documentElement.classList.remove("no-scroll"); return; }
    if (d.fmt) { st.format = d.fmt; size(); sheet.querySelectorAll("[data-fmt]").forEach((x) => x.setAttribute("aria-pressed", x === b)); return; }
    if (d.logo) { st.logo = d.logo; sheet.querySelectorAll("[data-logo]").forEach((x) => x.setAttribute("aria-pressed", x === b)); return; }
    if ("gold" in d) { st.gold = !st.gold; b.setAttribute("aria-checked", st.gold); return; }
    if ("mute" in d) { st.muted = !st.muted; b.setAttribute("aria-checked", st.muted); video.muted = st.muted && !audio?.gain; if (audio?.gain) audio.gain.gain.value = st.muted ? 0 : 1; return; }
    if ("play" in d) {
      if (!video.src) return;
      if (video.paused) { if (video.currentTime < st.start || video.currentTime >= st.end) video.currentTime = st.start; audioStream(); if (audio?.ac?.state === "suspended") await audio.ac.resume(); video.play(); b.textContent = "❚❚"; }
      else { video.pause(); b.textContent = "▶︎"; }
      return;
    }
    if ("export" in d) exportClip();
  });
}
