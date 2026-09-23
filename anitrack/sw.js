/* AniTrack service worker — offline shell for the installed PWA.
   Network-first for same-origin, so app updates and each rebuilt anitrack-cn-data.js arrive
   fresh; the cached copy is only a fallback when offline. The data file is in CORE because the
   offline roster is what keeps every tab usable without a connection.
   Cross-origin requests (AniList / Jikan / Bangumi APIs, cover images) are deliberately NOT
   intercepted: the app manages its own API caching and freshness, and caching thousands of
   covers would bloat storage on a shared origin (DayLedger and Larder live here too). */
const CACHE = "anitrack-v1";
const CORE = ["./anitrack.html", "./anitrack-cn-data.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  /* only this app's old caches — never touch DayLedger's or Larder's on the shared origin */
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("anitrack-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit || (req.mode === "navigate" ? caches.match("./anitrack.html") : Response.error())
      )
    )
  );
});
