"""Техасский Холдем — движок. 2-8 игроков. Карта = (rank 2..14, suit 0..3).
Раунды: preflop → flop → turn → river → showdown. Блайнды, колл/чек/рейз/фолд/олл-ин,
сайд-поты при олл-инах. Оценка комбинаций — best 5 из 7."""
import random
from itertools import combinations

RANKS = {2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
         10: "10", 11: "J", 12: "Q", 13: "K", 14: "A"}
SUITS = ["s", "h", "d", "c"]  # spades, hearts, diamonds, clubs
HAND_NAMES = ["Старшая карта", "Пара", "Две пары", "Тройка", "Стрит",
              "Флеш", "Фулл-хаус", "Каре", "Стрит-флеш", "Флеш-рояль"]


def make_deck():
    d = [(r, s) for r in range(2, 15) for s in range(4)]
    random.shuffle(d)
    return d


def eval5(cards):
    """Оценка 5 карт → (category 0..9, tiebreakers). Больше = лучше."""
    ranks = sorted((c[0] for c in cards), reverse=True)
    suits = [c[1] for c in cards]
    rank_counts = {}
    for r in ranks:
        rank_counts[r] = rank_counts.get(r, 0) + 1
    # сортируем ранги по (частота, ранг) убыв.
    ordered = sorted(rank_counts.items(), key=lambda kv: (kv[1], kv[0]), reverse=True)
    counts = [c for _, c in ordered]
    ranked = [r for r, _ in ordered]

    is_flush = len(set(suits)) == 1
    uniq = sorted(set(ranks), reverse=True)
    is_straight = False
    straight_high = None
    if len(uniq) == 5:
        if uniq[0] - uniq[4] == 4:
            is_straight = True
            straight_high = uniq[0]
        elif uniq == [14, 5, 4, 3, 2]:  # колесо A-2-3-4-5
            is_straight = True
            straight_high = 5

    if is_straight and is_flush:
        return (9 if straight_high == 14 else 8, [straight_high])
    if counts == [4, 1]:
        return (7, ranked)
    if counts == [3, 2]:
        return (6, ranked)
    if is_flush:
        return (5, ranks)
    if is_straight:
        return (4, [straight_high])
    if counts == [3, 1, 1]:
        return (3, ranked)
    if counts == [2, 2, 1]:
        return (2, ranked)
    if counts == [2, 1, 1, 1]:
        return (1, ranked)
    return (0, ranks)


def best_hand(seven):
    """Лучшая 5-карточная из 7 → (category, tiebreakers, best5)."""
    best = None
    best5 = None
    for combo in combinations(seven, 5):
        score = eval5(combo)
        if best is None or score > best:
            best = score
            best5 = combo
    return best[0], best[1], best5


def compare(hands):
    """hands = {pid: seven_cards}. Возвращает {pid: (category, tiebreak)} и список победителей (может ничья)."""
    scored = {pid: best_hand(cards)[:2] for pid, cards in hands.items()}
    best = max(scored.values())
    winners = [pid for pid, sc in scored.items() if sc == best]
    return scored, winners


def card_str(c):
    return RANKS[c[0]] + SUITS[c[1]]
