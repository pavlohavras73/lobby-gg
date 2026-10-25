#!/usr/bin/env bash
# Поднимает копию сервера (tests/start_server.sh) и прогоняет tests/ws_smoke.py. Нужен uv (https://docs.astral.sh/uv/).
set -u
source "$(dirname "$0")/start_server.sh"
uv run -q $UVF --python 3.11 --with websockets python "$ROOT/tests/ws_smoke.py"; rc=$?
echo "--- исключения сервера (одно uno_play ожидаемо — тест шлёт мусор специально):"
grep -E "ws action" "$T/server.log" | sort | uniq -c
exit $rc
