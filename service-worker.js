const CACHE_NAME = "narelvir-v12-security";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192-1.png",
  "/icon-512.png"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(event) {
  event.waitUntil(
    caches.keys()
      .then(function(keys) {
        return Promise.all(keys
          .filter(function(key) { return key !== CACHE_NAME; })
          .map(function(key) { return caches.delete(key); }));
      })
      .then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/service-worker.js") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          if (response && response.ok) {
            const copie = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put("/index.html", copie); });
          }
          return response;
        })
        .catch(function() { return caches.match("/index.html"); })
    );
    return;
  }

  if (["style", "script", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(function(cached) {
        const miseAJour = fetch(request).then(function(response) {
          if (response && response.ok && response.type === "basic") {
            const copie = response.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(request, copie); });
          }
          return response;
        }).catch(function() { return cached; });
        return cached || miseAJour;
      })
    );
  }
});
