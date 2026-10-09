"""Озвучка курса нейроголосами Microsoft Edge TTS.

    poetry run python tools/build_audio.py            # озвучить всё недостающее
    poetry run python tools/build_audio.py --limit 50 # для пробы

Список фраз берётся из tools/audio_wanted.json (его пишет `python -m app.export`).
Готовые файлы не пересоздаются. После озвучки снова запустите экспорт, чтобы
ссылки на mp3 попали в данные курса.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.audio import AUDIO_DIR, VOICES, rel_path  # noqa: E402

WANTED = ROOT / "tools" / "audio_wanted.json"


async def synth(item: dict, sem: asyncio.Semaphore, stats: dict) -> None:
    out = ROOT / "frontend" / "public" / rel_path(item["key"])
    if out.exists() and out.stat().st_size > 0:
        return
    out.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(4):
            try:
                tmp = out.with_suffix(".part")
                # отдельные слова — чуть медленнее, чтобы было хорошо слышно произношение
                rate = "-8%" if len(item["text"].split()) <= 2 else "+0%"
                await edge_tts.Communicate(item["text"], VOICES[item["voice"]], rate=rate).save(str(tmp))
                if tmp.stat().st_size == 0:
                    raise RuntimeError("пустой файл")
                tmp.replace(out)
                stats["done"] += 1
                if stats["done"] % 100 == 0:
                    print(f"  … {stats['done']} готово", flush=True)
                return
            except Exception as e:  # сеть может временно отказать — пробуем ещё раз
                if attempt == 3:
                    stats["failed"].append((item["key"], item["text"][:60], str(e)))
                await asyncio.sleep(2 * (attempt + 1))


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    items = json.loads(WANTED.read_text(encoding="utf-8"))
    todo = [i for i in items if not (ROOT / "frontend" / "public" / rel_path(i["key"])).exists()]
    if args.limit:
        todo = todo[: args.limit]
    print(f"Всего фраз: {len(items)}, озвучить: {len(todo)}")
    sem = asyncio.Semaphore(args.workers)
    stats: dict = {"done": 0, "failed": []}
    await asyncio.gather(*(synth(i, sem, stats) for i in todo))
    print(f"Готово: {stats['done']}, ошибок: {len(stats['failed'])}")
    for f in stats["failed"][:20]:
        print("  ✗", *f)
    total = sum(p.stat().st_size for p in AUDIO_DIR.glob("*/*.mp3"))
    print(f"Размер папки audio: {total / 1024 / 1024:.1f} МБ")


if __name__ == "__main__":
    asyncio.run(main())
