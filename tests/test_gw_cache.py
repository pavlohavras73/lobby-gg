"""«Хто є хто»: персонажи по теме генерируются один раз и берутся с диска; двойной «Старт» не дёргает ИИ дважды."""
import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import patch

import fastapi.staticfiles

ROOT = Path(__file__).resolve().parent.parent
_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(fastapi.staticfiles.StaticFiles, "__init__",
                  lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False})):
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402


async def _noop(*a, **k):
    return None


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def room():
    return {"players": {"a": {"name": "A"}, "b": {"name": "B"}}, "state": "lobby"}


def test_title_generated_once_then_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "GW_CACHE", str(tmp_path / "gw.json"))
    monkeypatch.setattr(server, "GW_PACKS", {})
    chars = [{"name": f"Ч{i}", "emoji": "🙂"} for i in range(20)]
    calls = []

    def fake(title, n=20):
        calls.append(title)
        return chars

    with patch.object(server, "gemini_chars", fake), patch.object(server, "broadcast", _noop), \
            patch.object(server, "push_gw", _noop):
        r1 = room()
        run(server.start_gw(r1, "Наруто"))
        r2 = room()
        run(server.start_gw(r2, "  наруто "))           # та же тема другим регистром
    assert calls == ["Наруто"] and r2["gw"]["chars"] == chars
    assert json.loads((tmp_path / "gw.json").read_text(encoding="utf-8"))["наруто"] == chars


def test_failed_generation_uses_defaults_and_is_not_cached(tmp_path, monkeypatch):
    monkeypatch.setattr(server, "GW_CACHE", str(tmp_path / "gw.json"))
    monkeypatch.setattr(server, "GW_PACKS", {})
    with patch.object(server, "gemini_chars", lambda t, n=20: None), patch.object(server, "broadcast", _noop), \
            patch.object(server, "push_gw", _noop):
        r = room()
        run(server.start_gw(r, "Неизвестное"))
    assert r["gw"]["chars"] is server.DEFAULT_CHARS and server.GW_PACKS == {} and "gw_loading" not in r


def test_double_start_ignored_while_loading(monkeypatch):
    monkeypatch.setattr(server, "GW_PACKS", {})
    r = room()
    r["gw_loading"] = True
    with patch.object(server, "gemini_chars", lambda *a: (_ for _ in ()).throw(AssertionError("не должен звать"))):
        run(server.start_gw(r, "Что-то"))
    assert "gw" not in r


def test_cache_is_capped():
    d = {str(i): [1] for i in range(10)}
    server._trim_cache(d, 3)
    assert list(d) == ["7", "8", "9"]
