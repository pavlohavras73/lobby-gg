"""Тест ранней инициализации в shell.js:
1) Настройка «меньше анимаций» (jg_rm=1) применяется сразу (html.rm) без открытия шторки.
2) Событие beforeinstallprompt перехватывается сразу при загрузке страницы, и последующий
   клик по «Установить приложение» вызывает prompt().
3) Счётчик входящих заявок в друзья (hp-badge) заполняется после загрузки без открытия шторки.

Запуск:
  LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_shell_eager.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright


def test_reduced_motion(b, token):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    ctx.add_init_script("localStorage.setItem('jg_rm', '1')")
    pg = ctx.new_page()
    pg.goto(BASE + "/", wait_until="domcontentloaded")
    pg.wait_for_timeout(300)
    has_rm = pg.evaluate("() => document.documentElement.classList.contains('rm')")
    ctx.close()
    print("1. Reduced motion eager:", "✅ PASS" if has_rm else "❌ FAIL", flush=True)
    return has_rm


def test_beforeinstallprompt(b, token):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    # До открытия шторки или даже при загрузке шлём beforeinstallprompt
    ctx.add_init_script("""
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                const evt = new Event('beforeinstallprompt');
                evt.prompt = function () { window.__promptCalled = true; };
                evt.userChoice = Promise.resolve({ outcome: 'accepted' });
                window.dispatchEvent(evt);
            }, 50);
        });
    """)
    pg = ctx.new_page()
    pg.goto(BASE + "/", wait_until="networkidle")
    pg.wait_for_timeout(500)

    # Теперь открываем шторку настроек и нажимаем кнопку установки
    pg.click("button[data-tab='settings']:visible")
    pg.wait_for_selector("#set-install-btn", timeout=4000)
    pg.click("#set-install-btn")
    pg.wait_for_timeout(500)
    prompt_called = pg.evaluate("() => Boolean(window.__promptCalled)")
    ctx.close()
    print("2. beforeinstallprompt eager:", "✅ PASS" if prompt_called else "❌ FAIL", flush=True)
    return prompt_called


def test_friends_badge(b, token):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
    # Route mock для /friends
    ctx.route("**/friends", lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps({
            "friends": [],
            "incoming": [{"username": "alice", "display_name": "Alice"}],
            "outgoing": []
        })
    ))
    pg = ctx.new_page()
    pg.goto(BASE + "/", wait_until="networkidle")
    # Без открытия шторки ждём появления бэйджа
    badge_visible = False
    try:
        pg.wait_for_selector("#hp-badge:visible", timeout=4000)
        txt = pg.inner_text("#hp-badge")
        badge_visible = "1" in txt
    except Exception:
        badge_visible = False

    ctx.close()
    print("3. Friends badge eager:", "✅ PASS" if badge_visible else "❌ FAIL", flush=True)
    return badge_visible


def main():
    token = register()
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        ok1 = test_reduced_motion(b, token)
        ok2 = test_beforeinstallprompt(b, token)
        ok3 = test_friends_badge(b, token)
        b.close()

    all_ok = ok1 and ok2 and ok3
    print("\nИТОГ browser_shell_eager:", "OK" if all_ok else "FAIL")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
