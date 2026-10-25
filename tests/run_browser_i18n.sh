#!/usr/bin/env bash
set -euo pipefail
export NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
trap 'pkill -P ${SRV:-0} 2>/dev/null || true; kill ${SRV:-0} 2>/dev/null || true; wait ${SRV:-0} 2>/dev/null || true; rm -rf "$T"' EXIT
mkdir -p "$T/data"
cp -r "$ROOT"/*.py "$ROOT/static" "$T/"
sed -i "s#/app/static#$T/static#g; s#\"/data/#\"$T/data/#g; s#'/data/#'$T/data/#g" "$T"/*.py
(cd "$T" && exec uv run -q --offline --python 3.11 --with fastapi==0.141.1 --with 'uvicorn[standard]==0.53.0' --with websockets \
   uvicorn server:app --host 127.0.0.1 --port 18090 > "$T/server.log" 2>&1) &
SRV=$!
for i in $(seq 1 90); do curl -s -o /dev/null http://127.0.0.1:18090/auth/check && break; sleep 0.5; done

PAGES=("$@")
if [ ${#PAGES[@]} -eq 0 ]; then
  PAGES=(alias arrows battleship bulls bunker c4 checkers chess connect4_3d dots durak fifteen g2048 geobunker guesswho index learn mafia mines poker profile quoridor race reversi snake space_invaders spy tetris uno variants wordle)
fi

cd "$ROOT/tests"
LOBBY_BASE=http://127.0.0.1:18090 LOBBY_LANGS=uk,en,de uv run --offline --with playwright python browser_i18n.py "${PAGES[@]}"
