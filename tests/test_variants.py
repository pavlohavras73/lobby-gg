"""«Варианты» (Аукцион лжи): колода без повторов, фазы не зависают из-за отключившихся, проверки ответов."""
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import variants as vr  # noqa: E402
from variants_facts import FACTS  # noqa: E402


def room(n_humans=3, bots=1):
    r = {"code": "TEST", "host": "h0", "players": {}, "state": "playing"}
    for i in range(n_humans):
        r["players"][f"h{i}"] = {"name": f"H{i}", "ws": object()}
    for i in range(bots):
        r["players"][f"bot_{i}"] = {"name": "Bot", "ws": None, "bot": "medium"}
    return r


def test_deck_is_complete_and_four_languages():
    assert len(FACTS) >= 40
    for f in FACTS:
        for field in ("text", "correct", "bluff", "explanation"):
            assert set(f[field]) == {"ru", "uk", "en", "de"} and all(f[field].values())
        for lang in f["text"]:
            assert f["text"][lang].count("_____") == 1
            assert f["correct"][lang].strip().lower() != f["bluff"][lang].strip().lower()


def test_no_repeats_until_deck_exhausted():
    r = room()
    seen = [id(vr.next_prompt(r)) for _ in range(len(FACTS))]
    assert len(set(seen)) == len(FACTS)
    nxt = vr.next_prompt(r)                         # колода кончилась — начинается заново, но не с того же
    assert id(nxt) != seen[-1]


def test_prefetched_llm_prompt_is_used_first():
    r = room()
    pre = {"text": {"ru": "x _____"}, "correct": {"ru": "y"}, "bluff": {}, "explanation": {}}
    r["state_data"] = {"prefetch": pre}
    assert vr.next_prompt(r) is pre and "prefetch" not in r["state_data"]


def test_llm_garbage_rejected_and_pauses():
    assert vr._norm_prompt({"text": "без пропуска", "correct": "a"}) is None
    assert vr._norm_prompt({"text": "есть _____", "correct": ""}) is None
    ok = vr._norm_prompt({"text": {"ru": "есть _____", "en": "has _____"}, "correct": "a", "bluff": "b", "explanation": "c"})
    assert ok["text"]["en"] == "has _____" and ok["correct"] == {"ru": "a"}
    with patch.object(vr.llm, "ask", return_value=None):
        vr._LLM_PAUSE_UNTIL = 0
        assert vr.generate_prompt([]) is None and vr.generate_prompt([]) is None
        assert not vr._llm_available()                  # после двух сбоев нейросеть отдыхает
        with patch.object(vr.llm, "ask", side_effect=AssertionError("не должен звать")):
            assert vr.generate_prompt([]) is None
    vr._LLM_PAUSE_UNTIL = 0


def play_round(r):
    vr.start_round(r, FACTS[0])
    return r["state_data"]


def test_full_round_scoring_and_bots_ignored():
    r = room(3, bots=2)
    gs = play_round(r)
    pd = r["players_data"]
    pd["h0"]["bluff"], pd["h1"]["bluff"] = "собаку", "хомяка"
    assert not vr.advance(r)
    pd["h2"]["bluff"] = "ХОМЯКА"                      # совпадение склеивается в один ответ
    assert vr.advance(r) and gs["phase"] == "voting"
    answers = gs["shuffled_answers"]
    texts = sorted(a["text"].lower() for a in answers)
    assert texts.count("хомяка") == 1 and len(answers) == 4   # правда + 2 лжи + обманка дома
    correct = gs["correct_id"]
    hamster = next(a["id"] for a in answers if a["text"].lower() == "хомяка")
    pd["h0"]["vote"], pd["h1"]["vote"], pd["h2"]["vote"] = hamster, correct, gs["sys_bluff_id"]
    assert vr.advance(r) and gs["phase"] == "results"
    assert pd["h0"]["score"] == 0 and pd["h1"]["score"] == 3 and pd["h2"]["score"] == 1   # h1: +2 правда, +1 обман h0
    pub = vr.variants_public(r)
    assert pub["answers"][0].get("author") and set(pub["explanation"]) == {"ru", "uk", "en", "de"}


def test_disconnected_player_does_not_block():
    r = room(3, bots=0)
    gs = play_round(r)
    r["players_data"]["h0"]["bluff"] = "a"
    r["players_data"]["h1"]["bluff"] = "b"
    assert not vr.advance(r)
    r["players"]["h2"]["ws"] = None                   # телефон уснул
    assert vr.advance(r) and gs["phase"] == "voting"
    ids = [a["id"] for a in gs["shuffled_answers"]]
    r["players_data"]["h0"]["vote"] = ids[0]
    r["players"]["h1"]["ws"] = None
    assert vr.advance(r) and gs["phase"] == "results"


def test_host_force_and_voting_hides_authors():
    r = room(3, bots=0)
    gs = play_round(r)
    assert not vr.force_advance(r)                    # никто не написал — пропускать нечего
    r["players_data"]["h0"]["bluff"] = "a"
    assert vr.force_advance(r) and gs["phase"] == "voting"
    pub = vr.variants_public(r)
    assert all("author" not in a for a in pub["answers"])
    assert vr.own_answer_ids(r, "h0") == {r["players_data"]["h0"]["bluff_id"]}
    assert vr.force_advance(r) and gs["phase"] == "results"


def test_truth_detection_any_language():
    f = FACTS[1]                                       # жираф: язык / tongue / Zunge
    assert vr.is_truth(f, " Языка! ") and vr.is_truth(f, "tongue") and vr.is_truth(f, "Zunge")
    assert not vr.is_truth(f, "хвоста")


def test_every_fact_can_be_played():
    for f in FACTS:
        r = room(2, bots=0)
        vr.start_round(r, f)
        r["players_data"]["h0"]["bluff"] = "x1"
        r["players_data"]["h1"]["bluff"] = "x2"
        assert vr.advance(r)
        for p in ("h0", "h1"):
            r["players_data"][p]["vote"] = r["state_data"]["correct_id"]
        assert vr.advance(r) and r["state_data"]["phase"] == "results"
