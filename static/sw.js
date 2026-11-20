/* Lobby.gg service worker (scope /games/).
 * Только то, что нужно для установки как приложения и для мгновенной загрузки:
 * - статика /games/static/* — stale-while-revalidate (иконки, css, js);
 * - страницы — всегда из сети; без сети — офлайн-заглушка;
 * - API, WebSocket, вход/выход — не трогаем вообще.
 */
const CACHE = "lobby-static-v22";  // v22: stage 13c device vibration detection, settings drawer i18n, header 320px
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
  "/games/static/raskol/engine.js",
  "/games/static/rules/alias.js",
  "/games/static/rules/bunker.js",
  "/games/static/rules/geostake.js",
  "/games/static/rules/guesswho.js",
  "/games/static/rules/mafia.js",
  "/games/static/rules/poker.js",
  "/games/static/rules/raskol.js",
  "/games/static/rules/space_invaders.js",
  "/games/static/rules/spy.js",
  "/games/static/rules/variants.js",
  "/games/static/rules/uno.js",
  "/games/static/rules/durak.js",
  "/games/static/rules/chess.js",
  "/games/static/rules/checkers.js",
  "/games/static/rules/battleship.js",
  "/games/static/rules/reversi.js",
  "/games/static/rules/dots.js",
  "/games/static/rules/bulls.js",
  "/games/static/rules/quoridor.js",
  "/games/static/rules/connect4_3d.js",
  "/games/static/rules/race.js",
  "/games/static/rules/geobunker.js"
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
