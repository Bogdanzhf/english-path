// Интервальное повторение (упрощённый SM-2) — копия backend/app/srs.py для статической версии,
// плюс общие вычисления прогресса для обоих режимов.

import type { Progress, ResultIn, ResultOut, WordState } from './types'

export const AGAIN = 0
export const HARD = 1
export const GOOD = 2
export const EASY = 3
export type Grade = 0 | 1 | 2 | 3

const MIN_EASE = 1.3
const RELEARN_MINUTES = 10
export const LEARNED_DAYS = 21
export const PASS_PERCENT = 70

export function emptyWord(): WordState {
  const now = new Date().toISOString()
  return { in_dict: false, ease: 2.5, interval: 0, reps: 0, lapses: 0, correct: 0, wrong: 0, due_at: now, seen_at: null, added_at: now }
}

export function review(prev: WordState | undefined, grade: Grade, now = new Date()): WordState {
  const w: WordState = { ...emptyWord(), ...prev }
  if (grade === AGAIN) {
    w.wrong += 1
    w.lapses += 1
    w.reps = 0
    w.interval = 0
    w.ease = Math.max(MIN_EASE, w.ease - 0.2)
    w.due_at = new Date(now.getTime() + RELEARN_MINUTES * 60_000).toISOString()
  } else {
    w.correct += 1
    w.reps += 1
    if (grade === HARD) {
      w.ease = Math.max(MIN_EASE, w.ease - 0.15)
      w.interval = Math.max(1, w.interval * 1.2)
    } else if (w.reps === 1) {
      w.interval = grade === GOOD ? 1 : 3
    } else if (w.reps === 2) {
      w.interval = grade === GOOD ? 3 : 6
    } else {
      w.interval = w.interval * w.ease * (grade === EASY ? 1.3 : 1)
    }
    if (grade === EASY) w.ease += 0.15
    w.interval = Math.round(Math.min(w.interval, 365) * 100) / 100
    w.due_at = new Date(now.getTime() + w.interval * 86_400_000).toISOString()
  }
  w.seen_at = now.toISOString()
  return w
}

/** Следующий интервал при оценке — для подписи на кнопках («через 3 дн.»). */
export function preview(prev: WordState | undefined, grade: Grade): number {
  const next = review(prev, grade)
  return grade === AGAIN ? 0 : next.interval
}

export type WordStage = 'new' | 'learning' | 'review' | 'learned'
export function stage(w: WordState | undefined): WordStage {
  if (!w || (!w.seen_at && w.reps === 0)) return 'new'
  if (w.interval >= LEARNED_DAYS) return 'learned'
  if (w.reps >= 2) return 'review'
  return 'learning'
}

export const isDue = (w: WordState | undefined, now = Date.now()) => !!w && !!w.seen_at && new Date(w.due_at).getTime() <= now

export function emptyProgress(): Progress {
  return { lessons: {}, words: {}, custom: [], results: [], activity: {} }
}

export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addActivity(p: Progress, points: number) {
  const day = today()
  p.activity[day] = (p.activity[day] ?? 0) + Math.max(0, points)
}

const LESSON_KINDS = new Set(['vocab', 'reading', 'grammar', 'dialogue'])

/** Применить результат теста к прогрессу (локальный режим; сервер делает то же самое). */
export function applyResult(p: Progress, r: ResultIn): ResultOut {
  const percent = Math.round((r.score * 100) / r.total)
  let completed = false
  if (LESSON_KINDS.has(r.kind)) {
    const row = p.lessons[r.scope] ?? { opened: true, best_score: 0, completed: false }
    row.opened = true
    row.best_score = Math.max(row.best_score, percent)
    if (percent >= PASS_PERCENT) row.completed = completed = true
    p.lessons[r.scope] = row
  }
  for (const w of r.words ?? []) p.words[w.id] = review(p.words[w.id], w.correct ? GOOD : AGAIN)
  p.results.unshift({
    id: crypto.randomUUID(),
    kind: r.kind,
    scope: r.scope,
    title: r.title || r.scope,
    score: r.score,
    total: r.total,
    created_at: new Date().toISOString(),
  })
  p.results = p.results.slice(0, 300)
  addActivity(p, 10 + r.score)
  return { percent, passed: percent >= PASS_PERCENT, completed }
}
