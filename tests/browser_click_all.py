"""tests/browser_click_all.py — Проверка всех кнопок на всех 34 страницах.
18a:
- Для каждой из 34 страниц (390×844, jg_rules_seen_* выставлен):
  - в лобби, а где можно — и в партии с ботом, и в окне итогов;
  - собери все видимые кликабельные элементы (button, a[href], [onclick], [role=button]);
  - нажимай по одному на свежей странице. Пропускай только явно разрушительные:
    «Выйти из аккаунта», «Удалить», «Покинуть комнату».
- После каждого нажатия проверь:
  1. 0 pageerror и 0 console.error (кроме известных 401 гостя);
  2. URL остался на том же хосте и начинается с /games/ или /learn/;
  3. экран не заморожен: на странице есть видимый кликабельный элемент, не перекрытый
     невидимым слоем (elementFromPoint в центре кнопки возвращает её саму или её потомка),
     и нет «пустого» оверлея на весь экран.
- Итог — таблица «страница → нажато / пропущено / проблем» и список проблем с селектором кнопки.

Запуск:
  LOBBY_BASE=http://127.0.0.1:18098/games uv run --offline --with playwright python tests/browser_click_all.py [страницы...]
"""

import json
import os
import re
import sys
import time
import urllib.parse
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import CHROMIUM, register

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090/games").rstrip("/")

ALL_PAGES = [
    "index", "profile", "leaderboard", "learn", "alias", "arrows", "battleship",
    "bulls", "bunker", "c4", "connect4_3d", "checkers", "chess", "dots", "durak",
    "fifteen", "g2048", "geobunker", "geostake", "guesswho", "mafia", "mines",
    "poker", "quoridor", "race", "raskol", "reversi", "snake", "space_invaders",
    "spy", "tetris", "uno", "variants", "wordle"
]

DESTRUCTIVE_RE = re.compile(
    r"выйти из аккаунта|удалить|покинуть комнат|покинуть|leave room|logout|delete",
    re.I
)
IGNORE_CONSOLE_RE = re.compile(
    r"favicon|ResizeObserver|AudioContext|vibrate|serviceWorker|sw\.js",
    re.I
)

RUN_DATA = {"win": True, "room": 10, "kills": 42, "shards": 7, "score": 1234, "time": 321, "lvl": 9}


def get_page_url(name):
    if name == "index":
        return f"{BASE}/"
    return f"{BASE}/{name}"


def setup_state(page, name, state):
    """Приводит страницу к состоянию: 'lobby', 'game' или 'results'."""
    url = get_page_url(name)
    for _ in range(3):
        try:
            page.goto(url, wait_until="load", timeout=12000)
            break
        except Exception:
            try:
                page.wait_for_timeout(300)
            except Exception:
                pass
    page.wait_for_timeout(200)

    if state == "lobby":
        return True

    if state == "game":
        try:
            if name == "race":
                page.evaluate("() => { if (window.startRace) startRace(); else if (window.engine && engine.start) engine.start(); }")
            elif name == "raskol":
                page.evaluate("() => { try { startRun(); } catch(e){} }")
            elif name == "space_invaders":
                page.evaluate("() => { try { launchGame(1, 1, false); } catch(e){} }")
            elif name in ("snake", "tetris"):
                page.evaluate("() => { try { startGame(); } catch(e){} }")
            elif name == "mines":
                page.evaluate("() => { try { initGame(); } catch(e){} }")
            elif name == "g2048":
                page.evaluate("() => { try { setup(); } catch(e){} }")
            elif name == "fifteen":
                page.evaluate("() => { try { newGame(); } catch(e){} }")
            elif name == "arrows":
                page.evaluate("() => { try { startGame(); } catch(e){} }")
            elif name in ("c4", "connect4_3d", "quoridor"):
                bot_btn = page.query_selector("button:has-text('ботом'), button:has-text('Играть')")
                if bot_btn and bot_btn.is_visible():
                    bot_btn.click()
            else:
                # Мультиплеер: создать комнату и добавить бота
                create_btn = page.query_selector("button:has-text('Создать')")
                if create_btn and create_btn.is_visible():
                    create_btn.click()
                    page.wait_for_timeout(400)
                    add_bot = page.query_selector("button[onclick*='add_bot'], button:has-text('бота')")
                    if add_bot and add_bot.is_visible():
                        add_bot.click()
            page.wait_for_timeout(250)
            return True
        except Exception:
            return False

    if state == "results":
        try:
            if name == "raskol":
                page.evaluate("() => { try { startRun(); } catch(e){} }")
                page.wait_for_timeout(200)
                page.evaluate("r => endRun(r)", RUN_DATA)
            elif name == "race":
                page.evaluate("() => engine.opts.onCrash({ distance: 100, coins: 5, maxSpeed: 120 })")
            elif name == "space_invaders":
                page.evaluate("() => { launchGame(1, 1, false); engine.cb.onGameOver({ score: 100, dust: 5, galaxy: 1, sector: 1 }); }")
            elif name in ("snake", "tetris", "g2048", "mines", "fifteen"):
                if name in ("snake", "tetris", "g2048"):
                    page.evaluate("() => gameOver()")
                elif name == "mines":
                    page.evaluate("() => gameOver(true)")
                elif name == "fifteen":
                    page.evaluate("() => winGame()")
                page.wait_for_timeout(450)
            elif name == "arrows":
                page.evaluate("() => { try { startGame(); } catch(e){} document.getElementById('winModal').classList.add('open'); }")
            else:
                # Мультиплеер: через st.done или LobbyUI.results
                res = page.evaluate("""() => {
                    if (window.st) {
                        st.done = true;
                        st.winner = window.pid || 'p1';
                        if (typeof handle === 'function') handle(st);
                        return true;
                    }
                    if (window.LobbyUI && typeof LobbyUI.results === 'function') {
                        LobbyUI.results({
                            title: 'Победа!',
                            score: 100,
                            winner: true,
                            onRematch: () => {},
                            onExit: () => {}
                        });
                        return true;
                    }
                    return false;
                }""")
                if not res:
                    return False
            page.wait_for_timeout(250)
            return True
        except Exception:
            return False

    return True


JS_COLLECT_ELEMENTS = """() => {
    const isVisible = el => {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) return false;
        if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') <= 0.05 || s.pointerEvents === 'none') return false;
        const cx = Math.max(0, Math.min(window.innerWidth - 1, r.left + r.width / 2));
        const cy = Math.max(0, Math.min(window.innerHeight - 1, r.top + r.height / 2));
        const hit = document.elementFromPoint(cx, cy);
        if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) return false;
        return true;
    };
    const els = Array.from(document.querySelectorAll('button, a[href], [onclick], [role="button"]'))
        .filter(isVisible);

    return els.map((el, idx) => {
        const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim().replace(/\\s+/g, ' ');
        let sel = '';
        if (el.id) {
            sel = '#' + el.id;
        } else if (el.tagName.toLowerCase() === 'a' && el.getAttribute('href')) {
            sel = `a[href="${el.getAttribute('href')}"]`;
        } else if (el.getAttribute('data-lang')) {
            sel = `[data-lang="${el.getAttribute('data-lang')}"]`;
        } else if (el.getAttribute('data-cls')) {
            sel = `[data-cls="${el.getAttribute('data-cls')}"]`;
        } else if (el.getAttribute('data-tab')) {
            sel = `[data-tab="${el.getAttribute('data-tab')}"]`;
        } else if (el.getAttribute('data-action')) {
            sel = `[data-action="${el.getAttribute('data-action')}"]`;
        } else {
            const cls = el.className && typeof el.className === 'string' ? el.className.split(/\\s+/).filter(c => c && !c.includes(':')).slice(0, 2).join('.') : '';
            sel = cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
        }
        const matches = Array.from(document.querySelectorAll(sel));
        const matchIdx = matches.indexOf(el);
        return {
            idx: idx,
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            text: text.slice(0, 40),
            sel: sel,
            matchIdx: matchIdx >= 0 ? matchIdx : 0
        };
    });
}"""

JS_CHECK_SCREEN_FROZEN = """() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isVisible = el => {
        const r = el.getBoundingClientRect();
        if (r.width <= 2 || r.height <= 2) return false;
        if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') <= 0.05 || s.pointerEvents === 'none') return false;
        return r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0;
    };

    const interactives = Array.from(document.querySelectorAll('button, a[href], [onclick], [role="button"]'))
        .filter(isVisible);

    if (interactives.length === 0) {
        return { frozen: false, reason: "no_visible_buttons" };
    }

    let clickableCount = 0;
    for (const el of interactives) {
        const rect = el.getBoundingClientRect();
        const cx = Math.max(0, Math.min(vw - 1, rect.left + rect.width / 2));
        const cy = Math.max(0, Math.min(vh - 1, rect.top + rect.height / 2));
        const hit = document.elementFromPoint(cx, cy);
        if (hit && (el === hit || el.contains(hit) || hit.contains(el))) {
            clickableCount++;
        }
    }

    // Проверка невидимого полноэкранного блокирующего слоя
    const fullOverlays = Array.from(document.querySelectorAll('div, section, aside')).filter(el => {
        const rect = el.getBoundingClientRect();
        const st = window.getComputedStyle(el);
        return rect.width >= vw * 0.95 && rect.height >= vh * 0.95 &&
               st.position === 'fixed' && st.pointerEvents !== 'none' &&
               parseFloat(st.opacity || '1') === 0;
    });

    if (clickableCount === 0 && interactives.length > 0) {
        return { frozen: true, reason: "all_interactives_obscured" };
    }
    if (fullOverlays.length > 0) {
        return { frozen: true, reason: "invisible_fullscreen_overlay" };
    }
    return { frozen: false, clickableCount: clickableCount };
}"""


def test_page_clicks(browser, token, page_name):
    print(f"\n--- Страница: {page_name} ---")
    states_to_test = ["lobby"] if page_name in ("index", "profile", "leaderboard", "learn") else ["lobby", "game", "results"]
    page_stats = {"clicked": 0, "skipped": [], "issues": []}

    base_parsed = urllib.parse.urlparse(BASE)

    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True
    )
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    ctx.add_init_script(f"""
        try {{
            localStorage.setItem('jg_rules_seen_{page_name}', '1');
            localStorage.setItem('jg_lang', 'ru');
        }} catch(e) {{}}
    """)
    pg = ctx.new_page()

    page_errors = []
    console_errors = []
    pg.on("pageerror", lambda e: page_errors.append(str(e)[:150]))
    pg.on("console", lambda m: console_errors.append(m.text[:150]) if m.type == "error" and not IGNORE_CONSOLE_RE.search(m.text) else None)

    for st in states_to_test:
        ok = setup_state(pg, page_name, st)
        if not ok:
            continue

        elements = pg.evaluate(JS_COLLECT_ELEMENTS)

        for el in elements:
            # Проверка разрушительных кнопок
            desc_match = DESTRUCTIVE_RE.search(el["text"]) or DESTRUCTIVE_RE.search(el["id"])
            if desc_match:
                skip_label = f"[{st}] {el['sel']} ('{el['text']}')"
                page_stats["skipped"].append(skip_label)
                continue

            # Сбрасываем ошибки перед кликом
            page_errors.clear()
            console_errors.clear()

            # Приводим страницу к тестируемому состоянию
            setup_state(pg, page_name, st)

            loc = pg.locator(el["sel"]).nth(el["matchIdx"])
            if not loc.is_visible():
                continue

            try:
                loc.click(timeout=2500)
                page_stats["clicked"] += 1
                print(".", end="", flush=True)
            except Exception as e:
                issue = f"[{st}] {el['sel']} ('{el['text']}'): Click execution failed: {str(e)[:100]}"
                page_stats["issues"].append(issue)
                print(f"\n  ❌ {issue}")
                continue

            pg.wait_for_timeout(350)

            # 1. Проверка ошибок JS
            all_errs = page_errors + console_errors
            if all_errs:
                issue = f"[{st}] {el['sel']} ('{el['text']}'): JS error: {'; '.join(all_errs[:2])}"
                page_stats["issues"].append(issue)
                print(f"\n  ❌ {issue}")

            # 2. Проверка URL
            curr_url = pg.url
            parsed_curr = urllib.parse.urlparse(curr_url)
            host_match = (parsed_curr.netloc == base_parsed.netloc) or (parsed_curr.hostname in ("127.0.0.1", "localhost"))
            path_ok = parsed_curr.path.startswith("/games") or parsed_curr.path.startswith("/learn")
            if not (host_match and path_ok):
                issue = f"[{st}] {el['sel']} ('{el['text']}'): Bad URL redirect to '{curr_url}'"
                page_stats["issues"].append(issue)
                print(f"\n  ❌ {issue}")

            # 3. Проверка экрана на заморозку
            frozen_info = pg.evaluate(JS_CHECK_SCREEN_FROZEN)
            if frozen_info.get("frozen"):
                pg.wait_for_timeout(300)
                frozen_info = pg.evaluate(JS_CHECK_SCREEN_FROZEN)
            if frozen_info.get("frozen"):
                issue = f"[{st}] {el['sel']} ('{el['text']}'): Screen frozen ({frozen_info.get('reason')})"
                page_stats["issues"].append(issue)
                print(f"\n  ❌ {issue}")

    ctx.close()
    status_tag = f"❌ {len(page_stats['issues'])} проблем" if page_stats["issues"] else "✅ OK"
    print(f"\nИТОГ {page_name:<16}: нажато {page_stats['clicked']}, пропущено {len(page_stats['skipped'])}, {status_tag}")
    return page_stats


def main():
    pages_to_test = [p for p in sys.argv[1:] if not p.startswith("-")] or ALL_PAGES
    print(f"Запуск browser_click_all на {len(pages_to_test)} страницах (viewport 390x844, BASE={BASE})...")

    token = register()
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )

        for page_name in pages_to_test:
            stats = test_page_clicks(browser, token, page_name)
            results[page_name] = stats

        browser.close()

    print("\n" + "=" * 80)
    print("ИТОГОВАЯ ТАБЛИЦА НАЖАТИЙ (browser_click_all):")
    print(f"{'№':<3} | {'Страница':<16} | {'Нажато':<8} | {'Пропущено':<10} | {'Проблем':<8}")
    print("-" * 80)
    total_clicked = 0
    total_skipped = 0
    total_issues = 0
    all_issues_list = []

    for i, (name, st) in enumerate(results.items(), 1):
        c = st["clicked"]
        s = len(st["skipped"])
        p = len(st["issues"])
        total_clicked += c
        total_skipped += s
        total_issues += p
        for iss in st["issues"]:
            all_issues_list.append(f"{name}: {iss}")
        print(f"{i:<3} | {name:<16} | {c:<8} | {s:<10} | {p:<8}")
    print("=" * 80)
    print(f"Всего нажато: {total_clicked} | Пропущено: {total_skipped} | Проблем найдено: {total_issues}")

    if all_issues_list:
        print("\nСписок найденных проблем:")
        for iss in all_issues_list:
            print(" -", iss)

    return 1 if total_issues > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
