// Загрузка учебного контента (JSON из public/data) с кешем в памяти.

import type { Course, LevelData, LevelId, Word } from './types'

const BASE = import.meta.env.BASE_URL
export const asset = (path: string) => `${BASE}${path.replace(/^\//, '')}`

const cache = new Map<string, Promise<unknown>>()

function load<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const p = fetch(asset(`data/${name}`), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Не удалось загрузить ${name}: ${r.status}`)
      return r.json()
    })
    p.catch(() => cache.delete(name))
    cache.set(name, p)
  }
  return cache.get(name) as Promise<T>
}

export const loadCourse = () => load<Course>('course.json')
export const loadLevel = (id: LevelId) => load<LevelData>(`level-${id}.json`)

export interface WordBank {
  list: Word[]
  byId: Map<string, Word>
  byUnit: (level: LevelId, unit: number) => Word[]
  byLevel: (level: LevelId) => Word[]
}

let bank: Promise<WordBank> | null = null
export function loadWords(): Promise<WordBank> {
  bank ??= load<Word[]>('words.json').then((list) => {
    const byId = new Map(list.map((w) => [w.id, w]))
    const units = new Map<string, Word[]>()
    const levels = new Map<string, Word[]>()
    for (const w of list) {
      const k = `${w.lv}.${w.u}`
      units.set(k, [...(units.get(k) ?? []), w])
      levels.set(w.lv, [...(levels.get(w.lv) ?? []), w])
    }
    return {
      list,
      byId,
      byUnit: (level, unit) => units.get(`${level}.${unit}`) ?? [],
      byLevel: (level) => levels.get(level) ?? [],
    }
  })
  bank.catch(() => (bank = null))
  return bank
}

export const unitKey = (level: LevelId, num: number) => `${level}.${String(num).padStart(2, '0')}`
export const lessonKeys = {
  vocab: (level: LevelId, num: number) => `v.${unitKey(level, num)}`,
  reading: (level: LevelId, num: number) => `r.${unitKey(level, num)}`,
  grammar: (level: LevelId, id: string) => `g.${level}.${id}`,
  dialogue: (id: string) => `d.${id}`,
}

export const CEFR: Record<LevelId, string> = { a1: 'A1', a2: 'A2', b1: 'B1', b2: 'B2', c1: 'C1', c2: 'C2' }
