// Сборка тестов: по уровню и «свой тест» — слова, грамматика, чтение, аудирование.

import type { WordBank } from './course'
import { exampleGap, toItems, wordExercise, type QuizItem } from './quiz'
import { sample, shuffle } from './text'
import type { LevelData, LevelId } from './types'

export interface TestSections {
  vocab: boolean
  grammar: boolean
  reading: boolean
  listening: boolean
}

const GRAMMAR_TYPES = new Set(['choice', 'input', 'cloze', 'error', 'order', 'tf', 'odd'])

export function buildTest(
  level: LevelData,
  bank: WordBank,
  { sections, count, lang, accent }: { sections: TestSections; count: number; lang: 'ru' | 'en'; accent: 'uk' | 'us' },
): QuizItem[] {
  const parts = Object.entries(sections).filter(([, on]) => on).map(([k]) => k as keyof TestSections)
  if (!parts.length) return []
  const per = Math.max(2, Math.round(count / parts.length))
  const words = bank.byLevel(level.id as LevelId)
  const items: QuizItem[] = []

  if (sections.vocab && words.length >= 4) {
    for (const w of sample(words, per)) {
      const mode = sample(['meaning', 'reverse', 'definition', 'cloze', 'spell'] as const, 1)[0]
      items.push(wordExercise(w, mode, { lang, accent, pool: words }))
    }
  }

  if (sections.grammar) {
    const all = level.grammar.flatMap((g) => toItems(g.exercises, `g.${level.id}.${g.id}`).filter((it) => GRAMMAR_TYPES.has(it.ex.type)))
    items.push(...sample(all, per))
  }

  if (sections.reading) {
    const readings = level.units.filter((u) => u.reading && u.reading.questions.length)
    const r = sample(readings, 1)[0]?.reading
    if (r) {
      const text = r.paras.map((p) => p.s.map((s) => s.en).join(' ')).join('\n\n')
      for (const it of toItems(r.questions, `r.${level.id}.${r.title}`).slice(0, per)) {
        items.push({ ...it, ex: { ...it.ex, context: { title: r.title, text } } })
      }
    }
  }

  if (sections.listening && words.length >= 4) {
    for (const w of sample(words, per)) {
      const gap = exampleGap(w)
      const others = sample(words.filter((x) => x.id !== w.id), 3).map((x) => exampleGap(x).answer)
      const options = shuffle([gap.answer, ...others])
      items.push({
        key: `${w.id}.listen`,
        wordId: w.id,
        ex: {
          type: 'listen',
          audio: w.ex.replace(/\*/g, ''),
          audioKey: w.ae,
          q: gap.text,
          options,
          answer: options.indexOf(gap.answer),
          task: 'Listen and choose the missing word',
          taskRu: 'Послушайте и выберите пропущенное слово',
        },
      })
    }
  }
  // чтение — блоком в конце (один текст), остальное вперемешку
  const reading = items.filter((i) => i.ex.context)
  return [...shuffle(items.filter((i) => !i.ex.context)), ...reading].slice(0, Math.max(count, reading.length))
}
