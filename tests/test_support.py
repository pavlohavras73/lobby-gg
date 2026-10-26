"""Саппорт: валидация, лимиты, доступ только для root, смена статуса, текст хранится как есть (экранирует клиент).
База — временная, прод-пути не трогаются."""
import os
import shutil
import sys
import tempfile
from unittest.mock import patch

import fastapi.staticfiles
import pytest
from fastapi.testclient import TestClient

_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(
    fastapi.staticfiles.StaticFiles,
    "__init__",
    lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False}),
):
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    import server  # noqa: E402
import support  # noqa: E402


@pytest.fixture()
def client():
    tmp = tempfile.mkdtemp(prefix="lobby_support_test_")
    with patch.object(server, "AUTH_DB", os.path.join(tmp, "users.db")), \
         patch.object(server, "AUTH_SECRET_PATH", os.path.join(tmp, "auth_secret.txt")), \
         patch.object(server, "_AUTH_SECRET", None), \
         patch.object(server, "_auth_db_initialized", False), \
         patch.object(support, "_support_db_initialized", False):
        if hasattr(support, "AUTH_DB"):
            support.AUTH_DB = server.AUTH_DB
        db = server._auth_db()
        for name, role in (("boss", "root"), ("alice", "user")):
            salt = "00" * 16
            db.execute("INSERT INTO users (username, salt, pwhash, role) VALUES (?, ?, ?, ?)",
                       (name, salt, server._hash_pw("secret123", salt), role))
        db.commit()
        yield TestClient(server.app, base_url="https://testserver")
    shutil.rmtree(tmp, ignore_errors=True)


def login(c, name):
    c.cookies.set("jsession", server._make_session(name, "root" if name == "boss" else "user"))


def send(c, msg="Кнопка «Старт» не работает на iPhone", **kw):
    return c.post("/api/support", json={"category": kw.get("category", "Bug"), "message": msg,
                                        "contact": kw.get("contact", "@tg"), "page": "index", "lang": "de"})


def test_validation(client):
    assert send(client).json()["ok"] is True
    assert send(client, "a").json()["ok"] is False                       # слишком коротко
    assert send(client, "x" * 2001).json()["ok"] is False                # слишком длинно
    assert send(client, category="Hack").json()["ok"] is False           # чужая категория


def test_guest_rate_limit(client):
    results = [send(client, f"guest report number {i}").json()["ok"] for i in range(5)]
    assert results[:3] == [True, True, True] and results[3] is False     # 3 в час с одного IP


def test_user_rate_limit(client):
    login(client, "alice")
    results = [send(client, f"user report number {i}").json()["ok"] for i in range(7)]
    assert results.count(True) == 5                                      # 5 в час на аккаунт


def test_only_root_reads_and_updates(client):
    tid = send(client, "<img src=x onerror=alert(1)> broken").json()["id"]
    assert client.get("/api/support/tickets").status_code == 403         # гость
    login(client, "alice")
    assert client.get("/api/support/tickets").status_code == 403         # обычный пользователь
    assert client.post(f"/api/support/tickets/{tid}", json={"status": "done"}).status_code == 403
    login(client, "boss")
    data = client.get("/api/support/tickets").json()
    assert data["unread"] == 1
    t = next(x for x in data["tickets"] if x["id"] == tid)
    assert t["message"] == "<img src=x onerror=alert(1)> broken"         # хранится как есть, экранирует клиент
    assert client.post(f"/api/support/tickets/{tid}", json={"status": "done", "admin_note": "fixed"}).status_code == 200
    assert client.get("/api/support/unread").json()["count"] == 0
