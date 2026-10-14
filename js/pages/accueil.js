/* Page d'accueil : on salue le visiteur dans la langue de son pays, puis il choisit */
import { LANGS } from "../config.js";
import { initI18n, setLang, currentLang, t, translateDom } from "../core/i18n.js";
import { mountFx } from "../ui/fx.js";

const HELLO = { fr: "Bienvenue", "en-US": "Welcome", "en-GB": "Welcome", ar: "أهلاً بك", es: "Bienvenido", pt: "Bem-vindo", ru: "Добро пожаловать", de: "Willkommen", zh: "欢迎光临", ja: "ようこそ", ko: "환영합니다" };

async function render() {
  const info = await initI18n();
  translateDom();

  /* Le premier mot affiché est dans la langue du visiteur, puis les autres défilent */
  const order = [info.code, ...LANGS.map((l) => l.code).filter((c) => c !== info.code && c !== "en-GB")];
  const greet = document.getElementById("greet");
  greet.innerHTML = order.map((c, i) => `<span class="${i === 0 ? "on" : ""}" lang="${c}">${HELLO[c]}</span>`).join("");
  let i = 0;
  setInterval(() => {
    const spans = greet.children;
    spans[i].classList.remove("on");
    i = (i + 1) % spans.length;
    spans[i].classList.add("on");
  }, 2400);

  const cur = currentLang();
  document.getElementById("langs").innerHTML = LANGS.map((l) => `
    <button type="button" class="lang-tile" data-lang="${l.code}" aria-current="${l.code === cur}">
      <b lang="${l.html}">${l.name}</b><small>${l.region}</small>
    </button>`).join("");

  document.getElementById("continue").textContent = t("w_continue", { lang: info.name });
}

document.getElementById("langs").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-lang]");
  if (!b) return;
  await setLang(b.dataset.lang);
  location.href = "maisons.html";
});
document.getElementById("continue").addEventListener("click", async () => {
  await setLang(currentLang());
  location.href = "maisons.html";
});

mountFx();
render();
