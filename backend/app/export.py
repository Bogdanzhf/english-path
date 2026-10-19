"""Сборка учебного контента в JSON для фронтенда.

    cd backend && poetry run python -m app.export

Пишет в frontend/public/data:
  course.json        — оглавление: уровни, юниты, темы грамматики, диалоги, неправильные глаголы, тест на уровень;
  words.json         — все слова курса (словарь, повторение, поиск);
  level-<id>.json    — тексты юнитов, правила грамматики с упражнениями и диалоги уровня.
И список фраз для озвучки — tools/audio_wanted.json (его читает tools/build_audio.py).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import yaml

from .audio import DIALOGUE_VOICES, AudioIndex, sentences
from .config import ROOT
from .content import CONTENT, LEVELS, Library, Unit, load_library

OUT = ROOT / "frontend" / "public" / "data"
PUBLIC = ROOT / "frontend" / "public"
WORD_VOICES = ("f-uk", "f-us")


def _images() -> dict[str, str]:
    path = CONTENT / "images.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return {k: v for k, v in data.items() if (PUBLIC / v).exists()}


def _paragraphs(text: str) -> list[str]:
    return [re.sub(r"\s+", " ", p).strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]


def export_words(lib: Library, audio: AudioIndex, images: dict[str, str]) -> list[dict]:
    out = []
    for level in LEVELS:
        for unit in lib.units[level]:
            for i, w in enumerate(unit.words):
                d = w.as_dict()
                d["lv"], d["u"] = level, unit.num
                ex_voice = audio.narrator(w.id)
                refs = {"au": audio.ref(WORD_VOICES[0], w.word), "aa": audio.ref(WORD_VOICES[1], w.word),
                        "ae": audio.ref(ex_voice, w.example)}
                d.update({k: v for k, v in refs.items() if v})
                img = images.get(w.id) or images.get(w.word.lower())
                if img:
                    d["img"] = img
                out.append(d)
    return out


def export_reading(unit: Unit, audio: AudioIndex) -> dict | None:
    r = unit.reading
    if not r:
        return None
    # нечётные юниты читает британский диктор, чётные — американский: слух привыкает к обоим акцентам
    voice = ("f-uk" if unit.num % 4 == 1 else "m-uk") if unit.num % 2 else ("f-us" if unit.num % 4 == 0 else "m-us")
    paras = []
    for en, ru in zip(_paragraphs(r["text"]), _paragraphs(r["ru"])):
        paras.append({"s": [{"en": s, "a": audio.ref(voice, s)} for s in sentences(en)], "ru": ru})
    questions = []
    for q in r["questions"]:
        if "tf" in q:
            questions.append({"type": "tf", "items": [[q["tf"], q["answer"]]]})
        else:
            questions.append({"type": "choice", "q": q["q"], "options": q["options"], "answer": q["answer"],
                              **({"explain": q["explain"]} if q.get("explain") else {})})
    return {"title": r["title"], "titleRu": r["title_ru"], "voice": voice, "paras": paras, "questions": questions,
            "glossary": r.get("glossary") or []}


def _exercise_audio(ex: dict, audio: AudioIndex, seed: str) -> dict:
    ex = dict(ex)
    if ex.get("audio"):
        ex["audioKey"] = audio.ref(audio.narrator(seed), ex["audio"])
    if ex["type"] == "listen" and not ex.get("audio"):
        raise ValueError(f"{seed}: у упражнения listen нет поля audio")
    return ex


def export_level(lib: Library, level: str, audio: AudioIndex) -> dict:
    units = []
    for u in lib.units[level]:
        units.append({"num": u.num, "title": u.title, "titleRu": u.title_ru, "reading": export_reading(u, audio),
                      "exercises": [_exercise_audio(e, audio, f"{u.key}.{i}") for i, e in enumerate(u.exercises)]})
    grammar = []
    for g in lib.grammar[level]:
        grammar.append({
            "id": g["id"], "title": g["title"], "titleRu": g["title_ru"], "section": g["section"],
            "summary": g["summary"], "summaryRu": g["summary_ru"], "theory": g["theory"], "theoryRu": g["theory_ru"],
            "examples": [{"en": en, "ru": ru, "a": audio.ref(audio.narrator(en), en)} for en, ru in g["examples"]],
            "exercises": [_exercise_audio(e, audio, f"{level}.{g['id']}.{i}") for i, e in enumerate(g["exercises"])],
            "writing": g["writing"],
        })
    dialogues = []
    for d in lib.dialogues[level]:
        voices = {name: DIALOGUE_VOICES[v] for name, v in d["speakers"].items()}
        dialogues.append({
            "id": d["id"], "title": d["title"], "titleRu": d["title_ru"], "scene": d["scene"], "sceneRu": d["scene_ru"],
            "speakers": d["speakers"],
            "lines": [{**ln, "a": audio.ref(voices[ln["speaker"]], ln["en"])} for ln in d["lines"]],
            "phrases": [{"en": en, "ru": ru, "a": audio.ref(audio.narrator(en), en)} for en, ru in d["phrases"]],
            "exercises": [_exercise_audio(e, audio, f"{d['id']}.{i}") for i, e in enumerate(d["exercises"])],
        })
    return {"id": level, "units": units, "grammar": grammar, "dialogues": dialogues}


def export_course(lib: Library, audio: AudioIndex) -> dict:
    levels = []
    for level in LEVELS:
        levels.append({
            "id": level,
            "units": [{"num": u.num, "title": u.title, "titleRu": u.title_ru, "words": len(u.words),
                       "reading": u.reading["title"] if u.reading else None,
                       "readingRu": u.reading["title_ru"] if u.reading else None} for u in lib.units[level]],
            "grammar": [{"id": g["id"], "title": g["title"], "titleRu": g["title_ru"], "section": g["section"],
                         "summary": g["summary"], "summaryRu": g["summary_ru"], "exercises": len(g["exercises"])}
                        for g in lib.grammar[level]],
            "dialogues": [{"id": d["id"], "title": d["title"], "titleRu": d["title_ru"], "lines": len(d["lines"])}
                          for d in lib.dialogues[level]],
        })
    irregular = [{**v, "a": audio.ref("f-us", f"{v['base']}, {v['past']}, {v['pp']}")} for v in lib.irregular]
    placement = [_exercise_audio(q, audio, f"placement.{i}") for i, q in enumerate(lib.placement)]
    return {"version": 1, "levels": levels, "irregular": irregular, "placement": placement}


def _write(name: str, data) -> int:
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (OUT / name).write_text(text, encoding="utf-8")
    return len(text.encode())


def main() -> None:
    lib = load_library()
    audio = AudioIndex()
    images = _images()
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {"words.json": _write("words.json", export_words(lib, audio, images))}
    for level in LEVELS:
        sizes[f"level-{level}.json"] = _write(f"level-{level}.json", export_level(lib, level, audio))
    sizes["course.json"] = _write("course.json", export_course(lib, audio))
    wanted = [{"key": k, "voice": v, "text": t} for k, (v, t) in sorted(audio.wanted.items())]
    (ROOT / "tools" / "audio_wanted.json").write_text(json.dumps(wanted, ensure_ascii=False, indent=0), encoding="utf-8")
    ready = sum(1 for w in wanted if w["key"] in audio.existing)
    total_words = len(lib.words)
    print(f"Слов: {total_words}, юнитов: {sum(len(lib.units[lv]) for lv in LEVELS)}, "
          f"тем грамматики: {sum(len(lib.grammar[lv]) for lv in LEVELS)}, "
          f"диалогов: {sum(len(lib.dialogues[lv]) for lv in LEVELS)}")
    print(f"Озвучка: готово {ready} из {len(wanted)} фраз")
    for name, size in sizes.items():
        print(f"  {name}: {size / 1024:.0f} КБ")


if __name__ == "__main__":
    main()
