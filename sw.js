/* =========================================================
   Service worker : garde les fichiers du site sur l'appareil
   pour ouvrir le Salon privé même hors connexion.
   Stratégie : on sert la copie gardée tout de suite, et on la
   met à jour en arrière-plan quand le réseau est là.
   Les appels à Supabase (autre domaine) ne sont jamais gardés.
   ========================================================= */
const CACHE = "odn-v29";
const CORE = [
  "admin.html", "css/app.css", "js/config.js",
  "js/pages/admin.js", "js/admin/store.js", "js/admin/analytics.js", "js/admin/studio.js", "js/admin/offline.js",
  "js/admin/growth.js", "js/admin/adstudio.js", "js/admin/video.js", "js/admin/eraser.js", "js/admin/affiliates.js", "js/admin/affview.js", "js/admin/qg.js", "js/core/shop.js", "js/ui/luxe.js", "js/admin/quotes.js", "js/ui/notify.js", "js/core/track.js", "assets/img/chargement.webp",
  "js/core/backend.js", "js/core/backend-local.js", "js/core/backend-remote.js", "js/core/sb.js", "js/core/demo.js",
  "js/core/catalogue.js", "js/core/pricing.js", "js/core/i18n.js", "js/core/money.js", "js/core/places.js", "js/core/util.js",
  "js/ui/card.js", "js/ui/icons.js", "locales/fr.json", "data/catalogue.json",
  "assets/img/logo.webp", "assets/img/mono.webp", "assets/img/ornement-logo.webp", "assets/img/favicon.png", "admin.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
