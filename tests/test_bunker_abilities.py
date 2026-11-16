"""Бункер: активные спецспособности (bunker.use_ability) и голосование с иммунитетом/×2."""
import random
import sys
from pathlib import Path
from unittest.mock import patch

import fastapi.staticfiles
import pytest

ROOT = Path(__file__).resolve().parent.parent
_ORIG_SF_INIT = fastapi.staticfiles.StaticFiles.__init__
with patch.object(fastapi.staticfiles.StaticFiles, "__init__",
                  lambda self, *a, **kw: _ORIG_SF_INIT(self, *a, **{**kw, "check_dir": False})):
    sys.path.insert(0, str(ROOT))
    import server  # noqa: E402
import bunker as bnk  # noqa: E402


def make_room(n=4):
    room = {"state": "playing", "host": "p0", "players": {}, "vote": None,
            "gs": bnk.new_game_state(n)}
    for i in range(n):
        room["players"][f"p{i}"] = {"name": f"N{i}", "alive": True, "char": bnk.make_character(),
                                   "revealed": set(), "reveals_round": 0}
    return room


def give(room, pid, ab, slot=0):
    """Положить игроку нужную способность в слот 1/2 (ищем текст по id)."""
    text = next(t for t, i in bnk.ABILITY_IDS.items() if i == ab)
    cat = bnk.ABILITY_CATS[0] if text in bnk.POOLS[bnk.ABILITY_CATS[0]] else bnk.ABILITY_CATS[1]
    room["players"][pid]["char"][cat] = text
    return cat


def test_every_card_has_ability_and_spec():
    for cat in bnk.ABILITY_CATS:
        for text in bnk.POOLS[cat]:
            assert bnk.ABILITY_IDS[text] in bnk.ABILITY_SPEC


def test_swap_exchanges_cards_and_reveals_ability():
    r = make_room()
    cat = give(r, "p0", "swap")
    a, b = r["players"]["p0"]["char"]["Профессия"], r["players"]["p1"]["char"]["Профессия"]
    ev, priv = bnk.use_ability(r, "p0", cat, target="p1", pick="Профессия")
    assert r["players"]["p0"]["char"]["Профессия"] == b and r["players"]["p1"]["char"]["Профессия"] == a
    assert cat in r["players"]["p0"]["revealed"] and cat in r["players"]["p0"]["used"]
    assert ev["kind"] == "swap" and ev["cat"] == "Профессия" and priv is None
    assert r["players"]["p0"]["reveals_round"] == 0          # не тратит лимит вскрытий
    with pytest.raises(bnk.AbilityError, match="used"):        # одноразовая
        bnk.use_ability(r, "p0", cat, target="p1", pick="Профессия")


def test_swap_rejects_bad_input():
    r = make_room()
    cat = give(r, "p0", "swap")
    for tgt, pick, code in [("p0", "Профессия", "bad_target"), ("zz", "Профессия", "bad_target"),
                            ("p1", bnk.ABILITY_CATS[0], "bad_pick"), ("p1", "нет", "bad_pick")]:
        with pytest.raises(bnk.AbilityError, match=code):
            bnk.use_ability(r, "p0", cat, target=tgt, pick=pick)
    r["players"]["p1"]["alive"] = False
    with pytest.raises(bnk.AbilityError, match="bad_target"):
        bnk.use_ability(r, "p0", cat, target="p1", pick="Профессия")
    assert not r["players"]["p0"].get("used")                  # ошибка не сжигает карту


def test_peek_is_private_and_only_closed():
    r = make_room()
    cat = give(r, "p0", "peek")
    r["players"]["p1"]["revealed"].add("Возраст")
    with pytest.raises(bnk.AbilityError, match="bad_pick"):
        bnk.use_ability(r, "p0", cat, target="p1", pick="Возраст")
    ev, priv = bnk.use_ability(r, "p0", cat, target="p1", pick="Здоровье")
    assert priv == {"kind": "peek", "target": "N1", "cat": "Здоровье",
                    "value": r["players"]["p1"]["char"]["Здоровье"]}
    assert "Здоровье" not in r["players"]["p1"]["revealed"]
    assert r["players"]["p0"]["notes"][-1] == priv


def test_vote_abilities_need_active_vote():
    r = make_room()
    c1, c2 = give(r, "p0", "cancel_vote"), give(r, "p1", "double_vote")
    for pid, c in (("p0", c1), ("p1", c2)):
        with pytest.raises(bnk.AbilityError, match="no_vote"):
            bnk.use_ability(r, pid, c)
    r["vote"] = {"votes": {"p1": "p3", "p2": "p2"}}
    bnk.use_ability(r, "p1", c2)
    assert bnk.tally(r) == {"p3": 2, "p2": 1}
    bnk.use_ability(r, "p0", c1)
    assert r["vote"] is None


def test_immunity_blocks_vote_for_one_round():
    r = make_room()
    cat = give(r, "p2", "immune")
    bnk.use_ability(r, "p2", cat)
    r["vote"] = {"votes": {"p0": "p2", "p1": "p2"}}
    kicked, txt = server.resolve_vote(r)
    assert kicked is None and "под защитой" in txt and r["players"]["p2"]["alive"]
    bnk.new_round(r)
    r["vote"] = {"votes": {"p0": "p2", "p1": "p2"}}
    kicked, _ = server.resolve_vote(r)
    assert kicked == "p2" and not r["players"]["p2"]["alive"]


def test_ally_shield_after_partner_kicked():
    r = make_room()
    cat = give(r, "p0", "ally")
    bnk.use_ability(r, "p0", cat, target="p1")
    r["vote"] = {"votes": {"p2": "p1", "p3": "p1"}}
    assert server.resolve_vote(r)[0] == "p1"
    assert r["players"]["p0"]["ally_shield"] and r["gs"]["log"][-1]["kind"] == "ally_shield"
    r["vote"] = {"votes": {"p2": "p0", "p3": "p0"}}
    assert server.resolve_vote(r)[0] is None and r["players"]["p0"]["alive"]


def test_dead_target_abilities():
    r = make_room()
    c_steal, c_rescue = give(r, "p0", "steal_inv"), give(r, "p1", "rescue")
    with pytest.raises(bnk.AbilityError, match="bad_target"):
        bnk.use_ability(r, "p0", c_steal, target="p2")          # жив — нельзя
    r["players"]["p2"]["alive"] = False
    inv2, inv0 = r["players"]["p2"]["char"]["Крупный инвентарь"], r["players"]["p0"]["char"]["Крупный инвентарь"]
    bnk.use_ability(r, "p0", c_steal, target="p2")
    assert r["players"]["p0"]["char"]["Крупный инвентарь"] == inv0 + bnk.SEP + inv2
    assert r["players"]["p2"]["char"]["Крупный инвентарь"] == bnk.NONE_VAL
    bnk.use_ability(r, "p1", c_rescue, target="p2")
    assert r["players"]["p2"]["alive"]


def test_dead_player_cannot_use():
    r = make_room()
    cat = give(r, "p0", "immune")
    r["players"]["p0"]["alive"] = False
    with pytest.raises(bnk.AbilityError, match="dead"):
        bnk.use_ability(r, "p0", cat)


def test_nullify_blocks_target_ability():
    r = make_room()
    cat = give(r, "p0", "nullify")
    tcat = give(r, "p1", "immune")
    bnk.use_ability(r, "p0", cat, target="p1", pick=tcat)
    with pytest.raises(bnk.AbilityError, match="nulled"):
        bnk.use_ability(r, "p1", tcat)


def test_self_effects_and_heal():
    r = make_room()
    me = r["players"]["p0"]["char"]
    c = give(r, "p0", "add_prof", 0)
    old = me["Профессия"]
    bnk.use_ability(r, "p0", c, rng=random.Random(1))
    first, second = me["Профессия"].split(bnk.SEP)
    assert first == old and second in bnk.POOLS["Профессия"] and second != old
    c = give(r, "p0", "change_age")
    with pytest.raises(bnk.AbilityError, match="bad_pick"):
        bnk.use_ability(r, "p0", c, pick="200 лет")
    bnk.use_ability(r, "p0", c, pick="23 года")
    assert me["Возраст"] == "23 года"

    r2 = make_room()
    c = give(r2, "p0", "non_contagious")
    h = r2["players"]["p0"]["char"]["Здоровье"]
    bnk.use_ability(r2, "p0", c)
    assert r2["players"]["p0"]["char"]["Здоровье"] == h + bnk.SEP + bnk.NON_CONTAGIOUS
    c = give(r2, "p0", "heal")
    bnk.use_ability(r2, "p0", c, target="p3")
    assert r2["players"]["p3"]["char"]["Здоровье"] == bnk.HEALTHY


def test_force_reveal_secret_and_round():
    r = make_room()
    c = give(r, "p0", "force_reveal")
    ev, _ = bnk.use_ability(r, "p0", c, target="p1")
    assert ev["cat"] in r["players"]["p1"]["revealed"]
    c = give(r, "p0", "see_secret")
    _, priv = bnk.use_ability(r, "p0", c)
    assert priv["kind"] == "secret" and priv["value"] in bnk.SECRETS
    r3 = make_room()
    c = give(r3, "p0", "force_round")
    r3["players"]["p1"]["reveals_round"] = 3
    r3["vote"] = {"votes": {}}
    bnk.use_ability(r3, "p0", c)
    assert r3["gs"]["round"] == 2 and r3["players"]["p1"]["reveals_round"] == 0 and r3["vote"] is None


def test_public_state_exposes_ability_status():
    r = make_room()
    cat = give(r, "p0", "immune")
    bnk.use_ability(r, "p0", cat)
    pub = server.bunker_public(r)
    me = next(p for p in pub["players"] if p["id"] == "p0")
    assert me["used"] == [cat] and me["immune"] and cat in me["revealed"]
    assert pub["log"][-1]["kind"] == "immune" and pub["log"][-1]["seq"] == 1
    other = next(p for p in pub["players"] if p["id"] == "p1")
    assert "char" not in other and other["revealed"] == {}      # чужие закрытые карты не утекают
