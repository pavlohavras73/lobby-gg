"""Шпион: вернувшийся игрок получает свою карту и остаток таймера; когда кто-то отвалился, остальных не кидает в лобби."""
import asyncio
import sys
import time
from pathlib import Path
from unittest.mock import patch

import fastapi.staticfiles

ROOT = Path(__file__).resolve().parent.parent
_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(fastapi.staticfiles.StaticFiles, "__init__",
                  lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False})):
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402


class WS:
    def __init__(self):
        self.sent = []

    async def send_json(self, m):
        self.sent.append(m)


def run(c):
    return asyncio.new_event_loop().run_until_complete(c)


def started_room():
    room = {"code": "TEST", "host": "a", "state": "lobby", "game": "spy",
            "players": {k: {"name": k.upper(), "ws": WS(), "role": None, "alive": True} for k in "abc"}}
    run(server.start_spy(room, 5))
    return room


def test_rejoin_gets_own_role_and_remaining_timer():
    room = started_room()
    room["spy_ends"] = time.time() + 120
    a = room["players"]["a"]
    a["ws"] = WS()
    run(server.resync_game(room, "a"))
    assert [m["type"] for m in a["ws"].sent] == ["role"]
    m = a["ws"].sent[0]
    assert m["spy"] == a["role"]["spy"] and 110 <= m["timer"] <= 120
    assert all(not p["ws"].sent or p["ws"].sent[-1]["type"] != "lobby" for p in room["players"].values())


def test_drop_does_not_send_lobby_to_others():
    room = started_room()
    for p in room["players"].values():
        p["ws"].sent.clear()
    room["players"]["a"]["ws"] = None
    run(server.resync_game(room))
    assert room["players"]["b"]["ws"].sent == [] and room["players"]["c"]["ws"].sent == []


def test_no_timer_game_stays_untimed():
    room = {"code": "T2", "host": "a", "state": "lobby", "game": "spy",
            "players": {k: {"name": k, "ws": WS(), "role": None, "alive": True} for k in "abc"}}
    run(server.start_spy(room, 0))
    b = room["players"]["b"]
    b["ws"] = WS()
    run(server.resync_game(room, "b"))
    assert b["ws"].sent[0]["timer"] == 0
