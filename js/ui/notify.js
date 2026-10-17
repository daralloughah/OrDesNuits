/* =========================================================
   Le site « communique » : quand une action échoue, un message
   élégant (cadre doré) dit ce qui se passe, avec le nom exact
   de l'erreur en petit. Erreurs non prévues attrapées partout.
   ========================================================= */
import { t } from "../core/i18n.js";
import { esc } from "../core/util.js";

const tr = (k, fr) => { try { const v = t(k); return v && v !== k ? v : fr; } catch { return fr; } };
const isNet = (e) => e?.status === 0 || /network|failed to fetch|load failed|networkerror/i.test(String(e?.message || e));

function name(e) {
  if (!e) return "inconnue";
  if (typeof e === "string") return e;
  const code = e.code || e.status ? `${e.code || ""}${e.status ? ` ${e.status}` : ""}`.trim() : "";
  return [e.name && e.name !== "Error" ? e.name : "", e.message || "", code ? `(${code})` : ""].filter(Boolean).join(" ").slice(0, 160) || "inconnue";
}

let box, timer;
export function showError(e, { title, retry } = {}) {
  box ||= Object.assign(document.createElement("div"), { className: "err-note", role: "alert" });
  if (!box.isConnected) document.body.append(box);
  const msg = isNet(e) ? tr("err_net", "La connexion a été interrompue. Vérifiez votre réseau puis réessayez.") : tr("err_generic", "Cette action n'a pas abouti.");
  box.innerHTML = `<span class="en-ic" aria-hidden="true">✦</span><div><b>${esc(title || tr("err_title", "Un petit contretemps"))}</b><p>${esc(msg)}</p><code>${esc(name(e))}</code></div>
    ${retry ? `<button type="button" class="en-retry">${esc(tr("err_retry", "Réessayer"))}</button>` : ""}<button type="button" class="en-x" aria-label="×">×</button>`;
  box.classList.add("show");
  box.querySelector(".en-x").onclick = () => box.classList.remove("show");
  if (retry) box.querySelector(".en-retry").onclick = () => { box.classList.remove("show"); retry(); };
  clearTimeout(timer);
  timer = setTimeout(() => box.classList.remove("show"), 9000);
}

export function watchErrors() {
  if (watchErrors.on) return;
  watchErrors.on = true;
  addEventListener("error", (ev) => {
    if (ev.target && ev.target !== window) return; // image ou fichier manquant : pas une erreur d'action
    if (/ResizeObserver/.test(ev.message)) return;
    showError(ev.error || ev.message);
  });
  addEventListener("unhandledrejection", (ev) => showError(ev.reason));
}
