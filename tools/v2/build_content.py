"""v2, этап 3: сборка уроков словаря → backend/content/vocab/<уровень>/uNNN.yaml.

    .venv/Scripts/python tools/v2/build_content.py            # собрать
    .venv/Scripts/python tools/v2/build_content.py --todo a1  # что ещё не написано (по порядку уроков)

Карточка = слово из _scratch/v2/cards.csv (уровень, часть речи, урок). Содержание берётся:
  1) из tools/v2/fill/*.txt — написанное для v2:
       «слово = часть_речи | перевод | определение | пример с *словом* | перевод примера | заметка»
     для доп. значения (та же лемма на другом уровне) — «слово@уровень = …»
  2) из курса v1 (то же слово и часть речи) — перевод, определение, пример, заметка, транскрипция;
Транскрипция новых слов — tools/v2/ipa.py (ipa-dict, MIT). У выражений транскрипции нет.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from ipa import lookup, manual  # noqa: E402

V2 = ROOT / "_scratch" / "v2"
FILL = Path(__file__).with_name("fill")
OUT = ROOT / "backend" / "content" / "vocab"
LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]
POS_OK = {"n", "v", "adj", "adv", "prep", "conj", "pron", "phr", "num", "det", "interj", "phv", "part"}


PROPER = {w: w.capitalize() for w in """january february march april may june july august september october november december
monday tuesday wednesday thursday friday saturday sunday olympics english""".split()}
PROPER.update({"i": "I", "cd": "CD", "dvd": "DVD", "tv": "TV", "cd player": "CD player", "pc": "PC", "id card": "ID card",
               "dj": "DJ", "dna": "DNA", "hiv": "HIV", "cv": "CV", "mp3 player": "MP3 player", "uk": "UK", "usa": "USA",
               "tv show": "TV show", "on tv": "on TV", "in april": "in April", "on monday": "on Monday",
               "mr.": "Mr", "mrs.": "Mrs", "ms.": "Ms", "the 20th century": "the 20th century", "i'm sorry": "I'm sorry",
               "e-commerce": "e-commerce", "mooc": "MOOC", "x-ray": "X-ray", "t-shirt": "T-shirt"})


def proper(word: str) -> str:
    return PROPER.get(word.lower(), word)


def display(lemma: str) -> str:
    """Выражения Oxford: sth/sb → something/somebody, «…» → «...»."""
    s = lemma.replace("sb/sth", "somebody/something").replace("sth/sb", "something/somebody")
    s = re.sub(r"\bsb's\b", "somebody's", s)
    s = re.sub(r"\bsth\b", "something", s)
    s = re.sub(r"\bsb\b", "somebody", s)
    return s.replace("…", "...").strip()


def load_fill() -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for path in sorted(FILL.glob("*.txt")):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip() or line.startswith("#"):
                continue
            head, sep, body = line.partition(" = ")
            if not sep:
                raise SystemExit(f"{path.name}:{n}: нет « = »: {line!r}")
            parts = [p.strip() for p in body.split(" | ")]
            if len(parts) not in (5, 6) or parts[0] not in POS_OK:
                raise SystemExit(f"{path.name}:{n}: нужно «часть_речи | перевод | определение | пример | перевод | [заметка]»: {line!r}")
            if parts[3].count("*") != 2:
                raise SystemExit(f"{path.name}:{n}: в примере должно быть одно выделение *слово*: {parts[3]!r}")
            if head.strip().lower() in out:
                raise SystemExit(f"{path.name}:{n}: {head.strip()!r} уже написано выше")
            out[head.strip().lower()] = parts + [""] * (6 - len(parts))
    return out


def load_v1() -> dict[str, list[dict]]:
    words = json.load(open(ROOT / "frontend" / "public" / "data" / "words.json", encoding="utf-8"))
    by = defaultdict(list)
    for w in words:
        by[w["w"].lower()].append(w)
    return by


def fill_key(c: dict) -> str:
    return f"{c['lemma'].lower()}@{c['level']}" if c["card"] == "sense" else c["lemma"].lower()


def by_pos(lemma: str, pos: str, uk: str, us: str) -> tuple[str, str]:
    """Омографы (wind n/v, record n/v…): ipa_manual.txt может задать «слово/часть речи = UK | US»."""
    return manual().get(f"{lemma.lower()}/{pos}", (uk, us))


def card_content(c: dict, fill: dict, v1: dict) -> tuple[str, list[str], str, str] | None:
    """(часть речи, [перевод, определение, пример, перевод примера, заметка], uk, us) или None — ещё не написано."""
    lemma = c["lemma"]
    olds = v1.get(lemma.lower(), [])
    hit = fill.get(fill_key(c))
    if hit:
        pos, rest = hit[0], hit[1:]
        old = next((o for o in olds if o["pos"] == pos), None)
        if old:
            uk, us = old["uk"], old["us"]
        elif pos in ("phr", "phv") and " " in lemma:
            uk, us = "", ""
        else:
            uk, us = lookup(lemma)
        return (pos, rest, *by_pos(lemma, pos, uk, us))
    old = next((o for o in olds if o["pos"] == c["pos"]), None) or (olds[0] if olds else None)
    if old and c["card"] == "main":
        return (old["pos"], [old["ru"], old["def"], old["ex"], old["exRu"], old.get("note", "")],
                *by_pos(lemma, old["pos"], old["uk"], old["us"]))
    return None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    cards = list(csv.DictReader(open(V2 / "cards.csv", encoding="utf-8-sig")))
    units = list(csv.DictReader(open(V2 / "units.csv", encoding="utf-8-sig")))
    fill, v1 = load_fill(), load_v1()
    by_unit = defaultdict(list)
    for c in cards:
        by_unit[c["unit"]].append(c)

    todo_level = sys.argv[sys.argv.index("--todo") + 1] if "--todo" in sys.argv else None
    if todo_level:
        n = 0
        for u in sorted((u for u in units if u["level"] == todo_level), key=lambda u: int(u["seq"])):
            missing = [c for c in by_unit[u["id"]] if card_content(c, fill, v1) is None]
            if missing:
                print(f"# {u['seq']}. {u['titleRu']} ({u['id']})")
                for c in missing:
                    pos = ",".join(filter(None, [c["pos"], c.get("also", "")]))
                    print(f"{fill_key(c)}  ({pos or '?'})")
                n += len(missing)
        print(f"# не написано: {n}", file=sys.stderr)
        return

    stats = Counter()
    for lv in LEVELS:
        d = OUT / lv
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("u*.yaml"):
            old.unlink()
        for u in sorted((u for u in units if u["level"] == lv), key=lambda u: int(u["seq"])):
            lines = []
            for c in by_unit[u["id"]]:
                got = card_content(c, fill, v1)
                if got is None:
                    stats["todo"] += 1
                    continue
                pos, (ru, definition, ex, ex_ru, note), uk, us = got
                word = proper(display(c["lemma"]) if c["card"] == "phrase" else c["lemma"])
                if pos in ("phr", "phv") and not uk:
                    uk = us = ""
                lines.append(" | ".join([word, pos, uk, "" if us == uk else us, ru, definition, ex, ex_ru, note]).rstrip(" |"))
                stats["done"] += 1
            if not lines:
                continue
            data = {"title": u["title"], "title_ru": u["titleRu"], "topic": u["topic"], "words": lines}
            (d / f"u{int(u['seq']):03d}.yaml").write_text(
                yaml.safe_dump(data, allow_unicode=True, sort_keys=False, width=10**6), encoding="utf-8", newline="\n")
    print("готово карточек:", stats["done"], "| ещё не написано:", stats["todo"])


if __name__ == "__main__":
    main()
