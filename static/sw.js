/* Lobby.gg service worker (scope /games/).
 * Только то, что нужно для установки как приложения и для мгновенной загрузки:
 * - статика /games/static/* — stale-while-revalidate (иконки, css, js);
 * - страницы — всегда из сети; без сети — офлайн-заглушка;
 * - API, WebSocket, вход/выход — не трогаем вообще.
 */
const CACHE = "lobby-static-v21";  // v21: stage 12c sfx volume leveling, shell sound & vibration toggle
const OFFLINE = "/games/static/offline.html";

const PRECACHE = [
  OFFLINE,
  "/games/static/theme.css",
  "/games/static/game-ui.css",
  "/games/static/shell.css",
  "/games/static/shell.js",
  "/games/static/ui.js",
  "/games/static/sfx.js",
  "/games/static/arcade_fx.js",
  "/games/static/rejoin.js",
  "/games/static/reconnect.js",
  "/games/static/invite.js",
  "/games/static/room_chat.js",
  "/games/static/i18n_common.js",
  "/games/static/favicon.svg",
  "/games/static/icons/icon-192.png",
  "/games/static/icons/icon-512.png",
  "/games/static/manifest.json",
  "/games/static/race/engine.js",
  "/games/static/shuttle/data.js",
  "/games/static/shuttle/save.js",
  "/games/static/shuttle/sprites.js",
  "/games/static/shuttle/engine.js",
  "/games/static/raskol/data.js",
  "/games/static/raskol/sprites.js",
  "/games/static/raskol/input.js",
  "/games/static/raskol/save.js",
  "/games/static/raskol/classes.js",
  "/games/static/raskol/engine.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/games/")) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith("/games/static/")) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => { if (res.ok) cache.put(req, res.clone()); return res; })
          .catch(() => cached);
        return cached || fresh;
      })
    );
  }
});
