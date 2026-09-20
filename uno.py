"""UNO — движок. 2-10 игроков. Каждый со своего телефона.
Карта: {"c": цвет 0-3 (4=wild), "v": значение}.
  Значения: 0-9 | 'skip'|'rev'|'d2'|'wild'|'wd4'
  No Mercy добавляет: 'd6'(+6 wild)|'d10'(+10 wild)|'skipall'|'discardall'|'revd4'(reverse+4 wild)
Цвета: 0 red, 1 yellow, 2 green, 3 blue.

Режимы (mode):
  'classic'  — как обычно, победа = сбросил все карты.
  'points'   — до лимита очков; проигравшие копят очки за карты на руках, выигрывает у кого меньше.
  'nomercy'  — 168-карт колода, стакинг штрафов, вылет при ≥10 картах, 0=обмен рук по кругу, 7=обмен.
"""
import random

COLORS = ["red", "yellow", "green", "blue"]
DRAW_PENALTY = {"d2": 2, "wd4": 4, "d6": 6, "d10": 10, "revd4": 4}
POINTS = {"skip": 20, "rev": 20, "d2": 20, "skipall": 20, "discardall": 20, "revd4": 20,
          "wild": 50, "wd4": 50, "d6": 50, "d10": 50}  # цифры = номинал


def make_deck(mode="classic"):
    d = []
    if mode == "nomercy":
        for c in range(4):
            d.append({"c": c, "v": 0})
            for v in range(1, 10):
                d.append({"c": c, "v": v}); d.append({"c": c, "v": v})
            for _ in range(2):
                for v in ("skip", "rev", "d2", "skipall", "discardall"):
                    d.append({"c": c, "v": v})
        for _ in range(4):
            for v in ("wild", "wd4", "d6", "d10", "revd4"):
                d.append({"c": 4, "v": v})
    else:
        for c in range(4):
            d.append({"c": c, "v": 0})
            for v in list(range(1, 10)) + ["skip", "rev", "d2"]:
                d.append({"c": c, "v": v}); d.append({"c": c, "v": v})
        for _ in range(4):
            d.append({"c": 4, "v": "wild"}); d.append({"c": 4, "v": "wd4"})
    random.shuffle(d)
    return d


def can_play(card, top, cur_color, pending_penalty=0, mode="classic"):
    # No Mercy: висит несобранный штраф → крыть можно ТОЛЬКО картой штрафа ≥ текущей силы
    if mode == "nomercy" and pending_penalty > 0:
        cv = DRAW_PENALTY.get(card["v"], 0)
        if cv == 0:
            return False
        return cv >= DRAW_PENALTY.get(top["v"], 0)
    if card["c"] == 4:               # wild-типы — всегда можно
        return True
    if card["c"] == cur_color:       # совпал цвет
        return True
    if card["v"] == top["v"]:        # совпало число/символ
        return True
    return False


def draw_from(state, n=1):
    out = []
    for _ in range(n):
        if not state["deck"]:
            if len(state["discard"]) > 1:
                top = state["discard"][-1]
                rest = state["discard"][:-1]
                random.shuffle(rest)
                state["deck"] = rest
                state["discard"] = [top]
            else:
                break
        if state["deck"]:
            out.append(state["deck"].pop())
    return out


def new_uno_state(pids, mode="classic", points_limit=500):
    deck = make_deck(mode)
    state = {"deck": deck, "discard": [], "cur_color": 0, "order": list(pids),
             "hands": {p: [] for p in pids}, "turn": 0, "dir": 1,
             "pending_msg": "", "winner": None, "last_action": "Игра началась",
             "mode": mode, "points_limit": points_limit,
             "scores": {p: 0 for p in pids}, "eliminated": set(),
             "pending_penalty": 0, "round_over": False, "game_over": False,
             "ultimate_winner": None, "no_progress": 0}
    for p in pids:
        state["hands"][p] = [deck.pop() for _ in range(7)]
    while True:
        c = deck.pop()
        if c["v"] not in ("wd4", "d6", "d10", "revd4"):  # не начинаем со штраф-wild
            state["discard"].append(c)
            state["cur_color"] = c["c"] if c["c"] != 4 else random.randint(0, 3)
            break
        deck.insert(0, c)
    return state


def alive_order(state):
    return [p for p in state["order"] if p not in state["eliminated"]]


def cur_player(state):
    return state["order"][state["turn"] % len(state["order"])]


def advance(state, steps=1):
    """Сдвиг хода с пропуском выбывших (в classic/points никто не выбывает — обычный сдвиг)."""
    n = len(state["order"])
    t = state["turn"]
    moved = 0
    while moved < steps:
        t = (t + state["dir"]) % n
        moved += 1
        # пропускаем выбывших, не считая их за шаг
        guard = 0
        while state["order"][t] in state["eliminated"] and guard < n:
            t = (t + state["dir"]) % n
            guard += 1
    state["turn"] = t


def next_player_id(state, steps=1):
    n = len(state["order"])
    t = state["turn"]
    moved = 0
    while moved < steps:
        t = (t + state["dir"]) % n
        moved += 1
        guard = 0
        while state["order"][t] in state["eliminated"] and guard < n:
            t = (t + state["dir"]) % n
            guard += 1
    return state["order"][t]


def hand_points(hand):
    return sum(POINTS.get(c["v"], c["v"] if isinstance(c["v"], int) else 0) for c in hand)


def check_mercy(state, pid):
    """No Mercy: ≥10 карт → вылет. Возвращает True если выбыл."""
    if state["mode"] != "nomercy":
        return False
    if len(state["hands"][pid]) >= 10 and pid not in state["eliminated"]:
        state["eliminated"].add(pid)
        # карты назад в колоду
        state["deck"] += state["hands"][pid]
        random.shuffle(state["deck"])
        state["hands"][pid] = []
        return True
    return False


def rotate_hands(state):
    """Карта 0 в No Mercy — все передают руки по направлению хода (среди живых)."""
    alive = alive_order(state)
    if len(alive) < 2:
        return
    # индексы живых в порядке order, сдвиг по dir
    hands = {p: state["hands"][p] for p in alive}
    order_alive = alive if state["dir"] == 1 else list(reversed(alive))
    rotated = [order_alive[-1]] + order_alive[:-1]
    for src, dst in zip(order_alive, rotated):
        state["hands"][dst] = hands[src]
