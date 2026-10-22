"""v2: общий список слов курса — сведение справочных списков уровней CEFR.

    .venv/Scripts/python tools/v2/wordlist.py

Источники (скачиваются в _scratch/sources, в репозиторий не входят):
  oxford/oxford-5k.csv                       — Oxford 3000/5000, уровни A1–C1 по частям речи
  cefrj/cefrj-vocabulary-profile-1.5.csv     — CEFR-J Vocabulary Profile 1.5 (TUFS), A1–B2
  cefrj/octanove-vocabulary-profile-c1c2-1.0.csv — Octanove Labs, C1–C2 (CC BY-SA 4.0)
  academic/AWL.json, NAWL.json, NGSL.json    — академическая лексика и общая база (CC0-сборник)
+ wordfreq (частотность Zipf) для спорных и «бесхозных» слов, + слова курса v1.

Уровень для пары (слово, часть речи): Oxford → CEFR-J → Octanove → AWL/NAWL → частотность.
Результат: _scratch/v2/wordlist.csv (по одному слову-лемме) и сводка.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

from wordfreq import zipf_frequency

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "_scratch" / "sources"
OUT = ROOT / "_scratch" / "v2"
LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]
RANK = {lv: i for i, lv in enumerate(LEVELS)}

POS = {
    "noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv", "pronoun": "pron", "preposition": "prep",
    "determiner": "det", "conjunction": "conj", "number": "num", "ordinal number": "num", "exclamation": "interj",
    "interjection": "interj", "modal verb": "v", "modal auxiliary": "v", "auxiliary verb": "v", "be-verb": "v",
    "do-verb": "v", "have-verb": "v", "linking verb": "v", "indefinite article": "det", "definite article": "det",
    "infinitive marker": "part", "infinitive-to": "part",
}


def norm_pos(p: str) -> str:
    return POS.get(p.strip().lower(), p.strip().lower() or "?")


def zipf(word: str) -> float:
    return max(zipf_frequency(w, "en") for w in word.split("/"))


def freq_level(z: float) -> str:
    """Уровень по частотности — только для слов, которых нет в списках уровней."""
    return "b1" if z >= 5.0 else "b2" if z >= 4.3 else "c1" if z >= 3.6 else "c2"


class Entry:
    def __init__(self, lemma: str, pos: str):
        self.lemma, self.pos = lemma, pos
        self.ox = self.cj = self.oc = ""
        self.awl = 0  # подсписок AWL 1–10
        self.nawl = False
        self.ngsl = ""
        self.v1 = ""  # уровень в курсе v1
        self.cj_topic = ""
        self.variants: set[str] = set()


def load() -> dict[tuple[str, str], Entry]:
    entries: dict[tuple[str, str], Entry] = {}

    def get(lemma: str, pos: str) -> Entry:
        lemma = lemma.strip()
        key = (lemma.lower(), pos)
        if key not in entries:
            entries[key] = Entry(lemma, pos)
        return entries[key]

    for r in csv.DictReader(open(SRC / "oxford" / "oxford-5k.csv", encoding="utf-8")):
        if r["level"]:
            get(r["word"], norm_pos(r["pos"])).ox = r["level"].lower()
    for r in csv.DictReader(open(SRC / "cefrj" / "cefrj-vocabulary-profile-1.5.csv", encoding="utf-8")):
        forms = [f.strip() for f in r["headword"].split("/") if f.strip()]
        e = get(forms[0], norm_pos(r["pos"]))
        e.cj = r["CEFR"].lower()
        e.variants |= set(forms[1:])
        e.cj_topic = r["CoreInventory 1"] or r["Threshold"]
    for r in csv.DictReader(open(SRC / "cefrj" / "octanove-vocabulary-profile-c1c2-1.0.csv", encoding="utf-8")):
        # «paralyze/paralyse» — американский/британский варианты в одной строке
        forms = [f.strip() for f in r["headword"].split("/") if f.strip()]
        uk = next((f for f in forms if re.search(r"(ise|yse|our|re)$", f)), forms[0])
        e = get(uk, norm_pos(r["pos"]))
        e.oc = r["CEFR"].lower()
        e.variants |= {f for f in forms if f != uk}

    # академические списки: часть речи в них не указана — привязываем к уже известной лемме или как n/v/adj по факту
    by_lemma: dict[str, list[Entry]] = defaultdict(list)
    for e in entries.values():
        by_lemma[e.lemma.lower()].append(e)
    awl = json.load(open(SRC / "academic" / "AWL.json", encoding="utf-8"))
    for sub, families in awl.items():
        n = int(re.sub(r"\D", "", sub))
        heads = families.keys() if isinstance(families, dict) else families
        for h in heads:
            h = str(h).strip().lower()
            targets = by_lemma.get(h) or [get(h, "?")]
            for e in targets:
                e.awl = e.awl or n
            by_lemma.setdefault(h, targets)
    for h in json.load(open(SRC / "academic" / "NAWL.json", encoding="utf-8")):
        h = h.strip().lower()
        targets = by_lemma.get(h) or [get(h, "?")]
        for e in targets:
            e.nawl = True
        by_lemma.setdefault(h, targets)
    ngsl = json.load(open(SRC / "academic" / "NGSL.json", encoding="utf-8"))
    for band, words in ngsl.items():
        for h in (words.keys() if isinstance(words, dict) else words):
            for e in by_lemma.get(str(h).strip().lower(), []):
                e.ngsl = e.ngsl or band

    # слова курса v1
    v1 = json.load(open(ROOT / "frontend" / "public" / "data" / "words.json", encoding="utf-8"))
    for w in v1:
        lemma, pos = w["w"], w["pos"]
        targets = [e for e in by_lemma.get(lemma.lower(), []) if e.pos == pos] or by_lemma.get(lemma.lower()) or [get(lemma, pos)]
        for e in targets:
            e.v1 = e.v1 or w["lv"]
        by_lemma.setdefault(lemma.lower(), targets)
    return entries


def level_of(e: Entry, z: float) -> tuple[str, str]:
    """(уровень, источник уровня)."""
    if e.ox and e.cj and abs(RANK[e.ox] - RANK[e.cj]) >= 2:
        # Oxford и CEFR-J сильно расходятся — средний уровень с округлением вниз
        return LEVELS[(RANK[e.ox] + RANK[e.cj]) // 2], "oxford+cefrj"
    if e.ox:
        return e.ox, "oxford"
    if e.cj:
        return e.cj, "cefrj"
    if e.oc:
        return e.oc, "octanove"
    if e.awl:
        return ("b2" if e.awl <= 3 else "c1" if e.awl <= 7 or z >= 3.5 else "c2"), "awl"
    if e.nawl:
        return ("c1" if z >= 3.3 else "c2"), "nawl"
    return freq_level(z), "freq"


# очень частотное слово не может быть «продвинутым»: потолок уровня по частотности
FREQ_CAP = [(5.5, "a2"), (5.0, "b1"), (4.6, "b2")]

# обрывки и служебные элементы академических списков
JUNK = {"non", "trans", "multi", "amino", "pre", "anti", "co", "ex", "semi", "mid", "sub", "inter", "ad"}


def capped(level: str, z: float) -> tuple[str, bool]:
    for zmin, cap in FREQ_CAP:
        if z >= zmin and RANK[level] > RANK[cap]:
            return cap, True
    return level, False


def drop_reason(e: Entry, z: float, src: str, lemmas: set[str]) -> str:
    """Почему слово не входит в курс (пусто — входит)."""
    w = e.lemma.lower()
    if w in JUNK:
        return "обрывок"
    if z == 0 and " " not in w and not e.v1:
        return "нет в корпусах"
    if src == "cefrj" and not e.v1 and z < (2.3 if RANK[e.cj] <= RANK["b1"] else 2.9):
        return "редкое (CEFR-J)"
    if src == "octanove" and not e.v1 and (z < 1.8 or (w.endswith("ly") and z < 2.6)):
        # C2 — это и есть редкая лексика: отсекаем только совсем редкое и производные наречия
        return "редкое (C1/C2)"
    if src == "freq" and z < 2.3:
        return "редкое (v1)"
    # производные от слов, которые уже есть: -ly, -ness, un-/in- … — показываются в «семье слова»
    if src in ("cefrj", "octanove", "freq") and not e.v1 and z < 3.3:
        for base in derived_bases(w):
            if base in lemmas:
                return f"производное от {base}"
    return ""


def derived_bases(w: str) -> list[str]:
    out = []
    if w.endswith("ly"):
        out += [w[:-2], w[:-3] + "y" if w.endswith("ily") else "", w[:-2] + "e", w[:-4] + "le" if w.endswith("ably") or w.endswith("ibly") else ""]
    if w.endswith("ness"):
        out += [w[:-4], w[:-5] + "y" if w.endswith("iness") else ""]
    for pre in ("un", "in", "im", "ir", "il", "dis", "mis", "non", "over", "under", "re"):
        if w.startswith(pre) and len(w) - len(pre) >= 4:
            out.append(w[len(pre):])
    return [b for b in out if b]


# британское/американское написание — одна карточка (заголовок — британский вариант)
def spelling_key(w: str) -> str:
    k = w.lower()
    k = re.sub(r"our\b", "or", k)
    k = re.sub(r"(?<=[^aeiou])re\b", "er", k)
    k = re.sub(r"is(e|ed|ing|ation)\b", r"iz", k)
    k = re.sub(r"yse\b", "yze", k)
    k = re.sub(r"ogue\b", "og", k)
    k = re.sub(r"ll(ed|ing|er)\b", r"l", k)
    return k


def load_phrases() -> list[dict]:
    """Oxford Phrase List: устойчивые выражения A1–C1."""
    out = []
    for r in csv.DictReader(open(SRC / "oxford" / "oxford-phrase.csv", encoding="utf-8")):
        if r["level"]:
            out.append({"lemma": r["word"].strip(), "pos": "phr", "level": r["level"].lower(), "source": "oxford-phrase"})
    return out


def load_manual() -> dict[str, str]:
    """tools/v2/manual_levels.txt: слово → уровень (или drop)."""
    out: dict[str, str] = {}
    for line in (Path(__file__).with_name("manual_levels.txt")).read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.startswith("#") or ":" not in line:
            continue
        lv, _, words = line.partition(":")
        # многословные элементы записаны слитно через пробел внутри известных фраз
        for w in re.findall(r"figure out|vice versa|[^\s]+", words):
            out[w.lower()] = lv.strip()
    return out


def load_ielts() -> list[tuple[str, str, str]]:
    """tools/v2/ielts_topics.txt → [(тема, уровень, элемент)]."""
    out, topic = [], ""
    for line in (Path(__file__).with_name("ielts_topics.txt")).read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            topic = line[3:].split("|")[0].strip()
        elif re.match(r"^(a1|a2|b1|b2|c1|c2):", line):
            lv, _, items = line.partition(":")
            out += [(topic, lv, it.strip()) for it in items.split(",") if it.strip()]
    return out


def phrase_key(s: str) -> str:
    """«look forward to sth» ≈ «look forward to»: без пометок sth/sb/…, артиклей a/the в начале и «your/someone's»."""
    k = s.lower().replace("’", "'")
    k = re.sub(r"\b(sb/sth|sth/sb|sb|sth|somebody|someone|something|your|yourself|someone's|sb's|one's)\b", " ", k)
    k = k.replace("/", " ")
    k = re.sub(r"[…?!.()]+", " ", k)
    k = re.sub(r"^(a|an|the|to)\s+", "", k.strip())
    return re.sub(r"\s+", " ", k).strip()


def add_ielts(cards: list[dict]) -> None:
    """Метки тем IELTS для уже известных слов и новые карточки для недостающих."""
    index: dict[str, list[dict]] = defaultdict(list)
    for c in cards:
        index[c["lemma"].lower()].append(c)
        if c["card"] == "phrase":
            index[phrase_key(c["lemma"])].append(c)
        for v in filter(None, c["variants"].split("/")):
            index[v.lower()].append(c)
    added = 0
    for topic, lv, item in load_ielts():
        key = item.lower()
        found = index.get(key) or (index.get(phrase_key(item)) if " " in item else None) or index.get(key.replace("isation", "ization")) or index.get(key.replace("ization", "isation"))
        if found:
            for c in found:
                if topic not in c["topics"].split(","):
                    c["topics"] = ",".join(filter(None, [c["topics"], topic]))
            continue
        z = round(zipf(key), 2) if " " not in key else ""
        card = {**{k: "" for k in cards[0]}, "lemma": item, "level": lv, "source": "ielts", "zipf": z,
                "card": "phrase" if " " in item else "main", "topics": topic}
        cards.append(card)
        index[key].append(card)
        added += 1
    print("IELTS: добавлено карточек:", added)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    entries = load()
    manual = load_manual()
    lemmas = {e.lemma.lower() for e in entries.values()}
    rows, dropped = [], []
    for e in entries.values():
        if e.pos == "?":
            e.pos = ""
        z = round(zipf(e.lemma.lower()), 2)
        lv, src = level_of(e, z)
        lv, cap = capped(lv, z)
        reason = drop_reason(e, z, src, lemmas)
        m = manual.get(e.lemma.lower())
        if m == "drop":
            reason = "вручную"
        elif m and src.split("+")[0] in ("freq", "awl", "nawl"):
            lv, src, cap, reason = m, "manual", False, ""
        row = {"lemma": e.lemma, "pos": e.pos, "level": lv, "source": src + ("+freqcap" if cap else ""), "oxford": e.ox,
               "cefrj": e.cj, "octanove": e.oc, "awl": e.awl or "", "nawl": "x" if e.nawl else "", "ngsl": e.ngsl,
               "zipf": z, "v1": e.v1, "disputed": "x" if src == "oxford+cefrj" else "", "cefrj_topic": e.cj_topic,
               "variants": "/".join(sorted(e.variants)), "dropped": reason}
        (dropped if reason else rows).append(row)

    # одинаковые слова в британском и американском написании
    groups = defaultdict(list)
    for r in rows:
        groups[(spelling_key(r["lemma"]), r["pos"])].append(r)
    merged = []
    for (_, _), rs in groups.items():
        if len(rs) > 1:
            rs.sort(key=lambda r: (RANK[r["level"]], -float(r["zipf"])))
            uk = next((r for r in rs if re.search(r"our|re$|ise|yse|ogue", r["lemma"])), rs[0])
            uk["level"] = min((r["level"] for r in rs), key=RANK.get)
            uk["variants"] = "/".join(sorted({r["lemma"] for r in rs if r is not uk} | set(filter(None, uk["variants"].split("/")))))
            merged.append(uk)
        else:
            merged.append(rs[0])
    rows = merged

    # карточки: одна на лемму; другие части речи — в той же карточке, если уровень тот же или ниже,
    # иначе отдельная карточка «доп. значение» на своём уровне (book n A1 / book v A2)
    cards = []
    by_lemma = defaultdict(list)
    for r in rows:
        by_lemma[r["lemma"].lower()].append(r)
    for rs in by_lemma.values():
        rs.sort(key=lambda r: (RANK[r["level"]], -float(r["zipf"])))
        main_r = dict(rs[0])
        main_r["also"] = ",".join(r["pos"] for r in rs[1:] if r["level"] == main_r["level"] and r["pos"])
        main_r["card"] = "main"
        cards.append(main_r)
        for r in rs[1:]:
            if r["level"] != main_r["level"]:
                extra = dict(r)
                extra["also"], extra["card"] = "", "sense"
                cards.append(extra)
    for p in load_phrases():
        cards.append({**{k: "" for k in cards[0]}, **p, "zipf": "", "card": "phrase"})
    for c in cards:
        c["topics"] = ""
    add_ielts(cards)

    OUT.mkdir(parents=True, exist_ok=True)
    cards.sort(key=lambda r: (RANK[r["level"]], r["lemma"].lower()))
    fields = list(cards[0].keys())
    with open(OUT / "wordlist.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(cards)
    with open(OUT / "dropped.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(dropped[0].keys()))
        w.writeheader()
        w.writerows(sorted(dropped, key=lambda r: r["lemma"].lower()))
    print("карточек:", len(cards), Counter(c["card"] for c in cards))
    print("по уровням:", sorted(Counter(c["level"] for c in cards).items(), key=lambda x: RANK[x[0]]))
    print("основные по уровням:", sorted(Counter(c["level"] for c in cards if c["card"] == "main").items(), key=lambda x: RANK[x[0]]))
    print("исключено:", len(dropped), Counter(re.sub(r" от .*", "", d["dropped"]) for d in dropped))
    print("объединено написаний:", sum(1 for c in cards if c["variants"] and c["source"] != "cefrj"))
    print("потолок по частотности:", sum(1 for c in cards if "freqcap" in c["source"]))
    v1_kept = {c["lemma"].lower() for c in cards if c["v1"]}
    print("слова v1 в курсе:", len(v1_kept))
    unassigned = [c["lemma"] for c in cards if c["source"].split("+")[0] in ("freq", "awl", "nawl")]
    print("без ручного уровня:", len(unassigned), unassigned[:20])


if __name__ == "__main__":
    main()
