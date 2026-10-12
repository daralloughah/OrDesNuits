/* Panier : mémorisé dans le navigateur, calcul de l'offre 3+1, message WhatsApp */
import { CONTACT, OFFER } from "../config.js";
import { storage, t } from "./i18n.js";
import { convert, format } from "./money.js";
import { loadCatalogue, finalPrice } from "./catalogue.js";

const KEY = "odn.cart";
const listeners = new Set();

function read() {
  try { return JSON.parse(storage.get(KEY) || "{}") || {}; } catch { return {}; }
}
let items = read();

function save() {
  storage.set(KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn());
}

export const onCartChange = (fn) => listeners.add(fn);
export function add(id, qty = 1) { items[id] = (items[id] || 0) + qty; save(); }
export function setQty(id, qty) { if (qty <= 0) delete items[id]; else items[id] = qty; save(); }
export function clear() { items = {}; save(); }
export const count = () => Object.values(items).reduce((s, q) => s + q, 0);

export async function summary() {
  const { products } = await loadCatalogue();
  const lines = Object.entries(items)
    .map(([id, q]) => {
      const p = products.find((x) => x.id === id);
      return p && q > 0 ? { p, q, unit: convert(finalPrice(p)) } : null;
    })
    .filter(Boolean);

  const eligible = OFFER.active ? lines.filter((l) => l.p.offer) : [];
  const nElig = eligible.reduce((s, l) => s + l.q, 0);
  const freeN = Math.floor(nElig / (OFFER.buy + 1));
  const units = eligible.flatMap((l) => Array(l.q).fill(l.unit)).sort((a, b) => a - b);
  const discount = units.slice(0, freeN).reduce((s, v) => s + v, 0);
  const subtotal = lines.reduce((s, l) => s + l.unit * l.q, 0);
  const missing = nElig ? (OFFER.buy + 1 - (nElig % (OFFER.buy + 1))) % (OFFER.buy + 1) : 0;

  return { lines, nElig, freeN, missing, discount, subtotal, total: subtotal - discount, count: count() };
}

/* Lien WhatsApp avec la commande déjà rédigée (en français pour toi) */
export function whatsappLink(s) {
  const rows = s.lines.map((l) => `• ${l.q} × ${l.p.name} (${format(l.unit)})`).join("\n");
  const msg =
    `Bonjour OrDesNuits, je souhaite commander :\n${rows}` +
    (s.discount ? `\nOffert (3+1) : −${format(s.discount)}` : "") +
    `\nTotal : ${format(s.total)}\nLangue du client : ${document.documentElement.lang}`;
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(msg)}`;
}

