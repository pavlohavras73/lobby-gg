"""QA-обход всех страниц как iPhone: ошибки JS, ошибки в консоли, упавшие запросы (4xx/5xx), затем «Старт»
и немного игры (стрелки/тапы/клики по полю), снова ошибки, скриншоты в SHOTS (по умолчанию ./qa_shots).

  LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_qa.py [страницы...]
  LOBBY_LANG=de — язык интерфейса (по умолчанию de). Без аргументов — все страницы.
Код выхода 1, если на какой-то странице есть ошибки.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

ALL = ("index profile leaderboard learn alias arrows battleship bulls bunker c4 c4_3d checkers chess dots durak "
       "fifteen g2048 geobunker guesswho mafia mines poker quoridor race reversi snake space_invaders spy tetris uno "
       "variants wordle").split()
LANG = os.environ.get("LOBBY_LANG", "de")
SHOTS = os.environ.get("SHOTS", "qa_shots")
START = re.compile(r"^\s*(▶\s*)?(Start|Spielen|Spiel starten|Neues Spiel|Los|Solo|Gegen Bot|Bot|Spiel erstellen)\b", re.I)
IGNORE = re.compile(r"favicon|ResizeObserver loop|Failed to load resource: net::ERR_ABORTED|serviceWorker|sw\.js", re.I)


def run_page(b, token, name):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
    pg = ctx.new_page()
    probs = []
    pg.on("pageerror", lambda e: probs.append(f"JS: {str(e)[:160]}"))
    pg.on("console", lambda m: m.type == "error" and not IGNORE.search(m.text) and probs.append(f"console: {m.text[:160]}"))
    pg.on("response", lambda r: r.status >= 400 and BASE.split("/games")[0] in r.url and not IGNORE.search(r.url)
          and probs.append(f"HTTP {r.status}: {r.url.split('/games')[-1][:80]}"))
    try:
        pg.goto(BASE + "/" + ("" if name == "index" else name), wait_until="networkidle", timeout=30000)
    except Exception as e:
        probs.append(f"загрузка: {str(e)[:120]}")
    pg.wait_for_timeout(1000)
    pg.screenshot(path=f"{SHOTS}/{name}_1.png")
    started = False
    btn = pg.locator("button:visible, a.btn:visible, .btn:visible").filter(has_text=START).first
    if btn.count():
        try:
            btn.click(timeout=3000); started = True; pg.wait_for_timeout(1500)
        except Exception as e:
            probs.append(f"клик Старт: {str(e)[:100]}")
    if started:
        canvas = pg.locator("canvas:visible").first
        for key in ("ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "Space"):
            pg.keyboard.press(key); pg.wait_for_timeout(150)
        box = (canvas.bounding_box() if canvas.count() else None) or {"x": 40, "y": 250, "width": 300, "height": 300}
        for fx, fy in ((.5, .5), (.2, .3), (.8, .7), (.5, .9)):
            try:
                pg.touchscreen.tap(box["x"] + box["width"] * fx, box["y"] + box["height"] * fy)
            except Exception:
                pass
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f"{SHOTS}/{name}_2.png")
    ctx.close()
    return started, list(dict.fromkeys(probs))


def main(pages):
    os.makedirs(SHOTS, exist_ok=True)
    token = register()
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        for name in pages:
            started, probs = run_page(b, token, name)
            mark = "❌" if probs else "✅"
            bad += bool(probs)
            print(f"{mark} {name:15} {'(игра запущена)' if started else '(без старта)'}", flush=True)
            for x in probs[:6]:
                print("     ·", x)
    print(f"\nИтого: {len(pages) - bad}/{len(pages)} без ошибок")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or ALL))
