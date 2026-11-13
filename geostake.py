"""Geo$take backend: curated 360-degree panorama pool, image proxy (no EXIF), wallet, betting, and Google Street View guard."""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import random
import secrets
import struct
import threading
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from server import _auth_db, current_user

router = APIRouter()

START_COINS = 1000
DAILY_BONUS = 100
RESCUE_BONUS = 200
ROUND_TIMEOUT_SEC = 180
ROUNDS_PER_GAME = 5
MIN_BET = 10

# Distance (km) -> payout multiplier
MULTIPLIER_TIERS = [
    (1.0, 5.0),
    (25.0, 3.0),
    (200.0, 2.0),
    (750.0, 1.0),
    (2000.0, 0.5),
]

_db_lock = threading.Lock()
_state_lock = threading.Lock()
_geo_db_initialized = False

_GAMES: dict[str, dict[str, Any]] = {}
_ROUNDS: dict[str, dict[str, Any]] = {}
_IMG_CACHE: dict[str, tuple[float, bytes]] = {}
_MAPILLARY_URL_CACHE: dict[str, tuple[float, str]] = {}
_MAPILLARY_HD_URL_CACHE: dict[str, tuple[float, str]] = {}
_POOL_CACHE: tuple[str, int, list[dict[str, Any]]] | None = None
_hd_sem: asyncio.Semaphore | None = None


def _get_hd_sem() -> asyncio.Semaphore:
    global _hd_sem
    if _hd_sem is None:
        _hd_sem = asyncio.Semaphore(2)
    return _hd_sem


def _utc_today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ensure_geo_tables(con) -> None:
    global _geo_db_initialized
    if _geo_db_initialized:
        return
    con.execute("""CREATE TABLE IF NOT EXISTS geo_wallet(
        username TEXT PRIMARY KEY,
        coins INTEGER NOT NULL DEFAULT 1000,
        best_game INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        last_daily TEXT,
        last_rescue TEXT,
        updated_at TEXT
    )""")
    con.execute("""CREATE TABLE IF NOT EXISTS geo_google_usage(
        day TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
    )""")
    con.execute("""CREATE TABLE IF NOT EXISTS geo_scores(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        total_coins_won INTEGER NOT NULL,
        total_bet INTEGER NOT NULL,
        net_profit INTEGER NOT NULL,
        best_dist_km REAL,
        created_at TEXT
    )""")
    con.commit()
    _geo_db_initialized = True


def _geo_db():
    con = _auth_db()
    _ensure_geo_tables(con)
    return con


def google_config() -> tuple[str, int]:
    """Return (GEO_GOOGLE_KEY, GEO_GOOGLE_DAILY_CAP). Disabled unless both key and cap > 0."""
    key = os.environ.get("GEO_GOOGLE_KEY", "").strip()
    try:
        cap = int(os.environ.get("GEO_GOOGLE_DAILY_CAP", "0") or 0)
    except ValueError:
        cap = 0
    if not key or cap <= 0:
        return "", 0
    return key, cap


def google_allowed(con=None) -> bool:
    """Check if Google Street View is enabled AND under today's UTC daily cap (read-only)."""
    key, cap = google_config()
    if not key or cap <= 0:
        return False
    close_after = con is None
    if con is None:
        con = _geo_db()
    try:
        today = _utc_today()
        row = con.execute("SELECT count FROM geo_google_usage WHERE day = ?", (today,)).fetchone()
        used = int(row[0]) if row else 0
        return used < cap
    finally:
        if close_after:
            con.close()


def consume_google_quota(con=None) -> bool:
    """Atomically check and increment today's UTC Google Street View counter.
    Returns False (and makes 0 increments) if key is missing, cap <= 0, or cap is reached."""
    key, cap = google_config()
    if not key or cap <= 0:
        return False
    close_after = con is None
    if con is None:
        con = _geo_db()
    try:
        today = _utc_today()
        with _db_lock:
            con.execute("INSERT OR IGNORE INTO geo_google_usage(day, count) VALUES (?, 0)", (today,))
            cur = con.execute(
                "UPDATE geo_google_usage SET count = count + 1 WHERE day = ? AND count < ?",
                (today, cap),
            )
            con.commit()
            return cur.rowcount == 1
    finally:
        if close_after:
            con.close()


def get_google_usage_today(con=None) -> dict[str, Any]:
    key, cap = google_config()
    close_after = con is None
    if con is None:
        con = _geo_db()
    try:
        today = _utc_today()
        row = con.execute("SELECT count FROM geo_google_usage WHERE day = ?", (today,)).fetchone()
        used = int(row[0]) if row else 0
        return {"enabled": bool(key and cap > 0), "day": today, "used": used, "cap": cap}
    finally:
        if close_after:
            con.close()


def _pool_candidates() -> list[Path]:
    env_path = os.environ.get("GEO_POOL", "").strip()
    base = Path(__file__).resolve().parent
    paths: list[Path] = []
    if env_path:
        paths.append(Path(env_path))
    # пул лежит рядом с кодом (/app/geo_pool.json на проде); /data/geo_pool.json — необязательная подмена без деплоя
    paths.extend([
        Path("/data/geo_pool.json"),
        base / "geo_pool.json",
        base / "tests" / "fixtures" / "geo_pool_test.json",
    ])
    return paths


def load_geo_pool() -> list[dict[str, Any]]:
    global _POOL_CACHE
    for p in _pool_candidates():
        if p.is_file():
            try:
                st = p.stat()
                key_path = str(p)
                if _POOL_CACHE and _POOL_CACHE[0] == key_path and _POOL_CACHE[1] == st.st_mtime_ns:
                    return _POOL_CACHE[2]
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, list) and data:
                    _POOL_CACHE = (key_path, st.st_mtime_ns, data)
                    return data
            except Exception as exc:
                logging.warning(f"Failed to load geo pool {p}: {exc}")
    return []


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2.0 * r * math.asin(min(1.0, math.sqrt(a)))


def calc_multiplier(distance_km: float) -> float:
    for max_km, mult in MULTIPLIER_TIERS:
        if distance_km < max_km:
            return mult
    return 0.0


def strip_jpeg_exif(data: bytes) -> bytes:
    """Remove APP1..APP15 (EXIF/XMP/IPTC) and COM markers from JPEG bytes without Pillow."""
    if len(data) < 4 or data[0:2] != b"\xff\xd8":
        return data
    out = bytearray(b"\xff\xd8")
    i = 2
    n = len(data)
    while i < n:
        if data[i] != 0xFF:
            out.extend(data[i:])
            break
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            break
        marker = data[i]
        i += 1
        if marker == 0xD9:  # EOI
            out.extend(b"\xff\xd9")
            break
        if marker == 0xDA:  # SOS -> rest is scan data until EOI
            out.extend(b"\xff\xda")
            out.extend(data[i:])
            break
        if marker == 0x00 or (0xD0 <= marker <= 0xD8):
            out.extend(bytes([0xFF, marker]))
            continue
        if i + 2 > n:
            break
        seg_len = struct.unpack(">H", data[i:i + 2])[0]
        if seg_len < 2 or i + seg_len > n:
            break
        # Strip APP1..APP15 (0xE1..0xEF) and COM (0xFE); keep APP0 (JFIF) & image tables
        if (0xE1 <= marker <= 0xEF) or marker == 0xFE:
            i += seg_len
            continue
        out.extend(bytes([0xFF, marker]))
        out.extend(data[i:i + seg_len])
        i += seg_len
    return bytes(out)


# Контейнер игр ограничен 256 МБ: брошенные игры/раунды и кэш картинок нужно чистить, иначе память растёт до перезапуска.
GAME_TTL_SEC = 2 * 3600
IMG_CACHE_MAX = 24                         # картинок в памяти (sd ≈ 0.2–2 МБ)
IMG_MAX_BYTES = 6_000_000
HD_IMG_MAX_BYTES = 15_000_000
HD_MAX_WIDTH = 6000                        # оригиналы Mapillary бывают 12288–13888 px (до ~385 МБ в распакованном виде) — телефон упадёт
_last_gc = 0.0


def _gc_state(force: bool = False) -> None:
    """Удаляет просроченные раунды, старые игры и лишние картинки. Вызывать без удержания _state_lock."""
    global _last_gc
    now = time.time()
    if not force and now - _last_gc < 30:
        return
    _last_gc = now
    with _state_lock:
        # раунд живёт ещё 10 мин после истечения: поздний ответ засчитается как таймаут, а не «раунд не найден»
        for rid in [k for k, rd in _ROUNDS.items() if rd["expires_at"] + 600 < now]:
            _ROUNDS.pop(rid, None)
        for gid in [k for k, g in _GAMES.items() if g["created_at"] + GAME_TTL_SEC < now]:
            _GAMES.pop(gid, None)
        for rid in [k for k, (exp, _b) in _IMG_CACHE.items() if exp < now or k not in _ROUNDS]:
            _IMG_CACHE.pop(rid, None)
        if len(_IMG_CACHE) > IMG_CACHE_MAX:
            for rid, _v in sorted(_IMG_CACHE.items(), key=lambda kv: kv[1][0])[: len(_IMG_CACHE) - IMG_CACHE_MAX]:
                _IMG_CACHE.pop(rid, None)
        for lid in [k for k, (exp, _u) in _MAPILLARY_URL_CACHE.items() if exp < now]:
            _MAPILLARY_URL_CACHE.pop(lid, None)
        for lid in [k for k, (exp, _u) in _MAPILLARY_HD_URL_CACHE.items() if exp < now]:
            _MAPILLARY_HD_URL_CACHE.pop(lid, None)


def _has_active_round(username: str) -> bool:
    now = time.time()
    with _state_lock:
        for rd in _ROUNDS.values():
            if rd["username"] == username and not rd["guessed"] and rd["expires_at"] > now:
                return True
    return False


def get_or_init_wallet(username: str, con=None) -> dict[str, Any]:
    close_after = con is None
    if con is None:
        con = _geo_db()
    try:
        today = _utc_today()
        now_iso = datetime.now(timezone.utc).isoformat()
        with _db_lock:
            con.execute(
                "INSERT OR IGNORE INTO geo_wallet(username, coins, best_game, games_played, updated_at) VALUES (?, ?, 0, 0, ?)",
                (username, START_COINS, now_iso),
            )
            row = con.execute(
                "SELECT coins, best_game, games_played, last_daily, last_rescue FROM geo_wallet WHERE username = ?",
                (username,),
            ).fetchone()
            coins, best_game, games_played, last_daily, last_rescue = row
            bonus_given = 0
            bonus_type = None
            if coins < START_COINS and last_daily != today:
                coins += DAILY_BONUS
                last_daily = today
                bonus_given += DAILY_BONUS
                bonus_type = "daily"
            if coins == 0 and last_rescue != today and not _has_active_round(username):
                coins += RESCUE_BONUS
                last_rescue = today
                bonus_given += RESCUE_BONUS
                bonus_type = "rescue"
            if bonus_given > 0:
                con.execute(
                    "UPDATE geo_wallet SET coins = ?, last_daily = ?, last_rescue = ?, updated_at = ? WHERE username = ?",
                    (coins, last_daily, last_rescue, now_iso, username),
                )
            con.commit()
        return {
            "username": username,
            "coins": coins,
            "best_game": best_game,
            "games_played": games_played,
            "bonus_given": bonus_given,
            "bonus_type": bonus_type,
        }
    finally:
        if close_after:
            con.close()


def _resolve_image_url(loc: dict[str, Any], hd: bool = False) -> str:
    src = loc.get("source", "panoramax")
    img_url = loc.get("img_url", "")
    if img_url.startswith("fixture://"):
        return img_url
    if src == "panoramax":
        if hd:
            if loc.get("hd_url"):
                return str(loc["hd_url"])
            if img_url and "/sd.jpg" in img_url:
                return img_url.replace("/sd.jpg", "/hd.jpg")
        if img_url and not hd:
            return img_url
        stac_url = f"https://api.panoramax.xyz/api/search?ids={urllib.parse.quote(str(loc['id']))}"
        req = urllib.request.Request(stac_url, headers={"User-Agent": "LobbyGG-GeoStake/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            d = json.loads(resp.read().decode("utf-8"))
        feats = d.get("features") or []
        if not feats:
            if img_url:
                return img_url
            raise HTTPException(502, "Panorama not found upstream")
        assets = feats[0].get("assets") or {}
        if hd:
            return (assets.get("hd") or {}).get("href") or (assets.get("sd") or {}).get("href") or img_url
        return (assets.get("sd") or {}).get("href") or (assets.get("hd") or {}).get("href") or ""
    if src == "mapillary":
        tok = mapillary_token()
        if not tok:
            raise HTTPException(503, "Mapillary token unavailable")
        lid = str(loc["id"])
        cache = _MAPILLARY_HD_URL_CACHE if hd else _MAPILLARY_URL_CACHE
        cached = cache.get(lid)
        if cached and cached[0] > time.time():
            return cached[1]                  # для HD может быть "" — значит HD у этой панорамы нет
        api = f"https://graph.mapillary.com/{urllib.parse.quote(lid)}?fields=width,thumb_2048_url,thumb_1024_url,thumb_original_url"
        req = urllib.request.Request(api, headers={"Authorization": f"OAuth {tok}", "User-Agent": "LobbyGG-GeoStake/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            d = json.loads(resp.read().decode("utf-8"))
        sd_u = d.get("thumb_2048_url") or d.get("thumb_1024_url") or ""
        try:
            width = int(d.get("width") or 0)
        except (TypeError, ValueError):
            width = 0
        # HD — только оригинал разумного размера; "" = HD нет, клиент остаётся на 2048
        hd_u = d.get("thumb_original_url") or "" if 2048 < width <= HD_MAX_WIDTH else ""
        exp = time.time() + 1800
        if sd_u:
            _MAPILLARY_URL_CACHE[lid] = (exp, sd_u)
        _MAPILLARY_HD_URL_CACHE[lid] = (exp, hd_u)
        return hd_u if hd else sd_u
    raise HTTPException(400, f"Unsupported source: {src}")


def _fetch_panorama_bytes(loc: dict[str, Any], hd: bool = False) -> bytes:
    url = _resolve_image_url(loc, hd=hd)
    if not url and hd:
        return b""                            # HD нет (слишком большой оригинал) — отвечаем 204, клиент остаётся на 2048
    if not url:
        raise HTTPException(502, "Empty panorama image URL")
    if url.startswith("fixture://"):
        fname = url[len("fixture://"):]
        fpath = Path(__file__).resolve().parent / "tests" / "fixtures" / fname
        if not fpath.is_file():
            raise HTTPException(404, "Test fixture image missing")
        return strip_jpeg_exif(fpath.read_bytes())

    max_bytes = HD_IMG_MAX_BYTES if hd else IMG_MAX_BYTES
    req = urllib.request.Request(url, headers={"User-Agent": "LobbyGG-GeoStake/1.0"})
    with urllib.request.urlopen(req, timeout=20 if hd else 15) as resp:
        raw = resp.read(max_bytes + 1)
    if len(raw) > max_bytes:
        raise HTTPException(502, "Panorama image too large")
    return strip_jpeg_exif(raw)


def mapillary_token() -> str:
    """MAPILLARY_TOKEN из окружения, иначе из файла (/data/mapillary_token на проде или ~/.mapillary_token локально) —
    так токен не нужно вшивать в docker run и он не попадает в git."""
    tok = os.environ.get("MAPILLARY_TOKEN", "").strip()
    if tok:
        return tok
    env_file = os.environ.get("MAPILLARY_TOKEN_FILE")
    candidates = [env_file] if env_file is not None else ["/data/mapillary_token", str(Path.home() / ".mapillary_token")]
    for path in candidates:
        try:
            with open(path, encoding="utf-8") as fh:
                v = fh.read().strip()
                if v:
                    return v
        except OSError:
            continue
    return ""


def _loc_country(loc: dict[str, Any]) -> str:
    c = str(loc.get("country") or "").strip().upper()
    if c:
        return c
    reg = str(loc.get("region") or "")
    if "," in reg:
        c = reg.split(",")[-1].strip().upper()
        return {"UK": "GB"}.get(c, c)
    return ""


def _select_location(used_ids: set[str], used_countries: set[str] | None = None) -> dict[str, Any]:
    pool = load_geo_pool()
    if not pool:
        raise HTTPException(503, "Geo panorama pool is empty")
    avail = [loc for loc in pool if loc["id"] not in used_ids]
    if not avail:
        avail = pool
    # Filter out mapillary if token is not configured
    has_mapillary = bool(mapillary_token())
    filtered = [loc for loc in avail if loc.get("source") != "mapillary" or has_mapillary or str(loc.get("img_url", "")).startswith("fixture://")]
    if not filtered:
        # Например, пропал токен Mapillary: не открываем раунд, который не сможет показать картинку (монеты целы)
        raise HTTPException(503, "Panoramas are temporarily unavailable")
    if used_countries:
        fresh_country = [loc for loc in filtered if _loc_country(loc) not in used_countries]
        if fresh_country:
            filtered = fresh_country
    # Uniformly pick a country first so rare countries appear as often as large ones
    by_country: dict[str, list[dict[str, Any]]] = {}
    for loc in filtered:
        by_country.setdefault(_loc_country(loc) or "_", []).append(loc)
    chosen_country = random.choice(list(by_country.keys()))
    return random.choice(by_country[chosen_country])


def _auth_username(request: Request) -> str | None:
    u = current_user(request)
    if isinstance(u, dict):
        return u.get("username")
    return u if isinstance(u, str) and u else None


@router.get("/api/geo/wallet")
async def geo_wallet(request: Request):
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    w = get_or_init_wallet(user)
    return {
        **w,
        "multipliers": [
            {"max_km": m[0], "mult": m[1]} for m in MULTIPLIER_TIERS
        ],
        "min_bet": MIN_BET,
        "rounds_per_game": ROUNDS_PER_GAME,
    }


@router.post("/api/geo/start")
async def geo_start(request: Request):
    _gc_state()
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    w = get_or_init_wallet(user)
    game_id = secrets.token_urlsafe(12)
    with _state_lock:
        _GAMES[game_id] = {
            "game_id": game_id,
            "username": user,
            "rounds_total": ROUNDS_PER_GAME,
            "round_num": 0,
            "used_ids": set(),
            "used_countries": set(),
            "total_bet": 0,
            "total_won": 0,
            "best_dist_km": None,
            "finished": False,
            "created_at": time.time(),
        }
    return {"game_id": game_id, "rounds_total": ROUNDS_PER_GAME, "wallet": w}


@router.post("/api/geo/round")
async def geo_round(request: Request):
    _gc_state()
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    try:
        body = await request.json()
    except Exception:
        body = {}
    game_id = str(body.get("game_id") or "")
    try:
        bet = int(body.get("bet") or 0)
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid_bet")

    if bet < MIN_BET:
        raise HTTPException(400, "bet_too_small")

    with _state_lock:
        game = _GAMES.get(game_id)
        if not game or game["username"] != user:
            raise HTTPException(404, "game_not_found")
        if game["finished"] or game["round_num"] >= game["rounds_total"]:
            raise HTTPException(400, "game_finished")
        # Ensure previous round in this game is guessed or expired
        for rd in _ROUNDS.values():
            if rd["game_id"] == game_id and not rd["guessed"] and rd["expires_at"] > time.time():
                raise HTTPException(409, "active_round_exists")
        if game.get("opening"):   # параллельный запрос уже открывает раунд этой игры
            raise HTTPException(409, "active_round_exists")
        game["opening"] = True

    try:
        return await _open_round(user, game, game_id, bet)
    finally:
        with _state_lock:
            game["opening"] = False


async def _open_round(user: str, game: dict[str, Any], game_id: str, bet: int) -> dict[str, Any]:
    with _state_lock:
        loc = _select_location(game["used_ids"], game.get("used_countries"))   # до списания: пустой пул → 503 без потери монет
    con = _geo_db()
    try:
        w = get_or_init_wallet(user, con=con)
        if w["coins"] < bet:
            raise HTTPException(400, "insufficient_coins")
        with _db_lock:
            cur = con.execute(
                "UPDATE geo_wallet SET coins = coins - ?, updated_at = ? WHERE username = ? AND coins >= ?",
                (bet, datetime.now(timezone.utc).isoformat(), user, bet),
            )
            con.commit()
            if cur.rowcount != 1:
                raise HTTPException(400, "insufficient_coins")
            new_coins = con.execute("SELECT coins FROM geo_wallet WHERE username = ?", (user,)).fetchone()[0]
    finally:
        con.close()

    with _state_lock:
        game["used_ids"].add(loc["id"])
        c = _loc_country(loc)
        if c:
            game.setdefault("used_countries", set()).add(c)
        game["round_num"] += 1
        game["total_bet"] += bet
        round_num = game["round_num"]
        round_id = secrets.token_urlsafe(14)
        expires_at = time.time() + ROUND_TIMEOUT_SEC
        _ROUNDS[round_id] = {
            "round_id": round_id,
            "game_id": game_id,
            "username": user,
            "round_num": round_num,
            "bet": bet,
            "loc": loc,
            "guessed": False,
            "expires_at": expires_at,
        }

    return {
        "round_id": round_id,
        "round_num": round_num,
        "rounds_total": game["rounds_total"],
        "bet": bet,
        "coins": new_coins,
        "heading": float(loc.get("heading") or 0.0),
        "img_url": f"/games/api/geo/img/{round_id}",
        "expires_at": expires_at,
        "timeout_sec": ROUND_TIMEOUT_SEC,
    }


@router.get("/api/geo/active")
async def geo_active(request: Request):
    _gc_state()
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    now = time.time()
    active_rd = None
    active_game = None
    with _state_lock:
        for rd in _ROUNDS.values():
            if rd["username"] == user and not rd["guessed"] and rd["expires_at"] > now:
                active_rd = dict(rd)
                g = _GAMES.get(rd["game_id"])
                active_game = dict(g) if g else None
                break
    if not active_rd:
        return {"active": None}
    loc = active_rd["loc"]
    w = get_or_init_wallet(user)
    return {
        "active": {
            "game_id": active_rd["game_id"],
            "round_id": active_rd["round_id"],
            "round_num": active_rd["round_num"],
            "rounds_total": active_game["rounds_total"] if active_game else ROUNDS_PER_GAME,
            "bet": active_rd["bet"],
            "coins": w["coins"],
            "heading": float(loc.get("heading") or 0.0),
            "img_url": f"/games/api/geo/img/{active_rd['round_id']}",
            "expires_at": active_rd["expires_at"],
            "remaining_sec": max(1, int(math.ceil(active_rd["expires_at"] - now))),
            "timeout_sec": ROUND_TIMEOUT_SEC,
        }
    }


@router.get("/api/geo/img/{round_id}")
async def geo_image(round_id: str, request: Request, hd: int = 0):
    _gc_state()
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    want_hd = bool(hd)
    with _state_lock:
        rd = _ROUNDS.get(round_id)
        if not rd or rd["username"] != user:
            raise HTTPException(404, "round_not_found")
        loc = rd["loc"]
        if not want_hd:
            cached = _IMG_CACHE.get(round_id)
            if cached and cached[0] > time.time():
                return Response(
                    content=cached[1],
                    media_type="image/jpeg",
                    headers={"Cache-Control": "private, no-store"},
                )

    if want_hd:
        # HD (~4096px) не кэшируем в _IMG_CACHE и ограничиваем 2 одновременными загрузками (256 МБ контейнер)
        async with _get_hd_sem():
            img_bytes = await asyncio.to_thread(_fetch_panorama_bytes, loc, True)
        if not img_bytes:
            return Response(status_code=204, headers={"Cache-Control": "private, no-store"})
    else:
        img_bytes = await asyncio.to_thread(_fetch_panorama_bytes, loc)
        with _state_lock:
            if round_id in _ROUNDS and not _ROUNDS[round_id]["guessed"]:
                _IMG_CACHE[round_id] = (time.time() + 300, img_bytes)
                while len(_IMG_CACHE) > IMG_CACHE_MAX:
                    _IMG_CACHE.pop(min(_IMG_CACHE, key=lambda k: _IMG_CACHE[k][0]), None)
    return Response(
        content=img_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/api/geo/guess")
async def geo_guess(request: Request):
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    try:
        body = await request.json()
    except Exception:
        body = {}
    round_id = str(body.get("round_id") or "")
    try:
        g_lat = float(body.get("lat"))
        g_lng = float(body.get("lng"))
    except (TypeError, ValueError):
        raise HTTPException(400, "invalid_coords")

    if not (-90.0 <= g_lat <= 90.0 and -180.0 <= g_lng <= 180.0):
        raise HTTPException(400, "coords_out_of_range")

    now = time.time()
    with _state_lock:
        rd = _ROUNDS.get(round_id)
        if not rd or rd["username"] != user:
            raise HTTPException(404, "round_not_found")
        if rd["guessed"]:
            raise HTTPException(409, "already_guessed")
        rd["guessed"] = True
        _IMG_CACHE.pop(round_id, None)
        game = _GAMES.get(rd["game_id"])
        timed_out = now > rd["expires_at"]
        loc = rd["loc"]
        bet = rd["bet"]

    dist_km = round(haversine_km(g_lat, g_lng, float(loc["lat"]), float(loc["lng"])), 2)
    mult = 0.0 if timed_out else calc_multiplier(dist_km)
    payout = int(round(bet * mult))

    con = _geo_db()
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        with _db_lock:
            if payout > 0:
                con.execute(
                    "UPDATE geo_wallet SET coins = coins + ?, updated_at = ? WHERE username = ?",
                    (payout, now_iso, user),
                )
            game_over = False
            game_summary = None
            if game:
                game["total_won"] += payout
                if not timed_out and (game["best_dist_km"] is None or dist_km < game["best_dist_km"]):
                    game["best_dist_km"] = dist_km
                if game["round_num"] >= game["rounds_total"]:
                    game["finished"] = True
                    game_over = True
                    net_profit = game["total_won"] - game["total_bet"]
                    con.execute(
                        "UPDATE geo_wallet SET games_played = games_played + 1, best_game = MAX(best_game, ?), updated_at = ? WHERE username = ?",
                        (game["total_won"], now_iso, user),
                    )
                    con.execute(
                        "INSERT INTO geo_scores(username, total_coins_won, total_bet, net_profit, best_dist_km, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        (user, game["total_won"], game["total_bet"], net_profit, game["best_dist_km"], now_iso),
                    )
                    game_summary = {
                        "total_bet": game["total_bet"],
                        "total_won": game["total_won"],
                        "net_profit": net_profit,
                        "best_dist_km": game["best_dist_km"],
                    }
            con.commit()
            coins = con.execute("SELECT coins FROM geo_wallet WHERE username = ?", (user,)).fetchone()[0]
    finally:
        con.close()

    return {
        "round_id": round_id,
        "timed_out": timed_out,
        "distance_km": dist_km,
        "multiplier": mult,
        "bet": bet,
        "payout": payout,
        "coins": coins,
        "answer": {"lat": loc["lat"], "lng": loc["lng"]},
        "attribution": {
            "author": loc.get("author") or "Contributor",
            "license": loc.get("license") or "CC-BY-SA-4.0",
            "source": loc.get("source") or "panoramax",
            "captured_at": loc.get("captured_at") or "",
        },
        "game_over": game_over,
        "game_summary": game_summary,
    }


@router.get("/api/geo/leaderboard")
async def geo_leaderboard():
    con = _geo_db()
    try:
        top_coins = [
            {"username": r[0], "coins": r[1], "best_game": r[2], "games_played": r[3]}
            for r in con.execute(
                "SELECT username, coins, best_game, games_played FROM geo_wallet WHERE games_played > 0 ORDER BY coins DESC, best_game DESC LIMIT 20"
            ).fetchall()
        ]
        top_best = [
            {"username": r[0], "coins": r[1], "best_game": r[2], "games_played": r[3]}
            for r in con.execute(
                "SELECT username, coins, best_game, games_played FROM geo_wallet WHERE games_played > 0 ORDER BY best_game DESC, coins DESC LIMIT 20"
            ).fetchall()
        ]
        return JSONResponse({"top_coins": top_coins, "top_best": top_best})
    finally:
        con.close()
