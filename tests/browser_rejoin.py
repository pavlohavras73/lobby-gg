"""Тест возврата в комнату посреди партии (Stage 11a / Stage 10c).
Проверяет возврат:
  - Мультиплеер (хост + 2 гостя): старт партии, перезагрузка гостя посреди игры.
    Гость возвращается в игру, а не на стартовый экран (без кнопки создания/входа),
    и у хоста не удваивается ник.
    (bunker, mafia, spy, alias, variants, guesswho, poker)
  - Одиночная/стейк (geobunker): старт, раунд, локация, перезагрузка, сверка HUD и переводов.

Запуск:
  LOBBY_BASE=http://127.0.0.1:18090 uv run --with playwright python tests/browser_rejoin.py [игры...]
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
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "qa_shots", "stage11")

CREATE_RE = re.compile(r"(Raum|Tisch|Spiel|Bunker)\s*erstellen|^\s*Erstellen|Создать|Створити|Create", re.I)
JOIN_RE = re.compile(r"beitreten|Войти|Увійти|Join", re.I)
ADD_BOT_RE = re.compile(r"Bot|бот", re.I)
START_RE = re.compile(r"(Spiel\s*)?starten|Austeilen|Karten (aus)?teilen|Start|Начать|Раздать|Запустить", re.I)


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


def page_for(b, token, probs, who):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: probs.append(f"{who} JS: {str(e)[:150]}"))
    pg.on("console", lambda m: m.type == "error" and not IGNORE.search(m.text) and probs.append(f"{who} console: {m.text[:150]}"))
    pg.on("response", lambda r: r.status >= 400 and not IGNORE.search(r.url) and probs.append(f"{who} HTTP {r.status} {r.url.split('/games')[-1][:60]}"))
    return ctx, pg


def fill_name(pg, name):
    inp = pg.locator("input:visible:not([type=range]):not([type=hidden]):not([type=checkbox])").first
    if inp.count():
        inp.fill(name)


def click_btn(pg, rx, timeout=3000):
    btn = pg.locator("button:visible").filter(has_text=rx).first
    if not btn.count():
        return False
    try:
        btn.click(timeout=timeout)
        return True
    except Exception:
        return False


def get_room_code(page):
    digits = page.locator(".pin-digit:visible")
    if digits.count() >= 4:
        code = "".join(digits.nth(i).inner_text().strip() for i in range(digits.count()))
        if CODE_RE.fullmatch(code):
            return code
    for sel in ("#lcode", "#roomcode", "#roomCode", "#code", ".room-code", ".pin-display"):
        el = page.locator(sel).first
        if el.count():
            txt = el.inner_text().strip()
            m = CODE_RE.search(txt)
            if m:
                return m.group(0)
    try:
        js_code = page.evaluate("() => window.roomCode || (window.LobbyRejoin && window.LobbyRejoin.getCode && window.LobbyRejoin.getCode(location.pathname.split('/').pop())) || ''")
        if js_code and CODE_RE.fullmatch(js_code):
            return js_code
    except Exception:
        pass
    return None


def vis_create(pg):
    return pg.locator("button:visible").filter(has_text=CREATE_RE).count() > 0


def test_geobunker(browser, token):
    probs = []
    ctx, page = page_for(browser, token, probs, "solo")
    try:
        page.goto(f"{BASE}/static/geobunker.html", wait_until="networkidle")
        start_btn = page.locator(".btn-start-game, #btnStartGame").first
        if start_btn.count():
            start_btn.click()
        else:
            page.evaluate("() => typeof startLobbyGame === 'function' && startLobbyGame()")
        page.wait_for_timeout(1000)

        hud_vis = page.evaluate("() => document.getElementById('gameHud').style.display !== 'none'")
        round_val = page.evaluate("() => document.getElementById('roundBadge').textContent.trim()")
        loc_val = page.evaluate("() => window.currentLoc ? window.currentLoc.name : ''")
        assert hud_vis, "GeoBunker HUD not visible after start"
        assert loc_val, "GeoBunker currentLoc is empty"

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)

        hud_after = page.evaluate("() => document.getElementById('gameHud').style.display !== 'none'")
        round_after = page.evaluate("() => document.getElementById('roundBadge').textContent.trim()")
        loc_after = page.evaluate("() => window.currentLoc ? window.currentLoc.name : ''")
        lobby_hidden = page.evaluate("() => document.getElementById('lobbyModal').style.display === 'none'")

        assert hud_after, "GeoBunker HUD not visible after reload"
        assert lobby_hidden, "GeoBunker lobbyModal should be hidden after reload"
        assert round_after == round_val, f"GeoBunker round mismatch: {round_after} vs {round_val}"
        assert loc_after == loc_val, f"GeoBunker location mismatch: {loc_after} vs {loc_val}"

        tr_check = page.evaluate("""() => {
            const fr = trLoc('Эйфелева Башня, Париж', 'Франция');
            LANG = 'en'; const en = trLoc('Эйфелева Башня, Париж', 'Франция');
            LANG = 'de'; const de = trLoc('Эйфелева Башня, Париж', 'Франция');
            LANG = 'uk'; const uk = trLoc('Эйфелева Башня, Париж', 'Франция');
            return { fr, en, de, uk };
        }""")
        assert "Eiffel Tower" in tr_check["en"], f"EN translation failed: {tr_check}"
        assert "Eiffelturm" in tr_check["de"], f"DE translation failed: {tr_check}"
        assert "Ейфелева" in tr_check["uk"], f"UK translation failed: {tr_check}"

        return True, f"раунд {round_after}, локация «{loc_after}», переводы en/de/uk OK", probs
    finally:
        ctx.close()


def test_multi_midrejoin(browser, tokens, game):
    probs = []
    hc, host = page_for(browser, tokens[0], probs, "host")
    host.goto(f"{BASE}/{game}", wait_until="networkidle")
    fill_name(host, "Host")
    click_btn(host, CREATE_RE)
    host.wait_for_timeout(1500)
    code = get_room_code(host)
    assert code, f"Не удалось получить код комнаты {game}"

    gs = []
    for i in range(2):
        c, g = page_for(browser, tokens[1 + i], probs, f"g{i+1}")
        join_param = "code" if game == "variants" else "join"
        g.goto(f"{BASE}/{game}?{join_param}={code}", wait_until="networkidle")
        fill_name(g, f"Gast{i+1}")
        pins = g.locator(".pin-box:visible")
        if pins.count() >= 4:
            pins.first.click()
            g.keyboard.type(code, delay=40)
        else:
            inps = g.locator("input:visible:not([type=range]):not([type=hidden]):not([type=checkbox])")
            if inps.count() >= 2:
                inps.nth(1).fill(code)
        click_btn(g, JOIN_RE)
        g.wait_for_timeout(1000)
        gs.append((c, g))

    # Добавляем бота если есть
    click_btn(host, ADD_BOT_RE, timeout=1200)
    host.wait_for_timeout(600)

    # Стартуем партию
    started = click_btn(host, START_RE, timeout=2500)
    host.wait_for_timeout(2000)

    g1 = gs[0][1]
    os.makedirs(SHOTS, exist_ok=True)
    g1.screenshot(path=f"{SHOTS}/{game}_g1_before.png")
    host.screenshot(path=f"{SHOTS}/{game}_host_before.png")

    before_host = host.evaluate("document.body.innerText").count("Gast1")
    before_create = vis_create(g1)

    # ПЕРЕЗАГРУЗКА ГОСТЯ ПОСРЕДИ ИГРЫ
    g1.goto(f"{BASE}/{game}", wait_until="networkidle")
    g1.wait_for_timeout(3000)

    after_create = vis_create(g1)
    after_host = host.evaluate("document.body.innerText").count("Gast1")
    g1.screenshot(path=f"{SHOTS}/{game}_g1_after_reload.png")

    for c in [hc] + [x[0] for x in gs]:
        c.close()

    ok = not after_create and after_host <= max(before_host, 1)
    detail = f"start={started} create_before={before_create} create_after={after_create} host'Gast1' {before_host}->{after_host}"
    return ok, detail, probs


def main():
    tokens = [register() for _ in range(3)]
    games_to_test = sys.argv[1:] or GAMES
    passed = 0
    failed = 0

    print(f"=== Проверка возврата посреди партии (browser_rejoin) на {len(games_to_test)} играх ===")
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"]) if CHROMIUM else p.chromium.launch(headless=True, args=["--no-sandbox"])
        for g in games_to_test:
            try:
                if g == "geobunker":
                    ok, detail, probs = test_geobunker(browser, tokens[0])
                else:
                    ok, detail, probs = test_multi_midrejoin(browser, tokens, g)

                if ok and not probs:
                    print(f"  ✅ {g:<12} OK: {detail}")
                    passed += 1
                elif ok and probs:
                    print(f"  ⚠️  {g:<12} OK: {detail} (но консоль: {probs[:2]})")
                    passed += 1
                else:
                    print(f"  ❌ {g:<12} FAIL: {detail} {probs}")
                    failed += 1
            except Exception as e:
                import traceback
                print(f"  ❌ {g:<12} ERROR: {str(e)}")
                traceback.print_exc()
                failed += 1
        browser.close()

    print(f"\nИТОГ: {passed}/{len(games_to_test)} пройдено, ошибок: {failed}")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
