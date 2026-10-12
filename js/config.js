/* =========================================================
   RÉGLAGES DU SITE — le seul fichier à modifier à la main
   (plus tard, ces valeurs viendront de l'espace gérant)
   ========================================================= */

export const CONTACT = {
  whatsapp: "33600000000",   // ton numéro au format international, sans le +
  snapchat: "ordesnuits",    // ton pseudo Snapchat
};

/* Offre de lancement : 3 achetés, le 4e offert (le moins cher des articles éligibles) */
export const OFFER = { active: true, buy: 3 };

/* Langues proposées. `cur` = devise affichée pour cette langue. */
export const LANGS = [
  { code: "fr",    file: "fr", html: "fr",    name: "Français",      region: "France",          cur: "EUR", locale: "fr-FR" },
  { code: "en-US", file: "en", html: "en-US", name: "English",       region: "United States",   cur: "USD", locale: "en-US" },
  { code: "en-GB", file: "en", html: "en-GB", name: "English",       region: "United Kingdom",  cur: "GBP", locale: "en-GB" },
  { code: "ar",    file: "ar", html: "ar",    name: "العربية",        region: "الإمارات",         cur: "AED", locale: "ar-AE", rtl: true },
  { code: "es",    file: "es", html: "es",    name: "Español",       region: "España",          cur: "EUR", locale: "es-ES" },
  { code: "pt",    file: "pt", html: "pt-BR", name: "Português",     region: "Brasil",          cur: "BRL", locale: "pt-BR" },
  { code: "ru",    file: "ru", html: "ru",    name: "Русский",       region: "Россия",          cur: "RUB", locale: "ru-RU" },
  { code: "de",    file: "de", html: "de",    name: "Deutsch",       region: "Deutschland",     cur: "EUR", locale: "de-DE" },
  { code: "zh",    file: "zh", html: "zh",    name: "中文",           region: "中国",             cur: "CNY", locale: "zh-CN" },
  { code: "ja",    file: "ja", html: "ja",    name: "日本語",         region: "日本",             cur: "JPY", locale: "ja-JP" },
  { code: "ko",    file: "ko", html: "ko",    name: "한국어",         region: "대한민국",          cur: "KRW", locale: "ko-KR" },
];

/* Taux indicatifs : 1 € = … (à automatiser avec Supabase) */
export const RATES = { EUR: 1, USD: 1.10, GBP: 0.86, AED: 4.04, BRL: 6.10, RUB: 95, CNY: 7.85, JPY: 165, KRW: 1500 };

/* Où trouver le catalogue (aujourd'hui un fichier, demain Supabase) */
export const DATA_URL = "data/catalogue.json";
