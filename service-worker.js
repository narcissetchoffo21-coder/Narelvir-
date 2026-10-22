const CACHE_NAME = "narelvir-v15-propositions-alertes";

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


self.addEventListener("push", function(event) {
  let donnees = {};
  try {
    donnees = event.data ? event.data.json() : {};
  } catch (erreur) {
    donnees = { title: "NARELVIR", body: event.data ? event.data.text() : "Nouvelle activité" };
  }
  const titre = donnees.title || "NARELVIR";
  const options = {
    body: donnees.body || "Nouvelle activité sur votre site",
    icon: "/icon-192-1.png",
    badge: "/icon-192-1.png",
    tag: donnees.tag || "narelvir-notification",
    renotify: true,
    silent: false,
    vibrate: [250, 100, 250],
    data: { url: donnees.url || "https://www.narelvir.cm/#connexion" }
  };
  event.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  const cible = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "https://www.narelvir.cm/#connexion";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(fenetres) {
      for (const fenetre of fenetres) {
        if ("focus" in fenetre) {
          fenetre.navigate(cible);
          return fenetre.focus();
        }
      }
      return clients.openWindow ? clients.openWindow(cible) : undefined;
    })
  );
});
