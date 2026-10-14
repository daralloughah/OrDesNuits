/* =========================================================
   MODE EN LIGNE (Supabase)
   Mêmes fonctions que backend-local.js, branchées sur la base.
   Les prix et l'offre 3+1 sont recalculés par le serveur
   (fonction place_order) : impossible de tricher.
   ========================================================= */
import { rest, rpc, getSession, setProfile, authSignUp, authSignIn, authSignOut, authRecover, authUpdatePassword, consumeHashSession, SbError } from "./sb.js";
import { makeDemo } from "./demo.js";

export const BACKEND_MODE = "supabase";
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());
const norm = (e) => String(e || "").trim().toLowerCase();
const num = (v) => (v == null ? 0 : Number(v));

/* ---------- Conversions base ⇄ site ---------- */
export function orderFromRow(r) {
  return {
    id: r.id, at: r.created_at, status: r.status, source: r.source, payment: r.payment,
    paidAt: r.paid_at, shippedAt: r.shipped_at, userId: r.user_id,
    customer: r.customer || {}, shipping: r.shipping || {}, lang: r.lang,
    lines: (r.lines || []).map((l) => ({ ...l, qty: num(l.qty), unitEur: num(l.unitEur) })),
    subtotalEur: num(r.subtotal_eur), discountEur: num(r.discount_eur), totalEur: num(r.total_eur),
    display: r.display || {}, stockApplied: !!r.stock_applied, demo: !!r.demo,
  };
}
function orderToRow(o) {
  return {
    id: o.id, created_at: o.at, status: o.status || "nouvelle", source: o.source || "site", payment: o.payment || null,
    paid_at: o.paidAt || null, shipped_at: o.shippedAt || null, user_id: o.userId || null,
    customer: o.customer || {}, shipping: o.shipping || {}, lang: o.lang || "fr", lines: o.lines || [],
    subtotal_eur: o.subtotalEur || 0, discount_eur: o.discountEur || 0, total_eur: o.totalEur || 0,
    display: o.display || {}, stock_applied: !!o.stockApplied, demo: !!o.demo,
  };
}
const userFromProfile = (p) => ({ id: p.id, email: p.email, firstName: p.first_name || "", optin: !!p.optin, lang: p.lang, country: p.country, createdAt: p.created_at });
const subFromRow = (s) => ({ email: s.email, source: s.source, lang: s.lang, at: s.created_at, demo: !!s.demo });

/* ---------- Démarrage (retour de lien e-mail, profil) ---------- */
let readyP = null;
export function ready() {
  readyP ||= (async () => {
    const back = await consumeHashSession();
    if (getSession() && !getSession().profile) await loadProfile();
    return back;
  })();
  return readyP;
}

async function loadProfile() {
  const s = getSession();
  if (!s?.user?.id) return null;
  try {
    const [p] = await rest("profiles", `id=eq.${s.user.id}&select=*`);
    if (p) setProfile(p);
    return p || null;
  } catch { return null; }
}

/* ---------- Comptes ---------- */
function authError(x) {
  if (!(x instanceof SbError)) return new Error("network");
  if (x.status === 0) return new Error("network");
  const m = `${x.code || ""} ${x.message || ""}`.toLowerCase();
  if (m.includes("not confirmed") || m.includes("email_not_confirmed")) return new Error("unconfirmed");
  if (m.includes("already") || m.includes("exists")) return new Error("exists");
  if (m.includes("password") || m.includes("weak")) return new Error("password");
  if (m.includes("email") && (m.includes("invalid") || m.includes("valid"))) return new Error("email");
  return new Error("credentials");
}

export async function signUp({ email, password, firstName = "", optin = false, lang = "fr", country = null }) {
  email = norm(email);
  if (!isEmail(email)) throw new Error("email");
  if (String(password).length < 8) throw new Error("password");
  let res;
  try { res = await authSignUp({ email, password, data: { first_name: firstName.trim(), optin: !!optin, lang, country } }); }
  catch (x) { throw authError(x); }
  if (!res.session) throw new Error("confirm"); // un e-mail de confirmation vient de partir
  await loadProfile();
  return currentUser();
}

export async function signIn({ email, password }) {
  try { await authSignIn(norm(email), password); } catch (x) { throw authError(x); }
  await loadProfile();
  return currentUser();
}

export function signOut() { authSignOut(); }

export function currentUser() {
  const s = getSession();
  if (!s?.user) return null;
  const p = s.profile || {};
  const meta = s.user.user_metadata || {};
  return { id: s.user.id, email: s.user.email, firstName: p.first_name ?? meta.first_name ?? "", optin: p.optin ?? !!meta.optin, lang: p.lang || meta.lang || "fr", country: p.country || meta.country || null };
}

export async function updateUser(patch) {
  const u = currentUser();
  if (!u) return null;
  const row = {};
  if ("firstName" in patch) row.first_name = patch.firstName;
  for (const k of ["optin", "lang", "country"]) if (k in patch) row[k] = patch[k];
  const [p] = await rest("profiles", `id=eq.${u.id}`, { method: "PATCH", body: row, headers: { Prefer: "return=representation" } });
  if (p) setProfile(p);
  if (patch.optin) await subscribe(u.email, "compte", u.lang);
  return currentUser();
}

export async function recover(email) {
  if (!isEmail(email)) throw new Error("email");
  try { await authRecover(norm(email)); } catch (x) { throw authError(x); }
}
export async function updatePassword(password) {
  if (String(password).length < 8) throw new Error("password");
  try { await authUpdatePassword(password); } catch (x) { throw authError(x); }
}

/* ---------- Commandes ---------- */
export async function createOrder(order) {
  let res;
  try {
    res = await rpc("place_order", {
      p: {
        customer: order.customer, shipping: order.shipping, lang: order.lang, display: order.display,
        lines: order.lines.map((l) => ({ id: l.id, qty: l.qty })),
      },
    });
  } catch (x) {
    const m = x?.message || "";
    const e = new Error(m.startsWith("sold_out:") ? "sold_out" : m === "email" ? "email" : x?.status === 0 ? "network" : "order");
    e.detail = m.split(":").slice(1).join(":");
    throw e;
  }
  return {
    ...order, id: res.id, at: new Date().toISOString(), status: "nouvelle", source: "site",
    lines: res.lines.map((l) => ({ ...l, qty: num(l.qty), unitEur: num(l.unitEur) })),
    subtotalEur: num(res.subtotalEur), discountEur: num(res.discountEur), totalEur: num(res.totalEur),
  };
}

export async function myOrders() {
  if (!currentUser()) return [];
  try { return (await rest("orders", "select=*&order=created_at.desc&limit=100")).map(orderFromRow); }
  catch { return []; }
}

/* ---------- Inscrits aux offres ---------- */
export async function subscribe(email, source = "site", lang = "fr") {
  if (!isEmail(email)) return false;
  try { return (await rpc("subscribe", { p_email: norm(email), p_source: source, p_lang: lang })) !== false; }
  catch { return false; }
}

/* =========================================================
   Salon privé : les données sont chargées une fois
   (loadAdminData), puis lues sans attendre par les écrans.
   ========================================================= */
const cache = { orders: [], users: [], subs: [] };

async function fetchAll(table, query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const page = await rest(table, `${query}&limit=1000&offset=${from}`);
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

export async function loadAdminData() {
  const [o, u, s] = await Promise.all([
    fetchAll("orders", "select=*&order=created_at.desc"),
    fetchAll("profiles", "select=*&order=created_at.desc"),
    fetchAll("subscribers", "select=*&order=created_at.desc"),
  ]);
  cache.orders = o.map(orderFromRow);
  cache.users = u.map(userFromProfile);
  cache.subs = s.map(subFromRow);
}

export const allOrders = () => cache.orders;
export const customers = () => cache.users;
export const subscribers = () => cache.subs;
export const hasDemo = () => cache.orders.some((o) => o.demo) || cache.subs.some((s) => s.demo);

function replaceInCache(o) {
  const i = cache.orders.findIndex((x) => x.id === o.id);
  if (i >= 0) cache.orders[i] = o; else cache.orders.unshift(o);
  return o;
}

/* Change le statut : le serveur décompte / remet le stock tout seul */
export async function setOrderStatus(id, status, payment = null) {
  const row = await rpc("admin_set_status", { p_id: id, p_status: status, p_payment: payment });
  return replaceInCache(orderFromRow(row));
}

export async function updateOrder(id, patch) {
  const cur = cache.orders.find((o) => o.id === id);
  const row = orderToRow({ ...cur, ...patch });
  delete row.id; delete row.created_at;
  const [r] = await rest("orders", `id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: row, headers: { Prefer: "return=representation" } });
  return r ? replaceInCache(orderFromRow(r)) : null;
}

/* Commande reçue directement sur WhatsApp, saisie par le gérant */
export async function adminCreateOrder(order) {
  const id = "ODN-W" + Date.now().toString(36).toUpperCase().slice(-5);
  const row = orderToRow({ ...order, id, at: new Date().toISOString(), status: "nouvelle", stockApplied: false, paidAt: null });
  await rest("orders", "", { method: "POST", body: row, headers: { Prefer: "return=minimal" } });
  return setOrderStatus(id, "confirmee", order.payment || "whatsapp");
}

export async function unsubscribe(email) {
  await rest("subscribers", `email=eq.${encodeURIComponent(norm(email))}`, { method: "DELETE" });
  cache.subs = cache.subs.filter((s) => s.email !== norm(email));
}

/* ---------- Données de démonstration (marquées demo, retirables) ---------- */
export async function seedDemo(products) {
  const d = makeDemo(products, { subs: cache.subs });
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rows = d.orders.map((o, i) => orderToRow({ ...o, id: `ODN-D${stamp}${i}`, demo: true, paidAt: o.status === "nouvelle" || o.status === "annulee" ? null : o.at }));
  for (let i = 0; i < rows.length; i += 200) {
    await rest("orders", "", { method: "POST", body: rows.slice(i, i + 200), headers: { Prefer: "return=minimal" } });
  }
  if (d.subs.length) {
    await rest("subscribers", "on_conflict=email", {
      method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: d.subs.map((s) => ({ email: s.email, source: s.source, lang: s.lang, created_at: s.at, demo: true })),
    });
  }
  await loadAdminData();
}

export async function clearDemo() {
  await rest("orders", "demo=is.true", { method: "DELETE" });
  await rest("subscribers", "demo=is.true", { method: "DELETE" });
  await loadAdminData();
}

/* Le compte connecté est-il gérant ? */
export async function isAdmin() {
  if (!getSession()) return false;
  try { return (await rpc("is_admin")) === true; } catch { return false; }
}
