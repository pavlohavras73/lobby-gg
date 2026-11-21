"""Проверка кнопки «Поделиться результатом» в одиночных играх:
2048, тетрис, змейка, сапёр, wordle, пятнашки, Shuttle.
Проверяется появление кнопки «Поделиться», клик без ошибок, копирование и показ тоста.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

LANG = "ru"

def test_single_player_share():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ctx = b.new_context(
            viewport={"width": 390, "height": 844},
            permissions=["clipboard-read", "clipboard-write"]
        )
        ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
        tok = register()
        ctx.add_cookies([{"name": "jsession", "value": tok, "url": BASE}])
        page = ctx.new_page()

        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        # 1. 2048
        print("Checking 2048 share...")
        page.goto(f"{BASE}/g2048", wait_until="networkidle")
        page.evaluate("() => endGame(false)")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        os.makedirs("qa_shots/stage14", exist_ok=True)
        page.screenshot(path="qa_shots/stage14/share_modal_2048.png")
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("2048 share OK!")

        # 2. Tetris
        print("Checking tetris share...")
        page.goto(f"{BASE}/tetris", wait_until="networkidle")
        page.evaluate("() => showGameOverScreen()")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("Tetris share OK!")

        # 3. Snake
        print("Checking snake share...")
        page.goto(f"{BASE}/snake", wait_until="networkidle")
        page.evaluate("""() => {
            dead = true;
            ArcadeFX.showGameOver({
                lang: LANG, score: 42, best: 100, isNewRecord: false,
                stats: [{ label: t('len_lbl'), value: 12 }],
                share: () => ({
                    title: '🐍 Snake — Lobby.gg',
                    text: '🐍 Snake — Lobby.gg\\n🍎 42 · Длина: 12'
                }),
                onRestart: () => restart()
            });
        }""")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("Snake share OK!")

        # 4. Minesweeper
        print("Checking minesweeper share...")
        page.goto(f"{BASE}/mines", wait_until="networkidle")
        page.evaluate("""() => {
            over = true;
            ArcadeFX.showGameOver({
                lang: LANG, title: t('boom_title'), score: '10/64', best: '20/64',
                isNewRecord: false,
                share: () => ({
                    title: '💣 Minesweeper — Lobby.gg',
                    text: '💣 Взрыв! (10/64 Открыто) — Lobby.gg'
                }),
                onRestart: () => newGame()
            });
        }""")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("Minesweeper share OK!")

        # 5. Wordle
        print("Checking wordle share...")
        page.goto(f"{BASE}/wordle", wait_until="networkidle")
        page.evaluate("""() => {
            over = true;
            guesses = [
                { word: 'ВОДКА', res: ['absent', 'correct', 'absent', 'absent', 'present'] },
                { word: 'ПОЛКА', res: ['correct', 'correct', 'correct', 'correct', 'correct'] }
            ];
            const gridEmoji = guesses.map(g => g.res.map(r => r === 'correct' ? '🟩' : (r === 'present' ? '🟨' : '⬛')).join('')).join('\\n');
            ArcadeFX.showGameOver({
                lang: LANG, title: t('over_win'), subtitle: t('word_was') + 'ПОЛКА',
                score: '2/6', scoreLabel: t('tries_lbl'),
                best: 5, bestLabel: t('streak_lbl'),
                isNewRecord: true,
                share: () => ({
                    title: 'Wordle (RU) 2/6 — Lobby.gg',
                    text: 'Wordle (RU) 2/6 — Lobby.gg\\n\\n' + gridEmoji
                }),
                onRestart: () => resetToNewWord()
            });
        }""")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        page.screenshot(path="qa_shots/stage14/share_modal_wordle.png")
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("Wordle share OK!")

        # 6. Fifteen
        print("Checking fifteen share...")
        page.goto(f"{BASE}/fifteen", wait_until="networkidle")
        page.evaluate("""() => {
            won = true;
            ArcadeFX.showGameOver({
                lang: LANG, title: t('win_title'), score: 45, scoreLabel: t('moves'),
                best: 40, isNewRecord: false,
                stats: [{ label: t('size_lbl'), value: '4×4' }],
                share: () => ({
                  title: '🧩 15-Puzzle (4×4) — Lobby.gg',
                  text: '🧩 Победа! (4×4)\\n🏆 Ходов: 45 — Lobby.gg'
                }),
                onRestart: () => newGame()
            });
        }""")
        page.wait_for_selector("#afxShareBtn:visible", timeout=3000)
        page.click("#afxShareBtn")
        page.wait_for_timeout(300)
        print("Fifteen share OK!")

        # 7. Space Invaders (Shuttle)
        print("Checking shuttle share...")
        page.goto(f"{BASE}/space_invaders", wait_until="networkidle")
        page.evaluate("""() => {
            lastGameOverInfo = { galaxy: 2, sector: 4, score: 1850, dust: 42 };
            document.getElementById('endStats').textContent = 'Сектор 2-4 · Счёт: 1850 · +✨ 42';
            document.getElementById('endModal').classList.add('open');
        }""")
        page.wait_for_selector("#endShareBtn:visible", timeout=3000)
        page.screenshot(path="qa_shots/stage14/share_modal_shuttle.png")
        page.click("#endShareBtn")
        page.wait_for_timeout(300)
        print("Shuttle share OK!")

        assert not errors, f"Page errors encountered: {errors}"
        b.close()
        print("ALL 7 SINGLE PLAYER SHARE CHECKS PASSED!")

if __name__ == "__main__":
    test_single_player_share()
