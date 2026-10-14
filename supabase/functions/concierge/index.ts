// =========================================================
// OrDesNuits · Le Concierge (agent IA)
// Fonction Supabase (Deno). Elle reçoit la conversation du site,
// ajoute le catalogue à jour, et interroge Claude (Anthropic).
//
// Secrets à définir dans Supabase → Edge Functions → Secrets (UNE des deux clés) :
//   GEMINI_API_KEY      (Google AI Studio) → utilisée en priorité si présente
//   ANTHROPIC_API_KEY   (console.anthropic.com)
//   GEMINI_MODEL        (facultatif, défaut : gemini-3.5-flash-lite)
//   CONCIERGE_MODEL     (facultatif, modèle Claude, défaut : claude-haiku-5-5)
//   CONCIERGE_HOURLY    (facultatif, messages max par visiteur et par heure, défaut 30)
//   CONCIERGE_DAILY     (facultatif, messages max par jour pour tout le site, défaut 1500)
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement
// par Supabase : la clé secrète ne quitte jamais le serveur.
// =========================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
const AI_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODEL = Deno.env.get("CONCIERGE_MODEL") || "claude-haiku-5-5";
const HOURLY = Number(Deno.env.get("CONCIERGE_HOURLY") || 30);
const DAILY = Number(Deno.env.get("CONCIERGE_DAILY") || 1500);

const db = (path: string, init: RequestInit = {}) =>
  fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });

// Nombre de lignes, sans les télécharger
async function count(query: string): Promise<number> {
  const r = await db(`chat_log?select=id&${query}`, { method: "HEAD", headers: { Prefer: "count=exact" } });
  return Number(r.headers.get("content-range")?.split("/")[1] || 0);
}

// ---------- Catalogue (gardé 5 minutes en mémoire) ----------
let catalogue = { at: 0, text: "", offer: { active: true, buy: 3 } };
async function getCatalogue() {
  if (Date.now() - catalogue.at < 5 * 60_000 && catalogue.text) return catalogue;
  const [pr, st] = await Promise.all([
    db("products?select=name,shop,category,type,price,promo,stock,offer,descr&active=is.true&order=shop,category,sort"),
    db("settings?select=value&key=eq.offer"),
  ]);
  const products = pr.ok ? await pr.json() : [];
  const offer = st.ok ? ((await st.json())[0]?.value ?? catalogue.offer) : catalogue.offer;
  const CAT: Record<string, string> = { miel: "miel", huile: "huile de massage", bougie: "bougie de massage", gel: "gel retardant", soin: "soin intime", pack: "coffret" };
  const text = products.map((p: any) => {
    const price = p.promo != null && Number(p.promo) < Number(p.price) ? `${p.promo} € (au lieu de ${p.price} €)` : `${p.price} €`;
    const d = p.descr?.fr || p.descr?.en || "";
    return `- ${p.name} · ${p.shop === "elle" ? "Pour elle" : "Pour lui"} · ${CAT[p.type === "pack" ? "pack" : p.category] || p.category} · ${price}` +
      `${p.offer ? " · éligible 3+1" : ""}${p.stock <= 0 ? " · ÉPUISÉ" : ""}${d ? ` · ${d}` : ""}`;
  }).join("\n");
  catalogue = { at: Date.now(), text, offer };
  return catalogue;
}

// PROMPT PROVISOIRE (version simple, à remplacer par la version détaillée)
// Les deux règles « santé » restent obligatoires : la loi interdit de promettre
// des effets aphrodisiaques ou de santé sur un aliment.
function systemPrompt(lang: string, cat: { text: string; offer: { active: boolean; buy: number } }) {
  return `Tu es « Le Concierge » de la boutique de luxe OrDesNuits (miels, huiles, bougies, gels, soins intimes, pour adultes).
Réponds dans la langue du client (langue du site : ${lang}), avec élégance, en 3 phrases maximum.

Catalogue (prix en euros) :
${cat.text || "(indisponible)"}
Offre : ${cat.offer?.active ? `${cat.offer.buy} achetés, le ${cat.offer.buy + 1}e offert (le moins cher) sur les articles marqués 3+1.` : "aucune."}
Livraison sous 48 h, colis neutre et discret. Paiement finalisé sur WhatsApp pour l'instant.

Règles : ne promets jamais d'effet sur la santé ou la libido ; pour toute question de santé, conseille un médecin ou un pharmacien ; n'invente rien.
Pour le suivi d'une commande ou si tu ne sais pas, termine par [WHATSAPP].`;
}

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GEMINI_KEY && !AI_KEY) return json({ error: "not_configured" }, 503);

  // ---------- Lecture et nettoyage de la conversation ----------
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const lang = String(body?.lang || "fr").slice(0, 10);
  let messages: Msg[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter((m: any) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, m.role === "user" ? 600 : 1500) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  // deux messages de suite du même rôle : on les fusionne
  messages = messages.reduce<Msg[]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content; else acc.push({ ...m });
    return acc;
  }, []);
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "bad_request" }, 400);

  // ---------- Anti-abus : par visiteur et pour tout le site ----------
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "?").split(",")[0].trim();
  try {
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [mine, all] = await Promise.all([
      count(`ip=eq.${encodeURIComponent(ip)}&created_at=gte.${hourAgo}`),
      count(`created_at=gte.${dayAgo}`),
    ]);
    if (mine >= HOURLY || all >= DAILY) return json({ error: "limit" }, 429);
    await db("chat_log", { method: "POST", body: JSON.stringify({ ip }), headers: { Prefer: "return=minimal" } });
  } catch { /* si le journal ne répond pas, on laisse passer */ }

  // ---------- Appel à l'IA ----------
  const cat = await getCatalogue().catch(() => catalogue);
  const system = systemPrompt(lang, cat);
  let reply = "";
  try { reply = GEMINI_KEY ? await askGemini(system, messages) : await askClaude(system, messages); }
  catch (e) { console.error(String(e)); return json({ error: "ai" }, 502); }
  const handoff = reply.includes("[WHATSAPP]");
  reply = reply.replaceAll("[WHATSAPP]", "").trim();
  if (!reply) return json({ error: "empty" }, 502);
  return json({ reply, handoff });
});

// ---------- Google Gemini ----------
async function askGemini(system: string, messages: Msg[]): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  // la clé passe d'abord dans l'en-tête (méthode officielle), puis dans l'adresse si Google la refuse
  let r = await fetch(url, { method: "POST", headers: { "x-goog-api-key": GEMINI_KEY, "content-type": "application/json" }, body });
  if (r.status === 401 || r.status === 403) {
    console.error("gemini header", r.status, await r.text());
    r = await fetch(`${url}?key=${encodeURIComponent(GEMINI_KEY)}`, { method: "POST", headers: { "content-type": "application/json" }, body });
  }
  if (!r.ok) throw new Error(`gemini ${r.status} ${await r.text()}`);
  const data = await r.json();
  return (data.candidates?.[0]?.content?.parts || []).filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("").trim();
}

// ---------- Anthropic Claude ----------
async function askClaude(system: string, messages: Msg[]): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": AI_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status} ${await r.text()}`);
  const data = await r.json();
  return (data.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
}
