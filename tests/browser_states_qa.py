import os
import sys
import time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright
from browser_reconnect import register

CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090/games")
SHOTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "qa_shots", "stage16", "states")
os.makedirs(SHOTS, exist_ok=True)

def test_states():
    token = register()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        ctx.add_init_script("try{localStorage.setItem('jg_lang','ru')}catch(e){}")
        page = ctx.new_page()

        # ----------------------------------------------------------------------
        # 1. LEADERBOARD STATES
        # ----------------------------------------------------------------------
        print("Testing Leaderboard states...")
        # 1a. Skeleton
        page.route("**/leaderboard?**", lambda route: None)
        page.goto(f"{BASE}/leaderboard#c4", wait_until="domcontentloaded")
        page.wait_for_selector(".sk-row", timeout=5000)
        page.screenshot(path=f"{SHOTS}/leaderboard_skeleton.png")
        print("  -> Saved leaderboard_skeleton.png")
        page.unroute("**/leaderboard?**")

        # 1b. Empty state
        page.route("**/leaderboard?**", lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true,"leaderboard":[]}'))
        page.goto(f"{BASE}/leaderboard#c4", wait_until="load")
        page.wait_for_selector("#lbEmpty .empty-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/leaderboard_empty.png")
        print("  -> Saved leaderboard_empty.png")
        page.unroute("**/leaderboard?**")

        # 1c. Error & Retry state
        page.route("**/leaderboard?**", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"server"}'))
        page.click('.gtab[data-game="chess"]')
        page.wait_for_selector("#lbEmpty .error-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/leaderboard_error_retry.png")
        print("  -> Saved leaderboard_error_retry.png")
        page.unroute("**/leaderboard?**")

        # ----------------------------------------------------------------------
        # 2. PROFILE STATES
        # ----------------------------------------------------------------------
        print("Testing Profile states...")
        # 2a. Skeleton
        page.route("**/games/me", lambda route: None)
        page.goto(f"{BASE}/profile", wait_until="domcontentloaded")
        page.wait_for_selector("#pAvatar.sk-shimmer", timeout=5000)
        page.screenshot(path=f"{SHOTS}/profile_skeleton.png")
        print("  -> Saved profile_skeleton.png")
        page.unroute("**/games/me")

        # 2b. Empty History state (fresh user has 0 games)
        page.goto(f"{BASE}/profile", wait_until="load")
        page.wait_for_selector(".empty-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/profile_empty_history.png")
        print("  -> Saved profile_empty_history.png")

        # 2c. Error & Retry state (HTTP 500)
        page.route("**/games/me", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"fail"}'))
        page.goto(f"{BASE}/profile", wait_until="load")
        page.wait_for_selector("#profileErrorContainer .error-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/profile_error_retry.png")
        print("  -> Saved profile_error_retry.png")
        page.unroute("**/games/me")

        # ----------------------------------------------------------------------
        # 3. LEARN STATES
        # ----------------------------------------------------------------------
        print("Testing Learn states...")
        # 3a. Skeleton
        page.route("**/learn/api/courses", lambda route: None)
        page.goto(f"{BASE}/learn", wait_until="domcontentloaded")
        page.wait_for_selector(".course-card .sk-shimmer", timeout=5000)
        page.screenshot(path=f"{SHOTS}/learn_skeleton.png")
        print("  -> Saved learn_skeleton.png")
        page.unroute("**/learn/api/courses")

        # 3b. Empty state
        page.route("**/learn/api/courses", lambda route: route.fulfill(status=200, content_type="application/json", body='{"ok":true,"courses":[],"stats":{"streak":0,"total_xp":0}}'))
        page.goto(f"{BASE}/learn", wait_until="load")
        page.wait_for_selector("#course-container .empty-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/learn_empty.png")
        print("  -> Saved learn_empty.png")
        page.unroute("**/learn/api/courses")

        # 3c. Error & Retry state
        page.route("**/learn/api/courses", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"fail"}'))
        page.goto(f"{BASE}/learn", wait_until="load")
        page.wait_for_selector("#course-container .error-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/learn_error_retry.png")
        print("  -> Saved learn_error_retry.png")
        page.unroute("**/learn/api/courses")

        # ----------------------------------------------------------------------
        # 4. FRIENDS DRAWER STATES (via index)
        # ----------------------------------------------------------------------
        print("Testing Friends drawer states...")
        # 4a. Skeleton
        # Шторка подгружается в фоне сразу после load и тут же грузит друзей (этап 17),
        # поэтому задержку ставим ДО загрузки страницы: скелетон виден, пока данных ещё нет.
        # time.sleep в обработчике блокирует сам Playwright — держим запросы без ответа и отвечаем после проверки
        held = []
        page.route("**/games/friends", lambda route: held.append(route))
        page.goto(f"{BASE}/", wait_until="load")
        page.evaluate("window.LobbyShell.open('friends')")
        page.wait_for_selector("#fr-friends-list .sk-shimmer", timeout=5000)
        page.screenshot(path=f"{SHOTS}/friends_skeleton.png")
        print("  -> Saved friends_skeleton.png")
        for r in held:
            r.fulfill(status=200, content_type="application/json", body='{"friends":[],"incoming":[],"outgoing":[]}')
        page.unroute("**/games/friends")

        # 4b. Empty state (0 friends)
        page.route("**/games/friends", lambda route: route.fulfill(status=200, content_type="application/json", body='{"friends":[],"incoming":[],"outgoing":[]}'))
        page.evaluate("window.LobbyShell.refreshFriends()")
        page.wait_for_selector("#fr-friends-list .empty-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/friends_empty.png")
        print("  -> Saved friends_empty.png")
        page.unroute("**/games/friends")

        # 4c. Error & Retry state
        page.route("**/games/friends", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"fail"}'))
        page.evaluate("window.LobbyShell.refreshFriends()")
        page.wait_for_selector("#fr-friends-list .error-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/friends_error_retry.png")
        print("  -> Saved friends_error_retry.png")
        page.unroute("**/games/friends")

        # ----------------------------------------------------------------------
        # 5. INDEX STATES
        # ----------------------------------------------------------------------
        print("Testing Index states...")
        # 5a. Skeleton
        page.route("**/games/invites", lambda route: None)
        page.goto(f"{BASE}/", wait_until="domcontentloaded")
        page.wait_for_selector("#inviteBanner .sk-shimmer", timeout=5000)
        page.screenshot(path=f"{SHOTS}/index_skeleton.png")
        print("  -> Saved index_skeleton.png")
        page.unroute("**/games/invites")

        # 5b. Empty search
        page.goto(f"{BASE}/", wait_until="load")
        page.fill("#gameSearch", "xyzunknownquery123")
        page.wait_for_selector("#noResults:not(.hide)", timeout=5000)
        page.screenshot(path=f"{SHOTS}/index_empty_search.png")
        print("  -> Saved index_empty_search.png")

        # 5c. Empty favorites
        page.click("#searchClear")
        page.evaluate("try{localStorage.setItem('jg_favorites','[]')}catch(e){}")
        page.click('#filters button[data-f="fav"]')
        page.wait_for_selector("#noResults:not(.hide)", timeout=5000)
        page.screenshot(path=f"{SHOTS}/index_empty_fav.png")
        print("  -> Saved index_empty_fav.png")

        # 5d. Empty recent
        page.evaluate("try{localStorage.setItem('jg_recent','[]')}catch(e){}")
        page.click('#filters button[data-f="recent"]')
        page.wait_for_selector("#noResults:not(.hide)", timeout=5000)
        page.screenshot(path=f"{SHOTS}/index_empty_recent.png")
        print("  -> Saved index_empty_recent.png")

        # 5e. Error retry on index (invites 500)
        page.route("**/games/invites", lambda route: route.fulfill(status=500, content_type="application/json", body='{"error":"server"}'))
        page.goto(f"{BASE}/", wait_until="load")
        page.wait_for_selector("#inviteBanner .error-state", timeout=5000)
        page.screenshot(path=f"{SHOTS}/index_error_retry.png")
        print("  -> Saved index_error_retry.png")
        page.unroute("**/games/invites")

        browser.close()
        print("ALL STATES VERIFIED AND SCREENSHOTS CAPTURED!")

if __name__ == "__main__":
    test_states()
