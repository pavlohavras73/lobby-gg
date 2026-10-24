"""Браузерная проверка переводов: страница открывается на uk/ru/en без JS-ошибок,
и тексты с data-i18n действительно меняются при смене языка.
Запуск (сервер на LOBBY_BASE, см. tests/run_smoke.sh):
  uv run --with playwright python tests/browser_i18n.py fifteen tetris ...
"""
import os
import sys

from browser_reconnect import BASE, CHROMIUM, register  # тот же вход и тот же Chromium
from playwright.sync_api import sync_playwright

ROUTES = {"g2048": "2048"}  # страницы, у которых маршрут отличается от имени файла
# языки, кроме русского, которые должны работать; немецкий: LOBBY_LANGS=uk,en,de
EXTRA = os.environ.get("LOBBY_LANGS", "uk,en").split(",")


def texts(page):
    return page.evaluate("""() => Object.fromEntries([...document.querySelectorAll('[data-i18n]')]
        .map(e => [e.getAttribute('data-i18n'), e.textContent.trim()]))""")


def main(pages):
    token = register()
    ok_all = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True)
        for name in pages:
            ctx = browser.new_context()
            ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)[:120]))
            by_lang = {}
            for lang in ["ru"] + EXTRA:
                page.goto(f"{BASE}/static/{name}.html")
                page.evaluate("l => localStorage.setItem('jg_lang', l)", lang)
                page.reload()
                page.wait_for_timeout(400)
                by_lang[lang] = texts(page)
            ru = by_lang["ru"]
            total = len(ru)
            changed = {l: sum(1 for k in ru if ru[k] and by_lang[l].get(k) and by_lang[l][k] != ru[k]) for l in EXTRA}
            # большинство текстов должно меняться (эмодзи/бренды могут совпадать); украинский ближе к русскому
            need = {l: (0.4 if l == "uk" else 0.6) for l in EXTRA}
            ok = not errors and total > 0 and all(changed[l] >= total * need[l] for l in EXTRA)
            ok_all.append(ok)
            last = EXTRA[-1]
            print(("✅" if ok else "❌"), f"{name}: элементов {total}, изменилось " + ", ".join(f"{l} {changed[l]}" for l in EXTRA)
                  + (f" | JS-ошибки: {errors[:2]}" if errors else "")
                  + f" | пример {last}: {next((by_lang[last][k] for k in by_lang[last] if by_lang[last][k] != ru.get(k)), '')[:40]!r}")
            ctx.close()
        browser.close()
    print(f"\nИтого: {sum(ok_all)}/{len(ok_all)}")
    sys.exit(0 if all(ok_all) else 1)


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    main(sys.argv[1:])
