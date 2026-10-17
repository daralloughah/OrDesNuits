/* Prix : conversion depuis l'euro et affichage dans la devise de la langue */
import { RATES } from "../config.js";
import { langInfo } from "./i18n.js";

const NO_DECIMALS = ["JPY", "KRW", "RUB"];

export function convert(eur) {
  const cur = langInfo().cur;
  const v = eur * (RATES[cur] || 1);
  if (cur === "JPY" || cur === "RUB") return Math.round(v / 10) * 10;
  if (cur === "KRW") return Math.round(v / 100) * 100;
  return Math.round(v * 100) / 100;
}

export function format(amount) {
  const { cur, locale } = langInfo();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: cur,
    maximumFractionDigits: NO_DECIMALS.includes(cur) ? 0 : 2,
  }).format(amount);
}

/* Raccourci : prix en euros → texte dans la devise du visiteur */
export const price = (eur) => format(convert(eur));

/* Prix « maison de luxe » : les centimes en petit, surélevés (19⁹⁰ €) */
export function formatLux(amount) {
  const { cur, locale } = langInfo();
  const parts = new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: NO_DECIMALS.includes(cur) ? 0 : 2 }).formatToParts(amount);
  const frac = parts.find((x) => x.type === "fraction");
  if (!frac || /^0+$/.test(frac.value)) return format(amount).replace(/[.,]00(?=\D|$)/, "");
  return parts.map((x) => x.type === "decimal" ? "" : x.type === "fraction" ? `<sup class="cts">${x.value}</sup>` : x.value.replace(/[<>&]/g, "")).join("");
}
export const priceLux = (eur) => formatLux(convert(eur));
