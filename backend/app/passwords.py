"""Политика паролей.

Chrome (и менеджеры паролей) предупреждают, если введённый пароль встречается в
базах утечек. Поэтому кроме длины мы отсекаем популярные и предсказуемые пароли:
словарные слова с цифрами, последовательности клавиш, повторы, логин внутри пароля.
"""

from __future__ import annotations

import re
import unicodedata

from .i18n import msg

MIN_LENGTH = 8
MAX_LENGTH = 128

_BASE_WORDS = """
password passwort passw0rd pass qwerty qwertz azerty asdf asdfgh zxcvbn admin administrator root user login
letmein welcome hello hallo iloveyou loveyou love lover
princess dragon monkey sunshine shadow master football soccer
baseball superman batman starwars pokemon minecraft killer freedom whatever trustno1 secret segreto
test tester testing demo guest default changeme abc abcd abcdef abcdefg alpha
english england london british america american hello world liverpool chelsea arsenal manchester
family mother father baby darling honey sweet heart star kitten cat dog
russia russian moscow moskva privet parol parolparol lyubov masha natasha anastasia
flower butterfly unicorn kitty hellokitty barbie angel angela michael jennifer jessica ashley
charlie daniel thomas robert jordan hunter ranger buster summer winter spring autumn
qazwsx qweasd qweasdzxc 1q2w3e 1q2w3e4r zaq12wsx q1w2e3r4 1qaz2wsx
"""
_SUFFIXES = ["", "1", "12", "123", "1234", "12345", "123456", "!", "1!", "01", "007", "69", "77", "88", "99", "00",
             "2000", "2001", "2010", "2015", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"]


def _build_common() -> set[str]:
    words = _BASE_WORDS.split()
    common = {w + s for w in words for s in _SUFFIXES}
    common |= {w.capitalize() + s for w in words for s in _SUFFIXES}
    digits = "1234567890"
    for n in range(4, 13):
        common.add(digits[:n])
        common.add(digits[:n][::-1])
    common |= {str(d) * n for d in range(10) for n in range(4, 13)}
    common |= {"11111111", "12341234", "123123123", "112233", "121212", "654321", "696969", "147258369", "159753"}
    return {c.lower() for c in common}


COMMON = _build_common()
_LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})
_KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "йцукенгшщзхъ", "фывапролджэ", "ячсмитьбю"]


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _is_sequence(s: str) -> bool:
    """abcd…, 1234…, qwer…, а также обратные."""
    if len(s) < 4:
        return False
    for row in _KEYBOARD_ROWS + ["abcdefghijklmnopqrstuvwxyz"]:
        if s in row or s in row[::-1]:
            return True
    return False


def problems(password: str, username: str = "") -> list[str]:
    """Список причин, по которым пароль не подходит (пустой — пароль хороший)."""
    errors: list[str] = []
    if len(password) < MIN_LENGTH:
        errors.append(msg("pwd_short", n=MIN_LENGTH))
    if len(password) > MAX_LENGTH:
        errors.append(msg("pwd_long", n=MAX_LENGTH))
    low = _strip_accents(password.lower())
    core = re.sub(r"[\W_]+", "", low)
    leet = re.sub(r"[\W_]+", "", low.translate(_LEET))
    if low in COMMON or core in COMMON or leet in COMMON or re.sub(r"\d+$", "", leet) in COMMON and len(leet) < 12:
        errors.append(msg("pwd_common"))
    elif re.fullmatch(r"(.)\1+", low) or _is_sequence(core):
        errors.append(msg("pwd_sequence"))
    elif re.fullmatch(r"\d+", password) and len(password) < 12:
        errors.append(msg("pwd_digits"))
    else:
        # слово из словаря + цифры в конце (princess2024, Amore123!)
        stem = re.sub(r"[\d\W_]+$", "", core)
        if stem and (stem in COMMON or stem.translate(_LEET) in COMMON) and len(stem) >= len(core) - 4:
            errors.append(msg("pwd_word_digits"))
    u = _strip_accents(username.lower())
    if u and len(u) >= 3 and u in low:
        errors.append(msg("pwd_username"))
    if len(set(low)) < 4 and len(password) >= MIN_LENGTH:
        errors.append(msg("pwd_variety"))
    return errors


def strength(password: str) -> int:
    """Грубая оценка силы 0–4 (для подсказки в интерфейсе, дублирует логику фронтенда)."""
    if problems(password):
        return 0
    classes = sum(bool(re.search(p, password)) for p in (r"[a-zа-я]", r"[A-ZА-Я]", r"\d", r"[^\w]"))
    score = 1 + (len(password) >= 12) + (len(password) >= 16) + (classes >= 3)
    return min(score, 4)
