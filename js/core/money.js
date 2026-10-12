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
