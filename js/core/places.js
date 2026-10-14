/* Pays et régions françaises : noms affichés dans la langue du visiteur */

const ISO = "AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CN CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VA VE VN WF EH YE ZM ZW".split(" ");

export function countryName(code, lang = document.documentElement.lang || "fr") {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code; } catch { return code; }
}

export function countries(lang) {
  return ISO.map((c) => ({ code: c, name: countryName(c, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang));
}

/* Drapeau en emoji à partir du code pays */
export const flag = (code) => (code && code.length === 2 ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 127397 + c.charCodeAt(0))) : "🏳️");

export const FR_REGIONS = {
  ARA: "Auvergne-Rhône-Alpes", BFC: "Bourgogne-Franche-Comté", BRE: "Bretagne", CVL: "Centre-Val de Loire",
  COR: "Corse", GES: "Grand Est", HDF: "Hauts-de-France", IDF: "Île-de-France", NOR: "Normandie",
  NAQ: "Nouvelle-Aquitaine", OCC: "Occitanie", PDL: "Pays de la Loire", PAC: "Provence-Alpes-Côte d'Azur", DOM: "Outre-mer",
};

const DEP = {
  ARA: "01 03 07 15 26 38 42 43 63 69 73 74", BFC: "21 25 39 58 70 71 89 90", BRE: "22 29 35 56",
  CVL: "18 28 36 37 41 45", COR: "20", GES: "08 10 51 52 54 55 57 67 68 88", HDF: "02 59 60 62 80",
  IDF: "75 77 78 91 92 93 94 95", NOR: "14 27 50 61 76", NAQ: "16 17 19 23 24 33 40 47 64 79 86 87",
  OCC: "09 11 12 30 31 32 34 46 48 65 66 81 82", PDL: "44 49 53 72 85", PAC: "04 05 06 13 83 84", DOM: "97",
};
const BY_DEP = {};
for (const [r, list] of Object.entries(DEP)) list.split(" ").forEach((d) => (BY_DEP[d] = r));

/* Code postal français → région (ex. 69003 → Auvergne-Rhône-Alpes) */
export function regionFromPostcode(cp) {
  const s = String(cp || "").replace(/\s/g, "");
  if (!/^\d{5}$/.test(s)) return null;
  return BY_DEP[s.slice(0, 2)] || null;
}
