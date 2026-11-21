"""Утилита для честных скриншотов страниц (iPhone 390x844).
- Окно правил гарантированно отключено через jg_rules_seen_* в localStorage.
- STATE=game — переводит страницу в состояние активной партии с ботом, где это возможно.
- STATE=lobby (по умолчанию) — честное чистое состояние лобби без модалок.

Запуск:
  uv run --with playwright python tests/browser_shots.py quoridor checkers ...
  STATE=game uv run --with playwright python tests/browser_shots.py quoridor fifteen ...
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

PAGES = sys.argv[1:]
if not PAGES:
    print("Использование: python tests/browser_shots.py [PAGE...]")
    sys.exit(0)

SHOTS_DIR = os.environ.get("SHOTS_DIR", "qa_shots/stage17")
STATE = os.environ.get("STATE", "lobby")
LANG = os.environ.get("LOBBY_LANG", "ru")

os.makedirs(SHOTS_DIR, exist_ok=True)

def shoot_page(context, name):
    url = f"{BASE}/{'' if name == 'index' else name}"
    page = context.new_page()

    # Гарантируем, что окно правил не откроется
    init_js = f"""
    try {{
      localStorage.setItem('jg_lang', '{LANG}');
      localStorage.setItem('jg_rules_seen', '1');
      localStorage.setItem('jg_rules_seen_all', '1');
      localStorage.setItem('jg_rules_seen_{name}', '1');
      localStorage.setItem('jg_rules_modal_dismissed', '1');
    }} catch(e) {{}}
    """
    page.add_init_script(init_js)

    try:
        page.goto(url, wait_until="networkidle", timeout=30000)
    except Exception:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(600)

    # Дополнительно закрываем любую модалку правил, если вдруг выскочила
    page.evaluate("""() => {
      document.querySelectorAll('.rules-modal-overlay, #rulesModal, [data-dismiss="backdrop"]').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('open', 'active');
      });
      document.body.classList.remove('modal-open');
    }""")

    if STATE == "game":
        # Переводим страницу в партию с ботом
        try:
            if name in ["quoridor", "checkers", "reversi", "dots", "bulls", "connect4_3d", "c4", "chess", "battleship"]:
                # Дуэли с комнатами: создать комнату и добавить бота
                page.evaluate("""() => {
                  if (typeof create === 'function') create();
                  else if (typeof createRoom === 'function') createRoom();
                }""")
                page.wait_for_timeout(1000)
                page.evaluate("""() => {
                  const botBtn = document.querySelector('.opts.botdiff + button, button[onclick*="add_bot"], [data-i18n="add_bot_btn"]');
                  if (botBtn) botBtn.click();
                  else if (window.__lastWS) window.__lastWS.send(JSON.stringify({action:'add_bot', diff:'easy'}));
                }""")
                page.wait_for_timeout(1500)
            elif name == "arrows":
                page.evaluate("""() => {
                  const s = document.getElementById('startBtn') || document.querySelector('.btn-primary');
                  if (s) s.click();
                }""")
                page.wait_for_timeout(1000)
            elif name == "fifteen":
                # Пятнашки сразу на экране, сделаем 1 ход
                page.evaluate("""() => {
                  const tiles = document.querySelectorAll('.t');
                  if (tiles.length > 0) tiles[0].click();
                }""")
                page.wait_for_timeout(500)
        except Exception as e:
            print(f"[{name}] Предупреждение при переходе в game: {e}")

    page.wait_for_timeout(800)
    out_path = os.path.join(SHOTS_DIR, f"{name}_{STATE}.png")
    page.screenshot(path=out_path)
    print(f"Скриншот сохранён: {out_path} (exists={os.path.exists(out_path)})")
    page.close()
    return out_path

def main():
    token = register()
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            has_touch=True
        )
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        for page_name in PAGES:
            shoot_page(ctx, page_name)
        ctx.close()
        browser.close()

if __name__ == "__main__":
    main()
