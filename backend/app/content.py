"""Загрузка и проверка учебного контента из YAML (формат описан в content/README.md).

Курс состоит из шести уровней (A1–C2). В каждом уровне:
  * 30 юнитов слов (vocab/<level>/uNN.yaml) — 20 слов и текст для чтения с вопросами;
  * темы грамматики (grammar/<level>/*.yaml) — правило на двух языках и упражнения;
  * диалоги для аудирования и говорения (dialogues/<level>.yaml).
Плюс тест на уровень (placement.yaml) и таблица неправильных глаголов (irregular_verbs.yaml).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

CONTENT = Path(__file__).resolve().parent.parent / "content"

LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]
POS = {"n", "v", "adj", "adv", "prep", "conj", "pron", "phr", "num", "det", "interj", "phv"}
EXERCISE_TYPES = {"choice", "input", "order", "match", "cloze", "error", "tf", "odd", "dialog", "listen", "speak"}
VOICES = {"f-us", "m-us", "f-uk", "m-uk", "f-au", "m-au"}


class ContentError(ValueError):
    pass


def slug(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower().replace("'", "")).strip("-")
    return s or "x"


def _pair(line: str, where: str) -> tuple[str, str]:
    """«английский | русский» → кортеж (перевод обязателен)."""
    if not isinstance(line, str) or "|" not in line:
        raise ContentError(f"{where}: ожидается строка «английский | русский», получено {line!r}")
    en, ru = (p.strip() for p in line.split("|", 1))
    if not en or not ru:
        raise ContentError(f"{where}: пустая часть в {line!r}")
    return en, ru


# ---------- упражнения ----------

CLOZE_RE = re.compile(r"\[\[(.+?)\]\]")
ERROR_RE = re.compile(r"\{\{(.+?)=>(.+?)\}\}")


def check_exercise(ex: dict, where: str) -> dict:
    if not isinstance(ex, dict):
        raise ContentError(f"{where}: упражнение должно быть словарём")
    t = ex.get("type")
    if t not in EXERCISE_TYPES:
        raise ContentError(f"{where}: неизвестный тип упражнения {t!r}")
    need = lambda *keys: [_require(ex, k, where) for k in keys]  # noqa: E731
    if t in ("choice", "odd", "listen") and "options" in ex:
        need("options", "answer")
        if not isinstance(ex["answer"], int) or not 0 <= ex["answer"] < len(ex["options"]):
            raise ContentError(f"{where}: answer — индекс варианта (0…{len(ex['options']) - 1})")
        if len(set(map(str, ex["options"]))) != len(ex["options"]):
            raise ContentError(f"{where}: варианты ответа повторяются")
    elif t in ("input", "listen"):
        need("answer")
        if isinstance(ex["answer"], str):
            ex["answer"] = [ex["answer"]]
        if not ex["answer"] or not all(isinstance(a, str) and a.strip() for a in ex["answer"]):
            raise ContentError(f"{where}: answer — строка или список строк")
    elif t == "choice":
        need("options", "answer")
    elif t == "order":
        need("answer")
        if len(str(ex["answer"]).split()) < 2:
            raise ContentError(f"{where}: в «order» нужно хотя бы два слова")
    elif t == "match":
        need("pairs")
        if len(ex["pairs"]) < 2 or not all(isinstance(p, list) and len(p) == 2 for p in ex["pairs"]):
            raise ContentError(f"{where}: pairs — список пар [a, b]")
    elif t == "cloze":
        need("text")
        if not CLOZE_RE.search(ex["text"]):
            raise ContentError(f"{where}: в cloze нет пропусков [[…]]")
        for gap in CLOZE_RE.findall(ex["text"]):
            if "/" in gap and gap.count("*") != 1:
                raise ContentError(f"{where}: в выпадающем списке [[{gap}]] нужен ровно один *верный вариант")
    elif t == "error":
        need("text")
        m = ERROR_RE.findall(ex["text"])
        if len(m) != 1:
            raise ContentError(f"{where}: в «error» должна быть ровно одна ошибка {{{{неверно=>верно}}}}")
    elif t == "tf":
        need("items")
        if not all(isinstance(i, list) and len(i) == 2 and isinstance(i[1], bool) for i in ex["items"]):
            raise ContentError(f"{where}: items — список [утверждение, true/false]")
    elif t == "dialog":
        need("lines")
        if len(ex["lines"]) < 3:
            raise ContentError(f"{where}: в «dialog» нужно хотя бы 3 реплики")
    elif t == "speak":
        need("answer")
    return ex


def _require(d: dict, key: str, where: str):
    if key not in d or d[key] in (None, "", []):
        raise ContentError(f"{where}: нет поля {key!r}")
    return d[key]


# ---------- слова и юниты ----------


@dataclass
class Word:
    id: str
    word: str
    pos: str
    uk: str
    us: str
    ru: str
    definition: str
    example: str
    example_ru: str
    note: str = ""
    level: str = ""
    unit: int = 0

    def as_dict(self) -> dict:
        d = {"id": self.id, "w": self.word, "pos": self.pos, "uk": self.uk, "us": self.us, "ru": self.ru,
             "def": self.definition, "ex": self.example, "exRu": self.example_ru}
        if self.note:
            d["note"] = self.note
        return d


def parse_word(line: str, level: str, unit: int, where: str) -> Word:
    parts = [p.strip() for p in str(line).split("|")]
    if len(parts) not in (8, 9):
        raise ContentError(f"{where}: в строке слова должно быть 8–9 полей через |, найдено {len(parts)}: {line!r}")
    word, pos, uk, us, ru, definition, example, example_ru, *rest = parts
    for name, val in (("слово", word), ("часть речи", pos), ("транскрипция", uk), ("перевод", ru),
                      ("определение", definition), ("пример", example), ("перевод примера", example_ru)):
        if not val:
            raise ContentError(f"{where}: пустое поле «{name}» у {word or line!r}")
    if pos not in POS:
        raise ContentError(f"{where}: неизвестная часть речи {pos!r} у {word!r} (допустимо: {', '.join(sorted(POS))})")
    if "*" not in example or example.count("*") != 2:
        raise ContentError(f"{where}: в примере к {word!r} выделите слово звёздочками: *word*")
    for ipa in (uk, us):
        if ipa and ("[" in ipa or "/" in ipa):
            raise ContentError(f"{where}: транскрипцию {word!r} пишите без скобок и слэшей")
    return Word(id=f"{level}.{unit:02d}.{slug(word)}", word=word, pos=pos, uk=uk, us=us or uk, ru=ru,
                definition=definition, example=example, example_ru=example_ru,
                note=rest[0] if rest else "", level=level, unit=unit)


def check_reading(r: dict, where: str) -> dict:
    for k in ("title", "title_ru", "text", "ru", "questions"):
        _require(r, k, where)
    paras = [p for p in re.split(r"\n\s*\n", r["text"].strip()) if p.strip()]
    paras_ru = [p for p in re.split(r"\n\s*\n", r["ru"].strip()) if p.strip()]
    if len(paras) != len(paras_ru):
        raise ContentError(f"{where}: в тексте {len(paras)} абзацев, а в переводе {len(paras_ru)}")
    for i, q in enumerate(r["questions"]):
        w = f"{where}, вопрос {i + 1}"
        if "tf" in q:
            if not isinstance(q.get("answer"), bool):
                raise ContentError(f"{w}: у вопроса «верно/неверно» answer — true или false")
        else:
            _require(q, "q", w)
            _require(q, "options", w)
            if not isinstance(q.get("answer"), int) or not 0 <= q["answer"] < len(q["options"]):
                raise ContentError(f"{w}: answer — индекс варианта")
    return r


@dataclass
class Unit:
    level: str
    num: int
    title: str
    title_ru: str
    words: list[Word]
    reading: dict | None
    exercises: list[dict] = field(default_factory=list)

    @property
    def key(self) -> str:
        return f"{self.level}.{self.num:02d}"


def load_unit(path: Path, level: str) -> Unit:
    num = int(re.fullmatch(r"u(\d+)\.yaml", path.name).group(1))
    where = f"vocab/{level}/{path.name}"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    words = [parse_word(line, level, num, f"{where}, слово {i + 1}") for i, line in enumerate(_require(data, "words", where))]
    ids = [w.id for w in words]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        raise ContentError(f"{where}: слова повторяются: {', '.join(sorted(dup))}")
    reading = check_reading(data["reading"], f"{where}, текст") if data.get("reading") else None
    exercises = [check_exercise(e, f"{where}, упражнение {i + 1}") for i, e in enumerate(data.get("exercises") or [])]
    return Unit(level=level, num=num, title=_require(data, "title", where), title_ru=_require(data, "title_ru", where),
                words=words, reading=reading, exercises=exercises)


# ---------- грамматика, диалоги, тест на уровень ----------

GRAMMAR_SECTIONS = {"tenses", "verbs", "modals", "nouns", "adjectives", "pronouns", "prepositions",
                    "sentences", "conditionals", "passive", "reported", "clauses", "style", "words"}


def load_grammar(path: Path, level: str) -> dict:
    where = f"grammar/{level}/{path.name}"
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for k in ("title", "title_ru", "section", "summary", "summary_ru", "theory", "theory_ru", "exercises"):
        _require(data, k, where)
    if data["section"] not in GRAMMAR_SECTIONS:
        raise ContentError(f"{where}: неизвестный раздел {data['section']!r}")
    m = re.fullmatch(r"(\d+)-([a-z0-9-]+)\.yaml", path.name)
    if not m:
        raise ContentError(f"{where}: имя файла — «NN-id.yaml»")
    data["order"], data["id"] = int(m.group(1)), m.group(2)
    data["examples"] = [_pair(e, f"{where}, пример") for e in data.get("examples") or []]
    data["exercises"] = [check_exercise(e, f"{where}, упражнение {i + 1}") for i, e in enumerate(data["exercises"])]
    if len(data["exercises"]) < 6:
        raise ContentError(f"{where}: нужно хотя бы 6 упражнений")
    return data


def load_dialogues(path: Path, level: str) -> list[dict]:
    where = f"dialogues/{path.name}"
    items = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    out = []
    for i, d in enumerate(items):
        w = f"{where}, диалог {i + 1}"
        for k in ("id", "title", "title_ru", "scene", "scene_ru", "speakers", "lines"):
            _require(d, k, w)
        for name, voice in d["speakers"].items():
            if voice not in VOICES:
                raise ContentError(f"{w}: голос {voice!r} у {name} (допустимо: {', '.join(sorted(VOICES))})")
        lines = []
        for j, line in enumerate(d["lines"]):
            en, ru = _pair(line, f"{w}, реплика {j + 1}")
            if ":" not in en:
                raise ContentError(f"{w}, реплика {j + 1}: нет говорящего («Имя: текст»)")
            speaker, text = (s.strip() for s in en.split(":", 1))
            if speaker not in d["speakers"]:
                raise ContentError(f"{w}, реплика {j + 1}: говорящий {speaker!r} не описан в speakers")
            lines.append({"speaker": speaker, "en": text, "ru": ru})
        d["lines"] = lines
        d["phrases"] = [_pair(p, f"{w}, фраза") for p in d.get("phrases") or []]
        d["exercises"] = [check_exercise(e, f"{w}, упражнение {k + 1}") for k, e in enumerate(d.get("exercises") or [])]
        d["level"] = level
        out.append(d)
    return out


def load_placement() -> list[dict]:
    path = CONTENT / "placement.yaml"
    if not path.exists():
        return []
    items = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    for i, q in enumerate(items):
        where = f"placement.yaml, вопрос {i + 1}"
        if q.get("level") not in LEVELS:
            raise ContentError(f"{where}: level — один из {LEVELS}")
        check_exercise(q, where)
    return items


def load_irregular() -> list[dict]:
    path = CONTENT / "irregular_verbs.yaml"
    if not path.exists():
        return []
    rows = []
    for i, line in enumerate(yaml.safe_load(path.read_text(encoding="utf-8")) or []):
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 5:
            raise ContentError(f"irregular_verbs.yaml, строка {i + 1}: «base | past | participle | перевод | уровень»")
        base, past, pp, ru, level = parts
        if level not in LEVELS:
            raise ContentError(f"irregular_verbs.yaml, строка {i + 1}: уровень {level!r}")
        rows.append({"base": base, "past": past, "pp": pp, "ru": ru, "level": level})
    return rows


# ---------- библиотека ----------


@dataclass
class Library:
    units: dict[str, list[Unit]]
    grammar: dict[str, list[dict]]
    dialogues: dict[str, list[dict]]
    placement: list[dict]
    irregular: list[dict]
    words: dict[str, Word] = field(default_factory=dict)
    lesson_keys: set[str] = field(default_factory=set)


def load_library(root: Path = CONTENT) -> Library:
    units: dict[str, list[Unit]] = {}
    grammar: dict[str, list[dict]] = {}
    dialogues: dict[str, list[dict]] = {}
    for level in LEVELS:
        units[level] = [load_unit(p, level) for p in sorted((root / "vocab" / level).glob("u*.yaml"))]
        grammar[level] = sorted((load_grammar(p, level) for p in sorted((root / "grammar" / level).glob("*.yaml"))),
                                key=lambda g: g["order"])
        dpath = root / "dialogues" / f"{level}.yaml"
        dialogues[level] = load_dialogues(dpath, level) if dpath.exists() else []
    lib = Library(units=units, grammar=grammar, dialogues=dialogues, placement=load_placement(), irregular=load_irregular())
    for level in LEVELS:
        for u in units[level]:
            lib.lesson_keys |= {f"v.{u.key}", f"r.{u.key}"}
            for w in u.words:
                lib.words[w.id] = w
        ids = [g["id"] for g in grammar[level]]
        if len(ids) != len(set(ids)):
            raise ContentError(f"grammar/{level}: повторяются id тем")
        lib.lesson_keys |= {f"g.{level}.{i}" for i in ids}
        lib.lesson_keys |= {f"d.{d['id']}" for d in dialogues[level]}
    did = [d["id"] for lv in LEVELS for d in dialogues[lv]]
    if len(did) != len(set(did)):
        raise ContentError("dialogues: повторяются id диалогов")
    return lib


@lru_cache(maxsize=1)
def get_library() -> Library:
    return load_library()
