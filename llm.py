"""Текстовый LLM для игр: Groq → Gemini, у каждого — «предохранитель» после сбоев.

Ключи только из окружения (GROQ_API_KEY / GROQ_KEY, GEMINI_API_KEY), в код и логи не попадают:
Gemini получает ключ в заголовке, а не в адресе. ask() возвращает текст ответа или None —
тогда вызывающий код берёт свои заготовки (у каждой игры есть готовая база).
"""
import json
import logging
import os
import time
import urllib.error
import urllib.request

GROQ_MODEL = "openai/gpt-oss-120b"
GEMINI_MODEL = "gemini-3.5-flash"
FAILS_TO_PAUSE = 2          # столько сбоев подряд → провайдер отдыхает
PAUSE_SEC = 300

_state = {"groq": {"fails": 0, "until": 0.0}, "gemini": {"fails": 0, "until": 0.0}}


def _groq(prompt, temperature, max_tokens, timeout):
    key = os.environ.get("GROQ_API_KEY", "") or os.environ.get("GROQ_KEY", "")
    if not key:
        return None
    body = json.dumps({"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}],
                       "temperature": temperature, "max_tokens": max_tokens,
                       "reasoning_effort": "low"}).encode()
    req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions", data=body,
                                 headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}",
                                          "User-Agent": "lobby-gg"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)["choices"][0]["message"]["content"]


def _gemini(prompt, temperature, max_tokens, timeout):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens,
                                            "thinkingConfig": {"thinkingBudget": 0}}}).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        data=body, headers={"Content-Type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.load(r)
    return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])


PROVIDERS = (("groq", _groq), ("gemini", _gemini))


def _why(e):
    """Короткая причина без тела ответа и адресов (там могут быть ключи/заголовки)."""
    if isinstance(e, urllib.error.HTTPError):
        return f"HTTP {e.code}"
    return type(e).__name__


def ask(prompt, temperature=0.8, max_tokens=1500, timeout=25):
    """Синхронный вызов (из игр — через run_in_executor). Текст ответа или None."""
    for name, fn in PROVIDERS:
        st = _state[name]
        if time.time() < st["until"]:
            continue
        try:
            txt = fn(prompt, temperature, max_tokens, timeout)
        except Exception as e:
            st["fails"] += 1
            if st["fails"] >= FAILS_TO_PAUSE:
                st["until"], st["fails"] = time.time() + PAUSE_SEC, 0
            logging.warning("llm: %s %s — дальше по списку", name, _why(e))
            continue
        if txt:
            st["fails"] = 0
            return txt
    return None
