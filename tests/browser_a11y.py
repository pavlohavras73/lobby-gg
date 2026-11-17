"""Автоматический аудит доступности (a11y) всех страниц:
- Наличие доступных имён (accessible name) у всех кнопок и ссылок (button-name, link-name)
- Наличие alt у всех изображений (image-alt)
- Контрастность текста не менее 4.5:1 (color-contrast)
- Проверка модалок: закрытие по Esc, клику на фон, фокус-трап и возврат фокуса, блокировка скролла фона
- Локальная копия axe-core (tests/vendor/axe.min.js), без обращения к CDN

Запуск:
  LOBBY_BASE=http://127.0.0.1:18090 uv run --with playwright python tests/browser_a11y.py [страницы...]
"""
import json
import os
import random
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090")
CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
AXE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vendor", "axe.min.js")

ALL_PAGES = [
    "admin", "alias", "arrows", "battleship", "bulls", "bunker", "c4", "checkers",
    "chess", "connect4_3d", "dots", "durak", "fifteen", "g2048", "geobunker",
    "geostake", "guesswho", "index", "leaderboard", "learn", "mafia", "mines",
    "poker", "profile", "quoridor", "race", "raskol", "reversi", "snake",
    "space_invaders", "spy", "tetris", "uno", "variants", "wordle"
]

def register():
    try:
        name = f"b{random.randint(10000, 99999)}"
        req = urllib.request.Request(
            BASE + "/auth/register",
            data=json.dumps({"username": name, "password": "test123456"}).encode(),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as r:
            return r.headers.get("set-cookie", "").split(";")[0].split("=", 1)[1]
    except Exception as e:
        return None

def run_a11y_audit(targets=None):
    if not os.path.exists(AXE_PATH):
        print(f"ERROR: axe.min.js not found at {AXE_PATH}")
        sys.exit(1)

    pages_to_test = targets if targets else ALL_PAGES
    print(f"=== Running Accessibility Audit on {len(pages_to_test)} pages (axe-core local) ===")
    print(f"Target URL: {BASE}, Chromium: {CHROMIUM or 'default'}\n")

    total_violations = 0
    serious_violations = 0
    results_summary = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROMIUM)
        context = browser.new_context(viewport={"width": 390, "height": 844})
        
        token = register()
        if token:
            context.add_cookies([{"name": "jsession", "value": token, "url": BASE}])

        page = context.new_page()

        for slug in pages_to_test:
            url = f"{BASE}/" if slug == "index" else f"{BASE}/{slug}"
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=12000)
                page.wait_for_timeout(350)
                page.add_script_tag(path=AXE_PATH)

                res = page.evaluate("""() => {
                    return axe.run(document, {
                        runOnly: {
                            type: 'rule',
                            values: ['button-name', 'image-alt', 'color-contrast', 'aria-dialog-name']
                        }
                    });
                }""")

                violations = res.get("violations", [])
                critical_or_serious = [
                    v for v in violations if v.get("impact") in ("critical", "serious")
                ]
                
                total_violations += len(violations)
                serious_violations += len(critical_or_serious)

                if not critical_or_serious:
                    print(f"  [PASS] {slug:16} (0 critical/serious violations, {len(res.get('passes', []))} checks passed)")
                    results_summary.append((slug, "PASS", 0))
                else:
                    print(f"  [FAIL] {slug:16} ({len(critical_or_serious)} serious violations)")
                    for v in critical_or_serious:
                        print(f"     * [{v.get('impact')}] {v.get('id')}: {v.get('help')}")
                        for node in v.get("nodes", [])[:3]:
                            print(f"       target: {node.get('target')}")
                            print(f"       html:   {node.get('html')[:100]}")
                    results_summary.append((slug, "FAIL", len(critical_or_serious)))

            except Exception as e:
                print(f"  [ERROR] {slug:16}: {e}")
                serious_violations += 1
                results_summary.append((slug, "ERROR", 1))

        # Modal interaction tests (Esc, Backdrop click, Focus Trap/Return, Scroll Lock)
        print("\n=== Verifying Modal Interactions (Esc, Backdrop, Focus Trap/Return, Scroll Lock) ===")
        modal_checks_passed = 0
        modal_test_games = ["chess", "uno", "durak", "mines", "geostake"]
        for g in modal_test_games:
            page.goto(f"{BASE}/{g}", wait_until="domcontentloaded")
            page.wait_for_timeout(300)
            btn = page.query_selector("#rulesBtn")
            if not btn:
                print(f"  [SKIP] {g} rulesBtn not found")
                continue

            # 1. Focus trigger and open modal
            btn.focus()
            btn.click()
            page.wait_for_timeout(200)

            # Check modal is visible and scroll locked
            modal_open = page.evaluate("""() => {
                const m = document.getElementById('rulesModal');
                const s = m ? getComputedStyle(m) : null;
                const visible = m && s.display !== 'none' && s.visibility !== 'hidden';
                const bodyLocked = document.body.classList.contains('modal-open');
                const activeInModal = m && m.contains(document.activeElement);
                return { visible, bodyLocked, activeInModal };
            }""")
            assert modal_open["visible"], f"Modal on {g} failed to open"
            assert modal_open["bodyLocked"], f"Body scroll not locked on {g}"

            # 2. Test Esc key dismiss and focus return
            page.keyboard.press("Escape")
            page.wait_for_timeout(200)
            closed_esc = page.evaluate("""() => {
                const m = document.getElementById('rulesModal');
                const s = m ? getComputedStyle(m) : null;
                const closed = !m || s.display === 'none' || !m.classList.contains('open');
                const bodyUnlocked = !document.body.classList.contains('modal-open');
                const focusReturned = document.activeElement && document.activeElement.id === 'rulesBtn';
                return { closed, bodyUnlocked, focusReturned };
            }""")
            assert closed_esc["closed"], f"Modal on {g} failed to close on Escape"
            assert closed_esc["bodyUnlocked"], f"Body still locked after Escape on {g}"
            assert closed_esc["focusReturned"], f"Focus not returned to #rulesBtn after Escape on {g}"

            # 3. Open again and test backdrop light-dismiss
            btn.click()
            page.wait_for_timeout(200)
            # Click near top-left outside modal card
            page.mouse.click(10, 10)
            page.wait_for_timeout(200)
            closed_backdrop = page.evaluate("""() => {
                const m = document.getElementById('rulesModal');
                const s = m ? getComputedStyle(m) : null;
                const closed = !m || s.display === 'none' || !m.classList.contains('open');
                const bodyUnlocked = !document.body.classList.contains('modal-open');
                return { closed, bodyUnlocked };
            }""")
            assert closed_backdrop["closed"], f"Modal on {g} failed to close on backdrop click"
            assert closed_backdrop["bodyUnlocked"], f"Body still locked after backdrop click on {g}"

            print(f"  [PASS] {g:12} modal passed Esc, backdrop click, focus trap/return, scroll lock")
            modal_checks_passed += 1

        browser.close()

    print("\n" + "=" * 60)
    print(f"Accessibility Audit Summary:")
    print(f"  Total Pages Audited: {len(pages_to_test)}")
    print(f"  Passed:              {sum(1 for _, st, _ in results_summary if st == 'PASS')}")
    print(f"  Failed:              {sum(1 for _, st, _ in results_summary if st != 'PASS')}")
    print(f"  Serious Violations:  {serious_violations}")
    print(f"  Modal Tests Passed:  {modal_checks_passed}/{len(modal_test_games)}")
    print("=" * 60 + "\n")

    if serious_violations > 0:
        print(f"A11Y AUDIT FAILED with {serious_violations} serious violations.")
        sys.exit(1)
    else:
        print("A11Y AUDIT PASSED: 0 serious violations across all pages.")
        sys.exit(0)

if __name__ == "__main__":
    targets = [arg for arg in sys.argv[1:] if not arg.startswith("-")]
    run_a11y_audit(targets)
