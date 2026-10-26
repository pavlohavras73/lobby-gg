"""Ищет страницы шире экрана телефона (эмуляция iPhone). WIDTHS=320,360,375,390,430; NO_GUARD=1 отключает страховку overflow-x:clip.
Запуск: LOBBY_BASE=http://127.0.0.1:PORT/games uv run --offline --with playwright python tests/browser_overflow.py index race ..."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browser_reconnect import BASE, CHROMIUM, register
from playwright.sync_api import sync_playwright
PAGES = sys.argv[1:]
JS = """() => {
  const W = document.documentElement.clientWidth, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0) continue;
    if (r.right > W + 1 || r.left < -1) {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : '')) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']');
    }
  }
  return { sw: document.documentElement.scrollWidth, W, bad: [...new Set(out)].slice(0, 5) };
}"""
token = register()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROMIUM, headless=True) if CHROMIUM else p.chromium.launch(headless=True)
    for w in [int(x) for x in os.environ.get("WIDTHS", "390,375").split(",")]:
        ctx = b.new_context(viewport={"width": w, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
        ctx.add_cookies([{"name": "jsession", "value": token, "url": BASE}])
        pg = ctx.new_page()
        for name in PAGES:
            url = BASE + "/" + ("" if name == "index" else name)
            try:
                pg.goto(url, wait_until="networkidle", timeout=20000); pg.wait_for_timeout(600)
                if os.environ.get("NO_GUARD"): pg.add_style_tag(content="html,body{overflow-x:visible !important}")
                r = pg.evaluate(JS)
                flag = "✅" if r["sw"] <= r["W"] else "❌"
                print(f"{flag} {w}px {name:15} scrollWidth={r['sw']} W={r['W']} {' '.join(r['bad']) if r['sw'] > r['W'] else ''}", flush=True)
            except Exception as e:
                print(f"⚠ {w}px {name}: {str(e)[:80]}", flush=True)
        ctx.close()
