import json
import urllib.request
import os
import random
import re
import time

import llm
from variants_facts import FACTS

LANGS = ("ru", "uk", "en", "de")
FIELDS = ("text", "correct", "bluff", "explanation")

# Нейросеть (общий ключ Gemini) часто висит/упирается в лимит: после серии сбоев не дёргаем её какое-то время,
# а игра всегда идёт на проверенной колоде variants_facts.FACTS.
_LLM_FAILS = 0
_LLM_PAUSE_UNTIL = 0.0
LLM_TIMEOUT = 12


def _llm_available():
    return time.time() >= _LLM_PAUSE_UNTIL


def _llm_result(ok):
    global _LLM_FAILS, _LLM_PAUSE_UNTIL
    if ok:
        _LLM_FAILS = 0
    else:
        _LLM_FAILS += 1
        if _LLM_FAILS >= 2:
            _LLM_PAUSE_UNTIL = time.time() + 300   # 5 минут тишины
            _LLM_FAILS = 0


def _norm_prompt(data):
    """LLM-ответ → {поле: {язык: строка}}. Пусто/битое → None."""
    if not isinstance(data, dict):
        return None
    out = {}
    for f in FIELDS:
        v = data.get(f)
        if isinstance(v, str):
            v = {"ru": v}
        if not isinstance(v, dict):
            v = {}
        v = {k: str(x).strip()[:300] for k, x in v.items() if k in LANGS and isinstance(x, (str, int, float)) and str(x).strip()}
        if not v.get("ru") and f in ("text", "correct"):
            return None
        out[f] = v
    if out["text"]["ru"].count("_____") != 1:
        return None
    if _same(out["correct"].get("ru", ""), out["bluff"].get("ru", "")):
        out["bluff"] = {}
    return out


def generate_prompt(categories):
    """Новый факт от нейросети на 4 языках или None (тогда берётся колода). Вызывать из потока."""
    if not _llm_available():
        return None
    cats_str = ", ".join(str(c)[:40] for c in categories[:6]) if categories else "Случайные факты, Абсурд, История"
    prompt = f"""
Сгенерируй ОДИН малоизвестный, но ПРАВДИВЫЙ и проверяемый факт для игры "Аукцион лжи" (Fibbage) на тему: {cats_str}.
Замени ключевое слово/фразу на "_____" (ровно один пропуск). Ответ — 1–3 слова.
Дай всё на четырёх языках: ru, uk, en, de. Формат ответа СТРОГО валидный JSON, без пояснений:
{{"text": {{"ru": "... _____ ...", "uk": "...", "en": "...", "de": "..."}},
 "correct": {{"ru": "...", "uk": "...", "en": "...", "de": "..."}},
 "bluff": {{"ru": "...", "uk": "...", "en": "...", "de": "..."}},
 "explanation": {{"ru": "...", "uk": "...", "en": "...", "de": "..."}}}}
'bluff' — правдоподобный, но НЕВЕРНЫЙ ответ. 'explanation' — одно короткое предложение.
"""
    try:
        txt = llm.ask(prompt, temperature=0.8, max_tokens=1500, timeout=LLM_TIMEOUT) or ""
        mt = re.search(r'\{.*\}', txt, re.S)
        data = _norm_prompt(json.loads(mt.group(0))) if mt else None
    except Exception as e:
        print(f"LLM prompt generation error: {e}")
        data = None
    _llm_result(bool(data))
    return data


def next_prompt(room):
    """Следующий вопрос: заранее готовый от нейросети, иначе — неповторяющийся факт из колоды."""
    gs = room.setdefault("state_data", {})
    pre = gs.pop("prefetch", None)
    if pre:
        return pre
    used = gs.setdefault("used_facts", [])
    free = [i for i in range(len(FACTS)) if i not in used]
    if not free:
        used.clear()
        free = list(range(len(FACTS)))
        last = gs.get("last_fact")
        if last in free and len(free) > 1:
            free.remove(last)
    i = random.choice(free)
    used.append(i)
    gs["last_fact"] = i
    return FACTS[i]


def _same(a, b):
    norm = lambda x: re.sub(r"[^\w]+", "", str(x).lower().replace("ё", "е"))
    return bool(norm(a)) and norm(a) == norm(b)


def is_truth(prompt, bluff):
    """Игрок вписал правду вместо лжи (на любом языке)."""
    return any(_same(v, bluff) for v in (prompt.get("correct") or {}).values())


def _sync(room):
    """room["players_data"] и room["names"] сервер не создаёт — держим их в синхроне с room["players"]."""
    pd = room.setdefault("players_data", {})
    for pid in room["players"]:
        pd.setdefault(pid, {})
    room["names"] = {pid: d.get("name", pid) for pid, d in room["players"].items()}
    return pd


def _humans(room):
    """Кого ждёт раунд: люди на связи. Боты не пишут/не голосуют; отключившийся (уснул телефон) не держит игру."""
    return [pid for pid, d in room["players"].items() if not d.get("bot") and d.get("ws")]


def variants_public(room):
    """Общее состояние для клиентов. Тексты вопроса — {язык: строка}, клиент берёт свой язык."""
    _sync(room)
    gs = room.setdefault("state_data", {})
    phase = gs.get("phase", "lobby")
    waiting = set(_humans(room))
    public_players = []
    for pid in room["players"]:
        pdata = room["players_data"].get(pid, {})
        d = room["players"][pid]
        public_players.append({
            "id": pid,
            "name": room["names"].get(pid, pid),
            "score": pdata.get("score", 0),
            "has_submitted": pdata.get("bluff") is not None,
            "has_voted": pdata.get("vote") is not None,
            "bot": bool(d.get("bot")),
            "online": pid in waiting or bool(d.get("bot")),
        })
    out = {
        "type": "variants_state",
        "phase": phase,
        "host": room["host"],
        "round": gs.get("round", 1),
        "total_rounds": gs.get("total_rounds", 5),
        "players": public_players,
        "categories": gs.get("categories", []),
    }
    if phase != "lobby":
        out["prompt"] = (gs.get("current_prompt") or {}).get("text", {})
    if phase in ("voting", "results"):
        answers = gs.get("shuffled_answers", [])
        if phase == "voting":
            # авторство скрыто; свой ответ клиент узнаёт по mine_id (присылается лично)
            out["answers"] = [{"id": a["id"], "text": a["text"], "i18n": a.get("i18n")} for a in answers]
        else:
            out["answers"] = answers
            out["correct_id"] = gs.get("correct_id")
            out["sys_bluff_id"] = gs.get("sys_bluff_id")
            out["explanation"] = (gs.get("current_prompt") or {}).get("explanation", {})
            out["votes"] = {pid: d["vote"] for pid, d in room["players_data"].items() if d.get("vote")}
            out["round_scores"] = gs.get("round_scores", {})
    return out


import uuid


def start_round(room, prompt_data=None):
    _sync(room)
    gs = room.setdefault("state_data", {})
    gs["phase"] = "input"
    gs["current_prompt"] = prompt_data or next_prompt(room)
    gs["shuffled_answers"] = []
    gs.pop("correct_id", None)
    gs.pop("sys_bluff_id", None)
    gs["round_scores"] = {}
    for pid in room["players"]:
        d = room["players_data"].setdefault(pid, {})
        d["bluff"] = None
        d["vote"] = None
        d.pop("bluff_id", None)
    return variants_public(room)


def check_input_phase_complete(room, force=False):
    """Все люди на связи вписали ложь → голосование. force (хост «не ждать») — с теми, кто успел."""
    _sync(room)
    gs = room.setdefault("state_data", {})
    if gs.get("phase") != "input":
        return False
    humans = _humans(room)
    if force:
        if not any(d.get("bluff") for d in room["players_data"].values()):
            return False
    elif not humans or any(not room["players_data"].get(pid, {}).get("bluff") for pid in humans):
        return False
    gs["phase"] = "voting"
    prompt = gs["current_prompt"]
    answers = []
    correct_id = str(uuid.uuid4())
    gs["correct_id"] = correct_id
    answers.append({"id": correct_id, "text": prompt["correct"].get("ru", ""), "i18n": prompt["correct"], "author": "system"})
    seen = [prompt["correct"].get("ru", "")]
    # ложь всех, кто успел вписать (включая тех, кто потом отключился); одинаковые склеиваются
    for pid, d in room["players_data"].items():
        txt = d.get("bluff")
        if not txt or pid not in room["players"]:
            continue
        dup = next((a for a in answers if a["author"] not in ("system", "system_bluff") and _same(a["text"], txt)), None)
        if dup:
            d["bluff_id"] = dup["id"]
            dup.setdefault("co_authors", []).append(pid)
            continue
        bid = str(uuid.uuid4())
        d["bluff_id"] = bid
        answers.append({"id": bid, "text": txt, "author": pid})
        seen.append(txt)
    sys_bluff = prompt.get("bluff") or {}
    if sys_bluff.get("ru") and not any(_same(sys_bluff["ru"], x) for x in seen):
        sid = str(uuid.uuid4())
        gs["sys_bluff_id"] = sid
        answers.append({"id": sid, "text": sys_bluff["ru"], "i18n": sys_bluff, "author": "system_bluff"})
    random.shuffle(answers)
    gs["shuffled_answers"] = answers
    return True


def check_voting_phase_complete(room, force=False):
    _sync(room)
    gs = room.setdefault("state_data", {})
    if gs.get("phase") != "voting":
        return False
    humans = _humans(room)
    if not force and (not humans or any(not room["players_data"].get(pid, {}).get("vote") for pid in humans)):
        return False
    gs["phase"] = "results"
    voters = [pid for pid, d in room["players_data"].items() if d.get("vote") and pid in room["players"]]
    round_scores = {pid: {"total": 0, "details": []} for pid, d in room["players"].items() if not d.get("bot")}
    correct_id = gs["correct_id"]
    by_id = {a["id"]: a for a in gs.get("shuffled_answers", [])}
    for pid in voters:
        vote_id = room["players_data"][pid]["vote"]
        rs = round_scores.setdefault(pid, {"total": 0, "details": []})
        if vote_id == correct_id:
            rs["total"] += 2
            rs["details"].append("truth")
        elif vote_id == gs.get("sys_bluff_id"):
            rs["details"].append("house")
        else:
            ans = by_id.get(vote_id) or {}
            for author in [ans.get("author")] + ans.get("co_authors", []):
                if author in round_scores and author != pid:
                    round_scores[author]["total"] += 1
                    round_scores[author]["details"].append("fooled")
            rs["details"].append("fooled_by")
    for pid, rs in round_scores.items():
        d = room["players_data"].setdefault(pid, {})
        d["score"] = d.get("score", 0) + rs["total"]
    gs["round_scores"] = round_scores
    return True


def advance(room):
    """Проверить, не пора ли сменить фазу (после ответа, голоса или отключения игрока)."""
    return check_input_phase_complete(room) or check_voting_phase_complete(room)


def force_advance(room):
    return check_input_phase_complete(room, force=True) or check_voting_phase_complete(room, force=True)


def own_answer_ids(room, pid):
    """id ответа(ов), под которыми стоит ложь этого игрока — за них голосовать нельзя."""
    d = room.get("players_data", {}).get(pid, {})
    return {d["bluff_id"]} if d.get("bluff_id") else set()
