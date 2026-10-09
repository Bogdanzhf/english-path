// Подсчёты прогресса для главной и страниц уровней.

import { lessonKeys } from './course'
import { isDue, stage } from './srs'
import type { Course, LevelId, LevelMeta, Progress } from './types'

export function levelLessonKeys(level: LevelMeta): string[] {
  return [
    ...level.units.map((u) => lessonKeys.vocab(level.id, u.num)),
    ...level.units.filter((u) => u.reading).map((u) => lessonKeys.reading(level.id, u.num)),
    ...level.grammar.map((g) => lessonKeys.grammar(level.id, g.id)),
    ...level.dialogues.map((d) => lessonKeys.dialogue(d.id)),
  ]
}

export function levelProgress(level: LevelMeta, p: Progress): { done: number; total: number; percent: number } {
  const keys = levelLessonKeys(level)
  const done = keys.filter((k) => p.lessons[k]?.completed).length
  return { done, total: keys.length, percent: keys.length ? Math.round((done * 100) / keys.length) : 0 }
}

export function wordStats(p: Progress) {
  const now = Date.now()
  let learned = 0
  let inDict = 0
  let due = 0
  let seen = 0
  for (const w of Object.values(p.words)) {
    if (w.in_dict) inDict++
    if (isDue(w, now)) due++
    const s = stage(w)
    if (s === 'learned') learned++
    if (s !== 'new') seen++
  }
  return { learned, inDict, due, seen }
}

export function lastDays(p: Progress, n: number): { day: string; points: number }[] {
  const out = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    out.push({ day: key, points: p.activity[key] ?? 0 })
  }
  return out
}

/** Следующий непройденный юнит / тема / текст / диалог уровня. */
export function nextInLevel(course: Course, level: LevelId, p: Progress) {
  const meta = course.levels.find((l) => l.id === level)
  if (!meta) return {}
  const unit = meta.units.find((u) => !p.lessons[lessonKeys.vocab(level, u.num)]?.completed) ?? meta.units[0]
  const reading = meta.units.find((u) => u.reading && !p.lessons[lessonKeys.reading(level, u.num)]?.completed) ?? meta.units.find((u) => u.reading)
  const grammar = meta.grammar.find((g) => !p.lessons[lessonKeys.grammar(level, g.id)]?.completed) ?? meta.grammar[0]
  const dialogue = meta.dialogues.find((d) => !p.lessons[lessonKeys.dialogue(d.id)]?.completed) ?? meta.dialogues[0]
  return { unit, reading, grammar, dialogue }
}

// ---------- последнее открытое место ----------

const LAST_KEY = 'ep:last'
export interface LastVisit { path: string; title: string; titleRu: string; at: number }

export function rememberVisit(v: Omit<LastVisit, 'at'>) {
  localStorage.setItem(LAST_KEY, JSON.stringify({ ...v, at: Date.now() }))
}
export function lastVisit(): LastVisit | null {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null')
  } catch {
    return null
  }
}
