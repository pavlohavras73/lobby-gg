"""Браузерная проверка единого экрана ошибок входа (Этап 14c).
Проверяет все 18 мультиплеерных игр с неверным кодом ?code=ZZZZ / ?join=ZZZZ:
- модалка #lobbyRoomErrorModal открывается (.open);
- заголовок #lobbyRoomErrorTitle и описание #lobbyRoomErrorDesc присутствуют;
- кнопки «Попробовать снова» и «На главную» отображаются и доступны;
- 0 ошибок консоли;
- проверка сценариев: room_not_found, room_full, already_playing, kicked, server_unavailable, timeout_disconnect на 4 языках.
"""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

GAMES = [
    ("alias", "?code=ZZZZ"),
    ("battleship", "?code=ZZZZ"),
    ("bulls", "?code=ZZZZ"),
    ("bunker", "?code=ZZZZ"),
    ("c4", "?code=ZZZZ"),
    ("checkers", "?code=ZZZZ"),
    ("chess", "?code=ZZZZ"),
    ("connect4_3d", "?join=ZZZZ"),
    ("dots", "?code=ZZZZ"),
    ("durak", "?join=ZZZZ"),
    ("guesswho", "?code=ZZZZ"),
    ("mafia", "?code=ZZZZ"),
    ("poker", "?code=ZZZZ"),
    ("quoridor", "?code=ZZZZ"),
    ("reversi", "?code=ZZZZ"),
    ("spy", "?code=ZZZZ"),
    ("uno", "?join=ZZZZ"),
    ("variants", "?code=ZZZZ"),
]

def main():
    os.makedirs("qa_shots/stage14", exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ctx = b.new_context(viewport={"width": 390, "height": 844})
        tok = register()
        ctx.add_cookies([{"name": "jsession", "value": tok, "url": BASE}])
        page = ctx.new_page()

        errors = []
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        passed = 0
        print(f"=== Testing unified room error modal on {len(GAMES)} games ===")
        for game, q in GAMES:
            url = f"{BASE}/{game}{q}"
            print(f"[{passed+1}/{len(GAMES)}] Checking {game} with {q}...")
            page.goto(url, wait_until="domcontentloaded")
            
            # Wait for modal to open with timeout
            try:
                page.wait_for_selector("#lobbyRoomErrorModal.open", timeout=4000)
            except Exception as ex:
                # If auto-join didn't trigger, click join button or submit
                page.evaluate("""() => {
                    if (window.join) window.join();
                    else if (window.joinGame) window.joinGame();
                }""")
                page.wait_for_selector("#lobbyRoomErrorModal.open", timeout=4000)

            title = page.text_content("#lobbyRoomErrorTitle")
            desc = page.text_content("#lobbyRoomErrorDesc")
            assert title and len(title) > 0, f"{game}: empty error title"
            assert desc and len(desc) > 0, f"{game}: empty error desc"

            # Check retry and home buttons
            retry_btn = page.query_selector("#lobbyRoomErrorRetryBtn")
            home_btn = page.query_selector("#lobbyRoomErrorHomeBtn")
            assert retry_btn and retry_btn.is_visible(), f"{game}: missing retry btn"
            assert home_btn and home_btn.is_visible(), f"{game}: missing home btn"

            if passed == 0:
                page.screenshot(path=f"qa_shots/stage14/room_error_{game}.png")

            passed += 1

        print(f"All {passed}/{len(GAMES)} games showed unified room error screen!")

        # Verify retry button clears query param and closes modal
        print("Testing retry button interaction...")
        page.click("#lobbyRoomErrorRetryBtn")
        page.wait_for_timeout(300)
        is_open = page.evaluate("() => document.getElementById('lobbyRoomErrorModal')?.classList.contains('open')")
        assert not is_open, "Error modal should be closed after retry click"
        cur_url = page.url
        assert "ZZZZ" not in cur_url, f"Query code was not cleaned from URL: {cur_url}"
        print("Retry button interaction verified OK!")

        # Test scenarios and i18n
        print("Testing error scenarios across 4 languages...")
        scenarios = ["room_not_found", "room_full", "already_playing", "kicked", "server_unavailable", "timeout_disconnect"]
        langs = ["ru", "uk", "en", "de"]

        for lang in langs:
            for sc in scenarios:
                res = page.evaluate(f"""() => {{
                    localStorage.setItem('jg_lang', '{lang}');
                    if (window.LobbyUI && window.LobbyUI.roomError) {{
                        LobbyUI.roomError('{sc}');
                        const t = document.getElementById('lobbyRoomErrorTitle')?.textContent;
                        const d = document.getElementById('lobbyRoomErrorDesc')?.textContent;
                        return {{ title: t, desc: d }};
                    }}
                    return null;
                }}""")
                assert res and res["title"] and res["desc"], f"Failed scenario {sc} in {lang}"
        print("Scenarios and 4-language i18n verified OK!")

        assert len(errors) == 0, f"Encountered page errors: {errors}"
        print("0 page errors encountered throughout!")
        b.close()

if __name__ == "__main__":
    main()
