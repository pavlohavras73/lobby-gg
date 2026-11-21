"""Окно итогов в одиночных играх: «В лобби» и «Ещё раз» не должны оставлять игрока на замершем экране.
Раскол: «В лобби» → меню классов видно, забег остановлен. Без ошибок JS.
Запуск: LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_results_lobby.py"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

RUN = {"win": True, "room": 10, "kills": 42, "shards": 7, "score": 1234, "time": 321, "lvl": 9}
token = register(); fails = 0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
    for button in ("lobbyResultsLobbyBtn", "lobbyResultsRematchBtn"):
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script("localStorage.setItem('jg_rules_seen_raskol','1')")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/raskol", wait_until="networkidle"); pg.wait_for_timeout(600)
        pg.evaluate("() => { try { startRun(); } catch (e) {} }"); pg.wait_for_timeout(500)
        pg.evaluate("r => endRun(r)", RUN); pg.wait_for_timeout(500)
        pg.click("#" + button); pg.wait_for_timeout(700)
        st = pg.evaluate("""() => ({
            inRun: document.body.classList.contains('in-run'),
            results: !!document.querySelector('.lobby-results-overlay.open, .lobby-results-overlay.on'),
            resModal: document.getElementById('resModal').classList.contains('on'),
            engine: (window.engine && engine.state) || null })""")
        if button == "lobbyResultsLobbyBtn":
            ok = (not st["inRun"]) and (not st["results"]) and (not st["resModal"]) and not errs
        else:
            ok = st["inRun"] and (not st["results"]) and (not st["resModal"]) and not errs
        fails += not ok
        print(("✅" if ok else "❌"), "raskol", button, st, errs[:2])
        ctx.close()
print("ИТОГ browser_results_lobby:", "OK" if not fails else f"ошибок {fails}")
sys.exit(1 if fails else 0)
