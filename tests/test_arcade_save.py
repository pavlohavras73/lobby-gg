import sys
from pathlib import Path
from unittest.mock import patch

import fastapi.staticfiles
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(
    fastapi.staticfiles.StaticFiles,
    "__init__",
    lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False}),
):
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402
import arcade_save  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "users.db"
    secret_file = tmp_path / "auth_secret.txt"
    monkeypatch.setattr(server, "AUTH_DB", str(db_file))
    monkeypatch.setattr(server, "AUTH_SECRET_PATH", str(secret_file))
    monkeypatch.setattr(server, "_AUTH_SECRET", None)
    monkeypatch.setattr(server, "_auth_db_initialized", False)
    monkeypatch.setattr(arcade_save, "_arcade_db_initialized", False)
    monkeypatch.setattr(server, "_RL", {})
    with arcade_save._rl_lock:
        arcade_save._WRITE_LOG.clear()
    return TestClient(server.app, base_url="https://testserver")


def _login(client: TestClient, username: str = "pilot1") -> None:
    r = client.post("/auth/register", json={"username": username, "password": "password123"})
    assert r.status_code == 200, r.text
    tok = r.cookies.get("jsession") or server._make_session(username, "member")
    client.cookies.set("jsession", tok)


def test_unauth_returns_401(client):
    assert client.get("/api/arcade/save/shuttle").status_code == 401
    assert client.put("/api/arcade/save/shuttle", json={"best_score": 100}).status_code == 401


def test_invalid_game_returns_400(client):
    _login(client, "badgameuser")
    assert client.get("/api/arcade/save/unknown_game").status_code == 400
    assert client.put("/api/arcade/save/../etc", json={"a": 1}).status_code in (400, 404)
    assert client.put("/api/arcade/save/tetris", json={"a": 1}).status_code == 400


def test_save_too_large_returns_413(client):
    _login(client, "bigsaveuser")
    huge = {"blob": "x" * (33 * 1024)}
    r = client.put("/api/arcade/save/shuttle", json=huge)
    assert r.status_code == 413


def test_save_read_isolation_and_leaderboard(client):
    _login(client, "pilot_a")
    assert client.get("/api/arcade/save/shuttle").json()["data"] is None

    payload = {
        "dust": 250,
        "best_score": 4200,
        "max_galaxy": 1,
        "max_sector": 7,
        "stars": {"1-1": 3, "1-2": 2},
        "ships": ["spark", "bastion"],
    }
    r = client.put("/api/arcade/save/shuttle", json=payload)
    assert r.status_code == 200 and r.json()["ok"] is True

    got = client.get("/api/arcade/save/shuttle").json()
    assert got["data"]["dust"] == 250
    assert got["data"]["stars"]["1-1"] == 3

    # Другой пользователь не видит чужое сохранение
    c2 = TestClient(server.app, base_url="https://testserver")
    _login(c2, "pilot_b")
    assert c2.get("/api/arcade/save/shuttle").json()["data"] is None
    assert c2.put("/api/arcade/save/shuttle", json={"best_score": 9100, "max_galaxy": 1, "max_sector": 10}).status_code == 200

    lb = client.get("/api/arcade/leaderboard/shuttle").json()["entries"]
    assert len(lb) == 2
    assert lb[0]["username"] == "pilot_b" and lb[0]["best_score"] == 9100
    assert lb[1]["username"] == "pilot_a" and lb[1]["max_sector"] == 7


def test_huge_numbers_do_not_crash_and_are_clamped(client):
    _login(client, "pilot_big")
    r = client.put("/api/arcade/save/shuttle", json={"best_score": 10**30, "max_galaxy": 10**25, "max_sector": -5})
    assert r.status_code == 200, r.text
    top = client.get("/api/arcade/leaderboard/shuttle").json()["entries"][0]
    assert top["best_score"] == 10**12 and top["max_galaxy"] == 99 and top["max_sector"] == 1


def test_declared_huge_body_rejected_before_reading(client):
    _login(client, "pilot_cl")
    r = client.put("/api/arcade/save/shuttle", content=b"{}", headers={"Content-Type": "application/json", "Content-Length": str(10**9)})
    assert r.status_code == 413
