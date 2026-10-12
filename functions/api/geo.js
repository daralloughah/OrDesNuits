/* Cloudflare Pages Function : renvoie le pays du visiteur (d'après son IP).
   Aucun service tiers, aucune donnée enregistrée. Fonctionne aussi en Chine. */
export function onRequest({ request }) {
  const country = request.cf?.country || request.headers.get("cf-ipcountry") || null;
  return new Response(JSON.stringify({ country }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
