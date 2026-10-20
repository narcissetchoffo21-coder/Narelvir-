const CACHE_NAME = "narelvir-v2";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/lanceur-debroussailleuse-4500.jpg"
];

self.addEventListener("install", function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("fetch", function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
