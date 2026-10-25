#!/usr/bin/env bash
# Поднимает копию сервера во временной папке (пути /app/static и /data подменяются на временные)
# на 127.0.0.1:$LOBBY_PORT (по умолчанию 18090). Подключать через source — сервер гасится при выходе из шелла.
# Нужен uv (https://docs.astral.sh/uv/).
export NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${LOBBY_PORT:-18090}"   # другой порт для параллельных агентов: LOBBY_PORT=18091 ...
export LOBBY_BASE="http://127.0.0.1:$PORT" LOBBY_WS="ws://127.0.0.1:$PORT/ws"
T="$(mktemp -d)"
export LOBBY_SERVER_LOG="$T/server.log"
export QUICKPLAY_TIMEOUT="${QUICKPLAY_TIMEOUT:-1.5}"
trap 'pkill -P ${SRV:-0} 2>/dev/null; kill ${SRV:-0} 2>/dev/null; wait ${SRV:-0} 2>/dev/null; rm -rf "$T"' EXIT
mkdir -p "$T/data"
cp -r "$ROOT"/*.py "$ROOT/static" "$T/"
sed -i "s#/app/static#$T/static#g; s#\"/data/#\"$T/data/#g; s#'/data/#'$T/data/#g" "$T"/*.py
UVF="${UV_OFFLINE:+--offline}"
export LOBBY_RECONNECT_GRACE="${LOBBY_RECONNECT_GRACE:-3}"   # в тестах лобби ждёт 3 с вместо 60
(cd "$T" && exec uv run -q $UVF --python 3.11 --with fastapi==0.141.1 --with 'uvicorn[standard]==0.53.0' --with websockets \
   uvicorn server:app --host 127.0.0.1 --port $PORT > "$T/server.log" 2>&1) &
SRV=$!
for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:$PORT/auth/check && break; sleep 1; done
