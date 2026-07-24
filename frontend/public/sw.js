const CACHE = "mineops-shell-v5";
// index.html is intentionally NOT cached — it must always be fetched from network
// so the browser gets the fresh asset hashes from every deploy (prevents MIME type
// errors from stale index.html referencing non-existent JS bundles).
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.svg", "/icons/icon-512.svg"];

self.addEventListener("install", event =>
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener("activate", event =>
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const path = new URL(event.request.url).pathname;
  // Never cache source maps or dev URLs.
  if (path.startsWith("/src/") || path.startsWith("/@") || path.includes("node_modules")) return;
  // Only serve shell assets from cache. JS/CSS bundles always go to network
  // so the latest deploy is reflected immediately (no stale bundle cache).
  if (SHELL.includes(path)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        });
      }).catch(() => caches.match("/index.html"))
    );
  }
  // Everything else goes directly to network (no cache-first).
});
