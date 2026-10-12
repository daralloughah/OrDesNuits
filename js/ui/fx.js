/* =========================================================
   Effets signature :
   - ordinateur : curseur au monogramme + halo doré qui le suit
   - partout (souris ou doigt) : éclat doré avec le monogramme
   ========================================================= */
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const HOVERABLE = "a, button, [role='button'], label, .card, .lang-tile, .door, .chip";

function halo() {
  const ring = document.createElement("div");
  ring.className = "cur-ring";
  ring.setAttribute("aria-hidden", "true");
  document.body.append(ring);
  let x = -100, y = -100, rx = x, ry = y, raf = null;
  const loop = () => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.3 ? requestAnimationFrame(loop) : null;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    ring.classList.add("on");
    ring.classList.toggle("big", !!e.target.closest?.(HOVERABLE));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => ring.classList.remove("on"));
  addEventListener("pointerdown", () => ring.classList.add("press"));
  addEventListener("pointerup", () => ring.classList.remove("press"));
}

function burst(x, y) {
  const b = document.createElement("div");
  b.className = "burst";
  b.setAttribute("aria-hidden", "true");
  b.style.transform = `translate(${x}px, ${y}px)`;
  let html = `<span class="wave"></span><span class="stamp"></span>`;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
    const d = 34 + Math.random() * 26;
    html += `<span class="spark ${i % 2 ? "drop" : ""}" style="--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;--rot:${Math.round(Math.random() * 180)}deg"></span>`;
  }
  b.innerHTML = html;
  document.body.append(b);
  setTimeout(() => b.remove(), 900);
}

export function mountFx() {
  if (mountFx.done) return;
  mountFx.done = true;
  if (finePointer) document.documentElement.classList.add("has-cursor");
  if (reduce) return;
  if (finePointer) halo();
  addEventListener("pointerdown", (e) => {
    if (e.button) return;
    if (e.target.closest?.("input, textarea, select, .concierge .log")) return;
    burst(e.clientX, e.clientY);
  }, { passive: true });
}
