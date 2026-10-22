"""Озвучка курса нейроголосами Microsoft Edge TTS.

    python tools/build_audio.py              # озвучить всё недостающее (сразу в сжатом виде)
    python tools/build_audio.py --limit 50   # для пробы
    python tools/build_audio.py --compress   # пересжать уже готовые файлы (48 → 32 кбит/с, без тишины по краям)
    python tools/build_audio.py --prune      # удалить mp3, которых больше нет в курсе

Список фраз берётся из tools/audio_wanted.json (его пишет `python -m app.export`).
Готовые файлы не пересоздаются. После озвучки снова запустите экспорт, чтобы
ссылки на mp3 попали в данные курса.

Сжатие: Edge отдаёт только MP3 48 кбит/с; ffmpeg (пакет imageio-ffmpeg) срезает тишину
в начале и конце и пересжимает в MP3 моно 24 кГц 32 кбит/с — для речи разница не слышна,
а файлы почти вдвое меньше. MP3 оставлен ради iPhone: его понимает любой браузер.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import edge_tts
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.audio import AUDIO_DIR, VOICES, rel_path  # noqa: E402

WANTED = ROOT / "tools" / "audio_wanted.json"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TARGET_KBPS = 32
# тишина по краям: оставляем 50 мс в начале и 80 мс в конце, чтобы звук не обрывался
TRIM = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse")

def is_compressed(path: Path) -> bool:
    """Наши файлы прошли через ffmpeg (заголовок Lavc); исходники Edge — нет."""
    return b"Lavc" in path.read_bytes()[:400]


def compress(src: Path, dst: Path) -> None:
    """Срезать тишину и пересжать; при ошибке ffmpeg оставляем исходник как есть."""
    tmp = dst.with_suffix(".tmp.mp3")
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(src), "-af", TRIM, "-ac", "1",
                        "-ar", "24000", "-b:a", f"{TARGET_KBPS}k", "-map_metadata", "-1", str(tmp)],
                       capture_output=True)
    if r.returncode == 0 and tmp.exists() and tmp.stat().st_size > 500:
        tmp.replace(dst)
        if src != dst and src.exists():
            src.unlink()
    else:
        tmp.unlink(missing_ok=True)
        if src != dst:
            src.replace(dst)


async def synth(item: dict, sem: asyncio.Semaphore, stats: dict, pool: ThreadPoolExecutor) -> None:
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
                await asyncio.get_running_loop().run_in_executor(pool, compress, tmp, out)
                stats["done"] += 1
                if stats["done"] % 200 == 0:
                    print(f"  … {stats['done']} готово", flush=True)
                return
            except Exception as e:  # сеть может временно отказать — пробуем ещё раз
                if attempt == 3:
                    stats["failed"].append((item["key"], item["text"][:60], str(e)))
                await asyncio.sleep(2 * (attempt + 1))


def wanted_keys() -> set[str]:
    return {i["key"] for i in json.loads(WANTED.read_text(encoding="utf-8"))}


def recompress_all(workers: int) -> None:
    files = [p for p in AUDIO_DIR.glob("*/*.mp3") if not is_compressed(p)]
    print(f"Пересжать: {len(files)}")
    with ThreadPoolExecutor(workers) as pool:
        for n, _ in enumerate(pool.map(lambda p: compress(p, p), files), 1):
            if n % 1000 == 0:
                print(f"  … {n}", flush=True)


def prune() -> None:
    keep = wanted_keys()
    extra = [p for p in AUDIO_DIR.glob("*/*.mp3") if p.stem not in keep]
    size = sum(p.stat().st_size for p in extra)
    for p in extra:
        p.unlink()
    print(f"Удалено неиспользуемых: {len(extra)} ({size / 1024 / 1024:.1f} МБ)")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--compress", action="store_true", help="пересжать уже готовые файлы")
    ap.add_argument("--prune", action="store_true", help="удалить mp3, которых нет в курсе")
    args = ap.parse_args()
    if args.prune:
        prune()
    if args.compress:
        recompress_all(args.workers)
    if not (args.prune or args.compress):
        items = json.loads(WANTED.read_text(encoding="utf-8"))
        todo = [i for i in items if not (ROOT / "frontend" / "public" / rel_path(i["key"])).exists()]
        if args.limit:
            todo = todo[: args.limit]
        print(f"Всего фраз: {len(items)}, озвучить: {len(todo)}", flush=True)
        sem = asyncio.Semaphore(args.workers)
        stats: dict = {"done": 0, "failed": []}
        with ThreadPoolExecutor(4) as pool:
            await asyncio.gather(*(synth(i, sem, stats, pool) for i in todo))
        print(f"Готово: {stats['done']}, ошибок: {len(stats['failed'])}")
        for f in stats["failed"][:20]:
            print("  ✗", *f)
    total = sum(p.stat().st_size for p in AUDIO_DIR.glob("*/*.mp3"))
    print(f"Размер папки audio: {total / 1024 / 1024:.1f} МБ")


if __name__ == "__main__":
    asyncio.run(main())
