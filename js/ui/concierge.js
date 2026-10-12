/* =========================================================
   Le Concierge : assistant de la boutique.
   Aujourd'hui : réponses préparées (questions fréquentes, 11 langues)
   + transfert vers WhatsApp pour tout le reste.
   Demain : on branchera une vraie IA via une fonction Supabase,
   sans changer cette interface.
   ========================================================= */
import { CONTACT } from "../config.js";
import { t } from "../core/i18n.js";
import { esc } from "../core/util.js";

const TOPICS = ["ship", "discreet", "offer", "order", "pay"];
let panel, log, opened = false;

const now = () => new Date().toLocaleTimeString(document.documentElement.lang, { hour: "2-digit", minute: "2-digit" });

function bubble(html, who = "bot") {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.innerHTML = `<div class="b">${html}</div><time>${now()}</time>`;
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

function typing(then) {
  const el = document.createElement("div");
  el.className = "msg bot typing";
  el.innerHTML = `<div class="b"><i></i><i></i><i></i></div>`;
  log.append(el);
  log.scrollTop = log.scrollHeight;
  setTimeout(() => { el.remove(); then(); }, 650 + Math.random() * 450);
}

const waLink = (text = "") => `https://wa.me/${CONTACT.whatsapp}${text ? "?text=" + encodeURIComponent(text) : ""}`;

function chips() {
  return `<div class="chips">${TOPICS.map((k) => `<button type="button" data-topic="${k}">${esc(t("q_" + k))}</button>`).join("")}
    <a href="${waLink()}" target="_blank" rel="noopener" class="human">${esc(t("chat_human"))}</a></div>`;
}

function ask(topic) {
  bubble(esc(t("q_" + topic)), "me");
  typing(() => bubble(`${esc(t("a_" + topic))}${chips()}`));
}

function free(text) {
  bubble(esc(text), "me");
  typing(() => bubble(`${esc(t("chat_fallback"))}<a class="btn btn-gold mt-3 w-full" href="${waLink(text)}" target="_blank" rel="noopener">${esc(t("chat_send_wa"))}</a>${chips()}`));
}

function build() {
  panel = document.createElement("section");
  panel.className = "concierge";
  panel.setAttribute("aria-label", t("chat_title"));
  panel.innerHTML = `
    <header>
      <img src="assets/img/mono.webp" alt="" width="40" height="40">
      <div><b class="display">${esc(t("chat_title"))}</b><span><i class="dot"></i>${esc(t("chat_status"))}</span></div>
      <button type="button" class="x" data-close aria-label="${esc(t("close"))}">×</button>
    </header>
    <div class="log" role="log" aria-live="polite"></div>
    <form autocomplete="off">
      <input id="conciergeInput" type="text" placeholder="${esc(t("chat_placeholder"))}" aria-label="${esc(t("chat_placeholder"))}">
      <button type="submit" aria-label="${esc(t("chat_send"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg></button>
    </form>`;
  document.body.append(panel);
  log = panel.querySelector(".log");
  panel.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return toggle(false);
    const c = e.target.closest("[data-topic]");
    if (c) ask(c.dataset.topic);
  });
  panel.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = panel.querySelector("input");
    const v = input.value.trim();
    if (v) { input.value = ""; free(v); }
  });
  typing(() => bubble(`${esc(t("chat_hello"))}${chips()}`));
}

export function toggle(force) {
  opened = force ?? !opened;
  if (opened && !panel) build();
  panel?.classList.toggle("open", opened);
  document.getElementById("conciergeBtn")?.setAttribute("aria-expanded", opened);
  if (opened && matchMedia("(pointer: fine)").matches) setTimeout(() => panel.querySelector("input")?.focus(), 300);
}

/* Si la langue change, on repart d'une conversation neuve */
export function resetConcierge() {
  panel?.remove();
  panel = null;
  if (opened) toggle(true);
}
