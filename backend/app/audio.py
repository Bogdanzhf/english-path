"""Озвучка: какой голос читает фразу и где лежит mp3.

Файлы создаёт tools/build_audio.py (нейроголоса Microsoft Edge TTS) в frontend/public/audio.
Имя файла — хеш «голос|текст», поэтому одинаковые фразы озвучиваются один раз,
а исправленный текст автоматически получает новый файл. Если файла нет, фронтенд
читает фразу голосом устройства (Web Speech API).
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

from .config import ROOT

AUDIO_DIR = ROOT / "frontend" / "public" / "audio"

VOICES = {
    "f-uk": "en-GB-SoniaNeural",
    "m-uk": "en-GB-RyanNeural",
    "f-us": "en-US-AvaNeural",
    "m-us": "en-US-AndrewNeural",
    "f-uk2": "en-GB-LibbyNeural",
    "m-uk2": "en-GB-ThomasNeural",
    "f-us2": "en-US-EmmaNeural",
    "m-us2": "en-US-BrianNeural",
    "f-au": "en-AU-NatashaNeural",
    "m-au": "en-AU-WilliamMultilingualNeural",
}
# голоса персонажей диалогов (в YAML пишется f-us, m-uk …)
DIALOGUE_VOICES = {"f-us": "f-us2", "m-us": "m-us2", "f-uk": "f-uk2", "m-uk": "m-uk2", "f-au": "f-au", "m-au": "m-au"}
NARRATORS = ["f-us", "m-uk", "f-uk", "m-us"]


def clean(text: str) -> str:
    """Убираем разметку: *выделение*, **жирный**, `код`, лишние пробелы."""
    text = re.sub(r"[*_`#>]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def key(voice: str, text: str) -> str:
    return hashlib.sha1(f"{VOICES[voice]}|{clean(text)}".encode()).hexdigest()[:16]


def rel_path(k: str) -> str:
    return f"audio/{k[:2]}/{k}.mp3"


class AudioIndex:
    """Собирает список нужных фраз и отвечает, какие файлы уже готовы."""

    def __init__(self, root: Path = AUDIO_DIR) -> None:
        self.root = root
        self.existing = {p.stem for p in root.glob("*/*.mp3")} if root.exists() else set()
        self.wanted: dict[str, tuple[str, str]] = {}

    def ref(self, voice: str, text: str) -> str | None:
        """Ключ файла, если он уже озвучен (иначе None — фронтенд использует голос устройства)."""
        text = clean(text)
        if not text:
            return None
        k = key(voice, text)
        self.wanted[k] = (voice, text)
        return k if k in self.existing else None

    def narrator(self, seed: str) -> str:
        return NARRATORS[int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(NARRATORS)]


SENTENCE_RE = re.compile(r"(?<=[.!?…])[\"”’)]?\s+(?=[\"“‘(]?[A-Z0-9])")
ABBREV = ("Mr.", "Mrs.", "Ms.", "Dr.", "St.", "Jr.", "Sr.", "vs.", "etc.", "e.g.", "i.e.", "a.m.", "p.m.", "U.S.", "D.C.")


def sentences(paragraph: str) -> list[str]:
    """Делим абзац на предложения (с учётом частых сокращений)."""
    text = re.sub(r"\s+", " ", paragraph.strip())
    protected = text
    for i, a in enumerate(ABBREV):
        protected = protected.replace(a, f"\x00{i}\x00")
    parts = SENTENCE_RE.split(protected)
    out = []
    for p in parts:
        for i, a in enumerate(ABBREV):
            p = p.replace(f"\x00{i}\x00", a)
        if p.strip():
            out.append(p.strip())
    return out
