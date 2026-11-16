"""Бункер — мультиплеер пати-игра. Каждый игрок со своего телефона, ведущий тоже играет.
Ручное вскрытие ячеек (видно всем), пульт ведущего, mobile-first, абсурд/18+ контент.
По ТЗ Rainar (chat 28.06). Стек: тот же что у Шпиона (websocket-комнаты в server.py).
"""
import random

# ── Сценарии катастрофы + бункер ──
SCENARIOS = [
    "Метеорит размером с Бельгию превратил поверхность в стекло. Снаружи −200°C.",
    "Утечка нейротоксина: все наверху превратились в агрессивных слизней.",
    "ИИ захватил дроны и охотится на людей. Электроника снаружи = смерть.",
    "Грибковая пандемия: споры превращают людей в ходячие грибницы за 3 часа.",
    "Ядерная зима, 40 лет тьмы. Радиация убивает за сутки без укрытия.",
    "Разлом в реальности: наружу выходят твари из чужого измерения.",
    "Океаны вскипели, атмосфера выгорает. Кислород только в бункере.",
]
BUNKER_INFO = [
    "Бункер на 50 м под землёй. Запас еды на 1 год, мест меньше чем людей.",
    "Старый советский бункер. Протечка реактора в дальнем крыле. Воды на 8 месяцев.",
    "Роскошный бункер миллиардера: спа, но еды всего на полгода и сломан фильтр воздуха.",
    "Тесный бункер на 4 человека, вас больше. Генератор барахлит.",
]

# ── Пулы карточек (абсурд + 18+), ~14 на категорию ──
POOLS = {
    "Пол / Раса": [
        "Мужчина, альбинос 2.10м", "Женщина, карлица-бодибилдер", "Небинарная персона, рыжая",
        "Мужчина, сиамский близнец (второй спит)", "Женщина, гермафродит", "Мужик, бывший качок-ныне-скелет",
        "Женщина, 7 месяцев беременна тройней", "Транс-женщина, экс-морпех", "Мужчина, без обеих рук",
        "Женщина-гигант 2.30м", "Мужчина, голубых кровей (буквально синяя кожа)", "Интерсекс, гениальный ребёнок в теле взрослого",
        "Женщина, сросшиеся пальцы", "Мужчина, третий сосок-детектор лжи",
    ],
    "Возраст": [
        "9 лет (вундеркинд)", "16 лет", "19 лет", "23 года", "28 лет", "34 года", "41 год",
        "55 лет", "67 лет", "78 лет", "92 года (но бодрый)", "104 года", "13 лет (готка)", "47 лет",
    ],
    "Телосложение": [
        "Анорексия, 38 кг", "Ожирение 180 кг", "Атлет в идеальной форме", "Дрыщ, но выносливый",
        "Беременный живот (у мужика тоже)", "Культурист на стероидах", "Карлик-крепыш", "Высокий и хилый",
        "Один глаз, одна нога", "Тело покрыто татуировками-оберегами", "Горбун с огромной силой рук",
        "Идеальные зубы, остальное гниёт", "Гибкий как акробат", "Парализованы ноги, руки-кувалды",
    ],
    "Профессия": [
        "Гинеколог (стаж 20 лет)", "Ассенизатор-философ", "Безработный тиктокер", "Военный хирург",
        "Повар-отравитель (в прошлом)", "Учитель ОБЖ", "Проститутка с медобразованием", "Священник-расстрига",
        "Инженер-ядерщик (алкаш)", "Палач (на пенсии)", "Психолог-манипулятор", "Фермер-выживальщик",
        "Хакер 17 лет", "Бывший крёстный отец мафии", "Ветеринар (лечит и людей)", "Клоун-аниматор с ПТСР",
    ],
    "Здоровье": [
        "Абсолютно здоров", "ВИЧ (на терапии)", "Бесплоден", "Аллергия на всё кроме воды",
        "Туберкулёз (заразен)", "Диабет, нужен инсулин", "Шизофрения (3 голоса советуют)", "Иммунитет как у бога",
        "Рак 2 стадии (медленный)", "Эпилепсия", "Хронический понос", "Сломанная психика, но крепкое тело",
        "Беременность + здоров", "Клептомания + идеальное зрение",
    ],
    "Хобби / Увлечения": [
        "Каннибализм (только по праздникам)", "Вязание из человеческих волос", "Бодибилдинг",
        "Коллекционирует зубы", "Готовит ресторанного уровня", "Дрессировка крыс", "Гербарий из ядовитых трав",
        "Танцы на пилоне", "Самогоноварение", "Ставит опыты на себе", "Оружейный мастер-любитель",
        "Пишет порно-фанфики", "Медитация (реально помогает)", "Таксидермия",
    ],
    "Фобии / Страхи": [
        "Боязнь темноты (а тут бункер)", "Клаустрофобия (а тут бункер!)", "Панически боится женщин",
        "Боязнь крови (но врач)", "Гемофобия", "Боится детей", "Страх замкнутого пространства",
        "Боязнь микробов (тут грязно)", "Никтофобия", "Боится сойти с ума", "Не боится ничего (психопат)",
        "Боязнь еды (анорексия)", "Боится спать", "Арахнофобия (а в бункере пауки)",
    ],
    "Крупный инвентарь": [
        "Канистра самогона 20л", "Ящик консервов на год", "Снайперская винтовка + патроны",
        "Аптечка хирурга", "Генератор на солнечных батареях", "Швейная машинка + ткань", "Бензопила",
        "Библиотека по выживанию", "Ящик семян (можно выращивать)", "Дойная коза", "Холодильник с вакциной",
        "Радиостанция дальней связи", "Гроб (вместительный)", "Надувная секс-кукла (можно как подушку)",
    ],
    "Рюкзак": [
        "Нож + спички + фляга", "Презервативы (100 шт)", "Пачка антибиотиков", "Колода карт + кубики",
        "Пистолет (1 патрон)", "Дневник предыдущего жителя", "Витамины на год", "Верёвка 50м + крюк",
        "Семена конопли", "Фонарик + батарейки", "Зажигалка Zippo (вечная)", "Соль (1 кг — ценность!)",
        "Библия + Коран + Тора", "Виагра (упаковка)",
    ],
    "Доп. сведения": [
        "Знает код от соседнего склада с едой", "Умеет принимать роды", "Тайно влюблён в ведущего",
        "Бесплоден, но мечтает о детях", "Видел карту других бункеров", "Был военнопленным, терпит пытки",
        "Полиглот (8 языков)", "Умеет чинить любую технику", "Скрывает что заражён", "Был донором органов",
        "Знает рецепт лекарства от чумы", "Гипнотизёр", "Помнит всё (эйдетик)", "Тайно вегетарианец-радикал",
    ],
    "Спецспособность 1": [
        "Раз за игру: заглянуть в любую закрытую карту игрока", "Раз за игру: отменить голосование",
        "Иммунитет к изгнанию на 1 раунд", "Поменяться одной картой с любым игроком",
        "Раз за игру: добавить себе случайную профессию", "Вылечить любую болезнь (свою или чужую)",
        "Раз за игру: украсть инвентарь изгнанного", "Заставить игрока вскрыть случайную карту",
    ],
    "Спецспособность 2": [
        "Раз за игру: переголосовать (твой голос ×2)", "Раз за игру: спасти изгнанного (вернуть)",
        "Обнулить чужую спецспособность", "Раз за игру: тайно увидеть сценарий-секрет",
        "Поменять свой возраст на любой", "Раз за игру: объединиться с игроком (вас не изгнать вместе)",
        "Раз за игру: форсировать новый раунд карт", "Сделать свою болезнь незаразной навсегда",
    ],
}

CATEGORIES = list(POOLS.keys())


def make_character():
    """Случайный персонаж — по одной карте из каждой категории."""
    return {cat: random.choice(opts) for cat, opts in POOLS.items()}


def new_game_state(n_players):
    seats = max(1, n_players // 2)  # выживает примерно половина
    return {
        "scenario": random.choice(SCENARIOS),
        "bunker": random.choice(BUNKER_INFO),
        "seats": seats,
        "round": 1,
    }


# ── Активные спецспособности ──
# Карты «Спецспособность 1/2» — одноразовые действия. Применение вскрывает карту для всех.
ABILITY_CATS = ("Спецспособность 1", "Спецспособность 2")
ABILITY_IDS = {
    "Раз за игру: заглянуть в любую закрытую карту игрока": "peek",
    "Раз за игру: отменить голосование": "cancel_vote",
    "Иммунитет к изгнанию на 1 раунд": "immune",
    "Поменяться одной картой с любым игроком": "swap",
    "Раз за игру: добавить себе случайную профессию": "add_prof",
    "Вылечить любую болезнь (свою или чужую)": "heal",
    "Раз за игру: украсть инвентарь изгнанного": "steal_inv",
    "Заставить игрока вскрыть случайную карту": "force_reveal",
    "Раз за игру: переголосовать (твой голос ×2)": "double_vote",
    "Раз за игру: спасти изгнанного (вернуть)": "rescue",
    "Обнулить чужую спецспособность": "nullify",
    "Раз за игру: тайно увидеть сценарий-секрет": "see_secret",
    "Поменять свой возраст на любой": "change_age",
    "Раз за игру: объединиться с игроком (вас не изгнать вместе)": "ally",
    "Раз за игру: форсировать новый раунд карт": "force_round",
    "Сделать свою болезнь незаразной навсегда": "non_contagious",
}
assert set(ABILITY_IDS) == set(POOLS[ABILITY_CATS[0]]) | set(POOLS[ABILITY_CATS[1]])

# что нужно выбрать: target = alive_other | alive_any | dead | none; pick = target_closed | swap_cat | target_ability | age | None
ABILITY_SPEC = {
    "peek": ("alive_other", "target_closed"), "cancel_vote": ("none", None), "immune": ("none", None),
    "swap": ("alive_other", "swap_cat"), "add_prof": ("none", None), "heal": ("alive_any", None),
    "steal_inv": ("dead", None), "force_reveal": ("alive_other", None), "double_vote": ("none", None),
    "rescue": ("dead", None), "nullify": ("alive_other", "target_ability"), "see_secret": ("none", None),
    "change_age": ("none", "age"), "ally": ("alive_other", None), "force_round": ("none", None),
    "non_contagious": ("none", None),
}

SEP = " ＋ "          # склейка карт («Профессия ＋ вторая профессия»); клиент переводит части по отдельности
NONE_VAL = "—"
NON_CONTAGIOUS = "Не заразно"
HEALTHY = "Абсолютно здоров"
SWAP_CATS = [c for c in CATEGORIES if c not in ABILITY_CATS]

SECRETS = [
    "В бункере уже кто-то живёт — и он не рад гостям.",
    "Через 3 месяца откроется соседний бункер с едой.",
    "Фильтр воздуха рассчитан на одного человека меньше, чем мест.",
    "Один из запасов еды отравлен.",
    "Снаружи есть выжившие, они ищут вход.",
    "В бункере спрятан тайник с оружием.",
]


class AbilityError(Exception):
    pass


def ability_of(char, cat):
    return ABILITY_IDS.get((char or {}).get(cat, ""))


def _alive(room, q):
    p = room["players"].get(q)
    return bool(p) and p.get("alive", True)


def is_protected(room, q):
    """Иммунитет от изгнания голосованием: на текущий раунд или навсегда (союз)."""
    p = room["players"].get(q) or {}
    rnd = room.get("gs", {}).get("round", 1)
    return p.get("immune_round") == rnd or bool(p.get("ally_shield"))


def on_kicked(room, kicked):
    """Изгнан один из союзников → второго больше нельзя изгнать голосованием. Возвращает событие или None."""
    p = room["players"].get(kicked) or {}
    ally = p.get("ally")
    if ally and _alive(room, ally) and not room["players"][ally].get("ally_shield"):
        room["players"][ally]["ally_shield"] = True
        ev = {"kind": "ally_shield", "actor": room["players"][ally]["name"], "target": p.get("name"), "cat": None}
        add_log(room, ev)
        return ev
    return None


def new_round(room):
    gs = room.setdefault("gs", {})
    gs["round"] = gs.get("round", 1) + 1
    for p in room["players"].values():
        p["reveals_round"] = 0
    room["vote"] = None


def use_ability(room, pid, cat, target=None, pick=None, rng=random):
    """Применить спецспособность. Возвращает (event, private|None). Ошибка → AbilityError(код)."""
    p = room["players"].get(pid)
    if not p or room.get("state") != "playing":
        raise AbilityError("not_playing")
    if cat not in ABILITY_CATS:
        raise AbilityError("bad_card")
    if not p.get("alive", True):
        raise AbilityError("dead")
    used, nulled = p.setdefault("used", set()), p.setdefault("nulled", set())
    if cat in used:
        raise AbilityError("used")
    if cat in nulled:
        raise AbilityError("nulled")
    ab = ability_of(p.get("char"), cat)
    if not ab:
        raise AbilityError("bad_card")
    need_t, need_pick = ABILITY_SPEC[ab]
    players = room["players"]
    t = players.get(target) if target else None
    if need_t == "alive_other" and (not t or target == pid or not t.get("alive", True)):
        raise AbilityError("bad_target")
    if need_t == "alive_any" and (not t or not t.get("alive", True)):
        raise AbilityError("bad_target")
    if need_t == "dead" and (not t or t.get("alive", True)):
        raise AbilityError("bad_target")
    vote = room.get("vote")
    my, tc = p["char"], (t or {}).get("char") or {}
    ev = {"kind": ab, "actor": p["name"], "target": t["name"] if t else None, "cat": None}
    private = None

    if ab == "peek":
        if pick not in CATEGORIES or pick in (t.get("revealed") or set()):
            raise AbilityError("bad_pick")
        private = {"kind": "peek", "target": t["name"], "cat": pick, "value": tc.get(pick)}
    elif ab == "cancel_vote":
        if vote is None:
            raise AbilityError("no_vote")
        room["vote"] = None
    elif ab == "immune":
        p["immune_round"] = room.get("gs", {}).get("round", 1)
    elif ab == "swap":
        if pick not in SWAP_CATS:
            raise AbilityError("bad_pick")
        my[pick], tc[pick] = tc.get(pick), my.get(pick)
        ev["cat"] = pick
    elif ab == "add_prof":
        cur = my.get("Профессия", "")
        opts = [x for x in POOLS["Профессия"] if x not in cur.split(SEP)]
        my["Профессия"] = cur + SEP + rng.choice(opts) if cur else rng.choice(opts)
    elif ab == "heal":
        tc["Здоровье"] = HEALTHY
    elif ab == "steal_inv":
        inv = tc.get("Крупный инвентарь")
        if not inv or inv == NONE_VAL:
            raise AbilityError("empty")
        mine = my.get("Крупный инвентарь")
        my["Крупный инвентарь"] = inv if (not mine or mine == NONE_VAL) else mine + SEP + inv
        tc["Крупный инвентарь"] = NONE_VAL
    elif ab == "force_reveal":
        closed = [c for c in CATEGORIES if c not in (t.get("revealed") or set())]
        if not closed:
            raise AbilityError("bad_target")
        c = rng.choice(closed)
        t.setdefault("revealed", set()).add(c)
        ev["cat"] = c
    elif ab == "double_vote":
        if vote is None:
            raise AbilityError("no_vote")
        vote.setdefault("double", set()).add(pid)
    elif ab == "rescue":
        t["alive"] = True
    elif ab == "nullify":
        if pick not in ABILITY_CATS or pick in t.setdefault("used", set()) or pick in t.setdefault("nulled", set()):
            raise AbilityError("bad_pick")
        t["nulled"].add(pick)
    elif ab == "see_secret":
        gs = room.setdefault("gs", {})
        if not gs.get("secret"):
            gs["secret"] = rng.choice(SECRETS)
        private = {"kind": "secret", "value": gs["secret"]}
    elif ab == "change_age":
        if pick not in POOLS["Возраст"]:
            raise AbilityError("bad_pick")
        my["Возраст"] = pick
    elif ab == "ally":
        if p.get("ally") or t.get("ally"):
            raise AbilityError("bad_target")
        p["ally"], t["ally"] = target, pid
    elif ab == "force_round":
        new_round(room)
    elif ab == "non_contagious":
        h = my.get("Здоровье", "")
        if NON_CONTAGIOUS not in h.split(SEP):
            my["Здоровье"] = h + SEP + NON_CONTAGIOUS if h else NON_CONTAGIOUS

    used.add(cat)
    p.setdefault("revealed", set()).add(cat)   # применение = вскрытие карты (не тратит лимит вскрытий)
    if private:
        p.setdefault("notes", []).append(private)
    add_log(room, ev)
    return ev, private


def add_log(room, ev):
    gs = room.setdefault("gs", {})
    gs["log_seq"] = gs.get("log_seq", 0) + 1
    ev["seq"] = gs["log_seq"]
    log = gs.setdefault("log", [])
    log.append(ev)
    del log[:-30]


def tally(room):
    """Подсчёт голосов с учётом «голос ×2»."""
    vote = room.get("vote") or {}
    dbl = vote.get("double") or set()
    out = {}
    for voter, tgt in (vote.get("votes") or {}).items():
        out[tgt] = out.get(tgt, 0) + (2 if voter in dbl else 1)
    return out


def my_abilities(char):
    """Для личной карты игрока: что требует каждая его способность (клиент строит по этому окно выбора)."""
    out = {}
    for c in ABILITY_CATS:
        ab = ability_of(char, c)
        if ab:
            tgt, pick = ABILITY_SPEC[ab]
            out[c] = {"id": ab, "target": tgt, "pick": pick}
    return out
