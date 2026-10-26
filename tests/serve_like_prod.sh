#!/usr/bin/env bash
# Копия сервера как на проде: адреса с префиксом /games (как Caddy handle_path). Порт: $1 (по умолчанию 18098).
# Подключать через source — сервер гасится при выходе из шелла; выставляет LOBBY_BASE.
PORT="${1:-18098}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
T="$(mktemp -d)"; mkdir -p "$T/data"
cp -r "$ROOT"/*.py "$ROOT/static" "$ROOT/tests/caddy_like.py" "$T/"
sed -i "s#/app/static#$T/static#g; s#\"/data/#\"$T/data/#g; s#'/data/#'$T/data/#g" "$T"/*.py
(cd "$T" && exec uv run -q --offline --python 3.11 --with fastapi==0.141.1 --with 'uvicorn[standard]==0.53.0' --with websockets \
   uvicorn caddy_like:app --host 127.0.0.1 --port "$PORT" > "$T/server.log" 2>&1) &
SRV=$!
trap 'pkill -P $SRV 2>/dev/null || true; kill $SRV 2>/dev/null || true; rm -rf "$T"' EXIT
export NO_PROXY=127.0.0.1 LOBBY_BASE="http://127.0.0.1:$PORT/games"
for i in $(seq 1 60); do curl -s -o /dev/null "$LOBBY_BASE/login" && break; sleep 1; done
