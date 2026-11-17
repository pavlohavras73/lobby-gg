"""Элиас: колоды на 4 языках одинакового размера, без дублей, немецкая есть."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import alias  # noqa: E402


def test_decks_parallel_and_big():
    assert set(alias.LANGS) == {"ru", "ua", "en", "de"}
    for diff in alias.DIFFS:
        sizes = {lang: len(alias.WORDS[lang][diff]) for lang in alias.LANGS}
        assert len(set(sizes.values())) == 1 and min(sizes.values()) >= 70, sizes
        for lang in alias.LANGS:
            words = [w.lower() for w in alias.WORDS[lang][diff]]
            assert len(words) == len(set(words)) and all(w.strip() for w in words)


def test_build_deck_unknown_falls_back():
    assert alias.build_deck("de", "hard") and sorted(alias.build_deck("xx", "yy")) == sorted(alias.WORDS["ru"]["easy"])
