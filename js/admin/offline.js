/* =========================================================
   Salon privé hors connexion
   - Instantané des données (produits, commandes, clients) gardé
     sur l'appareil : le Salon s'ouvre même sans réseau.
   - File d'attente : chaque modification faite hors ligne est
     gardée ici, puis envoyée toute seule au retour du réseau.
   ========================================================= */
const OUT = "odn.outbox";
const SNAP = "odn.admin.snap";
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state()));

export const onChange = (fn) => listeners.add(fn);
export const queue = () => read(OUT, []);
export const online = () => navigator.onLine !== false;

/* Erreur « pas de réseau » (et pas une vraie erreur du serveur) */
export function isNetErr(x) {
  return !online() || x?.status === 0 || x?.message === "network" || x?.name === "TypeError";
}

export function state() {
  const q = queue();
  return { online: online(), pending: q.filter((o) => !o.failed).length, failed: q.filter((o) => o.failed), syncing };
}

/* Ajoute une modification à envoyer plus tard.
   Les modifs du même produit se remplacent (on n'envoie que la dernière version). */
export function enqueue(op) {
  let q = queue();
  if (op.type === "upsert") q = q.filter((o) => !(o.type === "upsert" && o.p?.id === op.p.id));
  if (op.type === "remove") q = q.filter((o) => !((o.type === "upsert" || o.type === "stock") && (o.p?.id || o.id) === op.id));
  q.push({ ...op, at: new Date().toISOString(), uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  const ok = write(OUT, q);
  emit();
  return ok;
}

/* Envoie la file dans l'ordre. handlers = { upsert, remove, stock, status, waorder } */
let syncing = false;
export async function flush(handlers) {
  if (syncing || !online()) return { done: 0, left: queue().length };
  syncing = true; emit();
  let done = 0;
  try {
    for (const op of queue()) {
      if (op.failed) continue;
      try {
        await handlers[op.type](op);
        write(OUT, queue().filter((o) => o.uid !== op.uid));
        done++;
      } catch (x) {
        if (isNetErr(x)) break; // le réseau est retombé : on réessaiera
        write(OUT, queue().map((o) => (o.uid === op.uid ? { ...o, failed: String(x?.message || x).slice(0, 160) } : o)));
      }
      emit();
    }
  } finally { syncing = false; emit(); }
  return { done, left: queue().filter((o) => !o.failed).length };
}

export function dropFailed() { write(OUT, queue().filter((o) => !o.failed)); emit(); }
export function retryFailed() { write(OUT, queue().map(({ failed, ...o }) => o)); emit(); }

/* Instantané hors ligne */
export function saveSnap(part) { write(SNAP, { ...read(SNAP, {}), ...part, at: new Date().toISOString() }); }
export const loadSnap = () => read(SNAP, null);

/* Écoute le réseau */
export function watch(onBack) {
  window.addEventListener("online", () => { emit(); onBack(); });
  window.addEventListener("offline", emit);
}

/* Appli installable + fichiers gardés en cache (service worker) */
export function installApp() {
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}
