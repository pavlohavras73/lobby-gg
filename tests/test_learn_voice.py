"""/learn/api/voice-check: лимиты размера и частоты, расширение из белого списка, ключ не в argv."""
import base64
import sys
from pathlib import Path
from unittest.mock import patch

import fastapi.staticfiles
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(fastapi.staticfiles.StaticFiles, "__init__",
                  lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False})):
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402
import learn  # noqa: E402

URL = "/learn/api/voice-check"


def post(c, audio=b"abc", fmt="webm", ip="1.1.1.1"):
    return c.post(URL, json={"target_phrase": "hello world", "audio_base64": base64.b64encode(audio).decode(),
                             "format": fmt}, headers={"x-forwarded-for": ip})


def test_ok_and_ext_whitelist():
    seen = []

    def fake(path):
        seen.append(path)
        return "hello world"

    server._RL.clear()
    with patch.object(learn, "transcribe_audio_groq", fake):
        c = TestClient(server.app)
        r = post(c, fmt="x/../../evil;type=a", ip="2.2.2.2")
    assert r.status_code == 200 and r.json()["result"]["pass"]
    assert seen[0].endswith(".webm") and ".." not in seen[0]


def test_too_large_and_bad_base64():
    c = TestClient(server.app)
    with patch.object(learn, "transcribe_audio_groq", lambda p: ""):
        assert post(c, audio=b"0" * (learn.VOICE_MAX_BYTES + 10), ip="3.3.3.3").status_code == 413
        r = c.post(URL, json={"audio_base64": "!!!не-base64", "format": "webm"}, headers={"x-forwarded-for": "4.4.4.4"})
    assert r.status_code == 400


def test_rate_limited_per_ip():
    c = TestClient(server.app)
    with patch.object(learn, "transcribe_audio_groq", lambda p: ""):
        codes = [post(c, ip="5.5.5.5").status_code for _ in range(14)]
    assert codes[:12] == [200] * 12 and codes[-1] == 429


def test_no_subprocess_and_key_only_in_header(monkeypatch, tmp_path):
    assert not hasattr(learn, "subprocess")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_not_real")
    f = tmp_path / "a.webm"
    f.write_bytes(b"123")
    seen = []

    def fake_open(req, timeout=None):
        seen.append(req)
        raise TimeoutError()

    with patch("urllib.request.urlopen", fake_open):
        assert learn.transcribe_audio_groq(str(f)) == ""
    assert seen[0].get_header("Authorization") == "Bearer gsk_test_not_real" and b"gsk_" not in seen[0].data
