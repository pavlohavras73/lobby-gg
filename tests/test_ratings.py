"""Модульные тесты ELO-рейтингов, схемы БД, ничьих и всех 8 дуэльных хуков."""
import asyncio
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

import fastapi.staticfiles

_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(
    fastapi.staticfiles.StaticFiles,
    "__init__",
    lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False}),
):
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    import server  # noqa: E402


class RatingsUnitTests(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp(prefix="lobby_elo_test_")
        server.AUTH_DB = os.path.join(self.tmp_dir, "users.db")
        server.AUTH_SECRET_PATH = os.path.join(self.tmp_dir, "auth_secret.txt")
        server.USAGE_LOG = os.path.join(self.tmp_dir, "usage.jsonl")
        server._AUTH_SECRET = None
        server._auth_db_initialized = False
        server._social_db_initialized = False

    def tearDown(self):
        shutil.rmtree(self.tmp_dir, ignore_errors=True)

    def test_schema_columns_match_spec(self):
        con = server._auth_db()
        try:
            r_cols = [row[1] for row in con.execute("PRAGMA table_info(ratings)")]
            h_cols = [row[1] for row in con.execute("PRAGMA table_info(rating_history)")]
        finally:
            con.close()
        self.assertEqual(r_cols, ["username", "game", "elo", "wins", "losses", "draws", "games", "updated_at"])
        self.assertEqual(h_cols, ["id", "game", "winner", "loser", "draw", "elo_before_w", "elo_before_l", "ts"])

    def test_all_eight_duels_win_draw_and_audit(self):
        for game, (state_key, pids_key) in server._DUEL_STATE_SPEC.items():
            room = {
                "code": "TEST",
                "game": game,
                "state": "playing",
                "players": {
                    "p1": {"name": "Alice", "user": "alice"},
                    "p2": {"name": "Bob", "user": "bob"},
                },
                state_key: {pids_key: ["p1", "p2"]},
            }
            # 1) Победа p1: 1000 -> 1016, 1000 -> 984
            self.assertTrue(server.record_duel_result(room, "p1"), f"{game}: first win should record")
            # Повторный вызов на той же партии игнорируется
            self.assertFalse(server.record_duel_result(room, "p1"), f"{game}: duplicate must be ignored")

            # 2) Новая партия («Ещё раз») заканчивается ничьей (None)
            room[state_key] = {pids_key: ["p1", "p2"]}
            self.assertTrue(server.record_duel_result(room, None), f"{game}: draw should record")

            con = server._auth_db()
            try:
                ra = con.execute(
                    "SELECT elo, wins, losses, draws, games FROM ratings WHERE username='alice' AND game=?",
                    (game,),
                ).fetchone()
                rb = con.execute(
                    "SELECT elo, wins, losses, draws, games FROM ratings WHERE username='bob' AND game=?",
                    (game,),
                ).fetchone()
                hist = con.execute(
                    "SELECT winner, loser, draw, elo_before_w, elo_before_l FROM rating_history WHERE game=? ORDER BY id",
                    (game,),
                ).fetchall()
            finally:
                con.close()

            # После 1016 vs 984 ничья слегка сдвигает обоих к 1000, сумма сохраняется 2000
            self.assertAlmostEqual(ra[0] + rb[0], 2000.0, places=6)
            self.assertLess(ra[0], 1016.0)
            self.assertGreater(ra[0], 1000.0)
            self.assertEqual((ra[1], ra[2], ra[3], ra[4]), (1, 0, 1, 2))
            self.assertEqual((rb[1], rb[2], rb[3], rb[4]), (0, 1, 1, 2))
            self.assertEqual(len(hist), 2)
            self.assertEqual(hist[0], ("alice", "bob", 0, 1000.0, 1000.0))
            self.assertEqual(hist[1][2], 1)
            self.assertAlmostEqual(hist[1][3], 1016.0, places=6)
            self.assertAlmostEqual(hist[1][4], 984.0, places=6)

    def test_quoridor_three_players_ignored(self):
        room = {
            "code": "Q3P0",
            "game": "quoridor",
            "state": "playing",
            "players": {
                "p1": {"name": "A", "user": "alice"},
                "p2": {"name": "B", "user": "bob"},
                "p3": {"name": "C", "user": "carol"},
            },
            "quoridor": {"player_order": ["p1", "p2", "p3"]},
        }
        self.assertFalse(server.record_duel_result(room, "p1"))

    def test_leaderboard_joins_profile_avatar_and_display_name(self):
        con = server._social_db()
        try:
            con.execute(
                "INSERT INTO profiles(username, display_name, avatar, color, sound, updated_at) VALUES(?,?,?,?,?,?)",
                ("alice", "Алиса Про", "🦊", "#3b82f6", 1, "2026-10-25T00:00:00Z"),
            )
            con.commit()
        finally:
            con.close()

        room = {
            "code": "CH01",
            "game": "chess",
            "state": "playing",
            "players": {
                "w": {"name": "Алиса", "user": "alice"},
                "b": {"name": "Боб", "user": "bob"},
            },
            "chess": {"order": ["w", "b"]},
        }
        self.assertTrue(server.record_duel_result(room, "w"))

        class DummyReq:
            headers = {"accept": "application/json"}
            query_params = {"game": "chess"}
            cookies = {}

        resp = asyncio.run(server.get_leaderboard(DummyReq(), game="chess", limit=10))
        payload = json.loads(resp.body.decode("utf-8"))
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["leaderboard"]), 2)
        first = payload["leaderboard"][0]
        self.assertEqual(first["username"], "alice")
        self.assertEqual(first["display_name"], "Алиса Про")
        self.assertEqual(first["avatar"], "🦊")
        self.assertEqual(first["color"], "#3b82f6")
        self.assertEqual(first["elo"], 1016.0)
        self.assertEqual(first["rank"], 1)


if __name__ == "__main__":
    unittest.main()
