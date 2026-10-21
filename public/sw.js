/* Coque hors ligne. Les règles de tri sont les mêmes que src/lib/pwa.ts. */
const CACHE = "vestiaire-shell-v1";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne — Vestiaire</title></head><body style="font:16px/1.5 system-ui,sans-serif;background:#f8f4ec;color:#2c2c2c;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center"><main><h1 style="font-weight:500">Vestiaire est hors ligne</h1><p>Ouvrez d'abord l'application une fois avec du réseau. Ensuite, le dressing de cet appareil s'ouvre sans connexion.</p><p><a href="/">Réessayer l'accueil</a></p></main></body></html>`;

function cacheable(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/_server") || url.search.includes("_serverFn")) return false;
  const dest = request.destination;
  if (
    dest === "document" ||
    dest === "script" ||
    dest === "style" ||
    dest === "image" ||
    dest === "font" ||
    dest === "manifest"
  )
    return true;
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(png|jpe?g|webp|svg|ico|webmanifest|css|js|woff2)$/i.test(url.pathname);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate" && new URL(request.url).pathname === "/") {
      const shell = await cache.match("/");
      if (shell) return shell;
    }
    if (request.mode === "navigate") {
      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (!cacheable(event.request)) return;
  event.respondWith(networkFirst(event.request));
});
