"""Мультиплеер в браузере: хост + гости (разные аккаунты, iPhone-эмуляция). Хост создаёт комнату, гости входят
по коду, хост добавляет ботов (если есть кнопка) и стартует. Ловим ошибки JS/консоли/HTTP у всех, снимаем экраны.

  LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_multi.py [игры...]
  GUESTS=2 (сколько гостей), LOBBY_LANG=de, SHOTS=./multi_shots
Без аргументов — все комнатные игры. Код выхода 1, если где-то ошибки или не удалось дойти до старта.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

GAMES = "mafia bunker uno poker durak spy alias guesswho quoridor variants c4_3d".split()
LANG = os.environ.get("LOBBY_LANG", "de")
GUESTS = int(os.environ.get("GUESTS", "2"))
SHOTS = os.environ.get("SHOTS", "multi_shots")
CREATE = re.compile(r"(Raum|Tisch|Spiel|Bunker)\s*erstellen|^\s*Erstellen", re.I)
JOIN = re.compile(r"beitreten", re.I)
ADD_BOT = re.compile(r"Bot", re.I)
START = re.compile(r"(Spiel\s*)?starten|Austeilen|Karten (aus)?teilen|Start", re.I)
IGNORE = re.compile(r"favicon|ResizeObserver|ERR_ABORTED|serviceWorker|sw\.js", re.I)
CODE_RE = re.compile(r"\b[A-Z0-9]{4}\b")


def page_for(b, token, probs, who):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: probs.append(f"{who} JS: {str(e)[:150]}"))
    pg.on("console", lambda m: m.type == "error" and not IGNORE.search(m.text) and probs.append(f"{who} console: {m.text[:150]}"))
    pg.on("response", lambda r: r.status >= 400 and not IGNORE.search(r.url) and probs.append(f"{who} HTTP {r.status} {r.url.split('/games')[-1][:60]}"))
    return ctx, pg


def click(pg, rx, timeout=3000):
    btn = pg.locator("button:visible").filter(has_text=rx).first
    if not btn.count():
        return False
    btn.click(timeout=timeout)
    return True


def fill_name(pg, name):
    inp = pg.locator("input:visible:not([type=range]):not([type=hidden]):not([type=checkbox])").first
    if inp.count():
        inp.fill(name)


def room_code(pg):
    digits = pg.locator(".pin-digit:visible")
    if digits.count() >= 4:   # дизайн-система v2: код показан ячейками
        code = "".join(digits.nth(i).inner_text().strip() for i in range(digits.count()))
        if CODE_RE.fullmatch(code):
            return code
    for sel in ("#roomcode", "#roomCode", "#code", ".code", ".room-code", "#lcode", "#rcode"):
        el = pg.locator(sel + ":visible").first
        if el.count():
            m = CODE_RE.search(el.inner_text())
            if m:
                return m.group(0)
    m = CODE_RE.findall(pg.evaluate("document.body.innerText"))
    m = [x for x in m if not x.isdigit() and x not in ("CODE", "UKR", "DEU", "ENG")]
    return m[0] if m else None


def run_game(b, tokens, game):
    probs, ctxs, steps = [], [], []
    host_ctx, host = page_for(b, tokens[0], probs, "host")
    ctxs.append(host_ctx)
    host.goto(f"{BASE}/{game}", wait_until="networkidle")
    fill_name(host, "Host")
    if not click(host, CREATE):
        steps.append("нет кнопки «erstellen»")
    host.wait_for_timeout(1500)
    code = room_code(host)
    steps.append(f"код {code or '—'}")
    for i in range(GUESTS):
        ctx, g = page_for(b, tokens[1 + i], probs, f"guest{i + 1}")
        ctxs.append(ctx)
        g.goto(f"{BASE}/{game}" + (f"?join={code}" if code else ""), wait_until="networkidle")
        fill_name(g, f"Gast{i + 1}")
        code_inp = g.locator("input:visible:not([type=range]):not([type=hidden]):not([type=checkbox])").nth(1)
        pins = g.locator(".pin-box:visible")
        if code and pins.count() >= 4:   # ввод кода по ячейкам: печатаем как человек
            pins.first.click(); g.keyboard.type(code, delay=60)
        elif code and code_inp.count():
            code_inp.fill(code)
        if not click(g, JOIN):
            steps.append(f"guest{i + 1}: нет «beitreten»")
        g.wait_for_timeout(1200)
    for _ in range(2):
        try:
            click(host, ADD_BOT, 1500); host.wait_for_timeout(500)
        except Exception:
            pass
    try:
        started = click(host, START, 3000)
    except Exception as e:
        started = False; steps.append(f"старт: {str(e)[:60]}")
    steps.append("старт ✓" if started else "нет кнопки старта")
    host.wait_for_timeout(3000)
    for k, c in enumerate(ctxs):
        c.pages[0].screenshot(path=f"{SHOTS}/{game}_{'host' if k == 0 else 'guest%d' % k}.png")
    for c in ctxs:
        c.close()
    return started, steps, list(dict.fromkeys(probs))


def main(games):
    os.makedirs(SHOTS, exist_ok=True)
    tokens = [register() for _ in range(GUESTS + 1)]
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        for game in games:
            try:
                started, steps, probs = run_game(b, tokens, game)
            except Exception as e:
                started, steps, probs = False, [f"сбой теста: {str(e)[:120]}"], []
            ok = started and not probs
            bad += not ok
            print(f"{'✅' if ok else '❌'} {game:10} {' · '.join(steps)}", flush=True)
            for x in probs[:6]:
                print("     ·", x)
    print(f"\nИтого: {len(games) - bad}/{len(games)}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or GAMES))
