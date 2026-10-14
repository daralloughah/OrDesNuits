/* =========================================================
   Le Concierge : assistant de la boutique.
   - Questions fréquentes : réponses préparées (11 langues), instantanées.
   - Question libre : EN LIGNE, réponse de l'IA (fonction Supabase
     « concierge ») ; en mode aperçu ou en cas de souci, transfert WhatsApp.
   ========================================================= */
import { CONTACT } from "../config.js";
import { t, currentLang } from "../core/i18n.js";
import { esc } from "../core/util.js";
import { enabled, fn } from "../core/sb.js";

const history = []; // la conversation envoyée à l'IA (les 12 derniers messages)

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

const toWhatsapp = (text) => bubble(`${esc(t("chat_fallback"))}<a class="btn btn-gold mt-3 w-full" href="${waLink(text)}" target="_blank" rel="noopener">${esc(t("chat_send_wa"))}</a>${chips()}`);

/* Texte de l'IA → paragraphes propres (aucun HTML venant du serveur n'est injecté tel quel) */
const paras = (text) => String(text).trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")}</p>`).join("");

let busy = false;
async function free(text) {
  bubble(esc(text), "me");
  if (!enabled || busy) { typing(() => toWhatsapp(text)); return; }
  busy = true;
  history.push({ role: "user", content: text.slice(0, 600) });
  const dots = document.createElement("div");
  dots.className = "msg bot typing";
  dots.innerHTML = `<div class="b"><i></i><i></i><i></i></div>`;
  log.append(dots);
  log.scrollTop = log.scrollHeight;
  try {
    const res = await fn("concierge", { messages: history.slice(-12), lang: currentLang() });
    if (!res?.reply) throw new Error("empty");
    history.push({ role: "assistant", content: res.reply });
    dots.remove();
    bubble(paras(res.reply) + (res.handoff ? `<a class="btn btn-gold mt-3 w-full" href="${waLink(text)}" target="_blank" rel="noopener">${esc(t("chat_send_wa"))}</a>` : ""));
  } catch {
    history.pop();
    dots.remove();
    toWhatsapp(text);
  } finally { busy = false; }
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
  history.length = 0;
  panel?.remove();
  panel = null;
  if (opened) toggle(true);
}
