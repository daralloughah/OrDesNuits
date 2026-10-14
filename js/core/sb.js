/* =========================================================
   Petit client Supabase, sans bibliothèque externe
   (rien à télécharger depuis un CDN : marche aussi en Chine).
   Base de données : /rest/v1 · Comptes : /auth/v1
   Photos : /storage/v1 · Fonctions : /functions/v1
   ========================================================= */
import { SUPABASE } from "../config.js";

export const enabled = !!(SUPABASE.url && SUPABASE.anonKey);
const URL_ = String(SUPABASE.url || "").replace(/\/+$/, "");
const KEY = SUPABASE.anonKey;
const SKEY = "odn.sb.session";

/* ---------- Session ---------- */
let session = (() => { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } })();
function keep(s) {
  session = s;
  try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch {}
}
export const getSession = () => session;

function fromToken(data) {
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    user: data.user || session?.user || null,
    profile: session?.profile || null,
  };
}

let refreshing = null;
async function refresh() {
  if (!session?.refresh_token) return false;
  refreshing ||= (async () => {
    try {
      const r = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!r.ok) { if (r.status === 400 || r.status === 401) keep(null); return false; }
      keep(fromToken(await r.json()));
      return true;
    } catch { return false; } finally { setTimeout(() => (refreshing = null), 0); }
  })();
  return refreshing;
}

async function token() {
  if (!session) return null;
  if (session.expires_at - 60 < Date.now() / 1000) await refresh();
  return session?.access_token || null;
}

/* ---------- Appel générique ---------- */
export class SbError extends Error {
  constructor(status, body) {
    super(body?.message || body?.msg || body?.error_description || body?.error || `HTTP ${status}`);
    this.status = status; this.body = body; this.code = body?.code || body?.error_code || null;
  }
}

export async function api(path, { method = "GET", body, headers = {}, raw = false, auth = true, retry = true } = {}) {
  const h = { apikey: KEY, ...headers };
  const tk = auth ? await token() : null;
  if (tk) h.Authorization = `Bearer ${tk}`;
  if (body !== undefined && !raw) h["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch(URL_ + path, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) });
  } catch { throw new SbError(0, { message: "network" }); }
  if (r.status === 401 && tk && retry && (await refresh())) return api(path, { method, body, headers, raw, auth, retry: false });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new SbError(r.status, data);
  return data;
}

/* Base de données */
export const rest = (table, query = "", opts = {}) => api(`/rest/v1/${table}${query ? "?" + query : ""}`, opts);
export const rpc = (fn, args = {}) => api(`/rest/v1/rpc/${fn}`, { method: "POST", body: args });

/* ---------- Comptes ---------- */
const here = (page) => new URL(page, location.href).href.split("#")[0].split("?")[0];

export async function authSignUp({ email, password, data }) {
  const res = await api(`/auth/v1/signup?redirect_to=${encodeURIComponent(here("compte.html"))}`, {
    method: "POST", auth: false, body: { email, password, data },
  });
  if (res?.access_token) { keep(fromToken(res)); return { session: true }; }
  return { session: false, user: res?.user || res };
}

export async function authSignIn(email, password) {
  const res = await api("/auth/v1/token?grant_type=password", { method: "POST", auth: false, body: { email, password } });
  keep(fromToken(res));
  return res.user;
}

export async function authSignOut() {
  const tk = session?.access_token;
  keep(null);
  if (tk) fetch(`${URL_}/auth/v1/logout`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${tk}` } }).catch(() => {});
}

export async function authRecover(email) {
  await api(`/auth/v1/recover?redirect_to=${encodeURIComponent(here("compte.html"))}`, { method: "POST", auth: false, body: { email } });
}

export async function authUpdatePassword(password) {
  const user = await api("/auth/v1/user", { method: "PUT", body: { password } });
  if (session) keep({ ...session, user });
  return user;
}

export function setProfile(profile) { if (session) keep({ ...session, profile }); }

/* Retour du lien reçu par e-mail (confirmation ou nouveau mot de passe) :
   Supabase renvoie la session dans l'adresse, après le #. */
export async function consumeHashSession() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("error_description")) {
    history.replaceState(null, "", location.pathname + location.search);
    return { error: h.get("error_description") };
  }
  if (!h.get("access_token")) return null;
  const type = h.get("type");
  keep(fromToken({ access_token: h.get("access_token"), refresh_token: h.get("refresh_token"), expires_in: h.get("expires_in"), expires_at: Number(h.get("expires_at")) || undefined }));
  history.replaceState(null, "", location.pathname + location.search);
  try { keep({ ...session, user: await api("/auth/v1/user") }); } catch {}
  return { type };
}

/* ---------- Photos ---------- */
export async function upload(path, blob) {
  await api(`/storage/v1/object/products/${path}`, {
    method: "POST", raw: true, body: blob,
    headers: { "Content-Type": blob.type || "image/webp", "x-upsert": "true", "cache-control": "31536000" },
  });
  return publicUrl(path);
}
export const publicUrl = (path) => `${URL_}/storage/v1/object/public/products/${path}`;

/* ---------- Fonctions serveur ---------- */
export const fn = (name, body) => api(`/functions/v1/${name}`, { method: "POST", body, auth: false });
