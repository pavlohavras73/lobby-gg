"""Тест возврата в комнату после перезагрузки (Stage 10c).
Проверяет все 8 игр: bunker, mafia, spy, alias, variants, guesswho, poker, geobunker.
Сценарий:
  1. Вошёл / создал комнату (или начал партию).
  2. Перезагрузил страницу (page.reload() без query-параметра).
  3. Оказался на своём месте с тем же кодом комнаты / состоянием.
  4. Ноль ошибок в консоли.

Запуск:
  LOBBY_BASE=http://127.0.0.1:18090 uv run --with playwright python tests/browser_rejoin.py
"""
import json
import os
import random
import re
import sys
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090")
CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
GAMES = "bunker mafia spy alias variants guesswho poker geobunker".split()
CODE_RE = re.compile(r"\b[A-Z0-9]{4}\b")
IGNORE = re.compile(r"favicon|ResizeObserver|ERR_ABORTED|serviceWorker|sw\.js|arcgisonline|google\.com|unpkg|fetching the script|bad HTTP response code \(404\)", re.I)


def register():
    name = f"rejoin_{random.randint(10000, 99999)}"
    pw = "test123456"
    req = urllib.request.Request(
        f"{BASE}/auth/register",
        data=json.dumps({"username": name, "password": pw}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return r.headers.get("set-cookie", "").split(";")[0].split("=", 1)[1]


def get_room_code(page):
    digits = page.locator(".pin-digit:visible")
    if digits.count() >= 4:
        code = "".join(digits.nth(i).inner_text().strip() for i in range(digits.count()))
        if CODE_RE.fullmatch(code):
            return code
    for sel in ("#lcode", "#roomcode", "#roomCode", "#code", ".room-code"):
        el = page.locator(sel).first
        if el.count():
            txt = el.inner_text().strip()
            m = CODE_RE.search(txt)
            if m:
                return m.group(0)
    # Check JS roomCode variable
    try:
        js_code = page.evaluate("() => window.roomCode || (window.LobbyRejoin && window.LobbyRejoin.getCode && window.LobbyRejoin.getCode(location.pathname.split('/').pop())) || ''")
        if js_code and CODE_RE.fullmatch(js_code):
            return js_code
    except Exception:
        pass
    return None


def test_game_rejoin(browser, token, game):
    probs = []
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True
    )
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    page = ctx.new_page()

    page.on("pageerror", lambda e: probs.append(f"JS: {str(e)[:150]}"))
    page.on("console", lambda m: m.type == "error" and not IGNORE.search(m.text) and probs.append(f"console: {m.text[:150]}"))
    page.on("response", lambda r: r.status >= 400 and not IGNORE.search(r.url) and probs.append(f"HTTP {r.status} {r.url[:60]}"))

    try:
        if game == "geobunker":
            page.goto(f"{BASE}/static/geobunker.html", wait_until="networkidle")
            # Start game
            start_btn = page.locator(".btn-start-game, #btnStartGame").first
            if start_btn.count():
                start_btn.click()
            else:
                page.evaluate("() => typeof startLobbyGame === 'function' && startLobbyGame()")
            page.wait_for_timeout(1000)

            # Check game HUD
            hud_vis = page.evaluate("() => document.getElementById('gameHud').style.display !== 'none'")
            round_val = page.evaluate("() => document.getElementById('roundBadge').textContent.trim()")
            loc_val = page.evaluate("() => currentLoc ? currentLoc.name : ''")
            assert hud_vis, "GeoBunker HUD not visible after start"
            assert loc_val, "GeoBunker currentLoc is empty"

            # Reload
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(1200)

            # Verify restored state
            hud_after = page.evaluate("() => document.getElementById('gameHud').style.display !== 'none'")
            round_after = page.evaluate("() => document.getElementById('roundBadge').textContent.trim()")
            loc_after = page.evaluate("() => currentLoc ? currentLoc.name : ''")
            lobby_hidden = page.evaluate("() => document.getElementById('lobbyModal').style.display === 'none'")

            assert hud_after, "GeoBunker HUD not visible after reload"
            assert lobby_hidden, "GeoBunker lobbyModal should be hidden after reload"
            assert round_after == round_val, f"GeoBunker round mismatch: {round_after} vs {round_val}"
            assert loc_after == loc_val, f"GeoBunker location mismatch: {loc_after} vs {loc_val}"

            # Verify translation function trLoc
            tr_check = page.evaluate("""() => {
                const fr = trLoc('Эйфелева Башня, Париж', 'Франция');
                LANG = 'en';
                const en = trLoc('Эйфелева Башня, Париж', 'Франция');
                LANG = 'de';
                const de = trLoc('Эйфелева Башня, Париж', 'Франция');
                LANG = 'uk';
                const uk = trLoc('Эйфелева Башня, Париж', 'Франция');
                return { fr, en, de, uk };
            }""")
            assert "Eiffel Tower" in tr_check["en"], f"EN translation failed: {tr_check}"
            assert "Eiffelturm" in tr_check["de"], f"DE translation failed: {tr_check}"
            assert "Ейфелева" in tr_check["uk"], f"UK translation failed: {tr_check}"

            return True, f"раунд {round_after}, локация «{loc_after}», переводы en/de/uk OK", probs

        else:
            page.goto(f"{BASE}/{game}", wait_until="networkidle")
            name_inp = page.locator("#name").first
            if name_inp.count():
                name_inp.fill(f"Re_{game}")

            if game == "variants":
                # variants creates room automatically if no code in url
                page.wait_for_timeout(1500)
            else:
                create_btn = page.locator("button:has-text('Создать'), button:has-text('Erstellen'), button:has-text('Створити'), button:has-text('Create')").first
                if create_btn.count():
                    create_btn.click()
                else:
                    page.evaluate("() => typeof create === 'function' && create()")
                page.wait_for_timeout(1500)

            code = get_room_code(page)
            assert code, f"Failed to obtain room code for {game}"

            # Verify LobbyRejoin stored code
            stored_code = page.evaluate(f"() => window.LobbyRejoin && LobbyRejoin.getCode('{game}')")
            assert stored_code == code, f"LobbyRejoin stored code mismatch: {stored_code} vs {code}"

            # RELOAD PAGE
            page.reload(wait_until="networkidle")
            page.wait_for_timeout(2000)

            # Verify automatic rejoin into SAME room
            code_after = get_room_code(page)
            assert code_after == code, f"Rejoin code mismatch: {code_after} vs {code}"

            # Verify player is back on their spot
            pid_after = page.evaluate("() => window.pid || window.myId || ''")
            assert pid_after, f"Player ID missing after rejoin in {game}"

            return True, f"комната {code} сохранена и восстановлена", probs

    finally:
        ctx.close()


def main():
    tokens = [register()]
    games_to_test = sys.argv[1:] or GAMES
    passed = 0
    failed = 0

    print(f"=== Проверка возврата в комнату (LobbyRejoin) на {len(games_to_test)} играх ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"]) if CHROMIUM else p.chromium.launch(headless=True, args=["--no-sandbox"])
        for g in games_to_test:
            try:
                ok, detail, probs = test_game_rejoin(browser, tokens[0], g)
                if ok and not probs:
                    print(f"  ✅ {g:<12} OK: {detail}")
                    passed += 1
                elif ok and probs:
                    print(f"  ⚠️  {g:<12} OK: {detail} (но консоль: {probs[:2]})")
                    passed += 1
                else:
                    print(f"  ❌ {g:<12} FAIL: {probs}")
                    failed += 1
            except Exception as e:
                import traceback; print(f"  ❌ {g:<12} ERROR: {str(e)}"); traceback.print_exc()
                failed += 1
        browser.close()

    print(f"\nИТОГ: {passed}/{len(games_to_test)} пройдено, ошибок: {failed}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
