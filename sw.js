/* AirGuard GR — service worker.
 * Το κέλυφος της εφαρμογής μπαίνει στην cache ώστε να ανοίγει και χωρίς δίκτυο.
 * Τα δεδομένα καιρού/ποιότητας αέρα ΔΕΝ αποθηκεύονται ποτέ: πάντα από το δίκτυο.
 * Αν αλλάξεις αρχεία, ανέβασε το CACHE σε νέα έκδοση (v2, v3, ...).
 */
var CACHE = "airguard-v2";
var SHELL = [
  "./", "./index.html", "./core.js", "./airports.js", "./app.js",
  "./manifest.json", "./icon-192.png", "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () {
    return self.skipWaiting();
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // τα API περνούν πάντα από το δίκτυο
  if (url.hostname.indexOf("open-meteo.com") !== -1) return;
  if (url.hostname.indexOf("komoot.io") !== -1) return;
  if (url.hostname.indexOf("openstreetmap.org") !== -1) return;
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return res;
    }).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
