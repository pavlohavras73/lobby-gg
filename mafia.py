"""Мафия — классическая социальная дедукция с фазами ночь/день.

Роли:
  mafia    — ночью выбирают жертву (общее решение большинством голосов внутри мафии)
  doctor   — ночью лечит одного (можно себя, но не два раза подряд); спасает от убийства
  sheriff  — ночью проверяет одного: покажет «мафия / не мафия»
  civilian — мирный, только днём голосует

Фазы:
  night — ночные роли делают действия; когда все сходили — разрешение
  day   — обсуждение → голосование → казнь набравшего большинство

Победа:
  civilians — вся мафия мертва
  mafia     — мафии >= мирных (равенство = мафия рулит голосованием)

Здесь — чистая логика без сети (движок). Раздача ролей, разрешение ночи,
подсчёт голосов, проверка победы. Сетевые обёртки — в server.py.
"""
import random

ROLE_META = {
    "mafia":    {"emoji": "🔪", "title": "МАФИЯ",   "team": "mafia",
                 "desc": "Ночью с подельниками выбираешь жертву. Днём прикидывайся мирным."},
    "doctor":   {"emoji": "💉", "title": "ДОКТОР",  "team": "town",
                 "desc": "Ночью лечишь одного игрока — спасаешь от убийства. Себя нельзя два раза подряд."},
    "sheriff":  {"emoji": "🔎", "title": "ШЕРИФ",   "team": "town",
                 "desc": "Ночью проверяешь одного — узнаёшь, мафия он или нет."},
    "patrol":   {"emoji": "🚓", "title": "ПАТРУЛЬНЫЙ", "team": "town",
                 "desc": "Помощник комиссара. Ночью охраняешь игрока: если на него нападут — спасаешь его и узнаёшь, что была атака."},
    "civilian": {"emoji": "👤", "title": "МИРНЫЙ",  "team": "town",
                 "desc": "Ты мирный житель. Днём вычисляй мафию и голосуй."},
}

# роли, у которых есть ночное действие
NIGHT_ROLES = ("mafia", "doctor", "sheriff", "patrol")


def role_composition(n):
    """Сколько кого при n игроках. Сбалансировано для 3–18.
    Мафия ~n/3.5 (на больших столах больше); доктор с 4, шериф с 5, патрульный с 8."""
    if n < 3:
        return None
    mafia = max(1, round(n / 3.5))
    # мафии должно быть строго меньше половины (иначе стартовый перевес)
    while mafia * 2 >= n:
        mafia -= 1
    mafia = max(1, mafia)
    doctor = 1 if n >= 4 else 0
    sheriff = 1 if n >= 5 else 0
    patrol = 1 if n >= 8 else 0
    civilians = n - mafia - doctor - sheriff - patrol
    return {"mafia": mafia, "doctor": doctor, "sheriff": sheriff,
            "patrol": patrol, "civilian": civilians}


def deal_roles(pids):
    """Возвращает {pid: role}. Порядок ролей перемешивается."""
    n = len(pids)
    comp = role_composition(n)
    if not comp:
        return None
    bag = []
    for role, cnt in comp.items():
        bag += [role] * cnt
    random.shuffle(bag)
    ids = list(pids)
    random.shuffle(ids)
    return {pid: bag[i] for i, pid in enumerate(ids)}


def new_state(pids):
    roles = deal_roles(pids)
    if not roles:
        return None
    return {
        "roles": roles,                 # pid -> role
        "alive": {pid: True for pid in pids},
        "phase": "night",               # night | day | over
        "round": 1,
        "night_actions": {},            # pid -> target pid (mafia/doctor/sheriff)
        "sheriff_results": {},          # pid(sheriff) -> {target: "mafia"/"town"}
        "last_doctor_self": False,      # лечил ли доктор себя прошлой ночью
        "votes": {},                    # день: voter pid -> target pid
        "log": [],                      # публичная лента событий
        "winner": None,                 # "town" | "mafia"
        "last_night": None,             # итог прошлой ночи для показа днём
    }


def alive_pids(st):
    return [p for p, a in st["alive"].items() if a]


def alive_by_team(st, team):
    return [p for p in alive_pids(st)
            if ROLE_META[st["roles"][p]]["team"] == team]


def mafia_members(st, only_alive=True):
    src = alive_pids(st) if only_alive else list(st["roles"])
    return [p for p in src if st["roles"][p] == "mafia"]


def check_winner(st):
    """Возвращает 'town' / 'mafia' / None."""
    maf = len(alive_by_team(st, "mafia"))
    town = len(alive_by_team(st, "town"))
    if maf == 0:
        return "town"
    if maf >= town:
        return "mafia"
    return None


# ─────────── НОЧЬ ───────────
def night_role_pending(st):
    """Кто из ночных ролей ещё не сходил (живые mafia/doctor/sheriff/patrol)."""
    pending = set()
    for pid in alive_pids(st):
        if st["roles"][pid] in NIGHT_ROLES and pid not in st["night_actions"]:
            pending.add(pid)
    return pending


def submit_night(st, pid, target):
    """Ночное действие игрока. Возвращает (ok, msg_or_result).
    Для шерифа сразу отдаёт результат проверки этому шерифу."""
    if st["phase"] != "night":
        return False, "Сейчас не ночь."
    if not st["alive"].get(pid):
        return False, "Мёртвые не ходят."
    role = st["roles"][pid]
    if role not in NIGHT_ROLES:
        return False, "У тебя нет ночного действия."
    if target is not None and not st["alive"].get(target):
        return False, "Цель уже мертва."
    # доктор не может лечить себя два раза подряд
    if role == "doctor" and target == pid and st.get("last_doctor_self"):
        return False, "Себя нельзя лечить две ночи подряд."
    # патрульный не охраняет себя
    if role == "patrol" and target == pid:
        return False, "Себя охранять нельзя — выбери другого."
    st["night_actions"][pid] = target
    if role == "sheriff":
        res = "mafia" if st["roles"].get(target) == "mafia" else "town"
        st["sheriff_results"].setdefault(pid, {})[target] = res
        return True, {"check": target, "result": res}
    return True, "ok"


def resolve_night(st):
    """Разрешает ночь: мафия убивает (по большинству голосов мафии),
    доктор лечит, патрульный охраняет. Переводит в день. Возвращает dict-итог."""
    # цель мафии — самая частая среди голосов живой мафии
    maf_votes = [st["night_actions"].get(p) for p in mafia_members(st)]
    maf_votes = [t for t in maf_votes if t is not None]
    victim = None
    if maf_votes:
        tally = {}
        for t in maf_votes:
            tally[t] = tally.get(t, 0) + 1
        mx = max(tally.values())
        top = [t for t, c in tally.items() if c == mx]
        victim = random.choice(top)  # ничья внутри мафии — случайный из лидеров
    # лечение (доктор) и охрана (патрульный) — оба могут спасти
    healed = set(st["night_actions"].get(p) for p in alive_pids(st)
                 if st["roles"][p] == "doctor" and st["night_actions"].get(p) is not None)
    guarded = set(st["night_actions"].get(p) for p in alive_pids(st)
                  if st["roles"][p] == "patrol" and st["night_actions"].get(p) is not None)
    saved = victim is not None and (victim in healed or victim in guarded)
    killed = None
    if victim is not None and not saved:
        st["alive"][victim] = False
        killed = victim
    # патрульному — сообщить, что он предотвратил нападение на охраняемого
    st["patrol_alerts"] = {p: True for p in alive_pids(st)
                           if st["roles"][p] == "patrol"
                           and st["night_actions"].get(p) is not None
                           and st["night_actions"].get(p) == victim}
    # запомнить, лечил ли доктор себя (для правила «не два раза подряд»)
    st["last_doctor_self"] = any(
        st["night_actions"].get(p) == p
        for p in alive_pids(st) if st["roles"][p] == "doctor")
    # переход
    st["night_actions"] = {}
    st["phase"] = "day"
    st["last_night"] = {"killed": killed, "saved": saved,
                        "attacked": victim if saved else None}
    st["winner"] = check_winner(st)
    if st["winner"]:
        st["phase"] = "over"
    return st["last_night"]


# ─────────── ДЕНЬ ───────────
def submit_vote(st, pid, target):
    if st["phase"] != "day":
        return False, "Сейчас не день."
    if not st["alive"].get(pid):
        return False, "Мёртвые не голосуют."
    if target is not None and not st["alive"].get(target):
        return False, "Нельзя голосовать за мёртвого."
    st["votes"][pid] = target   # target=None → воздержался
    return True, "ok"


def day_vote_pending(st):
    """Живые, кто ещё не проголосовал."""
    return [p for p in alive_pids(st) if p not in st["votes"]]


def resolve_day(st):
    """Казнит набравшего большинство (не абсолютное — просто больше всех).
    Ничья или все воздержались → никто. Возвращает dict-итог."""
    tally = {}
    for t in st["votes"].values():
        if t is not None:
            tally[t] = tally.get(t, 0) + 1
    executed = None
    if tally:
        mx = max(tally.values())
        top = [t for t, c in tally.items() if c == mx]
        if len(top) == 1:
            executed = top[0]
            st["alive"][executed] = False
    st["votes"] = {}
    st["winner"] = check_winner(st)
    if st["winner"]:
        st["phase"] = "over"
    else:
        st["phase"] = "night"
        st["round"] += 1
    role = st["roles"].get(executed) if executed else None
    return {"executed": executed, "role": role, "tally": tally}
