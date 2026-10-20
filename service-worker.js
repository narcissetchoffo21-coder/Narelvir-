const CACHE_NAME = "narelvir-v5";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/images/lanceur-debroussailleuse-4500.jpg",
  "/images/poulie-jaune-3-gorges-30000.jpg",
  "/images/huile-benzol-5l-15w40.webp",
  "/images/debroussailleuse-honda-4t-complete.webp",
  "/images/catcheur-4t.webp",
  "/images/catcheur-2t.webp",
  "/images/motoculteur-complet.webp",
  "/images/semoir.webp",
  "/images/tariere-2t-63cc-trois-meches.webp",
  "/images/tariere-2t-52cc-trois-meches.webp",
  "/images/tariere-4t-gx35-trois-meches.webp",
  "/images/tronconneuse-070-complete.webp",
  "/images/jeu-cles-males-allen.webp"
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
