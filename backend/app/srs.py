"""Интервальное повторение по упрощённому алгоритму SM-2.

Оценки: 0 — «не помню», 1 — «трудно», 2 — «помню», 3 — «легко».
Ответ в упражнении: верно → 2, неверно → 0.
Та же логика продублирована во фронтенде (src/lib/srs.ts) для статической версии.
"""

from __future__ import annotations

from datetime import timedelta

from .db import WordProgress, utcnow

AGAIN, HARD, GOOD, EASY = 0, 1, 2, 3
MIN_EASE = 1.3
RELEARN_MINUTES = 10
LEARNED_DAYS = 21  # слово считается выученным при интервале от трёх недель


def review(row: WordProgress, grade: int) -> None:
    now = utcnow()
    row.ease = row.ease or 2.5
    row.interval = row.interval or 0
    row.reps = row.reps or 0
    if grade == AGAIN:
        row.wrong = (row.wrong or 0) + 1
        row.lapses = (row.lapses or 0) + 1
        row.reps = 0
        row.interval = 0
        row.ease = max(MIN_EASE, row.ease - 0.2)
        row.due_at = now + timedelta(minutes=RELEARN_MINUTES)
    else:
        row.correct = (row.correct or 0) + 1
        row.reps += 1
        if grade == HARD:
            row.ease = max(MIN_EASE, row.ease - 0.15)
            row.interval = max(1.0, row.interval * 1.2)
        elif row.reps == 1:
            row.interval = 1.0 if grade == GOOD else 3.0
        elif row.reps == 2:
            row.interval = 3.0 if grade == GOOD else 6.0
        else:
            row.interval = row.interval * row.ease * (1.3 if grade == EASY else 1.0)
        if grade == EASY:
            row.ease += 0.15
        row.interval = round(min(row.interval, 365.0), 2)
        row.due_at = now + timedelta(days=row.interval)
    row.seen_at = now
