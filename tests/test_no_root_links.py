"""Сайт игр живёт под /games/. Переход на корень домена ("/") уводит на чужой сайт
(так в этапе 14 кнопка «В лобби» открывала портфолио). Ловим такие ссылки в static/."""
import pathlib, re

STATIC = pathlib.Path(__file__).resolve().parent.parent / "static"
# location = '/', location.href = "/", href="/", assign('/'), replace('/'), а также '/?…' и '/#…'
BAD = re.compile(r"""(location(\.href)?\s*=\s*|href\s*=\s*|\.(assign|replace)\(\s*)(['"`])/([?#][^'"`]*)?\4""")


def test_no_links_to_domain_root():
    hits = []
    for f in sorted(STATIC.rglob("*")):
        if f.suffix not in (".html", ".js") or ".bak" in f.name:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if BAD.search(line):
                hits.append(f"{f.relative_to(STATIC)}:{n}: {line.strip()[:120]}")
    assert not hits, "ссылки на корень домена вместо /games/:\n" + "\n".join(hits)
