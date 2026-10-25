"""Браузерный тест автопереподключения: настоящая страница игры в headless Chromium.

Игрок создаёт партию с ботом, у страницы рвётся WebSocket — проверяем, что страница
сама вернулась в ТУ ЖЕ комнату на ТО ЖЕ место (а не создала новую и не «умерла»).
Запуск (нужен сервер на LOBBY_BASE, см. tests/run_smoke.sh):
  uv run --with playwright python tests/browser_reconnect.py chess checkers ...
"""
import json
import os
import random
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090")
PARTY = set() if os.environ.get("NO_START") else {"quoridor", "durak", "uno", "poker", "mafia", "bunker", "spy", "alias"}  # NO_START=1 — рвём связь ещё в лобби
CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)  # None — Chromium из Playwright (CI)


def register():
    # LOBBY_DEMO=user:password — войти существующим аккаунтом (для живого сайта, без создания новых)
    demo = os.environ.get("LOBBY_DEMO")
    name, pw, path = (demo.split(":", 1) + ["/auth/login"]) if demo else (f"b{random.randint(10000, 99999)}", "test123456", "/auth/register")
    req = urllib.request.Request(BASE + path,
                                 data=json.dumps({"username": name, "password": pw}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return r.headers.get("set-cookie", "").split(";")[0].split("=", 1)[1]


def check_game(page, game):
    page.goto(f"{BASE}/{game}")
    page.wait_for_load_state("domcontentloaded")
    page.fill("#name", "Тест")
    # перехватываем всё, что страница шлёт и получает по WS
    page.evaluate("""() => {
        window.__sent = []; window.__got = [];
        const S = WebSocket.prototype.send;
        WebSocket.prototype.send = function (d) { try { window.__sent.push(JSON.parse(d)); } catch (e) {} return S.apply(this, arguments); };
        const W = window.WebSocket;
        window.WebSocket = function (u, p) { const s = p ? new W(u, p) : new W(u); window.__lastWS = s;
            s.addEventListener('message', ev => { try { window.__got.push(JSON.parse(ev.data)); } catch (e) {} }); return s; };
        window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, {CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3});
    }""")
    page.evaluate("() => create()")
    page.wait_for_function("() => window.__got.some(m => m.type === 'joined')", timeout=8000)
    first = page.evaluate("() => window.__got.find(m => m.type === 'joined')")
    page.evaluate("() => window.__lastWS.send(JSON.stringify({action: 'add_bot', diff: 'easy'}))")
    page.wait_for_timeout(800)
    if game in PARTY:   # пати-игры ждут старта от хозяина; без старта комната в лобби
        page.evaluate("() => window.__lastWS.send(JSON.stringify({action: 'add_bot', diff: 'easy'}))")
        page.wait_for_timeout(300)
        page.evaluate("() => window.__lastWS.send(JSON.stringify({action: 'start'}))")
    page.wait_for_timeout(1500)
    sockets_before = page.evaluate("() => window.__sent.filter(m => m.action === 'create').length")
    # обрыв связи (как пропавший мобильный интернет)
    page.evaluate("() => window.__lastWS.close()")
    try:
        page.wait_for_function(
            "(code) => window.__got.filter(m => m.type === 'joined').length >= 2", arg=first["code"], timeout=12000)
    except Exception:
        tail = page.evaluate("() => window.__got.slice(-4).map(m => m.type + (m.msg ? ':' + m.msg : ''))")
        sent = page.evaluate("() => window.__sent.slice(-3).map(m => m.action || m.type)")
        return False, f"после обрыва нет второго joined | последние ответы: {tail} | последние отправки: {sent}"
    joined = page.evaluate("() => window.__got.filter(m => m.type === 'joined')")
    creates = page.evaluate("() => window.__sent.filter(m => m.action === 'create').length")
    second = joined[-1]
    if creates > sockets_before:
        return False, f"при переподключении создала НОВУЮ комнату ({first['code']} → {second['code']})"
    if second["code"] != first["code"] or second["pid"] != first["pid"]:
        return False, f"вернулась не туда: {first['code']}/{first['pid']} → {second['code']}/{second['pid']}"
    return True, f"вернулась в {second['code']} на прежнее место ({second['pid']})"


def main(games):
    token = register()
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        for game in games:
            ctx = browser.new_context()
            ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            try:
                ok, info = check_game(page, game)
            except Exception as e:
                ok, info = False, f"тест упал: {type(e).__name__}: {str(e)[:120]}"
            if errors:
                info += f" | JS-ошибки: {errors[:2]}"
            results.append(ok)
            print(("✅" if ok else "❌"), f"{game}: {info}")
            ctx.close()
        browser.close()
    print(f"\nИтого: {sum(results)}/{len(results)}")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main(sys.argv[1:] or ["chess", "checkers"])
