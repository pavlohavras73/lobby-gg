"""Дурак (подкидной) — движок. 2-6 игроков, 36 карт, козырь = нижняя карта колоды.
Логика: раздача, можно-ли-побить, подкид по рангам, бита/взятие, добор до 6, определение дурака.
Карты как dict {"r": ранг(6..14), "s": масть(0-3)}. Масти: 0♠ 1♥ 2♦ 3♣.
"""
import random

SUITS = ["♠", "♥", "♦", "♣"]
RANKS = {6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A"}


def make_deck():
    d = [{"r": r, "s": s} for s in range(4) for r in RANKS]
    random.shuffle(d)
    return d


def card_str(c):
    return RANKS[c["r"]] + SUITS[c["s"]]


def beats(defender_card, attack_card, trump):
    """Бьёт ли defender_card карту attack_card при козыре trump (масть)."""
    dc, ac = defender_card, attack_card
    if dc["s"] == ac["s"]:
        return dc["r"] > ac["r"]
    if dc["s"] == trump and ac["s"] != trump:
        return True
    return False


def deal_initial(state):
    for pid in state["order"]:
        while len(state["hands"][pid]) < 6 and state["deck"]:
            state["hands"][pid].append(state["deck"].pop())


def refill(state):
    """Добор до 6: сначала атакующий, по порядку, защищающийся последним."""
    atk = state["attacker"]
    order = state["order"]
    i = order.index(atk)
    seq = order[i:] + order[:i]
    deff = state["defender"]
    seq = [p for p in seq if p != deff] + ([deff] if deff in seq else [])
    for pid in seq:
        while len(state["hands"][pid]) < 6 and state["deck"]:
            state["hands"][pid].append(state["deck"].pop())


def table_ranks(state):
    rs = set()
    for pair in state["table"]:
        rs.add(pair["a"]["r"])
        if pair.get("d"):
            rs.add(pair["d"]["r"])
    return rs


def all_defended(state):
    return state["table"] and all(p.get("d") for p in state["table"])


def alive_players(state):
    """Игроки у кого ещё есть карты или колода не пуста."""
    return [p for p in state["order"] if state["hands"][p] or state["deck"]]


def next_after(state, pid):
    o = [p for p in state["order"] if state["hands"][p] or state["deck"] or p == pid]
    if pid not in o:
        o = state["order"]
    return o[(o.index(pid) + 1) % len(o)]


def next_with_cards(state, pid):
    """Следующий по кругу игрок У КОГО ЕСТЬ карты (вышедшие из игры пропускаются)."""
    order = state["order"]; n = len(order)
    if pid in order:
        i = order.index(pid)
    else:
        i = 0
    for step in range(1, n + 1):
        cand = order[(i + step) % n]
        if state["hands"][cand]:
            return cand
    return None  # ни у кого нет карт


def check_durak(state):
    """Если колода пуста — у кого остались карты последним = дурак. Возвращает pid дурака или None."""
    if state["deck"]:
        return None
    with_cards = [p for p in state["order"] if state["hands"][p]]
    if len(with_cards) <= 1:
        return with_cards[0] if with_cards else "draw"
    return None


def new_durak_state(pids):
    deck = make_deck()
    trump_card = deck[0]  # нижняя карта (останется последней в доборе)
    state = {
        "deck": deck, "trump_card": trump_card, "trump": trump_card["s"],
        "order": list(pids), "hands": {p: [] for p in pids},
        "table": [],  # [{"a": card, "d": card|None}]
        "attacker": pids[0], "defender": pids[1] if len(pids) > 1 else pids[0],
        "passed": set(), "durak": None, "log": "Игра началась",
    }
    deal_initial(state)
    return state
