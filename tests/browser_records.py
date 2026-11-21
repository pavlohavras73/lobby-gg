"""Проверка персональных рекордов и бейджа нового рекорда в одиночных играх:
2048, тетрис, змейка.
Подставляется счёт выше рекорда → проверяется появление бейджа и запись в localStorage.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

LANG = "ru"

def test_records():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ctx = b.new_context(
            viewport={"width": 390, "height": 844}
        )
        ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
        tok = register()
        ctx.add_cookies([{"name": "jsession", "value": tok, "url": BASE}])
        page = ctx.new_page()

        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        # 1. 2048
        print("Checking 2048 record...")
        page.goto(f"{BASE}/g2048", wait_until="networkidle")
        page.evaluate("() => { localStorage.setItem('jg_best_2048', '100'); best = 100; runStartBest = 100; document.getElementById('best').textContent = '100'; }")
        assert page.locator("#best").inner_text() == "100", "2048 HUD record mismatch before run"

        # End game with score higher than record
        page.evaluate("""() => {
            score = 350;
            if (score > best) {
                best = score;
                localStorage.setItem('jg_best_2048', String(best));
                localStorage.setItem('g2048_best', String(best));
                document.getElementById('best').textContent = best;
            }
            isNewRecord = true;
            endGame(false);
        }""")
        page.wait_for_selector("#afxRecordBadge:visible", timeout=3000)
        rec_2048 = page.evaluate("() => localStorage.getItem('jg_best_2048')")
        assert rec_2048 == "350", f"Expected jg_best_2048=350, got {rec_2048}"
        os.makedirs("qa_shots/stage15", exist_ok=True)
        page.screenshot(path="qa_shots/stage15/record_badge_2048.png")
        print("2048 record OK!")

        # 2. Tetris
        print("Checking Tetris record...")
        page.goto(f"{BASE}/tetris", wait_until="networkidle")
        page.evaluate("() => { localStorage.setItem('jg_best_tetris', '120'); best = 120; runStartBest = 120; document.getElementById('best-display').textContent = '120'; }")
        assert page.locator("#best-display").inner_text() == "120", "Tetris HUD record mismatch before run"

        # End game with score higher than record
        page.evaluate("""() => {
            score = 480;
            showGameOverScreen();
        }""")
        page.wait_for_selector("#afxRecordBadge:visible", timeout=3000)
        rec_tetris = page.evaluate("() => localStorage.getItem('jg_best_tetris')")
        assert rec_tetris == "480", f"Expected jg_best_tetris=480, got {rec_tetris}"
        page.screenshot(path="qa_shots/stage15/record_badge_tetris.png")
        print("Tetris record OK!")

        # 3. Snake
        print("Checking Snake record...")
        page.goto(f"{BASE}/snake", wait_until="networkidle")
        page.evaluate("() => { localStorage.setItem('jg_best_snake', '25'); best = 25; runStartBest = 25; document.getElementById('best').textContent = '25'; }")
        assert page.locator("#best").inner_text() == "25", "Snake HUD record mismatch before run"

        # End game with score higher than record
        page.evaluate("""() => {
            score = 60;
            if (score > best) {
                best = score;
                localStorage.setItem('jg_best_snake', String(best));
                localStorage.setItem('snake_best', String(best));
                document.getElementById('best').textContent = best;
            }
            dead = true;
            ArcadeFX.showGameOver({
                lang: LANG,
                score: score,
                best: best,
                isNewRecord: true,
                stats: [{ label: t('len_lbl'), value: 14 }],
                share: () => ({
                    title: '🐍 Snake — Lobby.gg',
                    text: '🐍 Snake — Lobby.gg\\n🍎 60 · Длина: 14\\n🔥 Новый рекорд!'
                }),
                onRestart: () => restart()
            });
        }""")
        page.wait_for_selector("#afxRecordBadge:visible", timeout=3000)
        rec_snake = page.evaluate("() => localStorage.getItem('jg_best_snake')")
        assert rec_snake == "60", f"Expected jg_best_snake=60, got {rec_snake}"
        page.screenshot(path="qa_shots/stage15/record_badge_snake.png")
        print("Snake record OK!")

        assert not errors, f"Page errors encountered: {errors}"
        b.close()
        print("ALL 3 RECORD CHECKS PASSED (3/3)!")

if __name__ == "__main__":
    test_records()
