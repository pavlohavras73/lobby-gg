"""Jarvis Games — мультиплеер пати-игры (комнаты по коду, каждый на своём телефоне).
Фаза 1: Шпион (Spyfall). Структура расширяемая под Бункер и др.
Stack: FastAPI + WebSocket. Игроки заходят на /games, создают/входят в комнату по коду.
"""
import asyncio, json, random, string, os, re, urllib.request, logging, threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
app = FastAPI()

app.mount("/games/static", StaticFiles(directory="/app/static"), name="static")

USAGE_LOG = "/data/games_usage.jsonl"
def log_usage(event, name, game, code, ws=None, username=None):
    """Кто/когда/во что играет — лёгкий трекинг, ничего не блокирует."""
    try:
        import datetime
        ip = ws.client.host if ws and ws.client else "?"
        entry = {"t": datetime.datetime.now(datetime.timezone.utc).isoformat(), "event": event,
                 "name": name[:20], "game": game, "code": code, "ip": ip, "user": username or "?"}
        with open(USAGE_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass


# ═══════════ АУТЕНТИФИКАЦИЯ: регистрация/логин/сессии/роли ═══════════
import sqlite3, hashlib, hmac, secrets, time

AUTH_DB = "/data/users.db"
AUTH_SECRET_PATH = "/data/auth_secret.txt"

def _auth_secret():
    if not os.path.exists(AUTH_SECRET_PATH):
        with open(AUTH_SECRET_PATH, "w") as f:
            f.write(secrets.token_hex(32))
    return open(AUTH_SECRET_PATH).read().strip()

def _auth_db():
    con = sqlite3.connect(AUTH_DB)
    con.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, salt TEXT, pwhash TEXT, "
                "role TEXT DEFAULT 'member', created_at TEXT)")
    con.commit()
    return con

def _hash_pw(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 100_000).hex()

def _seed_root():
    """Create the initial root account, only if ROOT_USERNAME and ROOT_PASSWORD are set in the environment."""
    user, pw = os.environ.get("ROOT_USERNAME", ""), os.environ.get("ROOT_PASSWORD", "")
    if not user or not pw:
        return
    con = _auth_db()
    if not con.execute("SELECT 1 FROM users WHERE username=?", (user,)).fetchone():
        salt = secrets.token_hex(16)
        con.execute("INSERT INTO users VALUES (?,?,?,?,?)",
                    (user, salt, _hash_pw(pw, salt), "root",
                     __import__("datetime").datetime.now().isoformat()))
        con.commit()
    con.close()
_seed_root()

def _make_session(username, role):
    exp = str(int(time.time()) + 60*60*24*90)  # 90 дней
    payload = f"{username}|{role}|{exp}"
    sig = hmac.new(_auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}|{sig}"

def _check_session(token):
    if not token: return None
    parts = token.split("|")
    if len(parts) != 4: return None
    username, role, exp, sig = parts
    payload = f"{username}|{role}|{exp}"
    good = hmac.new(_auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(good, sig): return None
    if int(exp) < time.time(): return None
    return {"username": username, "role": role}

def current_user(request: Request):
    return _check_session(request.cookies.get("jsession"))

LOGIN_PAGE = """<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>Вход — Jarvis Games</title><link rel="stylesheet" href="/games/static/theme.css">
<style>
  .login-hero{text-align:center;padding:26px 0 6px}
  .logo{font-size:36px;font-weight:900;letter-spacing:3px;
    background:linear-gradient(90deg,#fff 30%,#ff2238);-webkit-background-clip:text;background-clip:text;color:transparent;
    text-shadow:0 0 40px rgba(255,34,56,.25)}
  .logo .dot{color:#ff2238;-webkit-text-fill-color:#ff2238}
  .tabs{display:flex;gap:8px;margin-bottom:14px;background:rgba(255,255,255,.04);padding:4px;border-radius:14px}
  .tabs button{flex:1;margin:0;padding:11px;border-radius:11px;background:transparent;box-shadow:none;font-size:14px}
  .tabs button.off{background:transparent;color:var(--muted);box-shadow:none}
  .tabs button:not(.off){background:linear-gradient(135deg,var(--crimson),var(--crimson-deep));box-shadow:0 2px 12px rgba(255,34,56,.3)}
  .tabs button::after{display:none}
  .hint{font-size:11.5px;color:#5c5c64;text-align:center;margin-top:10px;line-height:1.5}
</style></head><body>
<div class="login-hero">
  <div class="logo float">JARVIS<span class="dot">·</span>GAMES</div>
  <div class="sub">войди или зарегистрируйся — играть с друзьями</div>
</div>
<div class="card" style="max-width:340px;margin:0 auto">
  <div class="tabs"><button id="tabLogin" onclick="showTab('login')">Войти</button>
  <button id="tabReg" class="off" onclick="showTab('reg')">Регистрация</button></div>
  <div id="loginForm">
    <input id="lu" placeholder="Имя пользователя" maxlength="20" autocomplete="username">
    <input id="lp" type="password" placeholder="Пароль" maxlength="40" autocomplete="current-password">
    <button onclick="doLogin()">Войти →</button>
  </div>
  <div id="regForm" class="hide">
    <input id="ru" placeholder="Придумай имя пользователя" maxlength="20" autocomplete="username">
    <input id="rp" type="password" placeholder="Придумай пароль" maxlength="40" autocomplete="new-password">
    <button onclick="doReg()">Создать аккаунт →</button>
    <div class="hint">Пароль решает уровень доступа. Обычным игрокам — просто придумай что-нибудь.</div>
  </div>
  <div id="status" class="sub" style="min-height:18px;margin-top:6px"></div>
</div>
<script>
document.addEventListener('keydown',e=>{if(e.key==='Enter'){
  document.getElementById('loginForm').classList.contains('hide')?doReg():doLogin();}});
function showTab(t){
  document.getElementById('loginForm').classList.toggle('hide', t!=='login');
  document.getElementById('regForm').classList.toggle('hide', t!=='reg');
  document.getElementById('tabLogin').classList.toggle('off', t!=='login');
  document.getElementById('tabReg').classList.toggle('off', t!=='reg');
}
async function doLogin(){
  const r = await fetch('/games/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:document.getElementById('lu').value,password:document.getElementById('lp').value})});
  const d = await r.json();
  if(d.ok) location.href='/games'; else document.getElementById('status').textContent = d.error||'Ошибка входа';
}
async function doReg(){
  const r = await fetch('/games/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:document.getElementById('ru').value,password:document.getElementById('rp').value})});
  const d = await r.json();
  if(d.ok) location.href='/games'; else document.getElementById('status').textContent = d.error||'Ошибка регистрации';
}
</script></body></html>"""

@app.get("/tetris")
async def tetris_page():
    return FileResponse("/app/static/tetris.html")

@app.get("/race")
async def race_page():
    return FileResponse("/app/static/race.html")

@app.get("/wordle")
async def wordle_page():
    return FileResponse("/app/static/wordle.html")

@app.get("/arrows")
async def arrows_page():
    return FileResponse("/app/static/arrows.html")

import bunker as bnk
import alias as al
import durak as dk
import uno as un
import chess as chs
import poker as pk
import mafia as mf
import variants as vr
import connect4_3d as c4d
from quoridor import new_quoridor_state, get_valid_pawn_moves, can_place_wall, apply_pawn_move, apply_wall_placement, bot_choose_action

@app.get("/g2048")
async def g2048_page():
    return FileResponse("/app/static/g2048.html")

@app.get("/snake")
async def snake_page():
    return FileResponse("/app/static/snake.html")

@app.get("/space_invaders")
async def space_invaders_page():
    return FileResponse("/app/static/space_invaders.html")

@app.get("/fifteen")
async def fifteen_page():
    return FileResponse("/app/static/fifteen.html")

@app.get("/mines")
async def mines_page():
    return FileResponse("/app/static/mines.html")


LOCATIONS = [
    "Школа", "Больница", "Самолёт", "Пляж", "Казино", "Банк", "Космическая станция",
    "Подводная лодка", "Цирк", "Ресторан", "Военная база", "Полицейский участок",
    "Круизный лайнер", "Театр", "Отель", "Супермаркет", "Метро", "Стадион",
]

# Паки-пресеты для Шпиона: тапаешь в лобби → активен, секрет тянется из объединённого пула.
SPY_PACKS = {
    "Классика": {"emoji": "🕵️", "items": LOCATIONS},
    "Marvel": {"emoji": "🦸", "items": [
        "Железный человек", "Человек-паук", "Тор", "Халк", "Капитан Америка", "Чёрная вдова",
        "Локи", "Танос", "Доктор Стрэндж", "Чёрная пантера", "Алая ведьма", "Соколиный глаз",
        "Дэдпул", "Росомаха", "Грут", "Вижн", "Человек-муравей", "Гамора", "Ник Фьюри", "Веном"]},
    "Атака титанов": {"emoji": "⚔️", "items": [
        "Эрен", "Микаса", "Армин", "Леви", "Эрвин", "Историа", "Райнер", "Бертольд", "Энни",
        "Ханджи", "Жан", "Саша", "Конни", "Зик", "Имир", "Гриша", "Кенни", "Фалько", "Габи", "Пик"]},
    "Гарри Поттер": {"emoji": "⚡", "items": [
        "Гарри", "Рон", "Гермиона", "Дамблдор", "Снейп", "Волдеморт", "Хагрид", "Драко",
        "МакГонагалл", "Сириус", "Люпин", "Добби", "Беллатриса", "Полумна", "Невилл", "Джинни",
        "Фред", "Джордж", "Молли", "Грюм"]},
}


# Персистентная библиотека крафта (переживает рестарты). {name: [items]}
CRAFT_CACHE = os.environ.get("SPY_CACHE", "/data/spy_packs.json")


def _load_crafted():
    try:
        with open(CRAFT_CACHE, encoding="utf-8") as f:
            d = json.load(f)
            return d if isinstance(d, dict) else {}
    except Exception:
        return {}


def _save_crafted():
    for path in (CRAFT_CACHE, "/tmp/spy_packs.json"):
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(CRAFTED, f, ensure_ascii=False)
            return True
        except Exception:
            continue
    return False


CRAFTED = _load_crafted()


def spy_lookup(name):
    if name in SPY_PACKS:
        return SPY_PACKS[name]["items"]
    return CRAFTED.get(name)


def spy_init(room):
    if "spy_active" not in room:
        room["spy_active"] = ["Классика"]


def spy_packs_payload(room):
    spy_init(room)
    presets = [{"name": n, "emoji": d["emoji"], "active": n in room["spy_active"], "count": len(d["items"])}
               for n, d in SPY_PACKS.items()]
    custom = [{"name": n, "active": n in room["spy_active"], "count": len(v)} for n, v in CRAFTED.items()]
    return {"type": "spy_packs", "presets": presets, "custom": custom}


rooms = {}  # code -> {"players": {pid: {"name","ws","role","alive"}}, "host": pid, "state": "lobby", "game": "spy"}

# ── Присутствие (онлайн-статус друзей) ──────────────────────────────────────
# username -> {"n": число активных соединений, "game": текущая игра или None, "seen": ts}
import time as _time
ONLINE = {}

def _presence_add(username):
    e = ONLINE.setdefault(username, {"n": 0, "game": None, "seen": 0})
    e["n"] += 1; e["seen"] = _time.time()

def _presence_game(username, game):
    if username in ONLINE:
        ONLINE[username]["game"] = game

def _presence_remove(username):
    e = ONLINE.get(username)
    if not e:
        return
    e["n"] -= 1; e["seen"] = _time.time()
    if e["n"] <= 0:
        e["game"] = None
        # оставляем запись с seen для «был N минут назад», но n=0 = offline

def _presence_of(username):
    e = ONLINE.get(username)
    if e and e["n"] > 0:
        return {"online": True, "game": e.get("game")}
    return {"online": False, "game": None, "last": (e.get("seen") if e else None)}


def code4():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=4))


async def broadcast(room, payload):
    dead = []
    for pid, p in room["players"].items():
        if not p.get("ws"):      # бот (ws=None) — пропускаем, не удаляем
            continue
        try:
            await p["ws"].send_json(payload)
        except Exception:
            dead.append(pid)
    for pid in dead:
        room["players"].pop(pid, None)


def lobby_state(room):
    return {"type": "lobby", "code": room["code"], "host": room["host"],
            "players": [{"id": pid, "name": p["name"], "bot": bool(p.get("bot"))} for pid, p in room["players"].items()],
            "game": room.get("game", "spy")}


async def start_spy(room, timer_min=5):
    pids = list(room["players"].keys())
    if len(pids) < 3:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 3 игрока (можно добрать ботами)."})
        return
    try:
        secs = max(0, min(20, int(timer_min))) * 60
    except Exception:
        secs = 300
    spy_init(room)
    pool = []
    wmap = {}   # слово -> из какого пака (для подсказки-категории)
    for n in room["spy_active"]:
        items = spy_lookup(n)
        if items:
            for it in items:
                pool.append(it)
                wmap.setdefault(it, n)
    pool = list(dict.fromkeys(pool)) or LOCATIONS   # dedup, fallback на классику
    loc = random.choice(pool)
    cat = wmap.get(loc, "Локации")
    is_loc = (cat == "Классика")
    spy = random.choice(pids)
    room["state"] = "playing"
    for pid, p in room["players"].items():
        if pid == spy:
            p["role"] = {"spy": True, "location": None}
        else:
            p["role"] = {"spy": False, "location": loc}
        if not p.get("ws"):
            continue
        if p["role"]["spy"]:
            await p["ws"].send_json({"type": "role", "spy": True, "timer": secs, "cat": cat,
                                     "title": "🕵️ ТЫ ШПИОН",
                                     "sub": f"Категория: «{cat}». Вычисли что загадано и не спались."})
        else:
            await p["ws"].send_json({"type": "role", "spy": False, "timer": secs, "cat": cat,
                                     "title": f"🎴 {loc}",
                                     "sub": ("Найди шпиона вопросами. Не называй локацию напрямую." if is_loc
                                             else f"Персонаж из «{cat}». Найди шпиона, не называй имя напрямую.")})
    await broadcast(room, {"type": "started", "n": len(pids)})


# ─────────────── БУНКЕР ───────────────
def bunker_public(room):
    """Публичная доска: игроки + только ВСКРЫТЫЕ ячейки, статус, сценарий, голосование."""
    gs = room.get("gs", {})
    vote = room.get("vote")
    players = []
    for pid, p in room["players"].items():
        char = p.get("char") or {}
        rev = p.get("revealed") or set()
        players.append({
            "id": pid, "name": p["name"], "alive": p.get("alive", True),
            "revealed": {cat: char.get(cat) for cat in rev},
            "total": len(bnk.CATEGORIES),
        })
    out = {"type": "bunker_state", "host": room["host"],
           "scenario": gs.get("scenario", ""), "bunker": gs.get("bunker", ""),
           "seats": gs.get("seats", 0), "round": gs.get("round", 1),
           "settings": room.get("settings", {}),
           "categories": bnk.CATEGORIES, "players": players, "vote": None}
    if vote is not None:
        # тэлли: кто сколько голосов набрал
        tally = {}
        for t in vote["votes"].values():
            tally[t] = tally.get(t, 0) + 1
        alive_ids = [pid for pid, p in room["players"].items() if p.get("alive", True)]
        out["vote"] = {"active": True, "voted": list(vote["votes"].keys()),
                       "tally": tally, "need": len(alive_ids)}
    return out


def resolve_vote(room):
    """Подсчёт голосов: изгоняется набравший больше всех (при ничьей — никто)."""
    vote = room.get("vote") or {"votes": {}}
    tally = {}
    for t in vote["votes"].values():
        tally[t] = tally.get(t, 0) + 1
    room["vote"] = None
    if not tally:
        return None, "Никто не проголосовал."
    mx = max(tally.values())
    top = [pid for pid, c in tally.items() if c == mx]
    if len(top) != 1:
        names = ", ".join(room["players"][p]["name"] for p in top if p in room["players"])
        return None, f"Ничья ({names}) — никого не изгнали."
    kicked = top[0]
    if kicked in room["players"]:
        room["players"][kicked]["alive"] = False
        return kicked, f"🚫 Изгнан: {room['players'][kicked]['name']} ({mx} голосов)"
    return None, "Игрок уже не в игре."


async def start_bunker(room):
    pids = list(room["players"].keys())
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 2 игрока."})
        return
    room["gs"] = bnk.new_game_state(len(pids))
    st = room.get("settings", {})
    if st.get("seats"):
        room["gs"]["seats"] = int(st["seats"])
    room["vote"] = None
    room["state"] = "playing"
    for pid, p in room["players"].items():
        p["char"] = bnk.make_character()
        p["revealed"] = set()
        p["reveals_round"] = 0
        p["alive"] = True
        if not p.get("ws"):
            continue
        await p["ws"].send_json({"type": "bunker_char", "char": p["char"],
                                 "categories": bnk.CATEGORIES})
    await broadcast(room, bunker_public(room))


async def push_bunker(room):
    await broadcast(room, bunker_public(room))

async def start_variants(room):
    vr.start_round(room)
    await broadcast(room, vr.variants_public(room))

async def push_variants(room):
    await broadcast(room, vr.variants_public(room))


# ─────────────── ЭЛИАС (ALIAS) ───────────────
def alias_public(room):
    a = room.get("al", {})
    mode = a.get("mode", "solo")
    def names(ids): return [room["players"][i]["name"] for i in ids if i in room["players"]]
    exp = a.get("explainer")
    out = {"type": "alias_state", "host": room["host"], "mode": mode,
           "settings": a.get("settings", {}),
           "turn": a.get("turn", 0),
           "explainer": exp, "explainer_name": room["players"].get(exp, {}).get("name", "") if exp else "",
           "round_active": a.get("round_active", False),
           "langs": al.LANGS, "diffs": al.DIFFS, "winner": a.get("winner"),
           "winner_name": room["players"].get(a.get("winner"), {}).get("name", "") if (mode != "teams" and a.get("winner") is not None) else ""}
    if mode == "teams":
        teams = a.get("teams", {0: [], 1: []})
        out["teams"] = {"0": names(teams.get(0, [])), "1": names(teams.get(1, []))}
        out["scores"] = {"0": a.get("scores", {}).get(0, 0), "1": a.get("scores", {}).get(1, 0)}
    else:  # solo — список игроков с личными очками
        sc = a.get("scores", {})
        out["players_score"] = [{"name": room["players"][p]["name"], "score": sc.get(p, 0)}
                                for p in a.get("order", []) if p in room["players"]]
    return out


async def start_alias(room):
    pids = list(room["players"].keys())
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 2 игрока."})
        return
    s = room.get("al", {}).get("settings", {"lang": "ru", "diff": "easy", "time": 60, "target": 20, "mode": "solo"})
    # командный режим доступен только при 4+ игроках и чётном числе
    mode = s.get("mode", "solo")
    if mode == "teams" and (len(pids) < 4 or len(pids) % 2 != 0):
        mode = "solo"
    deck = al.build_deck(s.get("lang", "ru"), s.get("diff", "easy"))
    base = {"settings": s, "mode": mode, "deck": deck, "word": None, "round_active": False, "winner": None}
    if mode == "teams":
        teams = {0: [], 1: []}
        random.shuffle(pids)                       # случайное разбиение по командам
        for i, pid in enumerate(pids):
            teams[i % 2].append(pid)
        base.update({"teams": teams, "scores": {0: 0, 1: 0}, "turn": 0, "ptr": {0: 0, 1: 0},
                     "explainer": teams[0][0]})
    else:  # solo — каждый сам за себя, персональный счёт, объясняющий по кругу
        order = pids[:]
        base.update({"order": order, "scores": {p: 0 for p in order}, "cur": 0,
                     "explainer": order[0]})
    room["al"] = base
    room["state"] = "playing"
    await broadcast(room, alias_public(room))


def next_word(room):
    a = room["al"]
    if not a["deck"]:
        a["deck"] = al.build_deck(a["settings"].get("lang", "ru"), a["settings"].get("diff", "easy"))
    a["word"] = a["deck"].pop()
    return a["word"]


async def send_word(room):
    a = room["al"]
    exp = a.get("explainer")
    if exp in room["players"] and room["players"][exp].get("ws"):
        await room["players"][exp]["ws"].send_json({"type": "alias_word", "word": a["word"]})


async def alias_begin_turn(room):
    a = room["al"]
    a["round_active"] = True
    next_word(room)
    await broadcast(room, {"type": "alias_turn", "secs": a["settings"].get("time", 60)})
    await broadcast(room, alias_public(room))
    await send_word(room)


async def alias_end_turn(room):
    a = room["al"]
    a["round_active"] = False
    if a.get("mode") == "teams":
        a["turn"] = 1 - a.get("turn", 0)
        t = a["turn"]
        team = a["teams"].get(t, [])
        if team:
            a["ptr"][t] = (a["ptr"].get(t, 0)) % len(team)
            a["explainer"] = team[a["ptr"][t]]
            a["ptr"][t] += 1
    else:  # solo — следующий объясняющий по кругу
        order = a.get("order", [])
        if order:
            a["cur"] = (a.get("cur", 0) + 1) % len(order)
            a["explainer"] = order[a["cur"]]
    await broadcast(room, alias_public(room))


# ─────────────── ДУРАК (подкидной) ───────────────
async def push_durak(room):
    s = room["dk"]
    common = {
        "type": "durak_state",
        "names": {p: room["players"][p]["name"] for p in s["order"] if p in room["players"]},
        "counts": {p: len(s["hands"][p]) for p in s["order"]},
        "table": s["table"], "trump_card": s["trump_card"], "trump": s["trump"],
        "deck": len(s["deck"]), "attacker": s["attacker"], "defender": s["defender"],
        "order": s["order"], "durak": s["durak"], "log": s.get("log", ""),
    }
    for pid in list(s["order"]):
        p = room["players"].get(pid)
        if not p or not p.get("ws"):
            continue
        msg = dict(common)
        msg["you"] = pid
        msg["hand"] = s["hands"][pid]
        try:
            await p["ws"].send_json(msg)
        except Exception:
            pass


async def start_durak(room):
    pids = list(room["players"].keys())
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 2 игрока."})
        return
    room["dk"] = dk.new_durak_state(pids)
    room["state"] = "playing"
    await push_durak(room)


def durak_resolve_end(room):
    s = room["dk"]
    d = dk.check_durak(s)
    if d:
        s["durak"] = d
        s["log"] = "🃏 Игра окончена!" if d == "draw" else f"🃏 Дурак: {room['players'].get(d, {}).get('name', '?')}"
        return True
    return False


def durak_try_bito(room):
    """«Бито» срабатывает когда всё отбито И все атакующие-с-картами пасанули
    (или таких нет вовсе — напр. атакующий выложил последние карты). Возвращает True если сыграло."""
    s = room["dk"]
    if not dk.all_defended(s):
        return False
    attackers = {p for p in s["order"] if p != s["defender"] and s["hands"][p]}
    if not s["passed"].issuperset(attackers):
        return False
    s["table"] = []
    s["log"] = "Бито!"
    prev_def = s["defender"]
    dk.refill(s)
    na = prev_def if s["hands"][prev_def] else dk.next_with_cards(s, prev_def)
    if na:
        s["attacker"] = na
        s["defender"] = dk.next_with_cards(s, na) or na
    s["passed"] = set()
    durak_resolve_end(room)
    return True


# ─────────────── UNO ───────────────
async def push_uno(room):
    s = room["uno"]
    common = {"type": "uno_state",
              "names": {p: room["players"][p]["name"] for p in s["order"] if p in room["players"]},
              "counts": {p: len(s["hands"][p]) for p in s["order"]},
              "top": s["discard"][-1], "cur_color": s["cur_color"], "deck": len(s["deck"]),
              "turn_pid": un.cur_player(s), "dir": s["dir"], "order": s["order"],
              "winner": s["winner"], "last_action": s["last_action"], "colors": un.COLORS,
              "mode": s.get("mode", "classic"), "scores": s.get("scores", {}),
              "eliminated": list(s.get("eliminated", set())), "pending_penalty": s.get("pending_penalty", 0),
              "game_over": s.get("game_over", False), "round_over": s.get("round_over", False)}
    for pid in list(s["order"]):
        p = room["players"].get(pid)
        if not p or not p.get("ws"):
            continue
        msg = dict(common); msg["you"] = pid; msg["hand"] = s["hands"][pid]
        try:
            await p["ws"].send_json(msg)
        except Exception:
            pass


async def start_uno(room):
    pids = list(room["players"].keys())
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 2 игрока."})
        return
    cfg = room.get("uno_settings") or {}
    mode = cfg.get("mode", "classic")
    if mode not in ("classic", "points", "nomercy"):
        mode = "classic"
    limit = max(100, min(int(cfg.get("points_limit", 500)), 2000))
    # в points очки копятся между раздачами одного лобби
    prev_scores = room["uno"]["scores"] if (mode == "points" and room.get("uno") and not room["uno"].get("game_over")) else None
    room["uno"] = un.new_uno_state(pids, mode=mode, points_limit=limit)
    if prev_scores:
        for p in pids:
            room["uno"]["scores"][p] = prev_scores.get(p, 0)
    room["state"] = "playing"
    await push_uno(room)


def _uno_round_end(room, pid):
    """Игрок сбросил все карты. В points — считаем очки; иначе — победа."""
    s = room["uno"]; nm = room["players"][pid]["name"]
    if s["mode"] == "points":
        for p in s["order"]:
            if p != pid:
                s["scores"][p] += un.hand_points(s["hands"][p])
        loser = next((p for p in s["order"] if s["scores"][p] >= s["points_limit"]), None)
        if loser:
            s["game_over"] = True
            winner = min(s["order"], key=lambda p: s["scores"][p])
            s["ultimate_winner"] = winner; s["winner"] = winner
            s["last_action"] = f"🏆 Игра окончена! Меньше всех очков у {s['names'].get(winner, room['players'].get(winner,{}).get('name','?'))}"
        else:
            s["round_over"] = True
            s["last_action"] = f"Раунд за {nm}. Новая раздача — жми «Ещё раз»."
    else:
        s["winner"] = pid; s["game_over"] = True
        s["last_action"] = f"🏆 {nm} выиграл!"


def uno_apply_play(room, pid, cards, chosen_color):
    """Играет ОДНУ или НЕСКОЛЬКО карт одного достоинства. Эффекты суммируются.
    Режимы: classic/points — прежнее поведение; nomercy — стакинг штрафов + имба-карты + mercy."""
    s = room["uno"]
    nm = room["players"][pid]["name"]
    nomercy = s.get("mode") == "nomercy"
    k = len(cards)
    for card in cards:
        s["hands"][pid].remove(card)
        s["discard"].append(card)
    v = cards[-1]["v"]
    last = cards[-1]
    s["cur_color"] = (chosen_color if chosen_color in (0, 1, 2, 3) else 0) if last["c"] == 4 else last["c"]
    s["no_progress"] = 0  # сыграна карта = прогресс есть
    if not s["hands"][pid]:
        _uno_round_end(room, pid)
        return
    kx = f"×{k}" if k > 1 else ""
    log = f"{nm} сыграл "
    names = lambda x: room['players'].get(x, {}).get('name', s['names'].get(x, '?'))

    if v == "skip":
        un.advance(s, 1 + k); log += f"Пропуск{kx}"
    elif v == "skipall":  # No Mercy — пропуск всех, ход возвращается к текущему
        log += f"Пропуск ВСЕХ{kx}"  # ход не двигаем (после сброса остаёшься ты) — но карты сыграны, ход к следующему живому
        un.advance(s, len(un.alive_order(s)))  # круг → снова ты (эффект «все пропущены»)
    elif v == "rev":
        if k % 2: s["dir"] *= -1
        un.advance(s, 2 if (len(un.alive_order(s)) == 2 and k % 2) else 1); log += f"Разворот{kx}"
    elif v == "discardall":  # No Mercy — сбросить все карты того же цвета из руки
        col = last["c"]
        keep = [c for c in s["hands"][pid] if c["c"] != col]
        dumped = len(s["hands"][pid]) - len(keep)
        s["discard"] += [c for c in s["hands"][pid] if c["c"] == col]
        s["hands"][pid] = keep
        log += f"Сброс всех {un.COLORS[col]} (−{dumped})"
        if not s["hands"][pid]:
            _uno_round_end(room, pid); return
        un.advance(s, 1)
    elif v in ("d2", "d6", "d10", "wd4", "revd4"):
        pen = un.DRAW_PENALTY[v] * k
        if v == "revd4" and k % 2:
            s["dir"] *= -1
        if nomercy:
            # стакинг: копим штраф, ход к следующему — он крыть или брать
            s["pending_penalty"] += pen
            un.advance(s, 1)
            log += f"+{pen} 🔥 (стак: +{s['pending_penalty']})"
        else:
            nxt = un.next_player_id(s); s["hands"][nxt] += un.draw_from(s, pen)
            un.check_mercy(s, nxt)
            un.advance(s, 2); log += f"+{pen} ({names(nxt)})"
        if last["c"] == 4:
            log += f" → {un.COLORS[s['cur_color']]}"
    elif v == "wild":
        un.advance(s, 1); log += f"Wild{kx} → {un.COLORS[s['cur_color']]}"
    elif v == 0 and nomercy:
        un.rotate_hands(s)
        for p in s["order"]:
            un.check_mercy(s, p)
        un.advance(s, 1); log += "0 — обмен рук по кругу 🔄"
    elif v == 7 and nomercy and len(un.alive_order(s)) >= 2:
        # авто-обмен: меняемся рукой с живым у кого МЕНЬШЕ всего карт (выгодно сыгравшему)
        cand = [p for p in un.alive_order(s) if p != pid]
        target = min(cand, key=lambda p: len(s["hands"][p]))
        s["hands"][pid], s["hands"][target] = s["hands"][target], s["hands"][pid]
        un.check_mercy(s, pid); un.check_mercy(s, target)
        un.advance(s, 1); log += f"7 — обмен рук с {names(target)} 🤝"
    else:
        un.advance(s, 1); log += f"{v}{kx}"
    s["last_action"] = log


# ─────────────── 4 В РЯД (Connect Four) ───────────────
def c4_check(board, r, c, p):
    """Есть ли 4 в ряд через клетку (r,c) для игрока p."""
    for dr, dc in ((0, 1), (1, 0), (1, 1), (1, -1)):
        cnt = 1
        for s in (1, -1):
            rr, cc = r + dr * s, c + dc * s
            while 0 <= rr < 6 and 0 <= cc < 7 and board[rr][cc] == p:
                cnt += 1; rr += dr * s; cc += dc * s
        if cnt >= 4:
            return True
    return False


async def push_c4(room):
    s = room["c4"]
    await broadcast(room, {"type": "c4_state", "board": s["board"], "turn_pid": s["players"][s["turn"]],
                           "players": s["players"], "names": {p: room["players"][p]["name"] for p in s["players"] if p in room["players"]},
                           "winner": s["winner"], "draw": s["draw"], "last": s["last"]})


async def start_c4(room):
    pids = list(room["players"].keys())[:2]
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно ровно 2 игрока."}); return
    room["c4"] = {"board": [[0] * 7 for _ in range(6)], "players": pids, "turn": 0, "winner": None, "draw": False, "last": None}
    room["state"] = "playing"
    await push_c4(room)


async def start_c4_3d(room):
    state = c4d.get_state(room)
    if len(state["players"]) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно минимум 2 игрока (жми «Добавить бота» для теста)."}); return
    room["state"] = "playing"
    state["grid"] = [[[] for _ in range(5)] for _ in range(5)]
    state["turn"] = 0
    state["winner"] = None
    state["win_line"] = None
    state["started"] = True
    await broadcast(room, {"type": "c4_3d_update", "state": state})
    await bot_turn(room)


async def push_c4_3d_resync(room):
    state = c4d.get_state(room)
    await broadcast(room, {"type": "c4_3d_update", "state": state})


# ═══════════ КТО ЕСТЬ КТО (Guess Who, Gemini-генерация) ═══════════
# Осмысленный дефолт если ВСЕ провайдеры недоступны — не безликие «Персонаж N»
DEFAULT_CHARS = [
    {"name": "Марио", "emoji": "🍄"}, {"name": "Бэтмен", "emoji": "🦇"}, {"name": "Пикачу", "emoji": "⚡"},
    {"name": "Дарт Вейдер", "emoji": "🌑"}, {"name": "Гарри Поттер", "emoji": "⚡"}, {"name": "Шрек", "emoji": "🧅"},
    {"name": "Соник", "emoji": "💨"}, {"name": "Человек-паук", "emoji": "🕷️"}, {"name": "Эльза", "emoji": "❄️"},
    {"name": "Йода", "emoji": "🟢"}, {"name": "Джокер", "emoji": "🃏"}, {"name": "Халк", "emoji": "💚"},
    {"name": "Микки Маус", "emoji": "🐭"}, {"name": "Губка Боб", "emoji": "🧽"}, {"name": "Волан-де-Морт", "emoji": "🐍"},
    {"name": "Железный человек", "emoji": "🤖"}, {"name": "Гомер Симпсон", "emoji": "🍩"}, {"name": "Наруто", "emoji": "🍥"},
    {"name": "Кратос", "emoji": "🪓"}, {"name": "Марж Симпсон", "emoji": "💙"},
]

def _parse_chars(txt, n):
    m = re.search(r"\[.*\]", txt, re.S)
    if not m:
        return None
    arr = json.loads(m.group(0))
    out = [{"name": str(x.get("name", ""))[:28], "emoji": str(x.get("emoji", "🙂"))[:4]}
           for x in arr if isinstance(x, dict) and x.get("name")][:n]
    return out if len(out) >= 8 else None

def _openrouter_chars(title, n=20):
    """Фолбэк на OpenRouter free-модель когда Gemini в 429 (общая квота исчерпана)."""
    key = os.environ.get("OPENROUTER_KEY", "")
    if not key:
        return None
    prompt = (f"Назови ровно {n} разных узнаваемых персонажей из «{title}». "
              f"Если не хватает — добавь связанных по теме. Верни СТРОГО JSON-массив "
              f'[{{"name":"короткое имя","emoji":"один эмодзи"}}], ровно {n} элементов, без обрамления и текста.')
    body = json.dumps({"model": "nvidia/nemotron-3-ultra-550b-a55b:free",
                       "messages": [{"role": "user", "content": prompt}],
                       "temperature": 0.8}).encode()
    try:
        req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", data=body,
                                     headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=40) as r:
            txt = json.load(r)["choices"][0]["message"]["content"]
        return _parse_chars(txt, n)
    except Exception as e:
        logging.warning(f"openrouter_chars failed: {e}")
        return None

def gemini_chars(title, n=20):
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        prompt = (f"Назови ровно {n} разных узнаваемых персонажей из «{title}». "
                  f"Если не хватает — добавь связанных по теме. Верни СТРОГО JSON-массив "
                  f'[{{"name":"короткое имя","emoji":"один эмодзи"}}], ровно {n} элементов, без обрамления и текста.')
        body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                           "generationConfig": {"temperature": 0.8, "maxOutputTokens": 1500,
                                                "thinkingConfig": {"thinkingBudget": 0}}}).encode()
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
        try:
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                txt = json.load(r)["candidates"][0]["content"]["parts"][0]["text"]
            res = _parse_chars(txt, n)
            if res:
                return res
        except Exception as e:
            logging.warning(f"gemini_chars failed ({e}) — fallback to OpenRouter")
    # Gemini недоступен/квота/парс — пробуем OpenRouter free
    return _openrouter_chars(title, n)

def gemini_locations(theme, n=15):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    prompt = (f"Тема: «{theme}». Придумай ровно {n} разных ЛОКАЦИЙ/мест в этой теме для игры Шпион "
              f'(коротко, 1-3 слова). Верни СТРОГО JSON-массив строк ровно из {n} элементов, без текста.')
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.9, "maxOutputTokens": 800,
                                            "thinkingConfig": {"thinkingBudget": 0}}}).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = json.load(r)["candidates"][0]["content"]["parts"][0]["text"]
        m = re.search(r"\[.*\]", txt, re.S)
        arr = json.loads(m.group(0))
        out = [str(x)[:30] for x in arr if isinstance(x, str) and x.strip()][:n]
        return out if len(out) >= 5 else None
    except Exception:
        return None


def gemini_people(theme, n=15):
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        return None
    prompt = (f"Назови ровно {n} разных узнаваемых ПЕРСОНАЖЕЙ из «{theme}» (герои, злодеи, ключевые лица). "
              f'Короткие имена по-русски. Верни СТРОГО JSON-массив строк ровно из {n} элементов, без текста.')
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.8, "maxOutputTokens": 800,
                                            "thinkingConfig": {"thinkingBudget": 0}}}).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as r:
            txt = json.load(r)["candidates"][0]["content"]["parts"][0]["text"]
        m = re.search(r"\[.*\]", txt, re.S)
        arr = json.loads(m.group(0))
        out = [str(x)[:30] for x in arr if isinstance(x, str) and x.strip()][:n]
        return out if len(out) >= 5 else None
    except Exception:
        return None


async def push_gw(room):
    s = room["gw"]
    for pid in s["players"]:
        p = room["players"].get(pid)
        if not p or not p.get("ws"):
            continue
        opp = s["players"][1 - s["players"].index(pid)]
        await p["ws"].send_json({"type": "gw_state", "chars": s["chars"], "title": s["title"],
            "you": pid, "players": s["players"], "names": {x: room["players"][x]["name"] for x in s["players"] if x in room["players"]},
            "my_secret": s["secret"][pid], "flipped": list(s["flipped"][pid]),
            "opp": opp, "winner": s["winner"]})

async def start_gw(room, title):
    pids = list(room["players"].keys())[:2]
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно 2 игрока."}); return
    title = (title or "Знаменитости").strip()[:60]
    await broadcast(room, {"type": "gw_loading", "title": title})
    chars = await asyncio.get_event_loop().run_in_executor(None, gemini_chars, title)
    if not chars:
        chars = DEFAULT_CHARS
    room["gw"] = {"chars": chars, "title": title, "players": pids,
                  "secret": {pids[0]: random.randrange(len(chars)), pids[1]: random.randrange(len(chars))},
                  "flipped": {p: set() for p in pids}, "winner": None}
    room["state"] = "playing"
    await push_gw(room)


@app.get("/guesswho")
async def gw_page():
    return FileResponse("/app/static/guesswho.html")


# ── ГЕЙТ: мультиплеерные игры (по WS с авторизацией) требуют логина ──────────
# Иначе не-залогиненный/друг по коду открывал страницу, WS отбивался 403 → «Связь потеряна».
_GATED_GAME_PAGES = {"/poker","/spy","/mafia","/bunker","/alias","/durak","/variants",
                     "/guesswho","/uno","/checkers","/chess","/reversi","/dots","/bulls",
                     "/battleship","/geobunker"}

@app.middleware("http")
async def _gate_multiplayer_pages(request: Request, call_next):
    if request.url.path in _GATED_GAME_PAGES and not current_user(request):
        return RedirectResponse("/games/login")
    return await call_next(request)


@app.get("/")
async def index(request: Request):
    if not current_user(request):
        return RedirectResponse("/games/login")
    return FileResponse("/app/static/index.html")


@app.get("/login")
async def login_page():
    return HTMLResponse(LOGIN_PAGE)


@app.post("/auth/register")
async def auth_register(request: Request, response: Response):
    body = await request.json()
    username = (body.get("username") or "").strip().lower()[:20]
    password = body.get("password") or ""
    if not re.fullmatch(r"[a-z0-9_]{3,20}", username):
        return JSONResponse({"ok": False, "error": "Имя: 3-20 симв., латиница/цифры/_"})
    if len(password) < 4:
        return JSONResponse({"ok": False, "error": "Пароль минимум 4 символа"})
    con = _auth_db()
    if con.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone():
        con.close(); return JSONResponse({"ok": False, "error": "Это имя уже занято"})
    salt = secrets.token_hex(16)
    con.execute("INSERT INTO users VALUES (?,?,?,?,?)",
                (username, salt, _hash_pw(password, salt), "member",
                 __import__("datetime").datetime.now().isoformat()))
    con.commit(); con.close()
    token = _make_session(username, "member")
    resp = JSONResponse({"ok": True})
    resp.set_cookie("jsession", token, max_age=60*60*24*90, httponly=True, samesite="lax", path="/games")
    return resp


@app.post("/auth/login")
async def auth_login(request: Request):
    body = await request.json()
    username = (body.get("username") or "").strip().lower()[:20]
    password = body.get("password") or ""
    con = _auth_db()
    row = con.execute("SELECT salt,pwhash,role FROM users WHERE username=?", (username,)).fetchone()
    con.close()
    if not row or _hash_pw(password, row[0]) != row[1]:
        return JSONResponse({"ok": False, "error": "Неверное имя или пароль"})
    token = _make_session(username, row[2])
    resp = JSONResponse({"ok": True, "role": row[2]})
    resp.set_cookie("jsession", token, max_age=60*60*24*90, httponly=True, samesite="lax", path="/games")
    return resp


@app.post("/auth/logout")
async def auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("jsession", path="/games")
    return resp


@app.get("/auth/check")
async def auth_check(request: Request):
    """Для Caddy forward_auth — 200 если валидная сессия, иначе 401."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    return JSONResponse({"ok": True, "username": u["username"], "role": u["role"]})


# ── Прогресс одиночных игр, привязанный к АККАУНТУ (сохраняется на сервере) ──
PROGRESS_FILE = "/data/game_progress.json"
_progress_lock = threading.Lock()

def _load_progress():
    try:
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_progress(data):
    tmp = PROGRESS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, PROGRESS_FILE)


@app.get("/progress")
async def get_progress(request: Request, game: str = "arrows"):
    """Прогресс текущего юзера по игре: {level: stars}."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    data = _load_progress()
    return JSONResponse({"ok": True, "levels": data.get(u["username"], {}).get(game, {})})


@app.post("/progress")
async def post_progress(request: Request):
    """Сохранить прохождение уровня. body: {game, level, stars}. Берёт максимум звёзд."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    body = await request.json()
    game = str(body.get("game", "arrows"))[:32]
    try:
        level = str(int(body.get("level")))
        stars = max(0, min(3, int(body.get("stars", 1))))
    except Exception:
        raise HTTPException(400)
    with _progress_lock:
        data = _load_progress()
        user = data.setdefault(u["username"], {})
        g = user.setdefault(game, {})
        g[level] = max(g.get(level, 0), stars)
        _save_progress(data)
    return JSONResponse({"ok": True})


# ══════════ ПРОФИЛИ и ДРУЗЬЯ ══════════
def _social_db():
    con = sqlite3.connect(AUTH_DB, timeout=5)
    con.execute("""CREATE TABLE IF NOT EXISTS profiles(
        username TEXT PRIMARY KEY, display_name TEXT, avatar TEXT DEFAULT '🙂',
        color TEXT DEFAULT '#e0102e', sound INTEGER DEFAULT 1, updated_at TEXT)""")
    con.execute("""CREATE TABLE IF NOT EXISTS friendships(
        from_user TEXT, to_user TEXT, status TEXT DEFAULT 'pending', created_at TEXT,
        PRIMARY KEY(from_user, to_user))""")
    con.execute("""CREATE TABLE IF NOT EXISTS invites(
        from_user TEXT, to_user TEXT, game TEXT, code TEXT, created_at TEXT,
        PRIMARY KEY(from_user, to_user))""")
    con.commit()
    return con

def _profile_of(con, username):
    r = con.execute("SELECT username,display_name,avatar,color,sound FROM profiles WHERE username=?",
                    (username,)).fetchone()
    if not r:
        return {"username": username, "display_name": username, "avatar": "🙂", "color": "#e0102e", "sound": 1}
    return {"username": r[0], "display_name": r[1] or r[0], "avatar": r[2], "color": r[3], "sound": r[4]}

def _user_stats(username):
    """Статистика из журнала: сыграно (create+join), любимые игры."""
    from collections import Counter
    played = 0
    games = Counter()
    try:
        with open(USAGE_LOG, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    e = json.loads(line)
                except Exception:
                    continue
                if e.get("user") == username and e.get("event") in ("create", "join"):
                    played += 1
                    if e.get("game"):
                        games[e["game"]] += 1
    except Exception:
        pass
    return {"played": played, "top_games": games.most_common(3)}


@app.get("/me")
async def get_profile(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    con = _social_db()
    try:
        prof = _profile_of(con, u["username"])
    finally:
        con.close()
    prof["role"] = u["role"]
    prof["stats"] = _user_stats(u["username"])
    return JSONResponse({"ok": True, "profile": prof})


@app.post("/me")
async def update_profile(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    body = await request.json()
    dn = str(body.get("display_name", "") or u["username"])[:24].strip() or u["username"]
    av = str(body.get("avatar", "🙂"))[:8]
    col = str(body.get("color", "#e0102e"))[:12]
    snd = 1 if body.get("sound", True) else 0
    con = _social_db()
    try:
        con.execute("""INSERT INTO profiles(username,display_name,avatar,color,sound,updated_at)
            VALUES(?,?,?,?,?,?) ON CONFLICT(username) DO UPDATE SET
            display_name=excluded.display_name, avatar=excluded.avatar,
            color=excluded.color, sound=excluded.sound, updated_at=excluded.updated_at""",
            (u["username"], dn, av, col, snd, __import__("datetime").datetime.now().isoformat()))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


@app.post("/me/password")
async def change_password(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    body = await request.json()
    old = str(body.get("old", ""))
    new = str(body.get("new", ""))
    if len(new) < 4:
        return JSONResponse({"ok": False, "error": "Пароль минимум 4 символа"})
    con = _auth_db()
    try:
        row = con.execute("SELECT salt,pwhash FROM users WHERE username=?", (u["username"],)).fetchone()
        if not row or _hash_pw(old, row[0]) != row[1]:
            return JSONResponse({"ok": False, "error": "Старый пароль неверный"})
        salt = secrets.token_hex(16)
        con.execute("UPDATE users SET salt=?, pwhash=? WHERE username=?",
                    (salt, _hash_pw(new, salt), u["username"]))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


@app.get("/users/search")
async def search_users(request: Request, q: str = ""):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    q = q.strip()[:24]
    if len(q) < 1:
        return JSONResponse({"ok": True, "users": []})
    con = _social_db()
    try:
        rows = con.execute("SELECT username FROM users WHERE username LIKE ? AND username!=? LIMIT 12",
                           (f"%{q}%", u["username"])).fetchall()
        out = [_profile_of(con, r[0]) for r in rows]
    finally:
        con.close()
    return JSONResponse({"ok": True, "users": out})


@app.get("/friends")
async def list_friends(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    con = _social_db()
    try:
        friends, incoming, outgoing = [], [], []
        for r in con.execute("SELECT from_user,to_user,status FROM friendships WHERE from_user=? OR to_user=?", (me, me)):
            frm, to, st = r
            other = to if frm == me else frm
            prof = _profile_of(con, other)
            if st == "accepted":
                prof.update(_presence_of(other))  # online + текущая игра
                friends.append(prof)
            elif frm == me:
                outgoing.append(prof)
            else:
                incoming.append(prof)
    finally:
        con.close()
    return JSONResponse({"ok": True, "friends": friends, "incoming": incoming, "outgoing": outgoing})


@app.post("/friends/request")
async def friend_request(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    target = str((await request.json()).get("to", "")).strip()[:24]
    if not target or target == me:
        return JSONResponse({"ok": False, "error": "Некорректный пользователь"})
    con = _social_db()
    try:
        if not con.execute("SELECT 1 FROM users WHERE username=?", (target,)).fetchone():
            return JSONResponse({"ok": False, "error": "Пользователь не найден"})
        # уже есть связь в любую сторону?
        ex = con.execute("SELECT from_user,status FROM friendships WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?)",
                         (me, target, target, me)).fetchone()
        if ex:
            if ex[1] == "accepted":
                return JSONResponse({"ok": False, "error": "Уже в друзьях"})
            # встречная заявка → принимаем
            if ex[0] == target:
                con.execute("UPDATE friendships SET status='accepted' WHERE from_user=? AND to_user=?", (target, me))
                con.commit()
                return JSONResponse({"ok": True, "accepted": True})
            return JSONResponse({"ok": False, "error": "Заявка уже отправлена"})
        con.execute("INSERT INTO friendships VALUES(?,?,?,?)",
                    (me, target, "pending", __import__("datetime").datetime.now().isoformat()))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


@app.post("/friends/respond")
async def friend_respond(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    body = await request.json()
    frm = str(body.get("from", "")).strip()[:24]
    accept = bool(body.get("accept", False))
    con = _social_db()
    try:
        if accept:
            con.execute("UPDATE friendships SET status='accepted' WHERE from_user=? AND to_user=?", (frm, me))
        else:
            con.execute("DELETE FROM friendships WHERE from_user=? AND to_user=?", (frm, me))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


@app.post("/friends/remove")
async def friend_remove(request: Request):
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    other = str((await request.json()).get("user", "")).strip()[:24]
    con = _social_db()
    try:
        con.execute("DELETE FROM friendships WHERE (from_user=? AND to_user=?) OR (from_user=? AND to_user=?)",
                    (me, other, other, me))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


# ── Приглашения в игру (друг зовёт в комнату) ──
@app.post("/invite")
async def create_invite(request: Request):
    """Позвать друга в игру. body: {to, game, code}. Хранится, друг видит при заходе."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    body = await request.json()
    to = str(body.get("to", "")).strip()[:24]
    game = str(body.get("game", "")).strip()[:32]
    code = str(body.get("code", "")).strip().upper()[:8]
    if not to or not game or not code:
        return JSONResponse({"ok": False, "error": "нужны to, game, code"})
    con = _social_db()
    try:
        # только друзьям
        fr = con.execute("SELECT 1 FROM friendships WHERE status='accepted' AND "
                         "((from_user=? AND to_user=?) OR (from_user=? AND to_user=?))",
                         (me, to, to, me)).fetchone()
        if not fr:
            return JSONResponse({"ok": False, "error": "Это не твой друг"})
        con.execute("INSERT OR REPLACE INTO invites(from_user,to_user,game,code,created_at) VALUES(?,?,?,?,?)",
                    (me, to, game, code, __import__("datetime").datetime.now().isoformat()))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


@app.get("/invites")
async def list_invites(request: Request):
    """Входящие приглашения в игру (свежие, до 30 мин)."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    import datetime as _dt
    con = _social_db()
    try:
        out = []
        for r in con.execute("SELECT from_user,game,code,created_at FROM invites WHERE to_user=?", (me,)):
            frm, game, code, ts = r
            try:
                age = (_dt.datetime.now() - _dt.datetime.fromisoformat(ts)).total_seconds()
            except Exception:
                age = 0
            if age > 1800:   # протухшие чистим
                con.execute("DELETE FROM invites WHERE from_user=? AND to_user=?", (frm, me))
                continue
            prof = _profile_of(con, frm)
            # актуально только если комната ещё существует
            if code in rooms:
                out.append({"from": frm, "from_name": prof["display_name"], "avatar": prof["avatar"],
                            "color": prof["color"], "game": game, "code": code})
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True, "invites": out})


@app.post("/invite/clear")
async def clear_invite(request: Request):
    """Убрать приглашение (принял/отклонил)."""
    u = current_user(request)
    if not u:
        raise HTTPException(401)
    me = u["username"]
    frm = str((await request.json()).get("from", "")).strip()[:24]
    con = _social_db()
    try:
        con.execute("DELETE FROM invites WHERE to_user=? AND from_user=?", (me, frm))
        con.commit()
    finally:
        con.close()
    return JSONResponse({"ok": True})


def _admin_data():
    lines = []
    try:
        with open(USAGE_LOG, encoding="utf-8") as f:
            lines = [json.loads(l) for l in f if l.strip()][-200:]
    except Exception:
        pass
    con = _auth_db()
    raw_users = con.execute("SELECT username,role,created_at FROM users").fetchall()
    con.close()
    
    users = []
    online_count = 0
    for r in raw_users:
        uname = r[0]
        pres = _presence_of(uname)
        if pres.get("online"):
            online_count += 1
        users.append({
            "username": uname,
            "role": r[1],
            "created": r[2],
            "online": pres.get("online", False),
            "game": pres.get("game")
        })
        
    active_rooms = []
    for code, room in rooms.items():
        players_list = [p.get("name", "Гость") for p in room.get("players", {}).values()]
        active_rooms.append({
            "code": code,
            "game": room.get("game", "?"),
            "state": room.get("state", "lobby"),
            "players_count": len(players_list),
            "players": players_list
        })
        
    return {
        "users": users,
        "online_count": online_count,
        "rooms": active_rooms,
        "recent_activity": list(reversed(lines))
    }


@app.get("/admin/activity.json")
async def admin_activity_json(request: Request):
    u = current_user(request)
    if not u or u["role"] != "root":
        raise HTTPException(403)
    return JSONResponse(_admin_data())


@app.get("/admin/activity")
async def admin_activity_page(request: Request):
    u = current_user(request)
    if not u:
        return RedirectResponse("/games/login")
    if u["role"] != "root":
        raise HTTPException(403)
    return FileResponse("/app/static/admin.html")


@app.get("/uno")
async def uno_page():
    return FileResponse("/app/static/uno.html")

@app.get("/quoridor")
async def quoridor_page():
    return FileResponse("/app/static/quoridor.html")

@app.get("/c4_3d")
async def c4_3d_page():
    return FileResponse("/app/static/connect4_3d.html")

@app.get("/c4")
async def c4_page():
    return FileResponse("/app/static/c4.html")


# ═══════════ РЕВЕРСИ (Othello) ═══════════
RV_DIRS = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
def rv_flips(b, r, c, p):
    if b[r][c] != 0: return []
    o = 3 - p; flips = []
    for dr, dc in RV_DIRS:
        line = []; rr, cc = r+dr, c+dc
        while 0<=rr<8 and 0<=cc<8 and b[rr][cc]==o: line.append((rr,cc)); rr+=dr; cc+=dc
        if line and 0<=rr<8 and 0<=cc<8 and b[rr][cc]==p: flips += line
    return flips
def rv_legal(b, p): return [(r,c) for r in range(8) for c in range(8) if rv_flips(b,r,c,p)]
async def push_rv(room):
    s = room["rv"]; p = s["turn"]+1
    await broadcast(room, {"type":"rv_state","board":s["board"],"players":s["players"],
        "turn_pid":s["players"][s["turn"]],"names":{x:room["players"][x]["name"] for x in s["players"] if x in room["players"]},
        "legal":[list(m) for m in rv_legal(s["board"],p)],"winner":s["winner"],"done":s["done"],
        "counts":[sum(x.count(1) for x in s["board"]),sum(x.count(2) for x in s["board"])]})
async def start_rv(room):
    pids=list(room["players"].keys())[:2]
    if len(pids)<2: await broadcast(room,{"type":"error","msg":"Нужно 2 игрока."}); return
    b=[[0]*8 for _ in range(8)]; b[3][3]=2;b[3][4]=1;b[4][3]=1;b[4][4]=2
    room["rv"]={"board":b,"players":pids,"turn":0,"winner":None,"done":False}; room["state"]="playing"
    await push_rv(room)

# ═══════════ ШАШКИ (Checkers 8×8, обязательный бой, дамки, цепные прыжки) ═══════════
# 1/2 = простые p1/p2, 3/4 = дамки p1/p2. p1 ходит к row 0, p2 — к row 7. Дамка — оба направления.
def ck_piece_dirs(v):
    if v == 1: return [(-1,-1),(-1,1)]
    if v == 2: return [(1,-1),(1,1)]
    return [(-1,-1),(-1,1),(1,-1),(1,1)]  # дамка
def ck_owner(v): return 1 if v in (1,3) else (2 if v in (2,4) else 0)
def ck_captures_from(b, r, c):
    v = b[r][c]; out = []
    # В русских шашках любая шашка (простая и дамка) бьет во всех 4 направлениях!
    for dr,dc in [(-1,-1),(-1,1),(1,-1),(1,1)]:
        mr,mc = r+dr,c+dc; tr,tc = r+2*dr,c+2*dc
        if 0<=tr<8 and 0<=tc<8 and b[tr][tc]==0 and 0<=mr<8 and 0<=mc<8:
            if b[mr][mc]!=0 and ck_owner(b[mr][mc])!=ck_owner(v):
                out.append((r,c,tr,tc,mr,mc))
    return out
def ck_simple_from(b, r, c):
    v = b[r][c]; out = []
    for dr,dc in ck_piece_dirs(v):
        tr,tc = r+dr,c+dc
        if 0<=tr<8 and 0<=tc<8 and b[tr][tc]==0:
            out.append((r,c,tr,tc,None,None))
    return out
def ck_legal(b, p, only_from=None):
    caps = []
    cells = [only_from] if only_from else [(r,c) for r in range(8) for c in range(8)]
    for cell in cells:
        if not cell: continue
        r,c = cell
        if ck_owner(b[r][c]) == p: caps += ck_captures_from(b, r, c)
    if caps: return caps
    if only_from: return []  # цепь прыжков закончилась без продолжения — ходить другой фигурой нельзя
    simples = []
    for r in range(8):
        for c in range(8):
            if ck_owner(b[r][c]) == p: simples += ck_simple_from(b, r, c)
    return simples
def ck_apply(s, fr, fc, tr, tc, mr, mc):
    b = s["board"]; v = b[fr][fc]
    b[tr][tc] = v; b[fr][fc] = 0
    captured = mr is not None
    if captured: b[mr][mc] = 0
    p = ck_owner(v)
    if v==1 and tr==0: b[tr][tc]=3
    if v==2 and tr==7: b[tr][tc]=4
    if captured and ck_legal(b, p, only_from=(tr,tc)):
        s["must_continue"] = (tr,tc); return
    s["must_continue"] = None
    s["turn"] = 1 - s["turn"]
async def push_ck(room):
    s = room["ck"]; p = s["turn"]+1
    legal = ck_legal(s["board"], p, only_from=s.get("must_continue"))
    if not legal and not s["done"]:
        s["done"] = True; s["winner"] = s["players"][1-s["turn"]]  # у текущего нет ходов — проиграл
    counts = [sum(row.count(1)+row.count(3) for row in s["board"]), sum(row.count(2)+row.count(4) for row in s["board"])]
    if not s["done"] and 0 in counts:
        s["done"] = True; s["winner"] = s["players"][0] if counts[1]==0 else s["players"][1]
    await broadcast(room, {"type":"ck_state","board":s["board"],"players":s["players"],
        "turn_pid":s["players"][s["turn"]],"names":{x:room["players"][x]["name"] for x in s["players"] if x in room["players"]},
        "legal":[list(m) for m in legal],"winner":s["winner"],"done":s["done"],
        "must_continue":list(s["must_continue"]) if s.get("must_continue") else None,"counts":counts})
async def start_ck(room):
    pids = list(room["players"].keys())[:2]
    if len(pids)<2: await broadcast(room,{"type":"error","msg":"Нужно 2 игрока."}); return
    b = [[0]*8 for _ in range(8)]
    for r in range(3):
        for c in range(8):
            if (r+c)%2==1: b[r][c]=2
    for r in range(5,8):
        for c in range(8):
            if (r+c)%2==1: b[r][c]=1
    room["ck"] = {"board":b,"players":pids,"turn":0,"winner":None,"done":False,"must_continue":None}
    room["state"]="playing"; await push_ck(room)
def ck_bot(s, diff):
    p = s["turn"]+1; legal = ck_legal(s["board"], p, only_from=s.get("must_continue"))
    if not legal: return None
    if diff == "easy": return random.choice(legal)
    caps = [m for m in legal if m[4] is not None]
    return random.choice(caps) if caps else random.choice(legal)

# ═══════════ ШАХМАТЫ ═══════════
async def push_chess(room):
    s = room["chess"]
    legal_by_sq = {}
    if not s["done"]:
        color = s["turn"]
        for r in range(8):
            for c in range(8):
                p = s["board"][r][c]
                if p and chs.owner(p) == color:
                    mv = chs.legal_moves(s, r, c)
                    if mv: legal_by_sq[f"{r}_{c}"] = [list(m) for m in mv]
    await broadcast(room, {"type": "chess_state", "board": s["board"], "order": s["order"],
        "turn_pid": s["order"][s["turn"]], "names": {x: room["players"][x]["name"] for x in s["order"] if x in room["players"]},
        "legal": legal_by_sq, "winner": s["winner"], "done": s["done"], "result": s.get("result"),
        "last_move": s.get("last_move"), "in_check": chs.in_check(s, s["turn"]) if not s["done"] else False})

async def start_chess(room):
    pids = list(room["players"].keys())[:2]
    if len(pids) < 2:
        await broadcast(room, {"type": "error", "msg": "Нужно 2 игрока."}); return
    room["chess"] = chs.new_state(pids)
    room["state"] = "playing"
    await push_chess(room)

def chess_bot(s, diff):
    moves = chs.all_legal_moves(s)
    if not moves: return None
    if diff == "easy":
        return random.choice(moves)
    # medium/hard — предпочитаем взятия, потом шахи, иначе случайный
    captures = [m for m in moves if s["board"][m[2]][m[3]] is not None]
    if captures:
        return random.choice(captures)
    checking = []
    for (fr, fc, tr, tc) in moves:
        nb, ncastle, nep = chs._apply_raw(s["board"], s["castle"], s["ep"], fr, fc, tr, tc, "Q")
        tmp = dict(s); tmp["board"] = nb
        if chs.in_check(tmp, 1 - s["turn"]):
            checking.append((fr, fc, tr, tc))
    if checking and diff == "hard":
        return random.choice(checking)
    return random.choice(moves)

# ═══════════ ПОКЕР (Texas Hold'em) ═══════════
POKER_START_CHIPS = 1000
POKER_SB = 10
POKER_BB = 20


def _pk_active(s):
    """Игроки в раздаче (не сфолдили, ещё в игре)."""
    return [p for p in s["seats"] if p not in s["folded"] and s["stacks"].get(p, 0) >= 0 and p in s["inhand"]]


def _pk_can_act(s):
    """Игроки, которые ещё могут делать ставки (не фолд, не олл-ин)."""
    return [p for p in s["seats"] if p in s["inhand"] and p not in s["folded"] and p not in s["allin"]]


def _pk_next_actor(s, start):
    """Следующий игрок по кругу от индекса start, кто может действовать."""
    n = len(s["seats"])
    for i in range(1, n + 1):
        p = s["seats"][(start + i) % n]
        if p in s["inhand"] and p not in s["folded"] and p not in s["allin"]:
            return (start + i) % n
    return None


def start_poker(room):
    seats = list(room["players"].keys())
    if len(seats) < 2:
        return False
    cfg = room.get("poker_settings") or {}
    start_chips = int(cfg.get("stack", POKER_START_CHIPS))
    bb = int(cfg.get("bb", POKER_BB))
    sb = max(1, bb // 2)
    stacks = room.get("poker_stacks") or {p: start_chips for p in seats}
    # выкидываем банкротов
    seats = [p for p in seats if stacks.get(p, 0) > 0]
    if len(seats) < 2:
        return False
    button = (room.get("poker", {}).get("button", -1) + 1) % len(seats)
    room["poker"] = _pk_new_hand(seats, stacks, button, room["players"], sb, bb)
    room["poker_stacks"] = stacks
    room["state"] = "playing"
    return True


def _pk_new_hand(seats, stacks, button, players, sb=POKER_SB, bb=POKER_BB):
    deck = pk.make_deck()
    hole = {p: [deck.pop(), deck.pop()] for p in seats}
    s = {
        "seats": seats, "stacks": stacks, "button": button, "deck": deck,
        "hole": hole, "community": [], "pot": 0, "sb": sb, "bb": bb,
        "bets": {p: 0 for p in seats},        # ставка в ТЕКУЩЕМ раунде
        "committed": {p: 0 for p in seats},   # всего вложено за раздачу (для сайд-потов)
        "folded": set(), "allin": set(), "inhand": set(seats),
        "stage": "preflop", "cur_bet": 0, "min_raise": bb,
        "to_act": None, "last_raiser": None, "done": False, "winners": None,
        "msg": "", "names": {p: players[p]["name"] for p in seats if p in players},
        "showdown": None, "acted": set(),
    }
    # блайнды
    sb_i = (button + 1) % len(seats) if len(seats) > 2 else button  # heads-up: баттон = SB
    bb_i = (button + 2) % len(seats) if len(seats) > 2 else (button + 1) % len(seats)
    _pk_post(s, seats[sb_i], sb)
    _pk_post(s, seats[bb_i], bb)
    s["cur_bet"] = bb
    s["min_raise"] = bb
    s["last_raiser"] = seats[bb_i]
    # первый ход: слева от BB
    s["to_act"] = _pk_next_actor(s, bb_i)
    return s


def _pk_post(s, pid, amount):
    amt = min(amount, s["stacks"][pid])
    s["stacks"][pid] -= amt
    s["bets"][pid] += amt
    s["committed"][pid] += amt
    s["pot"] += amt
    if s["stacks"][pid] == 0:
        s["allin"].add(pid)
    return amt


def _pk_advance_stage(s):
    """Открыть следующую улицу или уйти на шоудаун."""
    for p in s["seats"]:
        s["bets"][p] = 0
    s["cur_bet"] = 0
    s["min_raise"] = s["bb"]
    s["last_raiser"] = None
    s["acted"] = set()
    stage = s["stage"]
    if stage == "preflop":
        s["community"] += [s["deck"].pop() for _ in range(3)]
        s["stage"] = "flop"
    elif stage == "flop":
        s["community"].append(s["deck"].pop())
        s["stage"] = "turn"
    elif stage == "turn":
        s["community"].append(s["deck"].pop())
        s["stage"] = "river"
    else:
        _pk_showdown(s)
        return
    # первый ходит слева от баттона среди активных
    s["to_act"] = _pk_next_actor(s, s["button"])
    # если действовать некому (все олл-ин) — сразу дальше
    if s["to_act"] is None or len(_pk_can_act(s)) <= 1 and _pk_betting_settled(s):
        # доигрываем оставшиеся улицы автоматически (все олл-ин)
        if len(_pk_active(s)) >= 2:
            _pk_advance_stage(s)


def _pk_betting_settled(s):
    """Круг ставок завершён: все, кто может действовать, уравняли ставку и походили."""
    actors = _pk_can_act(s)
    if not actors:
        return True
    for p in actors:
        if s["bets"][p] != s["cur_bet"] or p not in s["acted"]:
            return False
    return True


def _pk_showdown(s):
    s["stage"] = "showdown"
    contenders = [p for p in s["seats"] if p in s["inhand"] and p not in s["folded"]]
    board = s["community"]
    # сайд-поты по уровням committed
    levels = sorted(set(s["committed"][p] for p in s["seats"] if s["committed"][p] > 0))
    pots = []  # (amount, [eligible pids])
    prev = 0
    for lvl in levels:
        contributors = [p for p in s["seats"] if s["committed"][p] >= lvl]
        amount = (lvl - prev) * len(contributors)
        eligible = [p for p in contributors if p in contenders]
        pots.append((amount, eligible))
        prev = lvl
    results = {}
    reveal = {}
    for p in contenders:
        cat, tb, best5 = pk.best_hand(s["hole"][p] + board)
        reveal[p] = {"hole": [list(c) for c in s["hole"][p]], "cat": cat, "name": pk.HAND_NAMES[cat]}
    for amount, eligible in pots:
        if not eligible:
            continue
        if len(eligible) == 1:
            winners = eligible
        else:
            hands = {p: s["hole"][p] + board for p in eligible}
            _, winners = pk.compare(hands)
        share = amount // len(winners)
        rem = amount - share * len(winners)
        for i, w in enumerate(winners):
            s["stacks"][w] += share + (1 if i < rem else 0)
            results[w] = results.get(w, 0) + share + (1 if i < rem else 0)
    s["winners"] = list(results.keys())
    s["showdown"] = {"reveal": reveal, "won": results}
    s["done"] = True
    s["msg"] = " · ".join(f"{s['names'].get(w, '?')} +{amt}" for w, amt in results.items())


def _pk_check_end_by_fold(s):
    """Если остался один активный — он забирает банк без вскрытия."""
    active = [p for p in s["seats"] if p in s["inhand"] and p not in s["folded"]]
    if len(active) == 1:
        w = active[0]
        s["stacks"][w] += s["pot"]
        s["winners"] = [w]
        s["showdown"] = {"reveal": {}, "won": {w: s["pot"]}}
        s["done"] = True
        s["msg"] = f"{s['names'].get(w, '?')} забирает банк {s['pot']}"
        return True
    return False


def poker_action(s, pid, action, amount=0):
    """action: fold|check|call|raise|allin. amount = сумма рейза (общая ставка в раунде)."""
    if s["done"] or s["seats"][s["to_act"]] != pid:
        return False
    to_call = s["cur_bet"] - s["bets"][pid]

    if action == "fold":
        s["folded"].add(pid)
    elif action == "check":
        if to_call > 0:
            return False
    elif action == "call":
        _pk_post(s, pid, to_call)
    elif action == "allin":
        _pk_post(s, pid, s["stacks"][pid])
        if s["bets"][pid] > s["cur_bet"]:
            s["min_raise"] = max(s["min_raise"], s["bets"][pid] - s["cur_bet"])
            s["cur_bet"] = s["bets"][pid]
            s["last_raiser"] = pid
            s["acted"] = {pid}
    elif action == "raise":
        target = int(amount)
        if target < s["cur_bet"] + s["min_raise"] or target - s["bets"][pid] > s["stacks"][pid]:
            return False
        _pk_post(s, pid, target - s["bets"][pid])
        s["min_raise"] = target - s["cur_bet"]
        s["cur_bet"] = target
        s["last_raiser"] = pid
        s["acted"] = {pid}
    else:
        return False

    s["acted"].add(pid)

    if _pk_check_end_by_fold(s):
        return True
    # круг завершён?
    if _pk_betting_settled(s):
        _pk_advance_stage(s)
    else:
        nxt = _pk_next_actor(s, s["to_act"])
        s["to_act"] = nxt
        if nxt is None or len(_pk_can_act(s)) == 0:
            if len(_pk_active(s)) >= 2:
                _pk_advance_stage(s)
    return True


async def push_poker(room):
    s = room["poker"]
    common = {
        "type": "poker_state", "seats": s["seats"], "names": s["names"],
        "community": [list(c) for c in s["community"]], "pot": s["pot"],
        "stacks": s["stacks"], "bets": s["bets"], "cur_bet": s["cur_bet"],
        "stage": s["stage"], "button": s["button"],
        "to_act_pid": s["seats"][s["to_act"]] if (s["to_act"] is not None and not s["done"]) else None,
        "folded": list(s["folded"]), "allin": list(s["allin"]),
        "done": s["done"], "winners": s["winners"], "msg": s["msg"],
        "showdown": s.get("showdown"), "min_raise": s["min_raise"], "bb": s["bb"],
    }
    for pid in list(s["seats"]):
        p = room["players"].get(pid)
        if not p or not p.get("ws"):
            continue
        m = dict(common)
        m["you"] = pid
        m["hole"] = [list(c) for c in s["hole"].get(pid, [])]
        to_call = s["cur_bet"] - s["bets"].get(pid, 0)
        m["to_call"] = to_call
        m["my_stack"] = s["stacks"].get(pid, 0)
        try:
            await p["ws"].send_json(m)
        except Exception:
            pass


def poker_bot(s, pid):
    """Простой бот: фолд на большой ставке, иначе колл/чек, изредка рейз."""
    to_call = s["cur_bet"] - s["bets"][pid]
    stack = s["stacks"][pid]
    if to_call == 0:
        if random.random() < 0.18 and stack > s["cur_bet"] + s["min_raise"]:
            return ("raise", s["cur_bet"] + s["min_raise"])
        return ("check", 0)
    if to_call >= stack:
        return ("allin", 0) if random.random() < 0.35 else ("fold", 0)
    if to_call > stack * 0.5 and random.random() < 0.6:
        return ("fold", 0)
    return ("call", 0)


async def poker_bot_turn(room):
    """Пока ходить должен бот — он действует (с задержкой), до хода человека или конца раздачи."""
    for _ in range(60):
        s = room.get("poker")
        if not s or s["done"] or s["to_act"] is None:
            return
        pid = s["seats"][s["to_act"]]
        d = room["players"].get(pid)
        if not d or not d.get("bot"):
            return  # ход человека
        await asyncio.sleep(0.8)
        act, amt = poker_bot(s, pid)
        if not poker_action(s, pid, act, amt):
            to_call = s["cur_bet"] - s["bets"][pid]
            poker_action(s, pid, "check" if to_call == 0 else "call", 0) or poker_action(s, pid, "fold", 0)
        await push_poker(room)

# ═══════════ МАФИЯ ═══════════
def mafia_public(room):
    """Публичная доска: живые/мёртвые, фаза, раунд, лог, статус голосования.
    Роли мёртвых раскрываются, живых — скрыты."""
    st = room.get("mafia")
    if not st:
        return {"type": "mafia_state", "phase": "lobby"}
    players = []
    for pid, p in room["players"].items():
        alive = st["alive"].get(pid, False)
        role = st["roles"].get(pid)
        players.append({
            "id": pid, "name": p["name"],
            "alive": alive, "bot": bool(p.get("bot")),
            # роль видна только у мёртвых или в конце игры
            "role": role if (not alive or st["phase"] == "over") else None,
        })
    out = {"type": "mafia_state", "host": room["host"],
           "phase": st["phase"], "round": st["round"],
           "players": players, "log": st["log"][-12:],
           "winner": st["winner"], "last_night": st.get("last_night")}
    if st["phase"] == "day":
        tally = {}
        for t in st["votes"].values():
            if t is not None:
                tally[t] = tally.get(t, 0) + 1
        out["vote"] = {"tally": tally, "voted": list(st["votes"].keys()),
                       "pending": mf.day_vote_pending(st)}
    if st["phase"] == "night":
        out["night_pending"] = len(mf.night_role_pending(st))
    return out


async def mafia_send_private(room):
    """Каждому живому шлём его роль и доступную ночную цель-панель."""
    st = room["mafia"]
    maf = set(mf.mafia_members(st))
    for pid, p in room["players"].items():
        ws = p.get("ws")
        if not ws:
            continue
        role = st["roles"].get(pid)
        meta = mf.ROLE_META.get(role, {})
        alive = st["alive"].get(pid, False)
        priv = {"type": "mafia_role", "role": role,
                "emoji": meta.get("emoji", ""), "title": meta.get("title", ""),
                "desc": meta.get("desc", ""), "alive": alive,
                # мафия знает своих
                "mafia_team": [room["players"][m]["name"] for m in maf] if role == "mafia" else None,
                "sheriff_results": {room["players"][t]["name"]: r
                                    for t, r in st.get("sheriff_results", {}).get(pid, {}).items()}
                                   if role == "sheriff" else None,
                # патрульному — сообщаем, если он предотвратил нападение прошлой ночью
                "patrol_alert": bool(st.get("patrol_alerts", {}).get(pid)) if role == "patrol" else False,
                # можно ли ходить ночью и по кому
                "can_act": alive and st["phase"] == "night" and role in mf.NIGHT_ROLES,
                "acted": pid in st["night_actions"],
                "targets": [{"id": t, "name": room["players"][t]["name"]}
                            for t in mf.alive_pids(st)
                            if not (role == "mafia" and t in maf)    # мафия не бьёт своих
                            and not (role == "patrol" and t == pid)]  # патруль не охраняет себя
                if (alive and st["phase"] == "night") else [],
                }
        try:
            await ws.send_json(priv)
        except Exception:
            pass


async def mafia_broadcast(room):
    await broadcast(room, mafia_public(room))
    await mafia_send_private(room)


async def start_mafia(room):
    pids = list(room["players"].keys())
    if len(pids) < 3:
        await broadcast(room, {"type": "error", "msg": "Мафия: нужно минимум 3 игрока (можно добрать ботами)."})
        return
    st = mf.new_state(pids)
    if not st:
        await broadcast(room, {"type": "error", "msg": "Не удалось раздать роли."})
        return
    st["log"].append("🌙 Город засыпает. Ночь 1 — мафия выходит на охоту.")
    room["mafia"] = st
    room["state"] = "playing"
    await broadcast(room, {"type": "started", "n": len(pids)})
    await mafia_broadcast(room)
    await mafia_bots_night(room)


async def mafia_bots_night(room):
    """Боты делают ночные действия."""
    st = room.get("mafia")
    if not st or st["phase"] != "night":
        return
    maf = mf.mafia_members(st)
    for pid in list(mf.night_role_pending(st)):
        p = room["players"].get(pid)
        if not p or not p.get("bot"):
            continue
        role = st["roles"][pid]
        if role == "mafia":
            targets = [t for t in mf.alive_pids(st) if t not in maf]
        else:
            targets = [t for t in mf.alive_pids(st) if t != pid or role == "doctor"]
        if targets:
            mf.submit_night(st, pid, random.choice(targets))
    await mafia_after_night_maybe(room)


async def mafia_after_night_maybe(room):
    """Если все ночные роли сходили — разрешаем ночь и уходим в день."""
    st = room["mafia"]
    if mf.night_role_pending(st):
        await mafia_broadcast(room)
        return
    res = mf.resolve_night(st)
    if res["killed"]:
        st["log"].append(f"☠️ Ночью убит: {room['players'][res['killed']]['name']}.")
    elif res["saved"]:
        st["log"].append("💉 Ночью было покушение, но доктор спас жертву!")
    else:
        st["log"].append("🌫️ Ночь прошла тихо — никто не погиб.")
    if st["winner"]:
        st["log"].append(_mafia_win_line(st))
    else:
        st["log"].append(f"☀️ Город просыпается. День {st['round']} — обсуждайте и голосуйте.")
    await mafia_broadcast(room)
    await mafia_bots_day(room)


async def mafia_bots_day(room):
    """Боты голосуют днём (случайно среди живых не-себя)."""
    st = room.get("mafia")
    if not st or st["phase"] != "day":
        return
    for pid in list(mf.day_vote_pending(st)):
        p = room["players"].get(pid)
        if not p or not p.get("bot"):
            continue
        cand = [t for t in mf.alive_pids(st) if t != pid]
        if cand:
            mf.submit_vote(st, pid, random.choice(cand))
    await mafia_broadcast(room)


def _mafia_win_line(st):
    if st["winner"] == "town":
        return "🎉 ПОБЕДА ГОРОДА! Вся мафия вычищена."
    return "🔪 ПОБЕДА МАФИИ! Город пал."


# ═══════════ ТОЧКИ И КВАДРАТЫ (Dots & Boxes, 4×4) ═══════════
async def push_db(room):
    s=room["db"]
    await broadcast(room,{"type":"db_state","h":s["h"],"v":s["v"],"boxes":s["boxes"],"players":s["players"],
        "turn_pid":s["players"][s["turn"]],"names":{x:room["players"][x]["name"] for x in s["players"] if x in room["players"]},
        "scores":s["scores"],"winner":s["winner"],"done":s["done"]})
async def start_db(room):
    pids=list(room["players"].keys())[:2]
    if len(pids)<2: await broadcast(room,{"type":"error","msg":"Нужно 2 игрока."}); return
    room["db"]={"h":[[0]*4 for _ in range(5)],"v":[[0]*5 for _ in range(4)],"boxes":[[0]*4 for _ in range(4)],
        "players":pids,"turn":0,"scores":[0,0],"winner":None,"done":False}; room["state"]="playing"
    await push_db(room)

# ═══════════ БЫКИ И КОРОВЫ (Bulls & Cows) ═══════════
def bc_eval(secret, guess):
    bulls=sum(1 for i in range(4) if guess[i]==secret[i])
    cows=sum(1 for d in guess if d in secret)-bulls
    return bulls,cows
async def push_bc(room):
    s=room["bc"]
    await broadcast(room,{"type":"bc_state","players":s["players"],"phase":s["phase"],
        "ready":{x:bool(s["codes"].get(x)) for x in s["players"]},"turn_pid":s["players"][s["turn"]] if s["phase"]=="play" else None,
        "names":{x:room["players"][x]["name"] for x in s["players"] if x in room["players"]},
        "guesses":{x:s["guesses"][x] for x in s["players"]},"winner":s["winner"]})
async def start_bc(room):
    pids=list(room["players"].keys())[:2]
    if len(pids)<2: await broadcast(room,{"type":"error","msg":"Нужно 2 игрока."}); return
    room["bc"]={"players":pids,"codes":{},"guesses":{p:[] for p in pids},"turn":0,"phase":"setup","winner":None}
    room["state"]="playing"; await push_bc(room)

# ═══════════ МОРСКОЙ БОЙ (Battleship 10×10, авто-расстановка) ═══════════
import random as _rnd
BS_FLEET=[4,3,3,2,2,2,1,1,1,1]
def bs_place():
    while True:
        cells=set(); ok=True
        for size in BS_FLEET:
            placed=False
            for _try in range(60):
                horiz=_rnd.random()<0.5
                r=_rnd.randint(0,9); c=_rnd.randint(0,9)
                ship=[(r,c+i) if horiz else (r+i,c) for i in range(size)]
                if any(not(0<=x<10 and 0<=y<10) for x,y in ship): continue
                # нельзя касаться (включая диагонали)
                bad=False
                for x,y in ship:
                    for dx in(-1,0,1):
                        for dy in(-1,0,1):
                            if (x+dx,y+dy) in cells: bad=True
                if bad: continue
                cells.update(ship); placed=True; break
            if not placed: ok=False; break
        if ok and len(cells)==sum(BS_FLEET): return cells
async def push_bs(room):
    s=room["bs"]
    for pid in s["players"]:
        p=room["players"].get(pid)
        if not p or not p.get("ws"): continue
        opp=s["players"][1-s["players"].index(pid)]
        own=[[0]*10 for _ in range(10)]      # 1=ship,2=hit,3=miss(на своём поле)
        for (r,c) in s["ships"][pid]: own[r][c]=1
        for (r,c) in s["shots"][opp]: own[r][c]=2 if (r,c) in s["ships"][pid] else 3
        enemy=[[0]*10 for _ in range(10)]    # 2=hit,3=miss(видно тебе)
        for (r,c) in s["shots"][pid]: enemy[r][c]=2 if (r,c) in s["ships"][opp] else 3
        await p["ws"].send_json({"type":"bs_state","phase":s["phase"],"you":pid,"players":s["players"],
            "names":{x:room["players"][x]["name"] for x in s["players"] if x in room["players"]},
            "ready":{x:s["ready"][x] for x in s["players"]},"own":own,"enemy":enemy,
            "turn_pid":s["players"][s["turn"]] if s["phase"]=="battle" else None,"winner":s["winner"]})
async def start_bs(room):
    pids=list(room["players"].keys())[:2]
    if len(pids)<2: await broadcast(room,{"type":"error","msg":"Нужно 2 игрока."}); return
    room["bs"]={"players":pids,"ships":{p:bs_place() for p in pids},"shots":{p:set() for p in pids},
        "ready":{p:False for p in pids},"turn":0,"phase":"place","winner":None}; room["state"]="playing"
    await push_bs(room)


# ═══════════ БОТЫ (ИИ соперник) ═══════════
import itertools as _it
def _c4_drop_row(b, c):
    for r in range(5, -1, -1):
        if b[r][c] == 0: return r
    return None
def c4_bot(s, diff):
    b = s["board"]; valid = [c for c in range(7) if b[0][c] == 0]
    if not valid: return None
    me = s["turn"] + 1; opp = 3 - me
    def wins(p, c):
        r = _c4_drop_row(b, c)
        if r is None: return False
        b[r][c] = p; w = c4_check(b, r, c, p); b[r][c] = 0; return w
    if diff != "easy":
        for c in valid:
            if wins(me, c): return c
        for c in valid:
            if wins(opp, c): return c
    if diff == "hard":
        return sorted(valid, key=lambda c: abs(c - 3))[0]
    return random.choice([c for c in valid if c == 3] or valid) if diff == "medium" else random.choice(valid)
def rv_bot(s, diff):
    p = s["turn"] + 1; b = s["board"]; lg = rv_legal(b, p)
    if not lg: return None
    if diff == "easy": return random.choice(lg)
    if diff == "hard":
        for cor in [(0,0),(0,7),(7,0),(7,7)]:
            if cor in lg: return cor
    return max(lg, key=lambda m: len(rv_flips(b, m[0], m[1], p)))
def db_bot(s, diff):
    edges = [("h",r,c) for r in range(5) for c in range(4) if s["h"][r][c]==0] + \
            [("v",r,c) for r in range(4) for c in range(5) if s["v"][r][c]==0]
    if not edges: return None
    if diff != "easy":
        for (t,r,c) in edges:
            arr = s["h"] if t=="h" else s["v"]; arr[r][c]=1; done=False
            for (br,bc) in ([(r-1,c),(r,c)] if t=="h" else [(r,c-1),(r,c)]):
                if 0<=br<4 and 0<=bc<4 and s["h"][br][bc] and s["h"][br+1][bc] and s["v"][br][bc] and s["v"][br][bc+1]:
                    done=True
            arr[r][c]=0
            if done: return (t,r,c)
    return random.choice(edges)
def bs_bot(s, botid, diff):
    opp = s["players"][1 - s["players"].index(botid)]
    fired = s["shots"][botid]; ships = s["ships"][opp]
    untried = [(r,c) for r in range(10) for c in range(10) if (r,c) not in fired]
    if diff != "easy":
        for (r,c) in fired:
            if (r,c) in ships:   # попадание — добиваем соседей
                for dr,dc in ((0,1),(0,-1),(1,0),(-1,0)):
                    nb=(r+dr,c+dc)
                    if 0<=nb[0]<10 and 0<=nb[1]<10 and nb not in fired: return nb
    return random.choice(untried) if untried else None
def bc_bot_guess(s, botid):
    prev = s["guesses"][botid]
    cands = [''.join(p) for p in _it.permutations('0123456789', 4)]
    for g, bl, co in prev:
        cands = [x for x in cands if bc_eval(x, g) == (bl, co)]
    return random.choice(cands) if cands else "1234"

async def bot_turn(room):
    """Если в комнате есть бот и сейчас его ход — он ходит (с задержкой)."""
    bot = next((p for p, d in room["players"].items() if d.get("bot")), None)
    if not bot: return
    diff = room["players"][bot]["bot"]; g = room.get("game")
    for _ in range(40):  # бот может ходить несколько раз подряд (морской бой при попадании)
        await asyncio.sleep(0.6)
        if g == "quoridor":
            s = room.get("quoridor")
            if not s or s.get("winner") or room.get("state") != "playing": return
            turn_pid = s["player_order"][s["turn"]]
            if not room["players"].get(turn_pid, {}).get("bot"): return
            diff = room["players"][turn_pid].get("bot", "medium")
            action = bot_choose_action(s, turn_pid, diff)
            if action:
                if action["action"] == "move":
                    apply_pawn_move(s, turn_pid, action["r"], action["c"])
                elif action["action"] == "wall":
                    apply_wall_placement(s, turn_pid, action["r"], action["c"], action["dir"])
                await push_quoridor(room)
                if s.get("winner"): return
            else:
                return
        elif g == "c4":
            s = room.get("c4");
            if not s or s["winner"] or s["draw"] or s["players"][s["turn"]] != bot: return
            col = c4_bot(s, diff)
            if col is None: return
            p = s["turn"]+1
            for r in range(5,-1,-1):
                if s["board"][r][col]==0:
                    s["board"][r][col]=p; s["last"]=[r,col]
                    if c4_check(s["board"],r,col,p): s["winner"]=bot
                    elif all(s["board"][0][c] for c in range(7)): s["draw"]=True
                    else: s["turn"]=1-s["turn"]
                    break
            await push_c4(room);
            if s["winner"] or s["draw"]: return
        elif g == "checkers":
            s = room.get("ck")
            if not s or s["done"] or s["players"][s["turn"]] != bot: return
            mv = ck_bot(s, diff)
            if not mv: return
            ck_apply(s, *mv)
            await push_ck(room)
            if s["done"] or not s.get("must_continue"): return
            continue  # цепной прыжок ботом — тот же бот продолжает без задержки-выхода
        elif g == "chess":
            s = room.get("chess")
            if not s or s["done"] or s["order"][s["turn"]] != bot: return
            mv = chess_bot(s, diff)
            if not mv: return
            chs.apply_move(s, *mv, "Q")
            await push_chess(room)
            return
        elif g == "reversi":
            s = room.get("rv")
            if not s or s["done"] or s["players"][s["turn"]] != bot: return
            mv = rv_bot(s, diff)
            if not mv: return
            p=s["turn"]+1; fl=rv_flips(s["board"],mv[0],mv[1],p)
            s["board"][mv[0]][mv[1]]=p
            for (rr,cc) in fl: s["board"][rr][cc]=p
            nxt=1-s["turn"]
            if rv_legal(s["board"],nxt+1): s["turn"]=nxt
            elif rv_legal(s["board"],p): pass
            else:
                s["done"]=True; f=sum(x.count(1) for x in s["board"]); se=sum(x.count(2) for x in s["board"])
                s["winner"]=None if f==se else s["players"][0 if f>se else 1]
            await push_rv(room)
            if s["done"] or s["players"][s["turn"]]!=bot: return
        elif g == "dots":
            s = room.get("db")
            if not s or s["done"] or s["players"][s["turn"]] != bot: return
            e = db_bot(s, diff)
            if not e: return
            t,r,c=e; arr=s["h"] if t=="h" else s["v"]; arr[r][c]=s["turn"]+1; gained=0
            for (br,bc) in ([(r-1,c),(r,c)] if t=="h" else [(r,c-1),(r,c)]):
                if 0<=br<4 and 0<=bc<4 and s["boxes"][br][bc]==0 and s["h"][br][bc] and s["h"][br+1][bc] and s["v"][br][bc] and s["v"][br][bc+1]:
                    s["boxes"][br][bc]=s["turn"]+1; s["scores"][s["turn"]]+=1; gained+=1
            if not gained: s["turn"]=1-s["turn"]
            if sum(s["scores"])==16:
                s["done"]=True; s["winner"]=None if s["scores"][0]==s["scores"][1] else s["players"][0 if s["scores"][0]>s["scores"][1] else 1]
            await push_db(room)
            if s["done"] or s["players"][s["turn"]]!=bot: return
        elif g == "battleship":
            s = room.get("bs")
            if not s: return
            if s["phase"]=="place":
                if not s["ready"][bot]:
                    s["ready"][bot]=True
                    if all(s["ready"].values()): s["phase"]="battle"
                    await push_bs(room)
                return
            if s["winner"] or s["players"][s["turn"]]!=bot: return
            mv=bs_bot(s,bot,diff)
            if not mv: return
            opp=s["players"][1-s["players"].index(bot)]; s["shots"][bot].add(mv)
            hit=mv in s["ships"][opp]
            if s["ships"][opp].issubset(s["shots"][bot]): s["winner"]=bot
            elif not hit: s["turn"]=1-s["turn"]
            await push_bs(room)
            if s["winner"] or s["players"][s["turn"]]!=bot: return
        elif g == "bulls":
            s = room.get("bc")
            if not s: return
            if s["phase"]=="setup":
                if not s["codes"].get(bot):
                    s["codes"][bot]=''.join(random.sample('0123456789',4))
                    if len(s["codes"])==2: s["phase"]="play"
                    await push_bc(room)
                return
            if s["winner"] or s["players"][s["turn"]]!=bot: return
            g2=bc_bot_guess(s,bot); opp=s["players"][1-s["players"].index(bot)]
            bl,co=bc_eval(s["codes"][opp],g2); s["guesses"][bot].append([g2,bl,co])
            if bl==4: s["winner"]=bot
            else: s["turn"]=1-s["turn"]
            await push_bc(room)
            if s["winner"] or s["players"][s["turn"]]!=bot: return
        elif g == "uno":
            s = room.get("uno")
            if not s or s["winner"] or un.cur_player(s) != bot: return
            top = s["discard"][-1]; cur = s["cur_color"]
            playable = [c for c in s["hands"][bot] if un.can_play(c, top, cur)]
            if playable:
                card = sorted(playable, key=lambda c: c["c"] == 4)[0]
                uno_apply_play(room, bot, [card], random.randint(0,3) if card["c"]==4 else None)
            else:
                drawn = un.draw_from(s, 1)
                if drawn:
                    s["hands"][bot] += drawn; d = drawn[0]
                    if un.can_play(d, top, cur):
                        uno_apply_play(room, bot, [d], random.randint(0,3) if d["c"]==4 else None)
                    else: un.advance(s, 1)
                else: un.advance(s, 1)
            await push_uno(room)
            if s["winner"] or un.cur_player(s) != bot: return
        elif g == "durak":
            s = room.get("dk")
            if not s or s["durak"]: return
            if bot == s["defender"]:
                undef = [i for i, pr in enumerate(s["table"]) if not pr.get("d")]
                if not undef: return
                i = undef[0]; atk = s["table"][i]["a"]
                beats = [c for c in s["hands"][bot] if dk.beats(c, atk, s["trump"])]
                if beats:
                    card = min(beats, key=lambda c: (c["s"]==s["trump"], c["r"]))
                    s["hands"][bot].remove(card); s["table"][i]["d"] = card
                    durak_try_bito(room); await push_durak(room)
                    if s["durak"]: return
                else:
                    for pr in s["table"]:
                        s["hands"][bot].append(pr["a"])
                        if pr.get("d"): s["hands"][bot].append(pr["d"])
                    s["table"] = []; prev = s["defender"]; dk.refill(s)
                    na = dk.next_with_cards(s, prev)
                    if na: s["attacker"] = na; s["defender"] = dk.next_with_cards(s, na) or na
                    s["passed"] = set(); durak_resolve_end(room); await push_durak(room); return
            elif bot == s["attacker"]:
                if not s["table"]:
                    card = min(s["hands"][bot], key=lambda c: (c["s"]==s["trump"], c["r"]))
                    s["hands"][bot].remove(card); s["table"].append({"a":card,"d":None}); s["passed"]=set()
                    await push_durak(room); return
                elif dk.all_defended(s):
                    ranks = dk.table_ranks(s)
                    room_ok = len(s["table"])<6 and sum(1 for p in s["table"] if not p.get("d")) < len(s["hands"][s["defender"]])
                    throw = [c for c in s["hands"][bot] if c["r"] in ranks] if room_ok else []
                    if throw:
                        c = min(throw, key=lambda c: c["r"]); s["hands"][bot].remove(c)
                        s["table"].append({"a":c,"d":None}); s["passed"]=set(); await push_durak(room); return
                    else:
                        s["passed"].add(bot); durak_try_bito(room); await push_durak(room); return
                else:
                    return
            else:
                if dk.all_defended(s):
                    s["passed"].add(bot); durak_try_bito(room); await push_durak(room)
                return
        elif g == "c4_3d":
            s = room.get("c4_3d")
            if not s or not s["started"] or s["winner"]: return
            # у c4_3d бывает несколько ботов сразу — ищем того, чей сейчас ход, а не первого попавшегося
            turn_bot = s["players"][s["turn"] % len(s["players"])]
            if not room["players"].get(turn_bot, {}).get("bot"): return
            bot = turn_bot
            options = [(x, y) for x in range(5) for y in range(5) if len(s["grid"][x][y]) < 5]
            if not options: return
            x, y = random.choice(options)
            col = s["grid"][x][y]
            col.append(bot)
            z = len(col) - 1
            await broadcast(room, {"type": "c4_3d_drop_anim", "x": x, "y": y, "z": z, "pid": bot})
            win_line = c4d.check_win(s["grid"], x, y, z, bot)
            if win_line:
                s["winner"] = bot; s["win_line"] = win_line; s["started"] = False
            elif all(len(s["grid"][i][j]) == 5 for i in range(5) for j in range(5)):
                s["winner"] = "draw"; s["started"] = False
            else:
                s["turn"] += 1
            await broadcast(room, {"type": "c4_3d_update", "state": s})
            if s["winner"]: return
        else:
            return


@app.get("/checkers")
async def ck_page(): return FileResponse("/app/static/checkers.html")
@app.get("/chess")
async def chess_page(): return FileResponse("/app/static/chess.html")
@app.get("/poker")
async def poker_page(): return FileResponse("/app/static/poker.html")
@app.get("/reversi")
async def rv_page(): return FileResponse("/app/static/reversi.html")
@app.get("/dots")
async def db_page(): return FileResponse("/app/static/dots.html")
@app.get("/bulls")
async def bc_page(): return FileResponse("/app/static/bulls.html")
@app.get("/battleship")
async def bs_page(): return FileResponse("/app/static/battleship.html")
@app.get("/variants")
async def variants_page():
    return FileResponse("/app/static/variants.html")


@app.get("/mafia")
async def mafia_page():
    return FileResponse("/app/static/mafia.html")


@app.get("/profile")
async def profile_page(request: Request):
    if not current_user(request):
        return RedirectResponse("/games/")
    return FileResponse("/app/static/profile.html")


@app.get("/spy")
async def spy_page():
    return FileResponse("/app/static/spy.html")


@app.get("/bunker")
async def bunker_page():
    return FileResponse("/app/static/bunker.html")


@app.get("/alias")
async def alias_page():
    return FileResponse("/app/static/alias.html")


@app.get("/durak")
async def durak_page():
    return FileResponse("/app/static/durak.html")



# ═══════════ КОРИДОР (Quoridor) ═══════════
async def push_quoridor(room):
    s = room.get("quoridor")
    if not s: return
    turn_pid = s["player_order"][s["turn"]]
    names = {p: room["players"][p]["name"] for p in s["player_order"] if p in room["players"]}
    await broadcast(room, {
        "type": "quoridor_state",
        "board_size": s["board_size"],
        "player_count": s["player_count"],
        "player_order": s["player_order"],
        "players": s["players"],
        "names": names,
        "walls": s["walls"],
        "turn_pid": turn_pid,
        "winner": s["winner"],
        "last_action": s.get("last_action"),
        "valid_moves": get_valid_pawn_moves(s, turn_pid) if not s.get("winner") else []
    })

async def start_quoridor(room):
    pids = list(room["players"].keys())
    if len(pids) not in (2, 3, 4):
        await broadcast(room, {"type": "error", "msg": "Для игры нужно 2, 3 или 4 игрока."})
        return
    cfg = room.get("quoridor_settings") or {}
    custom_walls = cfg.get("walls")
    room["quoridor"] = new_quoridor_state(pids, custom_walls=custom_walls)
    room["state"] = "playing"
    await push_quoridor(room)

async def push_game(room):
    if not room or "game" not in room: return
    g = room["game"]
    pmap = {"spy": push_spy, "al": alias_public, "durak": push_durak, "mafia": mafia_broadcast, "variants": push_variants,
            "bunker": push_bunker, "uno": push_uno, "c4": push_c4, "reversi": push_rv,
            "checkers": push_ck, "chess": push_chess, "dots": push_db,
            "bulls": push_bc, "battleship": push_bs, "poker": push_poker, "c4_3d": push_c4_3d_resync, "quoridor": push_quoridor, "quoridor": push_quoridor}
    if g in pmap: await pmap[g](room)


async def resync_game(room):
    """Разослать актуальное состояние текущей игры (после переподключения игрока)."""
    g = room.get("game")
    try:
        if room.get("state") != "playing":
            await broadcast(room, lobby_state(room)); return
        RESYNC = {
            "bunker": push_bunker, "uno": push_uno, "c4": push_c4, "reversi": push_rv,
            "dots": push_db, "bulls": push_bc, "battleship": push_bs, "checkers": push_ck,
            "chess": push_chess, "poker": push_poker, "durak": push_durak, "guesswho": push_gw,
            "variants": push_variants, "c4_3d": push_c4_3d_resync, "quoridor": push_quoridor,
        }
        if g == "mafia" and room.get("mafia"):
            await mafia_broadcast(room)
        elif g == "alias":
            await broadcast(room, alias_public(room))
        elif g in RESYNC:
            await RESYNC[g](room)
        else:
            await broadcast(room, lobby_state(room))
    except Exception:
        logging.exception("resync failed")


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    auth_user = _check_session(websocket.cookies.get("jsession"))
    if not auth_user:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    pid = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    room = None
    _presence_add(auth_user["username"])  # онлайн-статус для друзей
    try:
        while True:
            msg = json.loads(await websocket.receive_text())
            if msg.get("type") == "ping":
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
                continue
            act = msg.get("action")
            if not act:
                continue

            if act == "create":
                code = code4()
                while code in rooms:
                    code = code4()
                room = {"code": code, "players": {}, "host": pid, "state": "lobby", "game": msg.get("game", "spy"),
                        "settings": {"seats": 0, "timer": 0, "reveals_per_round": 0}, "vote": None}
                rooms[code] = room
                room["players"][pid] = {"name": msg.get("name", "Игрок")[:20], "ws": websocket, "role": None, "alive": True, "user": auth_user["username"]}
                log_usage("create", msg.get("name", "Игрок"), room["game"], code, websocket, auth_user["username"])
                _presence_game(auth_user["username"], room["game"])
                await websocket.send_json({"type": "joined", "code": code, "pid": pid, "host": True})
                await broadcast(room, lobby_state(room))

            elif act == "join":
                code = (msg.get("code", "") or "").upper().strip()
                room = rooms.get(code)
                if room:
                    log_usage("join", msg.get("name", "Игрок"), room.get("game", "?"), code, websocket, auth_user["username"])
                    _presence_game(auth_user["username"], room.get("game"))
                if not room:
                    await websocket.send_json({"type": "error", "msg": "Комната не найдена."})
                    room = None
                    continue
                # ПЕРЕПОДКЛЮЧЕНИЕ: если этот аккаунт уже в комнате (вылетел из браузера),
                # занимаем его прежний слот вместо нового — игра для остальных не рвётся
                old_pid = next((q for q, pl in room["players"].items()
                                if pl.get("user") == auth_user["username"] and not pl.get("ws")), None)
                if old_pid:
                    pid = old_pid
                    room["players"][pid]["ws"] = websocket
                    await websocket.send_json({"type": "joined", "code": code, "pid": pid, "host": room["host"] == pid})
                    await resync_game(room)   # вернуть игрока в текущее состояние игры
                    continue
                room["players"][pid] = {"name": msg.get("name", "Игрок")[:20], "ws": websocket, "role": None, "alive": True, "user": auth_user["username"]}
                await websocket.send_json({"type": "joined", "code": code, "pid": pid, "host": room["host"] == pid})
                await broadcast(room, lobby_state(room))
                # игры строго на двоих — авто-старт когда зашли двое (кнопки старта в лобби нет)
                TWO_P = {"c4": start_c4, "reversi": start_rv, "dots": start_db,
                         "bulls": start_bc, "battleship": start_bs, "checkers": start_ck, "chess": start_chess}
                g = room.get("game")
                if g in TWO_P and room["state"] == "lobby" and len(room["players"]) == 2:
                    await TWO_P[g](room)

            elif act == "start" and room and room["host"] == pid:
                if room.get("game") == "spy":
                    await start_spy(room, msg.get("timer", 5))
                elif room.get("game") == "bunker":
                    await start_bunker(room)
                elif room.get("game") == "variants":
                    await start_variants(room)
                elif room.get("game") == "alias":
                    await start_alias(room)
                elif room.get("game") == "durak":
                    await start_durak(room)
                elif room.get("game") == "uno":
                    await start_uno(room)
                elif room.get("game") == "quoridor":
                    await start_quoridor(room)
                    await bot_turn(room)
                elif room.get("game") == "c4":
                    await start_c4(room)
                elif room.get("game") == "reversi":
                    await start_rv(room)
                elif room.get("game") == "dots":
                    await start_db(room)
                elif room.get("game") == "bulls":
                    await start_bc(room)
                elif room.get("game") == "battleship":
                    await start_bs(room)
                elif room.get("game") == "guesswho":
                    await start_gw(room, msg.get("title", ""))
                elif room.get("game") == "chess":
                    await start_chess(room)
                elif room.get("game") == "c4_3d":
                    await start_c4_3d(room)
                elif room.get("game") == "mafia":
                    await start_mafia(room)
                elif room.get("game") == "poker":
                    # настройки стола (блайнды/стек) — только на самой первой раздаче
                    if not room.get("poker_stacks"):
                        st_cfg = msg.get("settings") or {}
                        room["poker_settings"] = {
                            "bb": max(2, min(int(st_cfg.get("bb", 20)), 1000)),
                            "stack": max(50, min(int(st_cfg.get("stack", 1000)), 100000)),
                        }
                    if start_poker(room):
                        await push_poker(room)
                        await poker_bot_turn(room)
                    else:
                        await websocket.send_json({"type": "error", "msg": "Нужно 2+ игрока с фишками."})

            # ── «Ещё раз» — переиграть ту же игру в том же лобби (любой игрок) ──
            elif act == "restart" and room and room.get("game"):
                g = room["game"]
                # сброс общего игрового стейта, игроки и комната остаются
                for key in ("c4", "rv", "db", "bc", "bs", "ck", "chess", "gw", "durak", "uno",
                            "spy", "bunker", "al", "poker", "poker_stacks", "mafia", "c4_3d"):
                    room.pop(key, None)
                room["state"] = "lobby"
                # авто-старт для игр на двоих/с ботом; партийные (spy/bunker/alias/durak/uno/poker) — хост жмёт старт
                RESTART_TWO = {"c4": start_c4, "reversi": start_rv, "dots": start_db, "bulls": start_bc,
                               "battleship": start_bs, "checkers": start_ck, "chess": start_chess}
                if g in RESTART_TWO:
                    await RESTART_TWO[g](room)
                    await bot_turn(room)
                else:
                    await broadcast(room, lobby_state(room))

            # ── Покер ──
            elif act == "poker_action" and room and room.get("game") == "poker" and room.get("poker"):
                s = room["poker"]
                if not s["done"] and s["to_act"] is not None and s["seats"][s["to_act"]] == pid:
                    if poker_action(s, pid, msg.get("act", ""), msg.get("amount", 0)):
                        await push_poker(room)
                        await poker_bot_turn(room)

            elif act == "poker_next" and room and room.get("game") == "poker" and room.get("poker"):
                # новая раздача в том же лобби (жмёт любой; только если текущая закончена)
                if room["poker"].get("done"):
                    if start_poker(room):
                        await push_poker(room)
                        await poker_bot_turn(room)
                    else:
                        await broadcast(room, {"type": "error", "msg": "Не хватает игроков с фишками для новой раздачи."})

            # ── Шахматы ──

            # ── Коридор (Quoridor) ──
            elif act == "quoridor_move" and room and room.get("game") == "quoridor" and room.get("quoridor"):
                s = room["quoridor"]
                if not s.get("winner") and pid == s["player_order"][s["turn"]]:
                    r, c = msg.get("r"), msg.get("c")
                    ok, err = apply_pawn_move(s, pid, r, c)
                    if ok:
                        await push_quoridor(room)
                        await bot_turn(room)
                    else:
                        await websocket.send_json({"type": "error", "msg": err})

            elif act == "quoridor_wall" and room and room.get("game") == "quoridor" and room.get("quoridor"):
                s = room["quoridor"]
                if not s.get("winner") and pid == s["player_order"][s["turn"]]:
                    r, c, wdir = msg.get("r"), msg.get("c"), msg.get("dir")
                    ok, err = apply_wall_placement(s, pid, r, c, wdir)
                    if ok:
                        await push_quoridor(room)
                        await bot_turn(room)
                    else:
                        await websocket.send_json({"type": "error", "msg": err})

            elif act == "quoridor_settings" and room and room.get("game") == "quoridor" and room.get("host") == pid:
                room["quoridor_settings"] = {
                    "walls": msg.get("walls"),
                    "timer": msg.get("timer", 0)
                }
                await broadcast(room, lobby_state(room))

            elif act and act.startswith("c4_3d") and room and room.get("game") == "c4_3d":
                msg["pid"] = pid
                await c4d.push_c4_3d(room, msg, websocket, broadcast)
                if act == "c4_3d_drop":
                    await bot_turn(room)
            elif act == "chess_move" and room and room.get("game") == "chess" and room.get("chess"):
                s = room["chess"]
                if not s["done"] and pid == s["order"][s["turn"]]:
                    fr, fc, tr, tc = msg.get("fr"), msg.get("fc"), msg.get("tr"), msg.get("tc")
                    if all(isinstance(x, int) for x in (fr, fc, tr, tc)):
                        if (tr, tc) in chs.legal_moves(s, fr, fc):
                            chs.apply_move(s, fr, fc, tr, tc, msg.get("promo", "Q"))
                            await push_chess(room)
                            if room.get("state") == "playing" and any(d.get("bot") for d in room.get("players", {}).values()):
                                await bot_turn(room)

            # ── Кто есть кто ──
            elif act == "gw_flip" and room and room.get("game") == "guesswho" and room.get("gw"):
                s = room["gw"]; idx = msg.get("idx")
                if pid in s["flipped"] and isinstance(idx, int) and 0 <= idx < len(s["chars"]):
                    s["flipped"][pid].symmetric_difference_update({idx})
                    await push_gw(room)
            elif act == "gw_guess" and room and room.get("game") == "guesswho" and room.get("gw"):
                s = room["gw"]; idx = msg.get("idx")
                if not s["winner"] and pid in s["secret"] and isinstance(idx, int) and 0 <= idx < len(s["chars"]):
                    opp = s["players"][1 - s["players"].index(pid)]
                    s["winner"] = pid if idx == s["secret"][opp] else opp
                    s["reveal"] = True
                    await push_gw(room)

            # ── Добавить бота (хост, в лобби) — для игр на двоих ──
            elif act == "add_bot" and room and room["host"] == pid and room.get("state") == "lobby":
                g = room.get("game")
                two_p = {"c4":start_c4,"reversi":start_rv,"dots":start_db,"bulls":start_bc,"battleship":start_bs,"checkers":start_ck,"chess":start_chess}
                party = {"bunker","spy","variants","alias","durak","uno","poker","mafia","quoridor"}
                diff = msg.get("diff", "medium")
                if g in two_p and len(room["players"]) < 2:
                    botid = "bot_" + "".join(random.choices(string.ascii_lowercase, k=6))
                    room["players"][botid] = {"name": "🤖 Бот (" + diff + ")", "ws": None, "role": None, "alive": True, "bot": diff}
                    await broadcast(room, lobby_state(room))
                    await two_p[g](room)
                    await bot_turn(room)
                elif g in party and len(room["players"]) < 8:
                    botid = "bot_" + "".join(random.choices(string.ascii_lowercase, k=6))
                    room["players"][botid] = {"name": "🤖 Бот", "ws": None, "role": None, "alive": True, "bot": diff}
                    await broadcast(room, lobby_state(room))   # старт жмёт хост вручную
                elif g == "c4_3d" and len(room["players"]) < 3:
                    botid = "bot_" + "".join(random.choices(string.ascii_lowercase, k=6))
                    room["players"][botid] = {"name": "🤖 Бот", "ws": None, "role": None, "alive": True, "bot": diff}
                    state = c4d.get_state(room)
                    if botid not in state["players"]:
                        state["players"].append(botid)
                        used = set(state["colors"].values())
                        state["colors"][botid] = next((c for c in c4d.PALETTE if c not in used), "#888888")
                    await broadcast(room, lobby_state(room))
                    await broadcast(room, {"type": "c4_3d_update", "state": state})

            # ── Шашки ──
            elif act == "ck_move" and room and room.get("game") == "checkers" and room.get("ck"):
                s = room["ck"]
                if s["players"][s["turn"]] == pid and not s["done"]:
                    fr,fc,tr,tc = msg.get("fr"),msg.get("fc"),msg.get("tr"),msg.get("tc")
                    legal = ck_legal(s["board"], s["turn"]+1, only_from=s.get("must_continue"))
                    match = next((m for m in legal if m[0]==fr and m[1]==fc and m[2]==tr and m[3]==tc), None)
                    if match:
                        ck_apply(s, *match)
                        await push_ck(room)
                        await bot_turn(room)

            # ── Реверси ──
            elif act == "rv_move" and room and room.get("game") == "reversi" and room.get("rv"):
                s = room["rv"]
                if s["players"][s["turn"]] == pid and not s["done"]:
                    r, c = msg.get("r"), msg.get("c"); p = s["turn"]+1
                    fl = rv_flips(s["board"], r, c, p) if isinstance(r,int) and isinstance(c,int) else []
                    if fl:
                        s["board"][r][c] = p
                        for (rr,cc) in fl: s["board"][rr][cc] = p
                        nxt = 1 - s["turn"]
                        if rv_legal(s["board"], nxt+1): s["turn"] = nxt
                        elif rv_legal(s["board"], p): pass   # соперник пасует
                        else:
                            s["done"] = True
                            f = sum(x.count(1) for x in s["board"]); se = sum(x.count(2) for x in s["board"])
                            s["winner"] = None if f==se else s["players"][0 if f>se else 1]
                        await push_rv(room)
                        await bot_turn(room)

            # ── Точки ──
            elif act == "db_edge" and room and room.get("game") == "dots" and room.get("db"):
                s = room["db"]
                if s["players"][s["turn"]] == pid and not s["done"]:
                    t, r, c = msg.get("t"), msg.get("r"), msg.get("c"); p = s["turn"]+1
                    arr = s["h"] if t=="h" else s["v"]
                    valid = t in ("h","v") and 0<=r<len(arr) and 0<=c<len(arr[0]) and arr[r][c]==0
                    if valid:
                        arr[r][c] = p; gained = 0
                        for (br,bc) in ([(r-1,c),(r,c)] if t=="h" else [(r,c-1),(r,c)]):
                            if 0<=br<4 and 0<=bc<4 and s["boxes"][br][bc]==0:
                                if s["h"][br][bc] and s["h"][br+1][bc] and s["v"][br][bc] and s["v"][br][bc+1]:
                                    s["boxes"][br][bc] = p; s["scores"][s["turn"]] += 1; gained += 1
                        if not gained: s["turn"] = 1 - s["turn"]
                        if sum(s["scores"]) == 16:
                            s["done"] = True
                            s["winner"] = None if s["scores"][0]==s["scores"][1] else s["players"][0 if s["scores"][0]>s["scores"][1] else 1]
                        await push_db(room)
                        await bot_turn(room)

            # ── Быки и коровы ──
            elif act == "bc_set" and room and room.get("game") == "bulls" and room.get("bc"):
                s = room["bc"]; code = str(msg.get("code",""))
                if s["phase"]=="setup" and len(code)==4 and code.isdigit() and len(set(code))==4:
                    s["codes"][pid] = code
                    if len(s["codes"]) == 2: s["phase"] = "play"
                    await push_bc(room)
                    await bot_turn(room)
            elif act == "bc_guess" and room and room.get("game") == "bulls" and room.get("bc"):
                s = room["bc"]; g = str(msg.get("guess",""))
                if s["phase"]=="play" and s["players"][s["turn"]]==pid and not s["winner"] and len(g)==4 and g.isdigit():
                    opp = s["players"][1-s["players"].index(pid)]
                    bulls, cows = bc_eval(s["codes"][opp], g)
                    s["guesses"][pid].append([g, bulls, cows])
                    if bulls == 4: s["winner"] = pid
                    else: s["turn"] = 1 - s["turn"]
                    await push_bc(room)
                    await bot_turn(room)

            # ── Морской бой ──
            elif act == "bs_reroll" and room and room.get("game") == "battleship" and room.get("bs"):
                s = room["bs"]
                if s["phase"]=="place" and not s["ready"][pid]:
                    s["ships"][pid] = bs_place(); await push_bs(room)
            elif act == "bs_ready" and room and room.get("game") == "battleship" and room.get("bs"):
                s = room["bs"]
                if s["phase"]=="place":
                    s["ready"][pid] = True
                    if all(s["ready"].values()): s["phase"] = "battle"
                    await push_bs(room)
                    await bot_turn(room)
            elif act == "bs_fire" and room and room.get("game") == "battleship" and room.get("bs"):
                s = room["bs"]
                if s["phase"]=="battle" and s["players"][s["turn"]]==pid and not s["winner"]:
                    r, c = msg.get("r"), msg.get("c")
                    opp = s["players"][1-s["players"].index(pid)]
                    if isinstance(r,int) and isinstance(c,int) and (r,c) not in s["shots"][pid]:
                        s["shots"][pid].add((r,c))
                        hit = (r,c) in s["ships"][opp]
                        if s["ships"][opp].issubset(s["shots"][pid]): s["winner"] = pid
                        elif not hit: s["turn"] = 1 - s["turn"]   # промах → ход сопернику; попал → стреляешь ещё
                        await push_bs(room)
                        await bot_turn(room)

            # ── 4 в ряд ──
            elif act == "c4_drop" and room and room.get("game") == "c4" and room.get("c4"):
                s = room["c4"]
                if s["players"][s["turn"]] == pid and not s["winner"] and not s["draw"]:
                    col = msg.get("col")
                    if isinstance(col, int) and 0 <= col < 7:
                        p = s["turn"] + 1
                        for r in range(5, -1, -1):       # снизу вверх
                            if s["board"][r][col] == 0:
                                s["board"][r][col] = p
                                s["last"] = [r, col]
                                if c4_check(s["board"], r, col, p):
                                    s["winner"] = pid
                                elif all(s["board"][0][c] for c in range(7)):
                                    s["draw"] = True
                                else:
                                    s["turn"] = 1 - s["turn"]
                                await push_c4(room)
                                await bot_turn(room)
                                break

            # ── UNO ──
            elif act == "uno_play" and room and room.get("game") == "uno" and room.get("uno"):
                s = room["uno"]
                if un.cur_player(s) == pid and not s.get("game_over") and not s.get("round_over"):
                    req = msg.get("cards") or ([msg.get("card")] if msg.get("card") else [])
                    hand = s["hands"].get(pid, [])
                    picked, pool = [], list(hand)
                    for rc in req:
                        m = next((c for c in pool if c["c"] == rc.get("c") and c["v"] == rc.get("v")), None)
                        if m: picked.append(m); pool.remove(m)
                    ok = bool(picked) and all(c["v"] == picked[0]["v"] for c in picked) \
                         and un.can_play(picked[0], s["discard"][-1], s["cur_color"],
                                         s.get("pending_penalty", 0), s.get("mode", "classic"))
                    if ok:
                        uno_apply_play(room, pid, picked, msg.get("color"))
                        await push_uno(room)
                    else:
                        await websocket.send_json({"type": "error", "msg": "Так нельзя. При активном штрафе (No Mercy) крой только картой добора не слабее."})
            elif act == "uno_draw" and room and room.get("game") == "uno" and room.get("uno"):
                s = room["uno"]
                if un.cur_player(s) == pid and not s.get("game_over") and not s.get("round_over"):
                    pend = s.get("pending_penalty", 0)
                    if s.get("mode") == "nomercy" and pend > 0:
                        # не смог/не захотел крыть стак — берёт весь накопленный штраф
                        got = un.draw_from(s, pend)
                        s["hands"][pid] += got
                        s["pending_penalty"] = 0
                        s["no_progress"] = 0 if got else s.get("no_progress", 0) + 1
                        elim = un.check_mercy(s, pid)
                        s["last_action"] = f"{room['players'][pid]['name']} взял +{len(got)}" + (" 💀 ВЫЛЕТЕЛ!" if elim else "")
                        alive = un.alive_order(s)
                        if len(alive) <= 1:
                            s["game_over"] = True; s["winner"] = alive[0] if alive else None
                            s["last_action"] += f" · 🏆 {s['names'].get(s['winner'],'?')} последний выживший!"
                        elif s["no_progress"] >= max(2, len(alive)):
                            _uno_round_end(room, min(alive, key=lambda p: len(s["hands"][p])))
                        else:
                            un.advance(s, 1)
                        await push_uno(room)
                    else:
                        drawn = un.draw_from(s, 1)
                        if drawn:
                            s["no_progress"] = 0
                            s["hands"][pid] += drawn
                            d = drawn[0]
                            un.check_mercy(s, pid)
                            if un.can_play(d, s["discard"][-1], s["cur_color"], 0, s.get("mode", "classic")):
                                s["last_action"] = f"{room['players'][pid]['name']} взял карту (можно сыграть)"
                            else:
                                s["last_action"] = f"{room['players'][pid]['name']} взял карту"
                                un.advance(s, 1)
                        else:
                            # колода физически пуста — дедлок-страховка: круг без прогресса → раунд по «меньше карт»
                            s["no_progress"] = s.get("no_progress", 0) + 1
                            un.advance(s, 1)
                            if s["no_progress"] >= max(2, len(un.alive_order(s))):
                                winner = min(un.alive_order(s), key=lambda p: len(s["hands"][p]))
                                _uno_round_end(room, winner)
                        await push_uno(room)
            elif act == "uno_pass" and room and room.get("game") == "uno" and room.get("uno"):
                s = room["uno"]
                if un.cur_player(s) == pid and not s.get("game_over") and not s.get("round_over"):
                    un.advance(s, 1)
                    s["last_action"] = f"{room['players'][pid]['name']} спасовал"
                    await push_uno(room)

            # ── Дурак ──
            elif act == "dk_attack" and room and room.get("game") == "durak" and room.get("dk"):
                s = room["dk"]; card = msg.get("card")
                hand = s["hands"].get(pid, [])
                in_hand = next((c for c in hand if c["r"] == card.get("r") and c["s"] == card.get("s")), None) if card else None
                ranks = dk.table_ranks(s)
                undef = sum(1 for p in s["table"] if not p.get("d"))
                deff_hand = len(s["hands"].get(s["defender"], []))
                can = in_hand and pid != s["defender"] and len(s["table"]) < 6 and undef < deff_hand
                if can and (not s["table"] and pid == s["attacker"] or s["table"] and in_hand["r"] in ranks):
                    hand.remove(in_hand)
                    s["table"].append({"a": in_hand, "d": None})
                    s["passed"] = set()
                    s["log"] = f"{room['players'][pid]['name']} подкинул {dk.card_str(in_hand)}"
                    await push_durak(room)
            elif act == "dk_defend" and room and room.get("game") == "durak" and room.get("dk"):
                s = room["dk"]
                if pid == s["defender"]:
                    idx = msg.get("idx"); card = msg.get("card")
                    hand = s["hands"].get(pid, [])
                    in_hand = next((c for c in hand if c["r"] == card.get("r") and c["s"] == card.get("s")), None) if card else None
                    if in_hand and 0 <= idx < len(s["table"]) and not s["table"][idx].get("d") \
                       and dk.beats(in_hand, s["table"][idx]["a"], s["trump"]):
                        hand.remove(in_hand)
                        s["table"][idx]["d"] = in_hand
                        s["log"] = f"{room['players'][pid]['name']} отбил {dk.card_str(in_hand)}"
                        durak_try_bito(room)   # авто-бито если подкидывать больше некому
                        await push_durak(room)
            elif act == "dk_take" and room and room.get("game") == "durak" and room.get("dk"):
                s = room["dk"]
                if pid == s["defender"]:
                    for pair in s["table"]:
                        s["hands"][pid].append(pair["a"])
                        if pair.get("d"): s["hands"][pid].append(pair["d"])
                    s["table"] = []
                    s["log"] = f"{room['players'][pid]['name']} забрал карты"
                    prev_def = s["defender"]
                    dk.refill(s)                                  # добор по бывшим ролям
                    na = dk.next_with_cards(s, prev_def)          # ход — следующему С КАРТАМИ (взявший пропускает)
                    if na:
                        s["attacker"] = na
                        s["defender"] = dk.next_with_cards(s, na) or na
                    s["passed"] = set()
                    durak_resolve_end(room)
                    await push_durak(room)
            elif act == "dk_done" and room and room.get("game") == "durak" and room.get("dk"):
                s = room["dk"]
                if pid != s["defender"] and dk.all_defended(s):
                    s["passed"].add(pid)
                    durak_try_bito(room)
                    await push_durak(room)

            # ── Элиас ──
            elif act == "set_alias_settings" and room and room["host"] == pid and room.get("game") == "alias":
                a = room.setdefault("al", {})
                s = a.setdefault("settings", {"lang": "ru", "diff": "easy", "time": 60, "target": 20, "mode": "solo"})
                for k in ("lang", "diff", "mode"):
                    if msg.get(k): s[k] = msg[k]
                for k in ("time", "target"):
                    if k in msg:
                        try: s[k] = max(5, int(msg[k]))
                        except Exception: pass
                await (broadcast(room, alias_public(room)) if room["state"] == "playing" else broadcast(room, lobby_state(room)))
            elif act == "alias_begin" and room and room.get("game") == "alias" and not room.get("al", {}).get("round_active"):
                if room["al"].get("explainer") == pid or room["host"] == pid:
                    await alias_begin_turn(room)
            elif act == "alias_correct" and room and room.get("game") == "alias" and room["al"].get("explainer") == pid:
                a = room["al"]
                key = a["turn"] if a.get("mode") == "teams" else a["explainer"]  # очко команде или игроку
                a["scores"][key] = a["scores"].get(key, 0) + 1
                if a["scores"][key] >= a["settings"].get("target", 20):
                    a["winner"] = key; a["round_active"] = False
                    await broadcast(room, alias_public(room))
                else:
                    next_word(room); await send_word(room); await broadcast(room, alias_public(room))
            elif act == "alias_skip" and room and room.get("game") == "alias" and room["al"].get("explainer") == pid:
                next_word(room); await send_word(room)
            elif act == "alias_end" and room and room.get("game") == "alias":
                if room["al"].get("explainer") == pid or room["host"] == pid:
                    await alias_end_turn(room)

            # ── Мафия: ночное действие (мафия/доктор/шериф выбирают цель) ──
            elif act == "mafia_night" and room and room.get("game") == "mafia" and room.get("mafia"):
                st = room["mafia"]
                target = msg.get("target")
                ok, res = mf.submit_night(st, pid, target)
                if not ok:
                    await websocket.send_json({"type": "error", "msg": res})
                else:
                    # шерифу сразу вернём результат проверки, остальным — обновим панель
                    await mafia_send_private(room)
                    await mafia_bots_night(room)      # добьём ботов и, если все сходили, разрешим ночь
                    await mafia_after_night_maybe(room)

            # ── Мафия: дневной голос ──
            elif act == "mafia_vote" and room and room.get("game") == "mafia" and room.get("mafia"):
                st = room["mafia"]
                ok, res = mf.submit_vote(st, pid, msg.get("target"))
                if not ok:
                    await websocket.send_json({"type": "error", "msg": res})
                else:
                    await mafia_bots_day(room)
                    if not mf.day_vote_pending(st):
                        d = mf.resolve_day(st)
                        if d["executed"]:
                            nm = room["players"][d["executed"]]["name"]
                            rl = mf.ROLE_META[d["role"]]["title"]
                            st["log"].append(f"⚖️ Город казнил: {nm} — это был {rl}.")
                        else:
                            st["log"].append("🤝 Голоса разделились — никого не казнили.")
                        if st["winner"]:
                            st["log"].append(_mafia_win_line(st))
                        else:
                            st["log"].append(f"🌙 Наступает ночь {st['round']}. Город засыпает.")
                        await mafia_broadcast(room)
                        if not st["winner"]:
                            await mafia_bots_night(room)
                            await mafia_after_night_maybe(room)
                    else:
                        await mafia_broadcast(room)

            # ── Мафия: хост форсит конец дня (если кто-то тупит) ──
            elif act == "mafia_force_day" and room and room["host"] == pid and room.get("game") == "mafia" and room.get("mafia"):
                st = room["mafia"]
                if st["phase"] == "day":
                    d = mf.resolve_day(st)
                    if d["executed"]:
                        nm = room["players"][d["executed"]]["name"]
                        rl = mf.ROLE_META[d["role"]]["title"]
                        st["log"].append(f"⚖️ Город казнил: {nm} — это был {rl}.")
                    else:
                        st["log"].append("🤝 Голоса разделились — никого не казнили.")
                    if st["winner"]:
                        st["log"].append(_mafia_win_line(st))
                    else:
                        st["log"].append(f"🌙 Наступает ночь {st['round']}. Город засыпает.")
                    await mafia_broadcast(room)
                    if not st["winner"]:
                        await mafia_bots_night(room)
                        await mafia_after_night_maybe(room)

            # ── Бункер: игрок вскрывает свою ячейку (видно всем) ──
            elif act == "reveal_cell" and room and room.get("game") == "bunker":
                cat = msg.get("category", "")
                p = room["players"].get(pid)
                lim = room.get("settings", {}).get("reveals_per_round", 0)
                if p and cat in bnk.CATEGORIES and cat not in (p.get("revealed") or set()):
                    if lim and p.get("reveals_round", 0) >= lim:
                        await websocket.send_json({"type": "error", "msg": f"Лимит вскрытий за раунд: {lim}. Ждите новый раунд."})
                    else:
                        p.setdefault("revealed", set()).add(cat)
                        p["reveals_round"] = p.get("reveals_round", 0) + 1
                        await push_bunker(room)

            # ── Бункер: настройки (хост, в лобби) ──
            elif act == "set_settings" and room and room["host"] == pid and room.get("game") == "bunker":
                s = room.setdefault("settings", {})
                for k in ("seats", "timer", "reveals_per_round"):
                    if k in msg:
                        try: s[k] = max(0, int(msg[k]))
                        except Exception: pass
                await push_bunker(room) if room["state"] == "playing" else await broadcast(room, lobby_state(room))

            # ── Бункер: ГОЛОСОВАНИЕ за изгнание ──
            elif act == "start_vote" and room and room["host"] == pid and room.get("game") == "bunker":
                room["vote"] = {"votes": {}}
                await broadcast(room, {"type": "vote_started"})
                await push_bunker(room)
            elif act == "vote" and room and room.get("game") == "bunker" and room.get("vote") is not None:
                p = room["players"].get(pid)
                tgt = msg.get("target")
                if p and p.get("alive", True) and tgt in room["players"]:
                    room["vote"]["votes"][pid] = tgt
                    alive = [x for x, pp in room["players"].items() if pp.get("alive", True)]
                    await push_bunker(room)
                    if len(room["vote"]["votes"]) >= len(alive):  # все проголосовали → авто-итог
                        kicked, txt = resolve_vote(room)
                        await broadcast(room, {"type": "vote_result", "msg": txt, "kicked": kicked})
                        await push_bunker(room)
            elif act == "end_vote" and room and room["host"] == pid and room.get("game") == "bunker":
                kicked, txt = resolve_vote(room)
                await broadcast(room, {"type": "vote_result", "msg": txt, "kicked": kicked})
                await push_bunker(room)

            # ── Бункер: таймер раунда (хост) ──
            elif act == "start_timer" and room and room["host"] == pid and room.get("game") == "bunker":
                secs = room.get("settings", {}).get("timer", 0) or int(msg.get("secs", 60))
                if secs > 0:
                    await broadcast(room, {"type": "timer", "secs": secs})

            # ── Бункер: пульт ведущего (ручное изгнание остаётся как опция) ──
            elif act == "kick" and room and room["host"] == pid and room.get("game") == "bunker":
                tgt = room["players"].get(msg.get("target"))
                if tgt:
                    tgt["alive"] = False
                    await push_bunker(room)
            elif act == "unkick" and room and room["host"] == pid and room.get("game") == "bunker":
                tgt = room["players"].get(msg.get("target"))
                if tgt:
                    tgt["alive"] = True
                    await push_bunker(room)
            elif act == "new_round" and room and room["host"] == pid and room.get("game") == "bunker":
                room.setdefault("gs", {})["round"] = room.get("gs", {}).get("round", 1) + 1
                for p in room["players"].values():
                    p["reveals_round"] = 0   # сброс лимита вскрытий
                room["vote"] = None
                await push_bunker(room)

            # --- Варианты (Аукцион лжи) ---
            elif act == "variants_set_cats" and room and room["host"] == pid and room.get("game") == "variants":
                gs = room.setdefault("state_data", {})
                gs["categories"] = d.get("categories", [])
                gs["total_rounds"] = d.get("total_rounds", 5)
                await broadcast(room, vr.variants_public(room))
            elif act == "variants_submit" and room and room.get("game") == "variants":
                bluff = d.get("bluff", "").strip()
                if bluff and room["players_data"].get(pid):
                    room["players_data"][pid]["bluff"] = bluff
                    if vr.check_input_phase_complete(room):
                        await push_variants(room)
                    else:
                        await push_variants(room)
            elif act == "variants_vote" and room and room.get("game") == "variants":
                vote_id = d.get("vote_id")
                if vote_id and room["players_data"].get(pid):
                    room["players_data"][pid]["vote"] = vote_id
                    if vr.check_voting_phase_complete(room):
                        await push_variants(room)
                    else:
                        await push_variants(room)
            elif act == "variants_next" and room and room["host"] == pid and room.get("game") == "variants":
                gs = room.setdefault("state_data", {})
                gs["round"] = gs.get("round", 1) + 1
                if gs["round"] > gs.get("total_rounds", 5):
                    gs["phase"] = "game_over"
                    await push_variants(room)
                else:
                    vr.start_round(room)
                    await push_variants(room)


            elif act == "reveal" and room:
                # показать всем: кто был шпион + что загадано (любой игрок может вскрыть)
                spy_name = next((p["name"] for p in room["players"].values()
                                 if p.get("role") and p["role"].get("spy")), "?")
                loc = next((p["role"]["location"] for p in room["players"].values()
                            if p.get("role") and not p["role"].get("spy") and p["role"].get("location")), "?")
                await broadcast(room, {"type": "reveal", "spy": spy_name, "location": loc})
                room["state"] = "lobby"

            elif act == "back" and room:
                room["state"] = "lobby"
                for p in room["players"].values():
                    p["role"] = None
                await broadcast(room, lobby_state(room))

            elif act == "spy_packs" and room:
                await broadcast(room, spy_packs_payload(room))

            elif act == "spy_toggle" and room and room["host"] == pid:
                spy_init(room)
                name = msg.get("name")
                if name and (name in SPY_PACKS or name in CRAFTED):
                    if name in room["spy_active"]:
                        room["spy_active"].remove(name)
                    else:
                        room["spy_active"].append(name)
                await broadcast(room, spy_packs_payload(room))

            elif act == "spy_craft" and room and room["host"] == pid:
                spy_init(room)
                theme = str(msg.get("theme", "")).strip()[:50]
                if theme and theme not in CRAFTED and theme not in SPY_PACKS:
                    await broadcast(room, {"type": "spy_loading", "theme": theme})
                    items = await asyncio.get_event_loop().run_in_executor(None, gemini_people, theme, 15)
                    if items:
                        CRAFTED[theme] = items
                        _save_crafted()
                    else:
                        await broadcast(room, {"type": "error", "msg": "Не вышло сгенерить пак, попробуй другую тему."})
                if (theme in CRAFTED or theme in SPY_PACKS) and theme not in room["spy_active"]:
                    room["spy_active"].append(theme)   # свежий пак сразу активен
                await broadcast(room, spy_packs_payload(room))

            elif act == "spy_uncraft" and room and room["host"] == pid:
                spy_init(room)
                name = msg.get("name")
                if name in CRAFTED:
                    del CRAFTED[name]
                    _save_crafted()
                if name in room["spy_active"]:
                    room["spy_active"].remove(name)
                await broadcast(room, spy_packs_payload(room))

            # авто-ход бота после ЛЮБОГО действия игрока (Дурак/UNO и др. — где боты играют)
            if room and room.get("state") == "playing" and any(d.get("bot") for d in room.get("players", {}).values()):
                await bot_turn(room)

    except WebSocketDisconnect:
        pass
    except Exception:
        logging.exception("ws loop crashed")
    finally:
        _presence_remove(auth_user["username"])  # снять онлайн-статус
        if room and pid in room["players"]:
            playing = room.get("state") == "playing"
            if playing:
                # Игра идёт — НЕ выкидываем игрока из состояния (иначе рвутся индексы/ходы
                # и всех выбрасывает в лобби). Помечаем offline; может переподключиться.
                room["players"][pid]["ws"] = None
                # если у всех оборвана связь — комнату можно убрать, иначе игра продолжается
                if all(not pl.get("ws") for pl in room["players"].values()):
                    rooms.pop(room["code"], None)
                else:
                    if room["host"] == pid:
                        room["host"] = next((q for q, pl in room["players"].items() if pl.get("ws")), pid)
                    # обновим доску оставшимся, БЕЗ переброса в лобби
                    try:
                        await resync_game(room)
                    except Exception:
                        pass
            else:
                # В лобби — обычное удаление
                room["players"].pop(pid, None)
                if not room["players"]:
                    rooms.pop(room["code"], None)
                else:
                    if room["host"] == pid:
                        room["host"] = next(iter(room["players"]))
                    try:
                        await broadcast(room, lobby_state(room))
                    except Exception:
                        pass


app.mount("/static", StaticFiles(directory="/app/static"), name="static")


@app.get("/geobunker")
async def geobunker_page():
    return FileResponse("/app/static/geobunker.html")

@app.get("/geoguessr")
async def geoguessr_page():
    return RedirectResponse("/games/geobunker")


# Jarvis Learn — интерактивный тренажер
try:
    import learn
    app.include_router(learn.router)
except Exception as e:
    logging.exception(f"Failed to load learn module: {e}")
