import json
import os
import struct
import sys
import time
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
import geostake  # noqa: E402


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "users.db"
    secret_file = tmp_path / "auth_secret.txt"
    monkeypatch.setattr(server, "AUTH_DB", str(db_file))
    monkeypatch.setattr(server, "AUTH_SECRET_PATH", str(secret_file))
    monkeypatch.setattr(server, "_AUTH_SECRET", None)
    monkeypatch.setattr(server, "_auth_db_initialized", False)
    monkeypatch.setattr(geostake, "_geo_db_initialized", False)
    monkeypatch.setattr(server, "_RL", {})   # лимит регистраций (5/час на IP) — свой на каждый тест
    monkeypatch.setenv("GEO_POOL", str(ROOT / "tests" / "fixtures" / "geo_pool_test.json"))
    monkeypatch.delenv("GEO_GOOGLE_KEY", raising=False)
    monkeypatch.delenv("GEO_GOOGLE_DAILY_CAP", raising=False)
    monkeypatch.delenv("MAPILLARY_TOKEN", raising=False)          # тесты не должны брать настоящий ~/.mapillary_token
    monkeypatch.setenv("MAPILLARY_TOKEN_FILE", str(tmp_path / "no_token"))
    geostake._MAPILLARY_URL_CACHE.clear()
    geostake._MAPILLARY_HD_URL_CACHE.clear()
    with geostake._state_lock:
        geostake._GAMES.clear()
        geostake._ROUNDS.clear()
        geostake._IMG_CACHE.clear()
    return TestClient(server.app, base_url="https://testserver")


def _register_and_login(client: TestClient, username: str = "geouser") -> None:
    r = client.post("/auth/register", json={"username": username, "password": "password123"})
    assert r.status_code == 200, r.text
    tok = r.cookies.get("jsession") or server._make_session(username, "member")
    client.cookies.set("jsession", tok)


def test_google_guard_disabled_by_default(client, monkeypatch):
    assert geostake.google_allowed() is False
    assert geostake.consume_google_quota() is False
    usage = geostake.get_google_usage_today()
    assert usage["enabled"] is False
    assert usage["used"] == 0
    assert usage["cap"] == 0


def test_google_guard_key_set_but_zero_cap(client, monkeypatch):
    monkeypatch.setenv("GEO_GOOGLE_KEY", "AIzaFakeKey123")
    monkeypatch.setenv("GEO_GOOGLE_DAILY_CAP", "0")
    assert geostake.google_allowed() is False
    assert geostake.consume_google_quota() is False
    usage = geostake.get_google_usage_today()
    assert usage["enabled"] is False
    assert usage["used"] == 0


def test_google_guard_enforces_daily_cap(client, monkeypatch):
    monkeypatch.setenv("GEO_GOOGLE_KEY", "AIzaFakeKey123")
    monkeypatch.setenv("GEO_GOOGLE_DAILY_CAP", "2")
    assert geostake.google_allowed() is True
    assert geostake.consume_google_quota() is True
    assert geostake.consume_google_quota() is True
    assert geostake.google_allowed() is False
    assert geostake.consume_google_quota() is False
    usage = geostake.get_google_usage_today()
    assert usage["enabled"] is True
    assert usage["used"] == 2
    assert usage["cap"] == 2


def test_wallet_start_daily_and_rescue_bonuses(client):
    _register_and_login(client, "alice")
    r = client.get("/api/geo/wallet")
    assert r.status_code == 200
    assert r.json()["coins"] == 1000

    # Drop coins to 500 -> daily bonus +100 once per UTC day
    con = geostake._geo_db()
    con.execute("UPDATE geo_wallet SET coins = 500, last_daily = NULL WHERE username = 'alice'")
    con.commit()
    con.close()

    r2 = client.get("/api/geo/wallet")
    assert r2.json()["coins"] == 600
    assert r2.json()["bonus_given"] == 100

    # Calling again on the same day does NOT grant another daily bonus
    r3 = client.get("/api/geo/wallet")
    assert r3.json()["coins"] == 600
    assert r3.json()["bonus_given"] == 0

    # Drop coins to 0 -> rescue bonus +200 once per UTC day
    con = geostake._geo_db()
    con.execute("UPDATE geo_wallet SET coins = 0, last_rescue = NULL WHERE username = 'alice'")
    con.commit()
    con.close()

    r4 = client.get("/api/geo/wallet")
    assert r4.json()["coins"] == 200
    assert r4.json()["bonus_given"] == 200


def test_multiplier_tiers():
    assert geostake.calc_multiplier(0.2) == 5.0
    assert geostake.calc_multiplier(10.0) == 3.0
    assert geostake.calc_multiplier(100.0) == 2.0
    assert geostake.calc_multiplier(500.0) == 1.0
    assert geostake.calc_multiplier(1500.0) == 0.5
    assert geostake.calc_multiplier(3000.0) == 0.0


def test_strip_jpeg_exif_removes_app1():
    pano = (ROOT / "tests" / "fixtures" / "geo_test_pano.jpg").read_bytes()
    assert pano[:2] == b"\xff\xd8"
    payload = b"Exif\x00\x00SECRET_GPS_LAT_48_85"
    app1 = b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload
    with_exif = b"\xff\xd8" + app1 + pano[2:]
    assert b"SECRET_GPS_LAT_48_85" in with_exif
    stripped = geostake.strip_jpeg_exif(with_exif)
    assert stripped[:2] == b"\xff\xd8"
    assert b"SECRET_GPS_LAT_48_85" not in stripped
    assert b"\xff\xe1" not in stripped[:64]


def test_full_round_proxy_single_guess_and_isolation(client, monkeypatch):
    _register_and_login(client, "bob")

    # Start game
    s = client.post("/api/geo/start")
    assert s.status_code == 200
    game_id = s.json()["game_id"]

    # Bet validation: too small & more than balance
    assert client.post("/api/geo/round", json={"game_id": game_id, "bet": 5}).status_code == 400
    assert client.post("/api/geo/round", json={"game_id": game_id, "bet": 99999}).status_code == 400

    # Start round 1 with bet=100
    rd = client.post("/api/geo/round", json={"game_id": game_id, "bet": 100})
    assert rd.status_code == 200
    rj = rd.json()
    assert rj["coins"] == 900
    assert "lat" not in rj and "lng" not in rj and "author" not in rj
    round_id = rj["round_id"]

    # Inject fake EXIF into fixture fetch to verify proxy strips it
    orig_bytes = (ROOT / "tests" / "fixtures" / "geo_test_pano.jpg").read_bytes()
    exif_payload = b"Exif\x00\x00GPS_LEAK_TEST"
    fake_with_exif = b"\xff\xd8\xff\xe1" + struct.pack(">H", len(exif_payload) + 2) + exif_payload + orig_bytes[2:]
    monkeypatch.setattr(geostake, "_fetch_panorama_bytes", lambda loc: geostake.strip_jpeg_exif(fake_with_exif))

    img_resp = client.get(f"/api/geo/img/{round_id}")
    assert img_resp.status_code == 200
    assert img_resp.headers["content-type"] == "image/jpeg"
    assert img_resp.content[:2] == b"\xff\xd8"
    assert b"GPS_LEAK_TEST" not in img_resp.content

    # Another user cannot read bob's image or guess bob's round
    c2 = TestClient(server.app, base_url="https://testserver")
    _register_and_login(c2, "eve")
    assert c2.get(f"/api/geo/img/{round_id}").status_code == 404
    assert c2.post("/api/geo/guess", json={"round_id": round_id, "lat": 0.0, "lng": 0.0}).status_code == 404

    # Exact guess on bob's round -> 5x payout
    ans_lat = geostake._ROUNDS[round_id]["loc"]["lat"]
    ans_lng = geostake._ROUNDS[round_id]["loc"]["lng"]
    g1 = client.post("/api/geo/guess", json={"round_id": round_id, "lat": ans_lat, "lng": ans_lng})
    assert g1.status_code == 200
    gj = g1.json()
    assert gj["distance_km"] == 0.0
    assert gj["multiplier"] == 5.0
    assert gj["payout"] == 500
    assert gj["coins"] == 1400
    assert gj["attribution"]["author"]

    # Second guess on same round -> 409 conflict
    g2 = client.post("/api/geo/guess", json={"round_id": round_id, "lat": ans_lat, "lng": ans_lng})
    assert g2.status_code == 409


def test_round_timeout_returns_zero_payout_and_5_rounds_leaderboard(client):
    _register_and_login(client, "charlie")
    game_id = client.post("/api/geo/start").json()["game_id"]

    # Round 1: expired timeout
    rd1 = client.post("/api/geo/round", json={"game_id": game_id, "bet": 100}).json()
    geostake._ROUNDS[rd1["round_id"]]["expires_at"] = time.time() - 5
    g1 = client.post("/api/geo/guess", json={"round_id": rd1["round_id"], "lat": 0.0, "lng": 0.0}).json()
    assert g1["timed_out"] is True
    assert g1["multiplier"] == 0.0
    assert g1["payout"] == 0
    assert g1["game_over"] is False

    # Rounds 2..5
    for _ in range(4):
        rd = client.post("/api/geo/round", json={"game_id": game_id, "bet": 50}).json()
        loc = geostake._ROUNDS[rd["round_id"]]["loc"]
        res = client.post("/api/geo/guess", json={"round_id": rd["round_id"], "lat": loc["lat"], "lng": loc["lng"]}).json()

    assert res["game_over"] is True
    assert res["game_summary"]["total_bet"] == 300
    assert res["game_summary"]["total_won"] == 1000

    lb = client.get("/api/geo/leaderboard").json()
    assert any(row["username"] == "charlie" for row in lb["top_coins"])
    assert any(row["username"] == "charlie" for row in lb["top_best"])


def test_real_pool_ships_next_to_code(monkeypatch):
    """На проде пул лежит рядом с server.py (/app/geo_pool.json), а не в /data."""
    from collections import Counter

    monkeypatch.delenv("GEO_POOL", raising=False)
    monkeypatch.setattr(geostake, "_POOL_CACHE", None)
    pool_path = ROOT / "geo_pool.json"
    assert pool_path.is_file()
    assert pool_path.stat().st_size <= 3 * 1024 * 1024, "geo_pool.json exceeds 3 MB"

    pool = geostake.load_geo_pool()
    assert len(pool) >= 3000
    assert all(
        p.get("lat") is not None
        and p.get("lng") is not None
        and (p.get("img_url") or (p.get("source") == "mapillary" and p.get("id")))
        for p in pool
    )
    countries = [str(p.get("country") or "").upper() for p in pool]
    assert all(len(c) == 2 and c.isalpha() for c in countries)
    assert "UK" not in countries, "ISO-3166: Великобритания — GB"
    counts = Counter(countries)
    assert len(counts) >= 100, f"too few countries: {len(counts)}"
    max_share = max(counts.values()) / len(pool)
    assert max_share <= 0.03, f"country share too high: {max_share:.3f} ({counts.most_common(3)})"
    seqs = [str(p["sequence"]) for p in pool if p.get("sequence")]
    assert len(seqs) == len(set(seqs)), "duplicate sequences in geo_pool.json"


def test_five_round_game_never_repeats_countries(client):
    _register_and_login(client, "countryuser")
    r = client.post("/api/geo/start")
    assert r.status_code == 200, r.text
    game_id = r.json()["game_id"]

    seen_countries = []
    for round_idx in range(1, 6):
        rr = client.post("/api/geo/round", json={"game_id": game_id, "bet": 10})
        assert rr.status_code == 200, f"round {round_idx}: {rr.text}"
        round_id = rr.json()["round_id"]
        gr = client.post("/api/geo/guess", json={"round_id": round_id, "lat": 48.85, "lng": 2.35})
        assert gr.status_code == 200, f"guess {round_idx}: {gr.text}"
        with geostake._state_lock:
            rnd = geostake._ROUNDS[round_id]
            seen_countries.append(geostake._loc_country(rnd["loc"]))

    assert len(seen_countries) == 5
    assert len(set(seen_countries)) == 5, f"repeated countries in 5 rounds: {seen_countries}"


def test_gc_drops_stale_rounds_games_and_images(client):
    _register_and_login(client, "gcuser")
    gid = client.post("/api/geo/start").json()["game_id"]
    rid = client.post("/api/geo/round", json={"game_id": gid, "bet": 10}).json()["round_id"]
    assert client.get(f"/api/geo/img/{rid}").status_code == 200
    assert rid in geostake._IMG_CACHE
    with geostake._state_lock:
        geostake._ROUNDS[rid]["expires_at"] = time.time() - 700
        geostake._GAMES[gid]["created_at"] = time.time() - geostake.GAME_TTL_SEC - 1
    geostake._gc_state(force=True)
    assert rid not in geostake._ROUNDS
    assert gid not in geostake._GAMES
    assert rid not in geostake._IMG_CACHE


def test_image_cache_is_bounded(client, monkeypatch):
    monkeypatch.setattr(geostake, "IMG_CACHE_MAX", 3)
    _register_and_login(client, "cacheuser")
    for _ in range(5):
        gid = client.post("/api/geo/start").json()["game_id"]
        rid = client.post("/api/geo/round", json={"game_id": gid, "bet": 10}).json()["round_id"]
        assert client.get(f"/api/geo/img/{rid}").status_code == 200
    assert len(geostake._IMG_CACHE) <= 3


def test_empty_pool_does_not_take_coins(client, monkeypatch, tmp_path):
    empty = tmp_path / "empty.json"
    empty.write_text("[]")
    monkeypatch.setenv("GEO_POOL", str(empty))
    monkeypatch.setattr(geostake, "_pool_candidates", lambda: [empty])
    _register_and_login(client, "emptyuser")
    before = client.get("/api/geo/wallet").json()["coins"]
    gid = client.post("/api/geo/start").json()["game_id"]
    r = client.post("/api/geo/round", json={"game_id": gid, "bet": 50})
    assert r.status_code == 503
    assert client.get("/api/geo/wallet").json()["coins"] == before
    # после ошибки игра не «залипает» в состоянии открытия раунда
    assert geostake._GAMES[gid].get("opening") is False


def test_mapillary_token_from_env_or_file(monkeypatch, tmp_path):
    monkeypatch.delenv("MAPILLARY_TOKEN", raising=False)
    monkeypatch.setenv("MAPILLARY_TOKEN_FILE", str(tmp_path / "missing"))
    assert geostake.mapillary_token() == ""
    p = tmp_path / "tok"
    p.write_text("MLY|file-token\n")
    monkeypatch.setenv("MAPILLARY_TOKEN_FILE", str(p))
    assert geostake.mapillary_token() == "MLY|file-token"
    monkeypatch.setenv("MAPILLARY_TOKEN", "MLY|env-token")
    assert geostake.mapillary_token() == "MLY|env-token"


def test_hd_image_not_cached_and_active_round_resumes(client):
    _register_and_login(client, "hdresumeuser")
    assert client.get("/api/geo/active").json()["active"] is None
    gid = client.post("/api/geo/start").json()["game_id"]
    rd = client.post("/api/geo/round", json={"game_id": gid, "bet": 20}).json()
    rid = rd["round_id"]

    act = client.get("/api/geo/active").json()["active"]
    assert act is not None and act["round_id"] == rid and act["bet"] == 20

    # HD не кладётся в _IMG_CACHE
    assert client.get(f"/api/geo/img/{rid}?hd=1").status_code == 200
    assert rid not in geostake._IMG_CACHE

    # SD кладётся в _IMG_CACHE
    assert client.get(f"/api/geo/img/{rid}").status_code == 200
    assert rid in geostake._IMG_CACHE

    # После guess активный раунд очищается
    assert client.post("/api/geo/guess", json={"round_id": rid, "lat": 48.85, "lng": 2.35}).status_code == 200
    assert client.get("/api/geo/active").json()["active"] is None


def test_no_mapillary_token_refuses_round_without_taking_coins(client, monkeypatch, tmp_path):
    pool = tmp_path / "mly.json"
    pool.write_text(json.dumps([{"id": "111", "source": "mapillary", "lat": 1.0, "lng": 2.0, "country": "KE",
                                 "heading": 0, "author": "a", "license": "CC-BY-SA-4.0"}]))
    monkeypatch.setattr(geostake, "_pool_candidates", lambda: [pool])
    _register_and_login(client, "notokenuser")
    before = client.get("/api/geo/wallet").json()["coins"]
    gid = client.post("/api/geo/start").json()["game_id"]
    r = client.post("/api/geo/round", json={"game_id": gid, "bet": 50})
    assert r.status_code == 503
    assert client.get("/api/geo/wallet").json()["coins"] == before


class _FakeResp:
    def __init__(self, body: bytes):
        self._b = body
    def read(self, *_a):
        return self._b
    def __enter__(self):
        return self
    def __exit__(self, *_a):
        return False


@pytest.mark.parametrize("width,expect_hd", [(4096, True), (5760, True), (12288, False), (2048, False)])
def test_mapillary_hd_only_for_reasonable_originals(client, monkeypatch, width, expect_hd):
    monkeypatch.setenv("MAPILLARY_TOKEN", "MLY|fake")
    body = json.dumps({"width": width, "thumb_2048_url": "https://x/sd.jpg", "thumb_original_url": "https://x/orig.jpg"}).encode()
    monkeypatch.setattr(geostake.urllib.request, "urlopen", lambda *a, **k: _FakeResp(body))
    loc = {"id": f"hd{width}", "source": "mapillary"}
    assert geostake._resolve_image_url(loc) == "https://x/sd.jpg"
    assert geostake._resolve_image_url(loc, hd=True) == ("https://x/orig.jpg" if expect_hd else "")
    if not expect_hd:
        assert geostake._fetch_panorama_bytes(loc, hd=True) == b""     # → 204, клиент остаётся на 2048
