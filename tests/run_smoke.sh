#!/usr/bin/env bash
# Поднимает копию сервера во временной папке (пути /app/static и /data подменяются на временные)
# на 127.0.0.1:18090 и прогоняет tests/ws_smoke.py. Нужен uv (https://docs.astral.sh/uv/).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'kill $SRV 2>/dev/null; rm -rf "$T"' EXIT
mkdir -p "$T/data"
cp -r "$ROOT"/*.py "$ROOT/static" "$T/"
sed -i "s#/app/static#$T/static#g; s#\"/data/#\"$T/data/#g; s#'/data/#'$T/data/#g" "$T"/*.py
UVF="${UV_OFFLINE:+--offline}"
(cd "$T" && uv run -q $UVF --python 3.11 --with fastapi==0.141.1 --with 'uvicorn[standard]==0.53.0' --with websockets \
   uvicorn server:app --host 127.0.0.1 --port 18090 > "$T/server.log" 2>&1) &
SRV=$!
for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:18090/auth/check && break; sleep 1; done
uv run -q $UVF --python 3.11 --with websockets python "$ROOT/tests/ws_smoke.py"; rc=$?
echo "--- исключения сервера (одно uno_play ожидаемо — тест шлёт мусор специально):"
grep -E "ws action" "$T/server.log" | sort | uniq -c
exit $rc
