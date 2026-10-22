import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkGap, checkOrder, clozeGaps, exampleGap, fixedSentence, parseCloze, parseError } from './quiz'

describe('parseCloze', () => {
  it('parses input gaps with alternatives', () => {
    const parts = parseCloze("I [[have lost|'ve lost]] my keys.")
    const [gap] = clozeGaps(parts)
    expect(gap).toEqual({ kind: 'input', answers: ['have lost', "'ve lost"] })
    expect(checkGap(gap, "I've lost".slice(1).trim()) || checkGap(gap, 'have lost')).toBe(true)
  })
  it('parses dropdowns and finds the right option', () => {
    const [gap] = clozeGaps(parseCloze('It [[might/*must/can]] be true.'))
    expect(gap).toEqual({ kind: 'select', options: ['might', 'must', 'can'], answer: 1 })
    expect(checkGap(gap, '1')).toBe(true)
    expect(checkGap(gap, '0')).toBe(false)
  })
})

describe('parseError / fixedSentence', () => {
  it('marks the wrong token', () => {
    const t = parseError('She has {{went=>gone}} home.')
    expect(t.filter((x) => x.wrong)).toEqual([{ text: 'went', wrong: true, fix: 'gone' }])
    expect(fixedSentence('She has {{went=>gone}} home.')).toBe('She has gone home.')
  })
})

describe('checkOrder', () => {
  it('ignores case and punctuation', () => {
    expect(checkOrder('Have you ever been to Italy?', ['have', 'you', 'ever', 'been', 'to', 'italy'])).toBe(true)
    expect(checkOrder('Have you ever been to Italy?', ['you', 'have', 'ever', 'been', 'to', 'italy'])).toBe(false)
  })
})

describe('exampleGap', () => {
  it('hides the marked word', () => {
    const g = exampleGap({ w: 'agree', ex: 'We *agree* on this.' } as never)
    expect(g).toEqual({ text: 'We _____ on this.', answer: 'agree' })
  })
})

// ---------- весь экспортированный контент разбирается без ошибок ----------

const DATA = resolve(__dirname, '../../public/data')
const load = (f: string) => JSON.parse(readFileSync(resolve(DATA, f), 'utf-8'))

describe('exported course content', () => {
  const levels = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((lv) => load(`level-${lv}.json`))
  const exercises: { type: string; [k: string]: unknown }[] = []
  for (const lv of levels) {
    for (const g of lv.grammar) exercises.push(...g.exercises)
    for (const d of lv.dialogues) exercises.push(...(d.exercises ?? []))
  }
  exercises.push(...load('course.json').placement)

  it('has a lot of exercises', () => {
    expect(exercises.length).toBeGreaterThan(1500)
  })
  it('every dropdown has a correct option', () => {
    for (const ex of exercises.filter((e) => e.type === 'cloze')) {
      for (const gap of clozeGaps(parseCloze(ex.text as string))) {
        if (gap.kind === 'select') expect(gap.answer, ex.text as string).toBeGreaterThanOrEqual(0)
        else expect(gap.answers.every((a) => a.length > 0), ex.text as string).toBe(true)
      }
    }
  })
  it('every error exercise has exactly one wrong token', () => {
    for (const ex of exercises.filter((e) => e.type === 'error')) {
      expect(parseError(ex.text as string).filter((t) => t.wrong), ex.text as string).toHaveLength(1)
    }
  })
  it('every word example contains the marked word', () => {
    const words = load('words.json') as { w: string; ex: string }[]
    expect(words.length).toBeGreaterThan(9000)
    for (const w of words) expect(exampleGap(w as never).text, w.ex).toContain('_____')
  })
})
