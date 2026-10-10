"""Контент курса: полнота уровней, корректность слов, упражнений и экспорта."""

import json
import re
from pathlib import Path

import pytest

from app.content import LEVELS, check_exercise, get_library, ContentError

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "frontend" / "public" / "data"


@pytest.fixture(scope="module")
def lib():
    return get_library()


@pytest.mark.parametrize("level", LEVELS)
def test_each_level_is_complete(lib, level):
    units = lib.units[level]
    assert len(units) == 30
    assert all(len(u.words) == 20 for u in units)
    assert len(lib.grammar[level]) >= 10
    assert len(lib.dialogues[level]) == 6


def test_total_word_count(lib):
    assert len(lib.words) == 3600


def test_word_ids_unique_and_well_formed(lib):
    for wid, w in lib.words.items():
        assert re.fullmatch(r"(a1|a2|b1|b2|c1|c2)\.\d\d\.[a-z0-9-]+", wid), wid
        assert w.ru and w.definition and w.example and w.example_ru


def test_readings_have_translation_and_questions(lib):
    for level in LEVELS:
        for u in lib.units[level]:
            r = u.reading
            assert r["title"] and r["text"] and r["ru"]
            assert len(r["questions"]) >= 3


def test_placement_covers_all_levels(lib):
    counts = {lv: sum(1 for q in lib.placement if q["level"] == lv) for lv in LEVELS}
    assert all(n >= 15 for n in counts.values()), counts


def test_irregular_verbs(lib):
    bases = [v["base"] for v in lib.irregular]
    assert len(bases) == len(set(bases)) >= 100
    assert {"go", "be", "write"} <= set(bases)


@pytest.mark.parametrize("bad", [
    {"type": "choice", "q": "?", "options": ["a", "a"], "answer": 0},
    {"type": "choice", "q": "?", "options": ["a", "b"], "answer": 5},
    {"type": "cloze", "text": "no gaps here"},
    {"type": "cloze", "text": "[[a/b/c]] без верного варианта"},
    {"type": "error", "text": "no error marked"},
    {"type": "match", "pairs": [["a", "x"], ["a", "y"]]},
    {"type": "order", "answer": "one"},
    {"type": "mystery"},
])
def test_exercise_validation_catches_mistakes(bad):
    with pytest.raises(ContentError):
        check_exercise(dict(bad), "test")


def test_exported_json_matches_library(lib):
    course = json.loads((DATA / "course.json").read_text(encoding="utf-8"))
    words = json.loads((DATA / "words.json").read_text(encoding="utf-8"))
    assert len(words) == len(lib.words)
    assert [lv["id"] for lv in course["levels"]] == list(LEVELS)
    assert len(course["placement"]) == len(lib.placement)
    for level in LEVELS:
        assert (DATA / f"level-{level}.json").exists()


def test_exported_media_files_exist():
    words = json.loads((DATA / "words.json").read_text(encoding="utf-8"))
    public = ROOT / "frontend" / "public"
    with_img = [w for w in words if w.get("img")]
    assert len(with_img) > 500
    assert all((public / w["img"]).exists() for w in with_img)
    with_audio = [w for w in words if w.get("au")]
    assert len(with_audio) > 3000
    assert all((public / "audio" / w["au"][:2] / f"{w['au']}.mp3").exists() for w in with_audio[:200])
