"""Что на экране осталось НЕ на выбранном языке (по умолчанию de): видимый текст, placeholder, title,
aria-label, value кнопок с кириллицей. Переключатель языков (#langbar) не считается.

Запуск (сервер как на проде, см. tests/serve_like_prod.sh):
  LOBBY_LANG=de uv run --offline --with playwright python tests/browser_untranslated.py index variants arrows ...
  CLICK="Solo|Start|Spielen" — после загрузки нажать первую видимую кнопку с таким текстом (чтобы увидеть экран игры).
Выход: по странице «✅ имя» или «❌ имя N строк» + до 8 примеров; код выхода 1, если что-то найдено.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright

LANG = os.environ.get("LOBBY_LANG", "de")
CLICK = os.environ.get("CLICK", "")
JS = r"""() => {
  const cyr = /[А-Яа-яЁёІіЇїЄєҐґ]/, out = new Set();
  const visible = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const skip = el => el.closest('#langbar, .langbar, script, style, noscript');
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const t = n.nodeValue.trim(), el = n.parentElement;
    if (t && cyr.test(t) && el && !skip(el) && visible(el)) out.add(t.slice(0, 80));
  }
  for (const el of document.querySelectorAll('[placeholder],[title],[aria-label],input[type=button],input[type=submit]')) {
    if (skip(el) || !visible(el)) continue;
    for (const a of ['placeholder', 'title', 'aria-label', 'value']) {
      const v = el.getAttribute(a); if (v && cyr.test(v)) out.add(`[${a}] ${v.slice(0, 70)}`);
    }
  }
  return [...out];
}"""


def main(pages):
    token = register()
    bad = 0
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
        for name in pages:
            ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
            ctx.add_init_script(f"try{{localStorage.setItem('jg_lang','{LANG}')}}catch(e){{}}")
            pg = ctx.new_page()
            pg.goto(BASE + "/" + ("" if name == "index" else name), wait_until="networkidle", timeout=30000)
            pg.wait_for_timeout(800)
            if CLICK:
                btn = pg.locator("button:visible, a:visible").filter(has_text=re.compile(CLICK, re.I)).first
                if btn.count():
                    btn.click(); pg.wait_for_timeout(1200)
            found = pg.evaluate(JS)
            if found:
                bad += 1
                print(f"❌ {name}: {len(found)} строк не на «{LANG}»", flush=True)
                for t in found[:8]:
                    print("     ·", t)
            else:
                print(f"✅ {name}", flush=True)
            ctx.close()
    print(f"\nИтого: {len(pages) - bad}/{len(pages)} без кириллицы на «{LANG}»")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
