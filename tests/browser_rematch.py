"""Проверка экрана итогов и реванша: доведение игр до завершения -> показ LobbyUI.results
-> нажатие «Реванш» -> перезапуск партии без дублей игроков.
"""
import os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

LANG = "ru"

def test_rematch():
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
        tok = register()
        ctx.add_cookies([{"name": "jsession", "value": tok, "url": BASE}])
        page = ctx.new_page()

        # 1. Шашки (Checkers)
        print("Checking checkers rematch...")
        page.goto(f"{BASE}/checkers", wait_until="networkidle")
        page.fill("input:visible", "Host")
        page.click("button:has-text('Создать')")
        page.wait_for_timeout(1000)
        page.click("button[onclick*='add_bot']")
        page.wait_for_timeout(1500)

        # Завершаем партию через существующий st
        page.evaluate("""() => {
            st.done = true;
            st.winner = window.pid;
            handle(st);
        }""")
        page.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        assert page.is_visible("#lobbyResultsRematchBtn"), "Checkers: rematch button not visible"
        os.makedirs("qa_shots/stage14", exist_ok=True)
        page.screenshot(path="qa_shots/stage14/rematch_results_modal.png")
        print("Checkers results modal opened OK. Screenshot saved. Clicking Rematch...")
        page.click("#lobbyResultsRematchBtn")
        page.wait_for_timeout(1500)
        assert not page.is_visible("#lobbyResultsModal.open"), "Checkers: modal still open after rematch"
        print("Checkers rematch OK!")

        # 2. Реверси (Reversi)
        print("Checking reversi rematch...")
        page.goto(f"{BASE}/reversi", wait_until="networkidle")
        page.fill("input:visible", "Host")
        page.click("button:has-text('Создать')")
        page.wait_for_timeout(1000)
        page.click("button[onclick*='add_bot']")
        page.wait_for_timeout(1500)

        page.evaluate("""() => {
            st.done = true;
            st.winner = window.pid;
            handle(st);
        }""")
        page.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        assert page.is_visible("#lobbyResultsRematchBtn"), "Reversi: rematch button not visible"
        page.click("#lobbyResultsRematchBtn")
        page.wait_for_timeout(1500)
        assert not page.is_visible("#lobbyResultsModal.open"), "Reversi: modal still open after rematch"
        print("Reversi rematch OK!")

        # 3. Точки (Dots)
        print("Checking dots rematch...")
        page.goto(f"{BASE}/dots", wait_until="networkidle")
        page.fill("input:visible", "Host")
        page.click("button:has-text('Создать')")
        page.wait_for_timeout(1000)
        page.click("button[onclick*='add_bot']")
        page.wait_for_timeout(1500)

        page.evaluate("""() => {
            st.done = true;
            st.winner = window.pid;
            handle(st);
        }""")
        page.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        assert page.is_visible("#lobbyResultsRematchBtn"), "Dots: rematch button not visible"
        page.click("#lobbyResultsRematchBtn")
        page.wait_for_timeout(1500)
        assert not page.is_visible("#lobbyResultsModal.open"), "Dots: modal still open after rematch"
        print("Dots rematch OK!")

        # 4. Коридор (Quoridor)
        print("Checking quoridor rematch...")
        page.goto(f"{BASE}/quoridor", wait_until="networkidle")
        page.fill("input:visible", "Host")
        page.click("button:has-text('Создать')")
        page.wait_for_timeout(1000)
        page.click("button[onclick*='addBot']")
        page.wait_for_timeout(800)
        page.click("#start-btn")
        page.wait_for_selector("#game:not(.hide)", timeout=5000)

        page.evaluate("""() => {
            state.winner = pid;
            renderGame();
        }""")
        page.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        assert page.is_visible("#lobbyResultsRematchBtn"), "Quoridor: rematch button not visible"
        page.click("#lobbyResultsRematchBtn")
        page.wait_for_timeout(1500)
        assert not page.is_visible("#lobbyResultsModal.open"), "Quoridor: modal still open after rematch"
        print("Quoridor rematch OK!")

        # 5. Дурак (Durak - партийная игра с ботами)
        print("Checking durak party rematch...")
        page.goto(f"{BASE}/durak", wait_until="networkidle")
        page.fill("input:visible", "Host")
        page.click("button:has-text('Создать')")
        page.wait_for_timeout(1000)
        # Добавляем 2 ботов
        page.click("button[onclick*='add_bot']")
        page.wait_for_timeout(800)
        page.click("button[onclick*='add_bot']")
        page.wait_for_timeout(800)
        # Начинаем партию
        page.click("#startbtn")
        page.wait_for_selector("#game:not(.hide)", timeout=5000)

        # Проверяем, что в игре 3 игрока (хост + 2 бота) без дублей по ID
        initial_ids = page.evaluate("() => Object.keys(st.names || {})")
        assert len(initial_ids) == 3, f"Durak: expected 3 player IDs initially, got {len(initial_ids)}"
        assert len(initial_ids) == len(set(initial_ids)), f"Durak: duplicate player IDs initially: {initial_ids}"

        # Завершаем партию: назначаем дураком одного из ботов
        page.evaluate("""() => {
            const botId = Object.keys(st.names || {}).find(k => k.startsWith('bot_')) || 'bot_1';
            st.durak = botId;
            st.is_draw = false;
            handle(st);
        }""")
        page.wait_for_selector("#lobbyResultsModal.open", timeout=3000)
        assert page.is_visible("#lobbyResultsRematchBtn"), "Durak: rematch button not visible"
        print("Durak results modal opened. Clicking Rematch...")
        page.click("#lobbyResultsRematchBtn")
        page.wait_for_timeout(1500)
        assert not page.is_visible("#lobbyResultsModal.open"), "Durak: modal still open after rematch"

        # Проверяем состав игроков после реванша: возврат в лобби с теми же 3 игроками, без дублей
        page.wait_for_selector("#lobby:not(.hide)", timeout=5000)
        player_names = page.evaluate("""() => {
            return Array.from(document.querySelectorAll('#players .player-row-item')).map(el => {
                const s = el.querySelector('span');
                return s ? s.textContent.trim() : el.textContent.trim();
            });
        }""")
        assert len(player_names) == 3, f"Durak: expected 3 players in lobby after rematch, got {len(player_names)}: {player_names}"
        print(f"Durak rematch OK: returned to lobby with {player_names} without duplicates!")

        b.close()
        print("ALL 5 REMATCH CHECKS PASSED!")

if __name__ == "__main__":
    test_rematch()
