// Copie les polices dans assets/fonts pour les héberger nous-mêmes
// (aucun appel à Google Fonts : le site reste rapide en Chine)
import fs from "fs";
import path from "path";

const want = [
  ["bodoni-moda", /latin-wght-normal\.woff2$/, "bodoni-moda-latin-normal.woff2"],
  ["bodoni-moda", /latin-wght-italic\.woff2$/, "bodoni-moda-latin-italic.woff2"],
  ["jost", /-latin-wght-normal\.woff2$/, "jost-latin-normal.woff2"],
  ["jost", /-cyrillic-wght-normal\.woff2$/, "jost-cyrillic-normal.woff2"],
  ["noto-naskh-arabic", /-arabic-wght-normal\.woff2$/, "noto-naskh-arabic-normal.woff2"],
];
fs.mkdirSync("assets/fonts", { recursive: true });
for (const [pkg, re, out] of want) {
  const dir = path.join("node_modules/@fontsource-variable", pkg, "files");
  const file = fs.readdirSync(dir).filter((f) => re.test(f) && !f.includes("-ext-"))[0];
  if (!file) { console.warn("introuvable :", pkg, re); continue; }
  fs.copyFileSync(path.join(dir, file), path.join("assets/fonts", out));
  console.log("✓", out);
}
