# как Caddy handle_path /games*: отрезает префикс /games (для tests/serve_like_prod.sh)
import server
async def app(scope, receive, send):
    if scope["type"] in ("http", "websocket") and scope["path"].startswith("/games"):
        path = scope["path"][len("/games"):] or "/"
        scope = dict(scope, path=path, raw_path=path.encode())
    await server.app(scope, receive, send)
