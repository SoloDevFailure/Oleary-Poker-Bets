const CACHE_NAME = "oleary-ave-poker-bets-v71";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/constants.js",
  "./js/utils.js",
  "./js/combo-logic.js",
  "./js/state.js",
  "./js/market-logic.js",
  "./js/payout-logic.js",
  "./features/avatar/avatar.css",
  "./features/avatar/avatar.js",
  "./app.js",
  "./supabase-config.js",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./PokerBets.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
