"""llm.ask: Groq → Gemini, предохранитель после сбоев, ключ не попадает в адрес и логи."""
import io
import json
import logging
import sys
import urllib.error
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import llm  # noqa: E402

FAKE_GROQ, FAKE_GEM = "gsk_test_not_real_000", "AIza_test_not_real_000"


@pytest.fixture(autouse=True)
def env(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", FAKE_GROQ)
    monkeypatch.setenv("GEMINI_API_KEY", FAKE_GEM)
    for st in llm._state.values():
        st.update(fails=0, until=0.0)


class Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fake_urlopen(answers, seen):
    def _open(req, timeout=None):
        seen.append(req)
        host = req.full_url.split("/")[2]
        a = answers[host]
        if isinstance(a, Exception):
            raise a
        return Resp(json.dumps(a).encode())
    return _open


GROQ_OK = {"choices": [{"message": {"content": "groq-answer"}}]}
GEM_OK = {"candidates": [{"content": {"parts": [{"text": "gemini-answer"}]}}]}
G, M = "api.groq.com", "generativelanguage.googleapis.com"


def test_groq_first():
    seen = []
    with patch.object(llm.urllib.request, "urlopen", fake_urlopen({G: GROQ_OK, M: GEM_OK}, seen)):
        assert llm.ask("hi") == "groq-answer"
    assert [r.full_url.split("/")[2] for r in seen] == [G]


def test_gemini_fallback_key_in_header_not_url(caplog):
    seen = []
    err = urllib.error.HTTPError("https://x", 401, "bad", {}, None)
    with caplog.at_level(logging.WARNING), \
            patch.object(llm.urllib.request, "urlopen", fake_urlopen({G: err, M: GEM_OK}, seen)):
        assert llm.ask("hi") == "gemini-answer"
    gem = seen[-1]
    assert FAKE_GEM not in gem.full_url and gem.get_header("X-goog-api-key") == FAKE_GEM
    assert FAKE_GROQ not in caplog.text and FAKE_GEM not in caplog.text and "HTTP 401" in caplog.text


def test_breaker_pauses_failing_provider():
    seen = []
    with patch.object(llm.urllib.request, "urlopen", fake_urlopen({G: TimeoutError(), M: GEM_OK}, seen)):
        for _ in range(3):
            assert llm.ask("hi") == "gemini-answer"
    # после двух таймаутов Groq больше не зовём — игра не ждёт его каждый раз
    assert [r.full_url.split("/")[2] for r in seen].count(G) == 2


def test_all_down_returns_none_and_no_keys_means_no_calls(monkeypatch):
    seen = []
    with patch.object(llm.urllib.request, "urlopen", fake_urlopen({G: TimeoutError(), M: TimeoutError()}, seen)):
        assert llm.ask("hi") is None
    monkeypatch.delenv("GROQ_API_KEY")
    monkeypatch.delenv("GEMINI_API_KEY")
    for st in llm._state.values():
        st.update(fails=0, until=0.0)
    seen.clear()
    with patch.object(llm.urllib.request, "urlopen", fake_urlopen({}, seen)):
        assert llm.ask("hi") is None and seen == []
