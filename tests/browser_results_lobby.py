"""Окно итогов: «В лобби» и «Реванш/Ещё раз» не должны оставлять игрока на замершем экране.
Проверяются одиночные игры (Раскол, Гонки, Shuttle) и мультиплеерные (Шашки, Реверси).
Запуск:
  LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_results_lobby.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

RUN = {"win": True, "room": 10, "kills": 42, "shards": 7, "score": 1234, "time": 321, "lvl": 9}


def test_raskol(b, token):
    fails = 0
    for button in ("lobbyResultsLobbyBtn", "lobbyResultsRematchBtn"):
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script("localStorage.setItem('jg_rules_seen_raskol','1')")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/raskol", wait_until="networkidle")
        pg.wait_for_timeout(600)
        pg.evaluate("() => { try { startRun(); } catch (e) {} }")
        pg.wait_for_timeout(500)
        pg.evaluate("r => endRun(r)", RUN)
        pg.wait_for_timeout(500)
        pg.click("#" + button)
        pg.wait_for_timeout(700)
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
        print(("✅" if ok else "❌"), "raskol", button, st, errs[:2], flush=True)
        ctx.close()
    return fails


def test_race(b, token):
    fails = 0
    for button in ("lobbyResultsLobbyBtn", "lobbyResultsRematchBtn"):
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script("localStorage.setItem('jg_rules_seen_race','1')")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/race", wait_until="networkidle")
        pg.wait_for_timeout(600)
        pg.evaluate("() => engine.opts.onCrash({ distance: 100, coins: 5, maxSpeed: 120 })")
        pg.wait_for_timeout(500)
        pg.click("#" + button)
        pg.wait_for_timeout(700)
        if button == "lobbyResultsLobbyBtn":
            ok = ("/games" in pg.url) and not errs
            info = {"url": pg.url}
        else:
            st = pg.evaluate("""() => ({
                running: engine.running,
                resOpen: !!document.querySelector('#lobbyResultsModal.open')
            })""")
            ok = st["running"] and (not st["resOpen"]) and not errs
            info = st
        fails += not ok
        print(("✅" if ok else "❌"), "race", button, info, errs[:2], flush=True)
        ctx.close()
    return fails


def test_shuttle(b, token):
    fails = 0
    for button in ("lobbyResultsLobbyBtn", "lobbyResultsRematchBtn"):
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script("localStorage.setItem('jg_rules_seen_space_invaders','1')")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(BASE + "/space_invaders", wait_until="networkidle")
        pg.wait_for_timeout(600)
        pg.evaluate("() => { launchGame(1, 1, false); engine.cb.onGameOver({ score: 100, dust: 5, galaxy: 1, sector: 1 }); }")
        pg.wait_for_timeout(500)
        pg.click("#" + button)
        pg.wait_for_timeout(700)
        st = pg.evaluate("""() => ({
            inGame: document.getElementById('playHud').classList.contains('active'),
            inMenu: document.getElementById('menuScreen').classList.contains('active'),
            resOpen: !!document.querySelector('#lobbyResultsModal.open'),
            endOpen: document.getElementById('endModal').classList.contains('open')
        })""")
        if button == "lobbyResultsLobbyBtn":
            ok = st["inMenu"] and (not st["inGame"]) and (not st["resOpen"]) and (not st["endOpen"]) and not errs
        else:
            ok = st["inGame"] and (not st["inMenu"]) and (not st["resOpen"]) and (not st["endOpen"]) and not errs
        fails += not ok
        print(("✅" if ok else "❌"), "shuttle", button, st, errs[:2], flush=True)
        ctx.close()
    return fails


def test_multi_game(b, token, game):
    fails = 0
    for button in ("lobbyResultsLobbyBtn", "lobbyResultsRematchBtn"):
        ctx = b.new_context(viewport={"width": 1280, "height": 800})
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script(f"localStorage.setItem('jg_rules_seen_{game}','1')")
        ctx.add_init_script("localStorage.setItem('jg_lang','ru')")
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(f"{BASE}/{game}", wait_until="networkidle")
        pg.fill("input:visible", "Host")
        pg.click("button:has-text('Создать')")
        pg.wait_for_timeout(700)
        pg.click("button[onclick*='add_bot']")
        pg.wait_for_timeout(1000)
        pg.evaluate("() => { st.done = true; st.winner = window.pid; handle(st); }")
        pg.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        pg.click("#" + button)
        pg.wait_for_timeout(700)
        if button == "lobbyResultsLobbyBtn":
            ok = ("/games" in pg.url) and not errs
            info = {"url": pg.url}
        else:
            res_open = pg.is_visible("#lobbyResultsModal.open")
            ok = (not res_open) and not errs
            info = {"resOpen": res_open}
        fails += not ok
        print(("✅" if ok else "❌"), game, button, info, errs[:2], flush=True)
        ctx.close()
    return fails


def main():
    token = register()
    total_fails = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        total_fails += test_raskol(b, token)
        total_fails += test_race(b, token)
        total_fails += test_shuttle(b, token)
        total_fails += test_multi_game(b, token, "checkers")
        total_fails += test_multi_game(b, token, "reversi")
        b.close()
    print("ИТОГ browser_results_lobby:", "OK" if not total_fails else f"ошибок {total_fails}")
    return 1 if total_fails else 0


if __name__ == "__main__":
    sys.exit(main())
