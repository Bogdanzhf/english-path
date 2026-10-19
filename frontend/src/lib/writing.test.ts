import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { ComposeEx, Course, LevelData, Word, WriteEx } from './types'
import { checkCompose, checkWrite, diffWords, pickWriting, unitWriting, wordForms } from './writing'

const DATA = join(__dirname, '..', '..', 'public', 'data')
const read = <T,>(f: string): T => JSON.parse(readFileSync(join(DATA, f), 'utf8'))
const course = read<Course>('course.json')
const words = read<Word[]>('words.json')

describe('checkWrite', () => {
  it('accepts contractions, case and punctuation differences', () => {
    expect(checkWrite("i'm not a teacher", ["I am not a teacher."]).verdict).toBe('ok')
    expect(checkWrite('She does not work on Sundays', ["She doesn't work on Sundays."]).verdict).toBe('ok')
    expect(checkWrite("He's finished", ['He has finished.']).verdict).toBe('ok')
    expect(checkWrite("I'd seen it", ['I had seen it.']).verdict).toBe('ok')
  })
  it('typos in long words are ok but flagged', () => {
    const r = checkWrite('My sister and I agre that summer is the best season', ['My sister and I agree that summer is the best season.'])
    expect(r.verdict).toBe('ok')
    expect(r.typos).toBe(true)
  })
  it('one wrong word in a long sentence is near, a different sentence is wrong', () => {
    expect(checkWrite('My sister and I agree that winter is the best season', ['My sister and I agree that summer is the best season.']).verdict).toBe('near')
    expect(checkWrite('I like cats', ['My sister and I agree that summer is the best season.']).verdict).toBe('wrong')
  })
  it('strict mode checks punctuation', () => {
    expect(checkWrite('It was late, we went home.', ['It was late; we went home.'], true).verdict).toBe('wrong')
    expect(checkWrite('it was late ; we went home', ['It was late; we went home.'], true).verdict).toBe('ok')
  })
  it('picks the closest of several answers', () => {
    expect(checkWrite('Please call me', ['Call me, please.', 'Please call me.']).verdict).toBe('ok')
  })
})

describe('diffWords', () => {
  it('marks missing, extra and typo words', () => {
    const d = diffWords('I watched the flim yesterday', 'I watched the film yesterday.')
    expect(d.map((x) => x.kind)).toContain('typo')
    const m = diffWords('I like', 'I like cats')
    expect(m.at(-1)).toEqual({ text: 'cats', kind: 'missing' })
    const e = diffWords('I do like cats', 'I like cats')
    expect(e.find((x) => x.kind === 'extra')?.text).toBe('do')
  })
})

describe('checkCompose', () => {
  const irr = course.irregular
  it('finds any form of the word, including irregular verbs', () => {
    expect(wordForms('catch', irr)).toContain('caught')
    expect(checkCompose('I caught the last bus home', { must: ['catch'] }, irr).ok).toBe(true)
    expect(checkCompose('She agreed with me yesterday', { must: ['agree'] }, irr).ok).toBe(true)
    expect(checkCompose('We are planning a big trip', { must: ['plan'] }, irr).ok).toBe(true)
  })
  it('phrasal verbs, start and length', () => {
    expect(checkCompose('I finally figured it out today', { must: ['figure out'] }, irr).ok).toBe(true)
    expect(checkCompose('I like it', { must: ['like'] }, irr).tooShort).toBe(true)
    expect(checkCompose('I would travel more', { start: 'If I had more time,', min: 7 }, irr).badStart).toBe(true)
  })
})

describe('writing content', () => {
  const levels = course.levels.map((l) => read<LevelData>(`level-${l.id}.json`))

  it('every grammar writing model passes its own check', () => {
    const broken: string[] = []
    let total = 0
    for (const lv of levels)
      for (const g of lv.grammar)
        for (const ex of g.writing ?? []) {
          total++
          if (ex.type === 'write') {
            for (const a of (ex as WriteEx).answer) if (checkWrite(a, (ex as WriteEx).answer, (ex as WriteEx).strict).verdict !== 'ok') broken.push(`${g.id}: ${a}`)
          } else {
            const c = ex as ComposeEx
            for (const m of c.model) if (!checkCompose(m, c, course.irregular).ok) broken.push(`${g.id}: ${m} ${JSON.stringify(checkCompose(m, c, course.irregular))}`)
          }
        }
    expect(total).toBeGreaterThan(100)
    expect(broken).toEqual([])
  })

  it('every unit example contains its word, so «own sentence» is solvable', () => {
    const broken = words.filter((w) => !checkCompose(w.ex.replace(/\*/g, ''), { must: [w.w], min: 1 }, course.irregular).ok).map((w) => `${w.id}: ${w.ex}`)
    expect(broken).toEqual([])
  })

  it('unit writing mixes kinds and respects the count', () => {
    const unit = words.filter((w) => w.lv === 'a1' && w.u === 1)
    const items = unitWriting(unit, 'w.a1.01')
    expect(items.length).toBeGreaterThanOrEqual(40)
    const picked = pickWriting(items, ['translate', 'compose', 'order'], 10)
    expect(picked).toHaveLength(10)
    expect(new Set(picked.map((p) => p.ex.type)).size).toBeGreaterThan(1)
    expect(pickWriting(items, ['compose'], 5).every((p) => p.ex.type === 'compose')).toBe(true)
  })
})
