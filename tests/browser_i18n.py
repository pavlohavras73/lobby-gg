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
            for lang in ("ru", "uk", "en"):
                page.goto(f"{BASE}/static/{name}.html")
                page.evaluate("l => localStorage.setItem('jg_lang', l)", lang)
                page.reload()
                page.wait_for_timeout(400)
                by_lang[lang] = texts(page)
            ru, uk, en = by_lang["ru"], by_lang["uk"], by_lang["en"]
            changed_en = sum(1 for k in ru if ru[k] and en.get(k) and en[k] != ru[k])
            changed_uk = sum(1 for k in ru if ru[k] and uk.get(k) and uk[k] != ru[k])
            total = len(ru)
            # большинство текстов должно меняться (эмодзи/названия-бренды могут совпадать)
            ok = not errors and total > 0 and changed_en >= total * 0.6 and changed_uk >= total * 0.4
            ok_all.append(ok)
            print(("✅" if ok else "❌"), f"{name}: элементов {total}, изменилось en {changed_en}, uk {changed_uk}"
                  + (f" | JS-ошибки: {errors[:2]}" if errors else "")
                  + f" | пример en: {next((en[k] for k in en if en[k] != ru.get(k)), '')[:40]!r}")
            ctx.close()
        browser.close()
    print(f"\nИтого: {sum(ok_all)}/{len(ok_all)}")
    sys.exit(0 if all(ok_all) else 1)


if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    main(sys.argv[1:])
