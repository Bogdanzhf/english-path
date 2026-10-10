"""Картинки к словам — Microsoft Fluent Emoji 3D (лицензия MIT): https://github.com/microsoft/fluentui-emoji

    .venv/Scripts/python tools/build_images.py

1. Слово, совпадающее с названием эмодзи (dog, volcano, whale…), получает его автоматически.
2. Синонимы и уточнения — в backend/content/image_words.txt («слово = название эмодзи»;
   «слово = -» запрещает автоматическую картинку).

Результат: frontend/public/img/e/*.webp и backend/content/images.yaml (слово → путь).
Исходники кэшируются в _scratch/img/cache — повторный запуск ничего не качает.
"""

from __future__ import annotations

import io
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "_scratch" / "img" / "cache"
OUT = ROOT / "frontend" / "public" / "img" / "e"
CONTENT = ROOT / "backend" / "content"
MAPPING = CONTENT / "image_words.txt"
IMAGES_YAML = CONTENT / "images.yaml"
FLUENT_TREE = "https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1"
FLUENT_RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/"
UA = {"User-Agent": "EnglishPathCourseBuilder/1.0 (educational, non-commercial)"}
SIZE = 160


def fetch(url: str, attempts: int = 5) -> bytes:
    if not url.startswith("https://"):
        raise ValueError(f"разрешены только https-адреса: {url}")
    for i in range(attempts):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:  # nosec B310 — схема проверена выше
                return r.read()
        except Exception:  # noqa: BLE001 — сеть: повторяем
            if i == attempts - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError("unreachable")


def cached(name: str, url: str) -> bytes:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / name
    if not path.exists():
        path.write_bytes(fetch(url))
        time.sleep(0.1)
    return path.read_bytes()


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def fluent_index() -> dict[str, str]:
    """Название эмодзи → путь к 3D-картинке в репозитории."""
    tree = json.loads(cached("fluent_tree.json", FLUENT_TREE))
    index: dict[str, str] = {}
    for item in tree["tree"]:
        p = item["path"]
        parts = p.split("/")
        if p.endswith("_3d.png") and len(parts) == 4 and parts[2] == "3D":
            index.setdefault(parts[1].lower(), p)
        elif p.endswith("_3d_default.png") and "/Default/3D/" in p:
            index.setdefault(parts[1].lower(), p)
    return index


def parse_mapping() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for line in MAPPING.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            word, _, target = line.partition("=")
            mapping[word.strip().lower()] = target.strip().lower()
    return mapping


def course_words() -> list[str]:
    words = []
    for path in sorted((CONTENT / "vocab").glob("*/u*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        for line in data.get("words") or []:
            words.append(line.split("|")[0].strip().lower())
    return words


def save_webp(data: bytes, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    img.thumbnail((SIZE, SIZE), Image.LANCZOS)
    img.save(out, "WEBP", quality=82, method=6)


def main() -> None:
    index = fluent_index()
    mapping = parse_mapping()
    result: dict[str, str] = {}
    missing: list[str] = []
    for word in sorted(set(course_words())):
        target = mapping.get(word)
        if target == "-":
            continue
        if target is None:
            singular = word[:-1] if word.endswith("s") else word
            target = word if word in index else singular if singular in index else None
            if target is None:
                continue
        path = index.get(target)
        if not path:
            missing.append(f"{word} → {target}")
            continue
        out = OUT / f"{slug(target)}.webp"
        if not out.exists():
            save_webp(cached(f"fluent_{slug(target)}.png", FLUENT_RAW + urllib.parse.quote(path)), out)
        result[word] = f"img/e/{slug(target)}.webp"

    IMAGES_YAML.write_text(
        "# Сгенерировано tools/build_images.py — не редактируйте вручную. Источник: Microsoft Fluent Emoji (MIT).\n"
        + yaml.safe_dump(result, allow_unicode=True, sort_keys=True, width=200),
        encoding="utf-8",
        newline="\n",
    )
    size = sum(f.stat().st_size for f in OUT.glob("*.webp")) // 1024
    print(f"Слов с картинкой: {len(result)}, файлов: {len(set(result.values()))}, {size} КБ")
    if missing:
        print("Нет такой иллюстрации:\n  " + "\n  ".join(missing), file=sys.stderr)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    main()
