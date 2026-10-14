/* Espace client : connexion, création de compte, mes commandes */
import { initI18n, t, translateDom, currentLang } from "../core/i18n.js";
import { signIn, signUp, signOut, currentUser, myOrders, updateUser, recover, updatePassword, ready, BACKEND_MODE } from "../core/backend.js";
import { countryFromIp } from "../core/geo.js";
import { mountChrome } from "../ui/chrome.js";
import { esc } from "../core/util.js";
import { ORN } from "../ui/card.js";

const app = document.getElementById("app");
let tab = "login";
let notice = "";          // message vert (e-mail envoyé, mot de passe changé…)
let resetMode = false;    // retour du lien « mot de passe oublié »
const next = new URLSearchParams(location.search).get("next");

async function render() {
  const u = currentUser();
  if (u && resetMode) return renderReset();
  const note = BACKEND_MODE === "local" ? `<p class="ac-note" data-i="ac_local_note"></p>` : "";
  if (!u) {
    app.innerHTML = `
    <section class="wrap py-14">
      <div class="ac-box">
        <div class="seal mx-auto" style="width:96px"><img src="assets/img/logo.webp" alt=""></div>
        <h1 class="display text-center text-4xl italic text-gold-hi" data-i="account"></h1>
        <p class="text-center text-muted" data-i="ac_why"></p>
        <div class="ac-tabs" role="tablist">
          <button type="button" role="tab" data-tab="login" aria-selected="${tab === "login"}" data-i="ac_login"></button>
          <button type="button" role="tab" data-tab="signup" aria-selected="${tab === "signup"}" data-i="ac_signup"></button>
        </div>
        <form id="acForm" class="flex flex-col gap-3" novalidate>
          ${tab === "signup" ? `<label class="co-f"><span data-i="co_first"></span><input class="co-in" id="firstName" autocomplete="given-name"></label>` : ""}
          <label class="co-f"><span data-i="co_email"></span><input class="co-in" id="email" type="email" autocomplete="email" required></label>
          <label class="co-f"><span data-i="ac_password"></span><input class="co-in" id="password" type="password" autocomplete="${tab === "signup" ? "new-password" : "current-password"}" required>
            ${tab === "signup" ? `<small class="text-faint" data-i="ac_password_hint"></small>` : ""}</label>
          ${tab === "signup" ? `<label class="co-check"><input type="checkbox" id="optin"><span data-i="co_optin"></span></label>` : ""}
          ${notice ? `<p class="ac-ok" role="status" data-i="${notice}"></p>` : ""}
          <p class="co-err" id="err" role="alert" hidden></p>
          <button class="btn btn-gold w-full" type="submit" data-i="${tab === "signup" ? "ac_submit_signup" : "ac_submit_login"}"></button>
          ${tab === "login" && BACKEND_MODE !== "local" ? `<button type="button" class="ac-link" id="forgot" data-i="ac_forgot"></button>` : ""}
        </form>
        ${note}
      </div>
    </section>`;
    translateDom(app);
    document.getElementById("acForm").addEventListener("submit", submit);
    document.getElementById("forgot")?.addEventListener("click", forgot);
    return;
  }
  const orders = await myOrders();
  if (currentUser()?.id !== u.id) return; // déconnecté entre-temps
  app.innerHTML = `
  <section class="wrap py-14">
    <p class="eyebrow m-0">${ORN}<span data-i="account"></span></p>
    <h1 class="display mt-3 text-[clamp(2.4rem,6vw,3.6rem)] italic leading-none text-gold-hi">${esc(t("ac_hello", { name: u.firstName || "" }))}</h1>
    <p class="text-muted">${esc(u.email)}</p>
    ${notice ? `<p class="ac-ok mt-4" role="status" data-i="${notice}"></p>` : ""}
    <div class="ac-grid">
      <section class="ac-card">
        <h2 class="display" data-i="ac_orders"></h2>
        ${orders.length ? `<ul class="ac-orders">${orders.map((o) => `<li>
          <div><b>${esc(o.id)}</b><small>${new Date(o.at).toLocaleDateString(currentLang(), { dateStyle: "medium" })} · ${o.lines.reduce((s, l) => s + l.qty, 0)} ×</small></div>
          <span class="ac-st st-${o.status}" data-i="ac_status_${o.status}"></span>
          <b class="ac-tot">${esc(o.display?.total || "")}</b></li>`).join("")}</ul>` : `<p class="text-muted" data-i="ac_no_orders"></p>`}
      </section>
      <section class="ac-card">
        <h2 class="display" data-i="ac_offers"></h2>
        <label class="co-check"><input type="checkbox" id="optinMe" ${u.optin ? "checked" : ""}><span data-i="co_optin"></span></label>
        <button type="button" class="btn btn-ghost mt-6" id="logout" data-i="ac_logout"></button>
      </section>
    </div>
    ${note}
  </section>`;
  translateDom(app);
  notice = "";
  document.getElementById("logout").onclick = () => { signOut(); tab = "login"; render(); };
  document.getElementById("optinMe").onchange = async (e) => { try { await updateUser({ optin: e.target.checked }); } catch { e.target.checked = !e.target.checked; } };
}

/* Mot de passe oublié : on envoie un lien par e-mail */
async function forgot() {
  const email = document.getElementById("email").value;
  const err = document.getElementById("err");
  try { await recover(email); notice = "ac_reset_sent"; render(); }
  catch (x) { err.hidden = false; err.textContent = t(x.message === "email" ? "co_invalid_email" : "co_err_network"); document.getElementById("email").focus(); }
}

/* Retour du lien : choisir un nouveau mot de passe */
function renderReset() {
  app.innerHTML = `
  <section class="wrap py-14">
    <div class="ac-box">
      <div class="seal mx-auto" style="width:96px"><img src="assets/img/logo.webp" alt=""></div>
      <h1 class="display text-center text-4xl italic text-gold-hi" data-i="ac_new_password"></h1>
      <form id="rsForm" class="flex flex-col gap-3" novalidate>
        <label class="co-f"><span data-i="ac_password"></span><input class="co-in" id="password" type="password" autocomplete="new-password" required><small class="text-faint" data-i="ac_password_hint"></small></label>
        <p class="co-err" id="err" role="alert" hidden></p>
        <button class="btn btn-gold w-full" type="submit" data-i="ac_reset_save"></button>
      </form>
    </div>
  </section>`;
  translateDom(app);
  document.getElementById("password").focus();
  document.getElementById("rsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await updatePassword(document.getElementById("password").value); resetMode = false; notice = "ac_reset_done"; render(); }
    catch (x) { const err = document.getElementById("err"); err.hidden = false; err.textContent = t(x.message === "password" ? "ac_err_password" : "co_err_network"); }
  });
}

async function submit(e) {
  e.preventDefault();
  const v = (id) => document.getElementById(id)?.value || "";
  const err = document.getElementById("err");
  try {
    if (tab === "signup") await signUp({ email: v("email"), password: v("password"), firstName: v("firstName"), optin: document.getElementById("optin")?.checked, lang: currentLang(), country: await countryFromIp() });
    else await signIn({ email: v("email"), password: v("password") });
    if (next === "commande") { location.href = "commande.html"; return; }
    render();
  } catch (x) {
    if (x.message === "confirm") { notice = "ac_check_email"; tab = "login"; render(); return; }
    err.hidden = false;
    err.textContent = t({ email: "co_invalid_email", password: "ac_err_password", exists: "ac_err_exists", unconfirmed: "ac_err_unconfirmed", network: "co_err_network" }[x.message] || "ac_err_credentials");
  }
}

app.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]");
  if (b) { tab = b.dataset.tab; render(); }
});

await initI18n();
mountChrome({ onLangChange: render });
const back = await ready();               // retour d'un lien reçu par e-mail ?
if (back?.type === "recovery") resetMode = true;
if (back?.type === "signup" || back?.type === "email") notice = "";
render();
