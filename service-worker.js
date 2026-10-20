const CACHE_NAME = "narelvir-v4";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/lanceur-debroussailleuse-4500.jpg",
  "/images/poulie-jaune-3-gorges-30000.jpg",
  "/images/huile-benzol-5l-15w40.webp"
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
