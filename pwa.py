"""PWA для Lobby.gg: manifest, service worker и теги «добавить на домашний экран» на всех страницах.

Сайт живёт под /games/ (Caddy `handle_path /games*` отрезает префикс), поэтому:
- /manifest.webmanifest и /sw.js здесь — это /games/manifest.webmanifest и /games/sw.js снаружи;
- service worker обслуживает область /games/ (он лежит в её корне);
- теги в <head> вставляются в каждый HTML-ответ, чтобы не править 30+ страниц вручную.
"""
import re

from fastapi.responses import FileResponse

STATIC = "/app/static"

HEAD_TAGS = (
    '<link rel="manifest" href="/games/manifest.webmanifest">'
    '<meta name="mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-capable" content="yes">'
    # black, не black-translucent: iOS сам оставляет место под часами/вырезом, иначе верх страниц уходит под них
    '<meta name="apple-mobile-web-app-status-bar-style" content="black">'
    '<meta name="apple-mobile-web-app-title" content="Lobby.gg">'
    '<link rel="apple-touch-icon" href="/games/static/icons/apple-touch-icon.png">'
    "<script>if('serviceWorker' in navigator)addEventListener('load',function(){"
    "navigator.serviceWorker.register('/games/sw.js',{scope:'/games/'}).catch(function(){})})</script>"
    # страховка: страница никогда не шире экрана телефона, iOS не раздувает шрифт при повороте
    "<style>html{-webkit-text-size-adjust:100%;text-size-adjust:100%}html,body{max-width:100%;overflow-x:clip}</style>"
).encode()

_VIEWPORT = re.compile(rb'(<meta\s+name="viewport"\s+content=")([^"]*)(")', re.I)


def _fit_viewport(body):
    """maximum-scale=1 на всех страницах: иначе iOS увеличивает страницу при фокусе на поле ввода
    (шрифт < 16px), и её приходится двигать пальцем вправо-влево."""
    def fix(m):
        content = m.group(2)
        if b"maximum-scale" not in content:
            content += b", maximum-scale=1"
        return m.group(1) + content + m.group(3)
    return _VIEWPORT.sub(fix, body, count=1)


async def manifest():
    return FileResponse(f"{STATIC}/manifest.webmanifest", media_type="application/manifest+json")


async def service_worker():
    # без кэша, чтобы обновления SW доходили сразу; область — вся /games/
    return FileResponse(f"{STATIC}/sw.js", media_type="application/javascript",
                        headers={"Cache-Control": "no-cache", "Service-Worker-Allowed": "/games/"})


class InjectPWAHead:
    """ASGI-middleware: в text/html-ответы перед </head> вставляет HEAD_TAGS (один раз)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        start, chunks = None, []

        async def wrapped(message):
            nonlocal start
            if message["type"] == "http.response.start":
                ctype = dict(message.get("headers") or []).get(b"content-type", b"")
                if ctype.startswith(b"text/html"):
                    start = message          # придержим заголовки, пока не соберём тело
                    return
                return await send(message)
            if message["type"] == "http.response.body" and start is not None:
                chunks.append(message.get("body", b""))
                if message.get("more_body"):
                    return
                body = _fit_viewport(b"".join(chunks))
                if b'rel="manifest"' not in body:
                    i = body.lower().find(b"</head>")
                    if i != -1:
                        body = body[:i] + HEAD_TAGS + body[i:]
                headers = [(k, v) for k, v in start.get("headers", []) if k.lower() != b"content-length"]
                headers.append((b"content-length", str(len(body)).encode()))
                await send({**start, "headers": headers})
                return await send({"type": "http.response.body", "body": body, "more_body": False})
            return await send(message)

        return await self.app(scope, receive, wrapped)


def install(app):
    app.add_api_route("/manifest.webmanifest", manifest, methods=["GET"])
    app.add_api_route("/sw.js", service_worker, methods=["GET"])
    app.add_middleware(InjectPWAHead)
