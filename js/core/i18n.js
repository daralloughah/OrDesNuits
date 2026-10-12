/* Langue : choix mémorisé > pays du visiteur (IP) > langue du téléphone */
import { LANGS } from "../config.js";
import { langFromIp } from "./geo.js";

const KEY = "odn.lang";
let dict = {};
let fallback = {};
let active = null;

export const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const valid = (code) => LANGS.some((l) => l.code === code);

export function detectLang() {
  const list = (navigator.languages || [navigator.language || "fr"]).map((x) => x.toLowerCase());
  for (const n of list) {
    if (n === "en-gb") return "en-GB";
    if (n.startsWith("en")) return "en-US";
    const hit = LANGS.find((l) => l.code === n.split("-")[0]);
    if (hit) return hit.code;
  }
  return "fr";
}

export const hasChosenLang = () => valid(storage.get(KEY));

/* Langue proposée au visiteur qui n'a encore rien choisi */
export async function suggestLang() {
  const saved = storage.get(KEY);
  if (valid(saved)) return saved;
  const byIp = await langFromIp();
  return valid(byIp) ? byIp : detectLang();
}

export function currentLang() {
  if (active) return active;
  const saved = storage.get(KEY);
  return valid(saved) ? saved : detectLang();
}
export const langInfo = (code = currentLang()) => LANGS.find((l) => l.code === code) || LANGS[0];

async function loadFile(file) {
  const res = await fetch(`locales/${file}.json`);
  if (!res.ok) throw new Error(file);
  return res.json();
}

export async function initI18n(code) {
  code = valid(code) ? code : await suggestLang();
  active = code;
  const info = langInfo(code);
  if (!Object.keys(fallback).length) { try { fallback = await loadFile("fr"); } catch { fallback = {}; } }
  try { dict = info.file === "fr" ? fallback : await loadFile(info.file); } catch { dict = fallback; }
  const root = document.documentElement;
  root.lang = info.html;
  root.dir = info.rtl ? "rtl" : "ltr";
  return info;
}

export async function setLang(code) {
  storage.set(KEY, code);
  return initI18n(code);
}

/* t("clé", {n: 3}) → texte traduit, avec remplacement de {n} */
export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

/* Traduit les éléments marqués data-i (texte), data-ih (HTML de confiance), data-ia (aria-label) */
export function translateDom(root = document) {
  root.querySelectorAll("[data-i]").forEach((el) => (el.textContent = t(el.dataset.i)));
  root.querySelectorAll("[data-ih]").forEach((el) => (el.innerHTML = t(el.dataset.ih)));
  root.querySelectorAll("[data-ia]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.ia)));
}
