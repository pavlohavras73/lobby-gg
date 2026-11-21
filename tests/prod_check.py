"""Проверка живого сайта на проде: https://promo-dev.duckdns.org/games/
ТОЛЬКО ЧТЕНИЕ: без регистрации, без отправки форм, без создания комнат.
Открывает все 34 страницы на 390px, собирает ошибки консоли, 404/500 и время загрузки.
"""
import os
import re
import sys
import time
from playwright.sync_api import sync_playwright

PROD_BASE = os.environ.get("PROD_BASE", "https://promo-dev.duckdns.org/games")
CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)

PAGES = [
    "index", "profile", "leaderboard", "learn", "alias", "arrows", "battleship",
    "bulls", "bunker", "c4", "connect4_3d", "checkers", "chess", "dots", "durak",
    "fifteen", "g2048", "geobunker", "geostake", "guesswho", "mafia", "mines",
    "poker", "quoridor", "race", "raskol", "reversi", "snake", "space_invaders",
    "spy", "tetris", "uno", "variants", "wordle"
]

IGNORE_CONSOLE = re.compile(r"favicon|ResizeObserver loop|serviceWorker|sw\.js|net::ERR_ABORTED", re.I)

def check_prod():
    print(f"Запуск проверки живого сайта: {PROD_BASE} (всего {len(PAGES)} страниц, viewport 390x844)...")
    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM,
            headless=True,
            args=["--no-sandbox", "--disable-gpu"]
        )

        for name in PAGES:
            ctx = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
            )
            # Не создаём сессию и не регистрируемся (строго без создания аккаунтов)
            page = ctx.new_page()

            console_errors = []
            js_errors = []
            bad_http = []

            page.on("console", lambda m: console_errors.append(m.text[:120]) if m.type == "error" and not IGNORE_CONSOLE.search(m.text) else None)
            page.on("pageerror", lambda e: js_errors.append(str(e)[:120]))
            page.on("response", lambda r: bad_http.append(f"{r.status}: {r.url.split('/games/')[-1][:40]}") if r.status >= 400 and not IGNORE_CONSOLE.search(r.url) else None)

            url = f"{PROD_BASE}/" if name == "index" else f"{PROD_BASE}/{name}"
            status_code = None
            final_url = None
            t0 = time.perf_counter()

            try:
                resp = page.goto(url, wait_until="load", timeout=25000)
                status_code = resp.status if resp else None
                page.wait_for_timeout(600)
                final_url = page.url
            except Exception as e:
                bad_http.append(f"TIMEOUT/ERR: {str(e)[:60]}")

            elapsed_ms = round((time.perf_counter() - t0) * 1000)
            ctx.close()

            is_redirected = final_url and ("/login" in final_url and name != "login")
            status_str = f"{status_code} -> login" if is_redirected else str(status_code)

            all_errors = js_errors + console_errors + bad_http
            results.append({
                "page": name,
                "status": status_str,
                "time_ms": elapsed_ms,
                "errors": all_errors
            })

            err_tag = f"❌ {len(all_errors)} errors" if all_errors else "✅ OK"
            print(f"[{len(results)}/34] {name:<16}: {status_str:<12} | {elapsed_ms:>5} ms | {err_tag}")

        browser.close()

    print("\n" + "=" * 90)
    print("ИТОГОВАЯ ТАБЛИЦА ПРОВЕРКИ ЖИВОГО САЙТА (PROD CHECK):")
    print(f"{'№':<3} | {'Страница':<16} | {'HTTP Статус':<15} | {'Время (мс)':<10} | {'Ошибки (JS / Консоль / 4xx / 5xx)':<35}")
    print("-" * 90)
    for i, r in enumerate(results, 1):
        err_str = "; ".join(r["errors"][:2]) if r["errors"] else "—"
        if len(err_str) > 35: err_str = err_str[:32] + "..."
        print(f"{i:<3} | {r['page']:<16} | {r['status']:<15} | {r['time_ms']:<10} | {err_str:<35}")
    print("=" * 90)

    total_errs = sum(len(r["errors"]) for r in results)
    print(f"Всего страниц проверено: {len(results)}/34 | Ошибок обнаружено: {total_errs}")

if __name__ == "__main__":
    check_prod()
