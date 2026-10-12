/* Langue d'après le pays du visiteur (IP), via notre fonction /api/geo.
   Si la fonction ne répond pas (aperçu, réseau lent), on prend la langue du téléphone. */
const BY_COUNTRY = {
  fr: "FR BE CH LU MC SN CI ML BF NE GN CM GA CG CD BJ TG MG HT RE GP MQ GF YT NC PF",
  "en-US": "US CA PH",
  "en-GB": "GB IE AU NZ ZA NG GH KE",
  ar: "MA DZ TN EG SA AE QA KW BH OM JO LB IQ SY YE LY SD PS MR",
  es: "ES MX AR CO CL PE VE EC GT CU BO DO HN PY SV NI CR PA UY",
  pt: "PT BR AO MZ CV",
  ru: "RU BY KZ KG",
  de: "DE AT LI",
  zh: "CN TW HK MO SG",
  ja: "JP",
  ko: "KR",
};
const MAP = {};
for (const [lang, list] of Object.entries(BY_COUNTRY)) list.split(" ").forEach((c) => (MAP[c] = lang));

export async function langFromIp(timeout = 1200) {
  try {
    const cached = sessionStorage.getItem("odn.geo");
    if (cached) return MAP[cached] || null;
  } catch {}
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch("/api/geo", { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const { country } = await res.json();
    try { sessionStorage.setItem("odn.geo", country || ""); } catch {}
    return MAP[country] || null;
  } catch {
    return null;
  }
}
