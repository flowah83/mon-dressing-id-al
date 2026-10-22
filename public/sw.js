/* Coque hors ligne. Les règles de tri sont les mêmes que src/lib/pwa.ts. */
const CACHE = "vestiaire-shell-v2";
const PRECACHE = [
  "/",
  "/composer",
  "/ajouter",
  "/conseiller",
  "/favoris",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/fonts/InterVariable.woff2",
];

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne — Vestiaire</title></head><body style="font:16px/1.5 system-ui,sans-serif;background:#f2f2f7;color:#1c1c1e;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center"><main><h1 style="font-weight:600">Vestiaire est hors ligne</h1><p>Ouvrez d'abord l'application une fois avec du réseau. Ensuite, le dressing de cet appareil s'ouvre sans connexion.</p><p><a href="/">Réessayer l'accueil</a></p></main></body></html>`;

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

function cacheFirstPath(url) {
  if (url.pathname === "/sw.js") return false;
  return (
    url.pathname.startsWith("/assets/") ||
    /\.(png|jpe?g|webp|svg|ico|webmanifest|css|js|woff2)$/i.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) void cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  if (cached) return cached;
  const fresh = await network;
  if (fresh) return fresh;
  if (request.mode === "navigate") {
    const shell = await cache.match("/");
    if (shell) return shell;
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response("", { status: 504 });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined))))
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
  const url = new URL(event.request.url);
  event.respondWith(
    cacheFirstPath(url) ? cacheFirst(event.request) : staleWhileRevalidate(event.request),
  );
});
