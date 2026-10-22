"""Транскрипции UK/US из ipa-dict (MIT, open-dict-data) в стиле учебных словарей (Oxford Learner's).

ipa-dict сделан на основе eSpeak: ударение стоит перед гласной (tɹˈiː), r — как ɹ, тёмное l — ɫ, в американском
нет долготы. Здесь это приводится к привычному виду: triː, əˈɡriː, US ˈmɪtəɡeɪt.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "_scratch" / "sources" / "ipa"
VOWELS = set("aeiouæɑɒɔəɛɜɪʊʌɐɚɝ")
# допустимые начала слога (для переноса знака ударения влево)
ONSETS = {
    "pl", "pr", "bl", "br", "tr", "dr", "kl", "kr", "kw", "gl", "gr", "fl", "fr", "θr", "ʃr", "sp", "st", "sk", "sm",
    "sn", "sl", "sw", "spr", "str", "skr", "spl", "skw", "pj", "bj", "tj", "dj", "kj", "gj", "mj", "nj", "fj", "vj",
    "hj", "lj", "sj", "zj", "θj", "tʃ", "dʒ", "tw", "dw", "gw", "θw", "ɡl", "ɡr", "ɡw", "ɡj",
}


def _load(name: str) -> dict[str, str]:
    out: dict[str, str] = {}
    path = SRC / f"{name}.txt"
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        word, _, ipa = line.partition("\t")
        if word and ipa:
            out[word.lower()] = ipa.split(",")[0].strip().strip("/")
    return out


@lru_cache(maxsize=1)
def dicts() -> tuple[dict[str, str], dict[str, str]]:
    return _load("en_UK"), _load("en_US")


def _segments(s: str) -> list[str]:
    """Разбить на звуки: аффрикаты и долгие гласные — одним элементом."""
    out, i = [], 0
    while i < len(s):
        for two in ("tʃ", "dʒ", "eɪ", "aɪ", "ɔɪ", "əʊ", "aʊ", "ɪə", "eə", "ʊə", "oʊ"):
            if s.startswith(two, i):
                out.append(two)
                i += 2
                break
        else:
            ch = s[i]
            if i + 1 < len(s) and s[i + 1] == "ː":
                ch += "ː"
                i += 1
            out.append(ch)
            i += 1
    return out


def _is_vowel(seg: str) -> bool:
    return seg[0] in VOWELS


def move_stress(s: str) -> str:
    """tɹˈiː → ˈtriː, dɪlˈiːt → dɪˈliːt: знак ударения — перед началом слога."""
    segs = _segments(s)
    out: list[str] = []
    for seg in segs:
        if seg in ("ˈ", "ˌ"):
            # сколько согласных перед гласной можно забрать в слог
            j = len(out)
            cons = []
            while j > 0 and not _is_vowel(out[j - 1]) and out[j - 1] not in ("ˈ", "ˌ", " "):
                cons.insert(0, out[j - 1])
                j -= 1
            take = 0
            for k in range(len(cons), 0, -1):
                cluster = "".join(cons[-k:])
                if k == 1 or cluster in ONSETS:
                    # в начале слова — всё скопление, внутри — хотя бы одну согласную оставить предыдущему слогу
                    if j == 0 and k == len(cons) or k == 1 or cluster in ONSETS:
                        take = k
                        break
            if j == 0:
                take = len(cons)
            out.insert(len(out) - take, seg)
        else:
            out.append(seg)
    return "".join(out)


def _finish(s: str) -> str:
    # второстепенное ударение после основного учебные словари не показывают
    k = s.find("ˈ")
    if k >= 0:
        s = s[:k + 1] + s[k + 1:].replace("ˌ", "")
    # односложные слова — без знака ударения (проверяем до слоговых l/n)
    if s.count("ˈ") == 1 and sum(1 for seg in _segments(s) if _is_vowel(seg)) == 1:
        s = s.replace("ˈ", "")
    # слоговые l, n: ˈkæpɪtəl → ˈkæpɪtl, ˈɡɑːdən → ˈɡɑːdn
    s = re.sub(r"(?<=[ptkbdɡfvszʃʒθðmnŋ])əl(?=$| )", "l", s)
    s = re.sub(r"(?<=[td])ən(?=$| )", "n", s)
    return s.strip()


def to_uk(raw: str, from_us: bool = False) -> str:
    s = raw.replace("ɹ", "r").replace("ɫ", "l").replace("ɛ", "e").replace("ᵻ", "ɪ").replace("ɾ", "t").replace("ʔ", "")
    s = s.replace("ɐ", "ə")
    if from_us:  # британского варианта нет — убираем «r» в конце слога, ɑ → ɑː
        s = s.replace("ɝ", "ɜː").replace("ɚ", "ə").replace("oʊ", "əʊ")
        s = re.sub(r"r(?=[^aeiouæɑɒɔəɛɜɪʊʌ]|$)", "", s)
        s = re.sub(r"([ɑɔ])(?!ː)", r"ː", s).replace("ɑː", "ɒ") if "ɑ" in s and "ɑr" not in raw else re.sub(r"ɔ(?!ː)", "ɔː", s)
        s = re.sub(r"(?<=r)i(?=ˈ)", "ɪ", s)
    else:
        s = move_stress(s)
    # безударное начальное e перед согласными (enjoy, experiment) — ɪ
    s = re.sub(r"^e(?=[nmkɡlsd][^ː]*ˈ)", "ɪ", s)
    return _finish(s)


def to_us(raw: str) -> str:
    s = raw.replace("ɹ", "r").replace("ɫ", "l").replace("ɛ", "e").replace("ɾ", "t").replace("ᵻ", "ɪ")
    # «ɝˈaɪv» (arrive) → «əˈraɪv»: r уходит в следующий слог
    s = re.sub(r"[ɝɚ]([ˈˌ])(?=[aeiouæɑɒɔəɛɜɪʊʌ])", r"ə\1r", s)
    s = s.replace("ɚr", "ər")
    segs = _segments(s)
    out: list[str] = []
    after_stress = False
    for k, seg in enumerate(segs):
        nxt = segs[k + 1] if k + 1 < len(segs) else ""
        if seg in ("ˈ", "ˌ"):
            after_stress = True
            out.append(seg)
            continue
        if _is_vowel(seg):
            stressed = after_stress
            after_stress = False
            if seg == "ə" and stressed:
                seg = "ʌ"
            elif seg == "ɝ":
                seg = "ɜːr" if stressed else "ər"
            elif seg == "ɚ":
                seg = "ər"
            elif seg == "i":
                seg = "i" if nxt == "" or nxt == "ə" else "iː"
                if nxt == "" and stressed:
                    seg = "iː"
            elif seg == "u":
                seg = "uː"
            elif seg in ("ɑ", "ɔ"):
                seg = seg + "ː"
        out.append(seg)
    s = "".join(out)
    if re.fullmatch(r"[^aeiouæɑɒɔəɛɜɪʊʌ]*i", s):
        s += "ː"
    return _finish(s)


@lru_cache(maxsize=1)
def manual() -> dict[str, tuple[str, str]]:
    out = {}
    path = Path(__file__).with_name("ipa_manual.txt")
    for line in path.read_text(encoding="utf-8").splitlines() if path.exists() else []:
        if " = " in line and not line.startswith("#"):
            w, _, ipa = line.partition(" = ")
            uk, _, us = ipa.partition(" | ")
            out[w.strip().lower()] = (uk.strip(), (us or uk).strip())
    return out


def lookup(phrase: str) -> tuple[str, str]:
    """(UK, US) для слова или выражения из нескольких слов; пустая строка — если чего-то нет в словаре."""
    if phrase.lower() in manual():
        return manual()[phrase.lower()]
    uk_d, us_d = dicts()
    words = re.findall(r"[a-zA-Z'’-]+", phrase.lower().replace("’", "'"))
    if not words:
        return "", ""
    uk, us = [], []
    for w in words:
        u = uk_d.get(w) or uk_d.get(w.replace("-", ""))
        a = us_d.get(w) or us_d.get(w.replace("-", ""))
        if not u and not a:
            return "", ""
        uk.append(to_uk(u) if u else to_uk(a, from_us=True))
        us.append(to_us(a or u))
    return " ".join(uk), " ".join(us)
