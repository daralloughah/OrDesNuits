/* Pages légales (en français, langue du droit applicable) */
import { initI18n, translateDom } from "../core/i18n.js";
import { mountChrome } from "../ui/chrome.js";

function open() {
  const id = location.hash.slice(1) || "mentions";
  document.querySelectorAll(".lg-doc").forEach((d) => (d.hidden = d.id !== id));
  document.querySelectorAll(".lg-tabs a").forEach((a) => a.setAttribute("aria-current", a.hash === "#" + id));
  window.scrollTo({ top: 0 });
}
await initI18n();
mountChrome({ onLangChange: () => translateDom() });
translateDom();
open();
addEventListener("hashchange", open);
