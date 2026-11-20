import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

ALL_22_GAMES = [
    "alias", "battleship", "bulls", "bunker", "checkers", "chess",
    "connect4_3d", "dots", "durak", "geobunker", "geostake", "guesswho",
    "mafia", "poker", "quoridor", "race", "raskol", "reversi",
    "space_invaders", "spy", "uno", "variants"
]

def main():
    token = register()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True)

        print(f"=== 1. Testing Online Rules Modal ({len(ALL_22_GAMES)} games) ===")
        for game in ALL_22_GAMES:
            errors = []
            ctx = b.new_context(viewport={"width": 390, "height": 844})
            ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(f"JS: {e}"))
            pg.on("console", lambda m: errors.append(f"Console: {m.text}") if m.type == "error" else None)

            url = f"{BASE}/static/geobunker.html" if game == "geobunker" else f"{BASE}/{game}"
            pg.goto(url, wait_until="domcontentloaded")
            pg.wait_for_timeout(300)

            # Trigger rules via #rulesBtn click if available, else LobbyUI.rules
            has_btn = pg.evaluate("() => { const b = document.getElementById('rulesBtn'); if (b) { b.click(); return true; } return false; }")
            if not has_btn:
                pg.evaluate(f"window.LobbyUI && LobbyUI.rules('{game}')")
            pg.wait_for_timeout(350)

            # Verify slides rendered
            slides_count = pg.evaluate("() => document.querySelectorAll('.rules-slide').length")
            assert slides_count > 0, f"{game}: no rules slides rendered"

            # Advance all slides until closed
            for _ in range(slides_count + 1):
                is_open = pg.evaluate("() => { const m = document.getElementById('rulesModal'); return m && getComputedStyle(m).display !== 'none'; }")
                if not is_open:
                    break
                pg.evaluate("() => { const b = document.querySelector('.rules-btn-next'); if (b) b.click(); }")
                pg.wait_for_timeout(150)

            is_open = pg.evaluate("() => { const m = document.getElementById('rulesModal'); return m && getComputedStyle(m).display !== 'none'; }")
            assert not is_open, f"{game}: modal did not close after clicking done"

            # Filter ignorable console messages
            real_errs = [e for e in errors if not any(ign in e for ign in ["favicon", "net::ERR_", "404"])]
            assert len(real_errs) == 0, f"{game} errors: {real_errs}"
            print(f"  OK: {game} ({slides_count} slides) cycled and closed with 0 errors")
            ctx.close()

        print(f"\n=== 2. Testing Offline Fallback ({len(ALL_22_GAMES)} games) ===")
        for game in ALL_22_GAMES:
            errors = []
            ctx = b.new_context(viewport={"width": 390, "height": 844})
            ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            
            # Block all rules requests to simulate offline / script fail
            ctx.route("**/rules/**", lambda r: r.abort("failed"))

            pg = ctx.new_page()
            pg.on("pageerror", lambda e: errors.append(f"JS: {e}"))
            pg.on("console", lambda m: errors.append(f"Console: {m.text}") if m.type == "error" else None)

            url = f"{BASE}/static/geobunker.html" if game == "geobunker" else f"{BASE}/{game}"
            pg.goto(url, wait_until="domcontentloaded")
            pg.wait_for_timeout(300)

            # Open rules
            pg.evaluate(f"window.LobbyUI && LobbyUI.rules('{game}')")
            pg.wait_for_timeout(400)

            # Fallback modal should be open
            is_open = pg.evaluate("() => { const m = document.getElementById('rulesModal'); return m && getComputedStyle(m).display !== 'none'; }")
            assert is_open, f"{game}: fallback modal did not open"

            pg.evaluate("() => { const b = document.querySelector('#rulesFallbackOk, .rules-btn-next, .rules-close, #rulesOk'); if (b) b.click(); }")
            pg.wait_for_timeout(200)

            is_open = pg.evaluate("() => { const m = document.getElementById('rulesModal'); return m && getComputedStyle(m).display !== 'none'; }")
            assert not is_open, f"{game}: fallback modal did not close"

            real_errs = [e for e in errors if not any(ign in e for ign in ["favicon", "net::ERR_", "Failed to load resource", "404"])]
            assert len(real_errs) == 0, f"{game} offline errors: {real_errs}"
            print(f"  OK: {game} offline fallback opened and closed with 0 console errors")
            ctx.close()

        b.close()
    print("\nAll 22 games online slides and offline fallback tests passed successfully!")

if __name__ == "__main__":
    main()
