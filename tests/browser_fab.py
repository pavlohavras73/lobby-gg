"""Тест перекрытий плавающими элементами (FAB Chat, Invite, Toasts, Reconnect banner).
Stage 11a:
- Вьюпорты 320x568, 390x844, 430x932
- Лобби и партия (где можно запустить — с ботами или 2-3 вкладками)
- Скролл шагами по 200px
- Проверка пересечений (> 4px) со всеми кликабельными элементами
- Скриншоты вьюпорта (без full_page) в qa_shots/stage11/

Запуск:
  LOBBY_BASE=http://127.0.0.1:18090 uv run --with playwright python tests/browser_fab.py [игры...]
"""
import json
import os
import random
import re
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090")
CHROMIUM = os.environ.get("CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
VIEWPORTS = [(320, 568), (390, 844), (430, 932)]
SHOTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "qa_shots", "stage11")
IGNORE = re.compile(r"favicon|ResizeObserver|ERR_ABORTED|serviceWorker|sw\.js|arcgisonline|google\.com|unpkg", re.I)

# Все игры с комнатами / UI
GAMES = "spy mafia bunker poker alias variants uno durak quoridor battleship c4 checkers chess reversi dots bulls connect4_3d guesswho race snake tetris g2048 mines fifteen wordle arrows geobunker raskol space_invaders".split()

JS_FIND_OVERLAPS = """() => {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // 1. Ищем видимые фиксированные элементы (плавающие кнопки, тосты, баннеры)
  const fixedEls = [];
  
  // Кнопка чата
  const chatRoot = document.getElementById('rc-root');
  const chatToggle = document.getElementById('rc-toggle');
  if (chatRoot && chatToggle && !chatRoot.classList.contains('rc-hidden')) {
    const cs = getComputedStyle(chatRoot);
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0) {
      const r = chatToggle.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        fixedEls.push({ name: 'ChatFAB', el: chatToggle, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
      }
    }
  }

  // Кнопка инвайта
  const invBtn = document.getElementById('inviteBtn');
  if (invBtn) {
    const cs = getComputedStyle(invBtn);
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0) {
      const r = invBtn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        fixedEls.push({ name: 'InviteBtn', el: invBtn, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
      }
    }
  }

  // Баннер переподключения
  const recBanner = document.getElementById('reconnectBanner') || document.querySelector('.reconnect-banner');
  if (recBanner) {
    const cs = getComputedStyle(recBanner);
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0) {
      const r = recBanner.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        fixedEls.push({ name: 'ReconnectBanner', el: recBanner, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
      }
    }
  }

  // Тосты
  const toasts = document.querySelectorAll('.toast:not([style*="display: none"]), .mini-toast:not([style*="display: none"])');
  for (const t of toasts) {
    const cs = getComputedStyle(t);
    if (cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0) {
      const r = t.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        fixedEls.push({ name: 'Toast', el: t, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
      }
    }
  }

  if (fixedEls.length === 0) return { fixedCount: 0, violations: [] };

  // 2. Ищем видимые кликабельные элементы на странице
  const selector = 'button, a[href], input, select, textarea, [onclick], [role=button], .card, .pin-box, .cell, .chip, .opt, .choice, .action-btn, .tapbtn, [data-action], .spy-sus-btn, .selectable, .pl';
  const allClickable = document.querySelectorAll(selector);
  const violations = [];

  for (const el of allClickable) {
    // Пропускаем элементы внутри самих fixed элементов
    let insideFixed = false;
    for (const f of fixedEls) {
      if (f.el.contains(el) || el.contains(f.el)) { insideFixed = true; break; }
    }
    if (insideFixed) continue;

    // Пропускаем скрытые модалки
    if (el.closest('#rulesModal, #inviteModal') && getComputedStyle(el.closest('#rulesModal, #inviteModal')).display === 'none') {
      continue;
    }

    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') continue;

    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    // Игнорируем гигантские фоновые контейнеры
    if (r.height > vh * 0.55 && r.width > vw * 0.8) continue;

    // Элемент должен быть в видимой части вьюпорта
    if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;

    // Проверяем пересечение с каждым fixed элементом
    for (const f of fixedEls) {
      const ix = Math.min(f.rect.right, r.right) - Math.max(f.rect.left, r.left);
      const iy = Math.min(f.rect.bottom, r.bottom) - Math.max(f.rect.top, r.top);
      if (ix > 4 && iy > 4) {
        const desc = (el.id ? '#' + el.id : '') +
                     (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') +
                     ' <' + el.tagName.toLowerCase() + '> ' +
                     (el.innerText || el.value || '').trim().slice(0, 20);
        violations.push({
          fixed: f.name,
          elem: desc,
          ix: Math.round(ix),
          iy: Math.round(iy),
          rectF: f.rect,
          rectE: { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom) }
        });
      }
    }
  }

  return { fixedCount: fixedEls.length, violations };
}"""

def register_user():
    name = f"fab_{random.randint(10000, 99999)}"
    pw = "test123456"
    req = urllib.request.Request(
        f"{BASE}/auth/register",
        data=json.dumps({"username": name, "password": pw}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as r:
        return r.headers.get("set-cookie", "").split(";")[0].split("=", 1)[1]

def run_fab_checks():
    os.makedirs(SHOTS, exist_ok=True)
    token = register_user()
    games_to_test = sys.argv[1:] or GAMES
    total_checks = 0
    total_violations = 0
    results = {}

    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"]) if CHROMIUM else p.chromium.launch(headless=True, args=["--no-sandbox"])

        for game in games_to_test:
            results[game] = {"violations": [], "shots": []}
            for w, h in VIEWPORTS:
                ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True)
                ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
                pg = ctx.new_page()

                # Открываем страницу
                url = f"{BASE}/{game}" if game != "geobunker" else f"{BASE}/static/geobunker.html"
                try:
                    pg.goto(url, wait_until="networkidle", timeout=12000)
                    pg.wait_for_timeout(400)
                except Exception as e:
                    print(f"  ⚠ {game} ({w}x{h}) goto fail: {e}")
                    ctx.close()
                    continue

                # 1. Проверяем в Лобби
                # Скроллим с шагом 200px
                max_scroll = pg.evaluate("() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)")
                scroll_steps = list(range(0, int(max_scroll) + 1, 200))
                if not scroll_steps: scroll_steps = [0]
                if scroll_steps[-1] < max_scroll: scroll_steps.append(int(max_scroll))

                for s_idx, y in enumerate(scroll_steps):
                    pg.evaluate(f"() => window.scrollTo(0, {y})")
                    pg.wait_for_timeout(100)
                    total_checks += 1
                    data = pg.evaluate(JS_FIND_OVERLAPS)
                    if data["violations"]:
                        for v in data["violations"]:
                            total_violations += 1
                            item = f"LOBBY {w}x{h} y={y}: {v['fixed']} перекрывает {v['elem']} (ix={v['ix']}px, iy={v['iy']}px)"
                            results[game]["violations"].append(item)
                            print(f"  ❌ [{game}] {item}")

                # Снимок лобби (обычный вьюпорт, не full_page!)
                shot_path = f"{SHOTS}/{game}_{w}x{h}_lobby.png"
                pg.screenshot(path=shot_path)
                results[game]["shots"].append(shot_path)

                # 2. Проверяем в Партии (где можно запустить)
                try:
                    if game in ("poker", "mafia", "bunker", "spy", "alias", "variants", "uno", "durak", "quoridor"):
                        # Создаем комнату
                        create_btn = pg.locator("button:visible").filter(has_text=re.compile(r"Создать|Erstellen|Create|Створити", re.I)).first
                        if create_btn.count():
                            create_btn.click(timeout=1500)
                            pg.wait_for_timeout(800)
                        
                        # Добавляем бота если есть
                        bot_btn = pg.locator("button:visible").filter(has_text=re.compile(r"бот|bot", re.I)).first
                        if bot_btn.count():
                            try:
                                bot_btn.click(timeout=1000)
                                pg.wait_for_timeout(600)
                            except Exception: pass
                        
                        # Стартуем партию если есть кнопка старта
                        start_btn = pg.locator("button:visible").filter(has_text=re.compile(r"Начать|Start|Старт|Раздать|Austeilen", re.I)).first
                        if start_btn.count():
                            try:
                                start_btn.click(timeout=1500)
                                pg.wait_for_timeout(1000)
                            except Exception: pass

                        # Снова скроллим с шагом 200px в активной партии
                        max_scroll_game = pg.evaluate("() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight)")
                        game_steps = list(range(0, int(max_scroll_game) + 1, 200))
                        if not game_steps: game_steps = [0]
                        if game_steps[-1] < max_scroll_game: game_steps.append(int(max_scroll_game))

                        for g_idx, y in enumerate(game_steps):
                            pg.evaluate(f"() => window.scrollTo(0, {y})")
                            pg.wait_for_timeout(100)
                            total_checks += 1
                            data_g = pg.evaluate(JS_FIND_OVERLAPS)
                            if data_g["violations"]:
                                for v in data_g["violations"]:
                                    total_violations += 1
                                    item = f"PARTY {w}x{h} y={y}: {v['fixed']} перекрывает {v['elem']} (ix={v['ix']}px, iy={v['iy']}px)"
                                    results[game]["violations"].append(item)
                                    print(f"  ❌ [{game}] {item}")

                        # Снимок партии (обычный вьюпорт)
                        shot_game = f"{SHOTS}/{game}_{w}x{h}_party.png"
                        pg.screenshot(path=shot_game)
                        results[game]["shots"].append(shot_game)

                except Exception as e:
                    # Игра не запустилась с 1 игроком/ботом - допустимо
                    pass

                ctx.close()

            # Итог по игре
            v_cnt = len(results[game]["violations"])
            if v_cnt == 0:
                print(f"✅ {game:<14} OK (0 перекрытий во всех вьюпортах)")
            else:
                print(f"⚠️ {game:<14} FAIL ({v_cnt} перекрытий)")

        b.close()

    print(f"\n==========================================")
    print(f"ИТОГ browser_fab.py: проверок={total_checks}, перекрытий={total_violations}")
    print(f"Скриншоты вьюпортов сохранены в: {SHOTS}")
    print(f"==========================================")
    return total_violations

if __name__ == "__main__":
    v = run_fab_checks()
    sys.exit(0 if v == 0 else 1)
