"""Текстовый LLM для игр: Gemini → (одна повторная попытка при 429) → Groq.

Ключ Gemini общий с n8n и другими контейнерами и регулярно ловит поминутный лимит (429),
поэтому у игр всегда есть запасной провайдер. ask() возвращает текст ответа или None —
тогда вызывающий код берёт свои заготовки.
"""
import json
import logging
import os
import time
import urllib.error
import urllib.request

GEMINI_MODEL = "gemini-3.5-flash"
GROQ_MODEL = "openai/gpt-oss-120b"


def _gemini(prompt, temperature, max_tokens, timeout):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens,
                                            "thinkingConfig": {"thinkingBudget": 0}}}).encode()
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={key}",
        data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.load(r)
    return "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"])


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


def ask(prompt, temperature=0.8, max_tokens=1500, timeout=25):
    """Синхронный вызов (из игр — через run_in_executor). Текст ответа или None."""
    for attempt in (1, 2):
        try:
            txt = _gemini(prompt, temperature, max_tokens, timeout)
            if txt:
                return txt
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 1:
                time.sleep(1.5)  # поминутный лимит общего ключа — одна короткая повторная попытка
                continue
            logging.warning("llm: gemini HTTP %s — пробую Groq", e.code)
            break
        except Exception as e:
            logging.warning("llm: gemini %s — пробую Groq", e)
            break
    try:
        return _groq(prompt, temperature, max_tokens, timeout)
    except Exception as e:
        logging.warning("llm: groq %s — остаются заготовки", e)
        return None
