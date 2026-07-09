/* DayLedger service worker — offline shell for the installed PWA.
   Network-first for same-origin (fresh app updates), cache fallback offline.
   Cross-origin GETs (Google Fonts, Firebase SDK) are cached after first use
   so the installed app keeps working with no connection. */
const CACHE = "dayledger-v1";
const CORE = ["./timetable.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const sameOrigin = new URL(req.url).origin === location.origin;
  if (sameOrigin || /gstatic\.com|googleapis\.com/.test(req.url)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: sameOrigin }).then(hit =>
          hit || (req.mode === "navigate" ? caches.match("./timetable.html") : Response.error())
        )
      )
    );
  }
});
