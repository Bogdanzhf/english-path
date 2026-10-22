"""Тексты v1 (по одному на старый юнит) из ветки main → tools/v2/readings/<lv>.yaml.

Запускается один раз; дальше тексты правятся в tools/v2/readings, а attach_readings.py
раскладывает их по новым тематическим урокам.
"""
import subprocess, sys, yaml
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tools" / "v2" / "readings"
LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2"]


def git_show(path: str) -> str:
    return subprocess.run(["git", "show", f"main:{path}"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8").stdout


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for lv in LEVELS:
        items = []
        for n in range(1, 31):
            data = yaml.safe_load(git_show(f"backend/content/vocab/{lv}/u{n:02d}.yaml")) or {}
            r = data.get("reading")
            if r:
                items.append({"id": f"{lv}-{n:02d}", "v1_unit": data.get("title", ""), **r})
        (OUT / f"{lv}.yaml").write_text(yaml.safe_dump(items, allow_unicode=True, sort_keys=False, width=1000), encoding="utf-8")
        print(lv, len(items))


if __name__ == "__main__":
    main()
