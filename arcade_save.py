"""Generic per-user cloud save & leaderboard router for solo arcade games (e.g., Shuttle Cruiser)."""

from __future__ import annotations

import json
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from server import _auth_db, current_user

router = APIRouter()

ALLOWED_GAMES = frozenset({"shuttle"})
_GAME_RE = re.compile(r"^[a-z0-9_]{2,32}$")
MAX_SAVE_BYTES = 32 * 1024

_db_lock = threading.Lock()
_rl_lock = threading.Lock()
_arcade_db_initialized = False
_WRITE_LOG: dict[tuple[str, str], list[float]] = {}
WRITE_LIMIT_COUNT = 30
WRITE_LIMIT_WINDOW_SEC = 10.0


def _ensure_arcade_tables(con) -> None:
    global _arcade_db_initialized
    if _arcade_db_initialized:
        return
    con.execute("""CREATE TABLE IF NOT EXISTS arcade_saves(
        username TEXT NOT NULL,
        game TEXT NOT NULL,
        data TEXT NOT NULL,
        best_score INTEGER NOT NULL DEFAULT 0,
        max_stage INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(username, game)
    )""")
    con.commit()
    _arcade_db_initialized = True


def _arcade_db():
    con = _auth_db()
    _ensure_arcade_tables(con)
    return con


def _auth_username(request: Request) -> str | None:
    u = current_user(request)
    if isinstance(u, dict):
        return u.get("username")
    return u if isinstance(u, str) and u else None


def _validate_game(game: str) -> str:
    g = (game or "").strip().lower()
    if not _GAME_RE.match(g) or g not in ALLOWED_GAMES:
        raise HTTPException(400, "invalid_game")
    return g


def _check_write_rate_limit(username: str, game: str) -> None:
    now = time.time()
    key = (username, game)
    with _rl_lock:
        hist = [t for t in _WRITE_LOG.get(key, []) if now - t < WRITE_LIMIT_WINDOW_SEC]
        if len(hist) >= WRITE_LIMIT_COUNT:
            _WRITE_LOG[key] = hist
            raise HTTPException(429, "rate_limited")
        hist.append(now)
        _WRITE_LOG[key] = hist


@router.get("/api/arcade/save/{game}")
async def get_arcade_save(game: str, request: Request):
    g = _validate_game(game)
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")
    con = _arcade_db()
    try:
        with _db_lock:
            row = con.execute(
                "SELECT data, updated_at FROM arcade_saves WHERE username = ? AND game = ?",
                (user, g),
            ).fetchone()
        if not row:
            return {"game": g, "data": None, "updated_at": None}
        try:
            parsed = json.loads(row[0])
        except Exception:
            parsed = None
        return {"game": g, "data": parsed, "updated_at": row[1]}
    finally:
        con.close()


@router.put("/api/arcade/save/{game}")
async def put_arcade_save(game: str, request: Request):
    g = _validate_game(game)
    user = _auth_username(request)
    if not user:
        raise HTTPException(401, "auth_required")

    try:
        declared = int(request.headers.get("content-length") or 0)
    except ValueError:
        declared = 0
    if declared > MAX_SAVE_BYTES:          # не читаем огромное тело в память (контейнер 256 МБ)
        raise HTTPException(413, "save_too_large")
    raw = await request.body()
    if len(raw) > MAX_SAVE_BYTES:
        raise HTTPException(413, "save_too_large")

    try:
        payload: Any = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(400, "invalid_json")

    if isinstance(payload, dict) and "data" in payload and len(payload) <= 2:
        data_obj = payload["data"]
    else:
        data_obj = payload

    if not isinstance(data_obj, dict):
        raise HTTPException(400, "invalid_save_object")

    encoded = json.dumps(data_obj, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_SAVE_BYTES:
        raise HTTPException(413, "save_too_large")

    _check_write_rate_limit(user, g)

    try:
        best_score = min(10**12, max(0, int(data_obj.get("best_score") or 0)))   # sqlite INTEGER — 64 бита
    except (TypeError, ValueError):
        best_score = 0
    try:
        max_gal = min(99, max(1, int(data_obj.get("max_galaxy") or 1)))
        max_sec = min(99, max(1, int(data_obj.get("max_sector") or 1)))
        max_stage = max_gal * 100 + max_sec
    except (TypeError, ValueError):
        max_stage = 101

    now_iso = datetime.now(timezone.utc).isoformat()
    con = _arcade_db()
    try:
        with _db_lock:
            con.execute(
                """INSERT INTO arcade_saves(username, game, data, best_score, max_stage, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT(username, game) DO UPDATE SET
                     data = excluded.data,
                     best_score = MAX(arcade_saves.best_score, excluded.best_score),
                     max_stage = MAX(arcade_saves.max_stage, excluded.max_stage),
                     updated_at = excluded.updated_at""",
                (user, g, encoded, best_score, max_stage, now_iso),
            )
            con.commit()
        return {"ok": True, "game": g, "updated_at": now_iso}
    finally:
        con.close()


@router.get("/api/arcade/leaderboard/{game}")
async def get_arcade_leaderboard(game: str):
    g = _validate_game(game)
    con = _arcade_db()
    try:
        with _db_lock:
            rows = con.execute(
                """SELECT username, best_score, max_stage, updated_at
                   FROM arcade_saves
                   WHERE game = ? AND best_score > 0
                   ORDER BY max_stage DESC, best_score DESC
                   LIMIT 20""",
                (g,),
            ).fetchall()
        return {
            "game": g,
            "entries": [
                {
                    "username": r[0],
                    "best_score": r[1],
                    "max_galaxy": max(1, r[2] // 100),
                    "max_sector": max(1, r[2] % 100),
                    "updated_at": r[3],
                }
                for r in rows
            ],
        }
    finally:
        con.close()
