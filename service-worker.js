const CACHE_NAME = "smile-trust-susu-offline-048-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/smile-trust-logo.png",
  "./assets/smile-trust-login-bg.png",
  "./assets/smile-trust-icon.svg",
  "./assets/smile-trust-icon-192.png",
  "./assets/smile-trust-icon-512.png",
  "./assets/seed-data.json",
  "./vendor/xlsx.full.min.js",
  "./vendor/mammoth.browser.min.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs"
];

async function cacheAssets(cache) {
  await Promise.all(
    ASSETS.map(async (asset) => {
      try {
        await cache.add(asset);
      } catch {
        // Skip assets that are unavailable during install.
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cacheAssets(cache)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
