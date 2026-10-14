/* =========================================================
   MODE APERÇU (sans Supabase)
   Comptes clients, commandes, inscrits aux offres.

   MODE ACTUEL : "local" → tout est gardé sur l'appareil
   (parfait pour tester et faire la démo).
   Quand Supabase sera prêt, on réécrit UNIQUEMENT ce fichier
   avec les mêmes fonctions : le site et le Salon privé
   continueront de marcher sans autre changement.
   ========================================================= */
import { makeDemo } from "./demo.js";
export const BACKEND_MODE = "local";
export const ready = async () => null;
export const loadAdminData = async () => {};

const K = { users: "odn.users", session: "odn.session", orders: "odn.orders", subs: "odn.subs" };
const read = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const uid = (p) => p + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
const norm = (e) => String(e || "").trim().toLowerCase();
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim());

async function hash(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("odn-user:" + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------- Comptes ---------- */
export async function signUp({ email, password, firstName = "", optin = false, lang = "fr", country = null }) {
  email = norm(email);
  if (!isEmail(email)) throw new Error("email");
  if (String(password).length < 8) throw new Error("password");
  const users = read(K.users);
  if (users.some((u) => u.email === email)) throw new Error("exists");
  optin = optin || read(K.subs).some((s) => s.email === email);
  const user = { id: uid("U"), email, firstName: firstName.trim(), optin, lang, country, createdAt: new Date().toISOString(), pass: await hash(password) };
  users.push(user);
  write(K.users, users);
  if (optin) subscribe(email, "compte", lang);
  write(K.session, user.id);
  return publicUser(user);
}

export async function signIn({ email, password }) {
  const u = read(K.users).find((x) => x.email === norm(email));
  if (!u || u.pass !== (await hash(password))) throw new Error("credentials");
  write(K.session, u.id);
  return publicUser(u);
}

export function signOut() { try { localStorage.removeItem(K.session); } catch {} }

export function currentUser() {
  const id = read(K.session, null);
  const u = id && read(K.users).find((x) => x.id === id);
  return u ? publicUser(u) : null;
}

export function updateUser(patch) {
  const users = read(K.users);
  const u = users.find((x) => x.id === read(K.session, null));
  if (!u) return null;
  Object.assign(u, patch);
  write(K.users, users);
  if (patch.optin) subscribe(u.email, "compte", u.lang);
  return publicUser(u);
}

const publicUser = ({ pass, ...u }) => u;

/* ---------- Commandes ---------- */
export function createOrder(order) {
  const orders = read(K.orders);
  const o = {
    id: "ODN-" + Date.now().toString(36).toUpperCase().slice(-6),
    at: new Date().toISOString(),
    status: "nouvelle",
    source: "site",
    payment: null,
    userId: currentUser()?.id || null,
    ...order,
  };
  orders.unshift(o);
  write(K.orders, orders);
  if (o.customer?.optin) subscribe(o.customer.email, "commande", o.lang);
  return o;
}

export const myOrders = () => {
  const u = currentUser();
  return u ? read(K.orders).filter((o) => o.userId === u.id || norm(o.customer?.email) === u.email) : [];
};

/* ---------- Réservé au Salon privé ---------- */
export const allOrders = () => read(K.orders);
export function updateOrder(id, patch) {
  const orders = read(K.orders);
  const o = orders.find((x) => x.id === id);
  if (o) { Object.assign(o, patch); write(K.orders, orders); }
  return o;
}
export const customers = () => read(K.users).map(publicUser);

/* ---------- Inscrits aux offres (liste e-mails) ---------- */
export function subscribe(email, source = "site", lang = "fr") {
  email = norm(email);
  if (!isEmail(email)) return false;
  const subs = read(K.subs);
  if (!subs.some((s) => s.email === email)) {
    subs.push({ email, source, lang, at: new Date().toISOString() });
    write(K.subs, subs);
  }
  return true;
}
export const subscribers = () => read(K.subs);
export function unsubscribe(email) { write(K.subs, read(K.subs).filter((s) => s.email !== norm(email))); }

/* ---------- Données de démonstration (pour voir le tableau de bord vivre) ---------- */
export function seedDemo(products) {
  const d = makeDemo(products, { users: read(K.users), subs: read(K.subs) });
  write(K.orders, [...read(K.orders), ...d.orders].sort((a, b) => b.at.localeCompare(a.at)));
  write(K.users, [...read(K.users), ...d.users]);
  write(K.subs, [...read(K.subs), ...d.subs]);
}

export function clearDemo() {
  write(K.orders, read(K.orders).filter((o) => !o.demo));
  write(K.users, read(K.users).filter((u) => !u.demo));
  write(K.subs, read(K.subs).filter((s) => !s.demo));
}
export const hasDemo = () => read(K.orders).some((o) => o.demo);

/* Mot de passe oublié : impossible sans serveur d'e-mails */
export async function recover() { throw new Error("local"); }
export async function updatePassword() { throw new Error("local"); }
