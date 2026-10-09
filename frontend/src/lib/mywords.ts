// Слова личного словаря: слова курса и свои, в общем виде для карточек и тренажёров.

import type { WordBank } from './course'
import type { CustomWord, Progress, Word } from './types'

/** Своё слово в виде слова курса (для генератора упражнений). */
export function customAsWord(c: CustomWord): Word {
  const ex = c.example && c.example.toLowerCase().includes(c.word.toLowerCase())
    ? c.example.replace(new RegExp(c.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), (m) => `*${m}*`)
    : `*${c.word}*`
  return {
    id: c.id,
    w: c.word,
    pos: 'phr',
    uk: c.ipa,
    us: c.ipa,
    ru: c.translation || c.word,
    def: c.translation || c.word,
    ex,
    exRu: '',
    lv: 'a1',
    u: 0,
  }
}

export function dictWords(bank: WordBank, p: Progress): Word[] {
  const out: Word[] = []
  const custom = new Map(p.custom.map((c) => [c.id, c]))
  for (const [id, st] of Object.entries(p.words)) {
    if (!st.in_dict) continue
    const w = bank.byId.get(id) ?? (custom.has(id) ? customAsWord(custom.get(id)!) : undefined)
    if (w) out.push(w)
  }
  return out
}

export function resolveWord(bank: WordBank, p: Progress, id: string): Word | undefined {
  if (bank.byId.has(id)) return bank.byId.get(id)
  const c = p.custom.find((x) => x.id === id)
  return c ? customAsWord(c) : undefined
}
