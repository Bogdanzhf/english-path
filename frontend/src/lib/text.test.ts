import { describe, expect, it } from 'vitest'
import { expand, levenshtein, matches, nearMiss, norm, shuffle, speechScore } from './text'

describe('norm / expand', () => {
  it('ignores case, curly apostrophes and punctuation', () => {
    expect(norm('  Hello,   World!  ')).toBe('hello world')
    expect(norm('It’s')).toBe("it's")
  })
  it('expands contractions', () => {
    expect(expand("I don't know")).toBe('i do not know')
    expect(expand("won't")).toBe('will not')
    expect(expand("can't")).toBe('cannot')
    expect(expand('can not')).toBe('cannot')
  })
})

describe('matches', () => {
  it('accepts contracted and full forms', () => {
    expect(matches('have not finished', ["haven't finished"])).toBe(true)
    expect(matches("I'd gone", ['I had gone'])).toBe(true)
    expect(matches("I'd go", ['I would go'])).toBe(true)
  })
  it('accepts any of several answers', () => {
    expect(matches('Whether', ['if', 'whether'])).toBe(true)
  })
  it('rejects wrong answers', () => {
    expect(matches('went', ['gone'])).toBe(false)
    expect(matches("it's", ['its'])).toBe(false)
  })
})

describe('nearMiss / levenshtein', () => {
  it('detects one typo in long words only', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(nearMiss('recieve', ['receive'])).toBe(false) // две правки
    expect(nearMiss('beautful', ['beautiful'])).toBe(true)
    expect(nearMiss('cst', ['cat'])).toBe(false) // слишком короткое
  })
})

describe('speechScore', () => {
  it('scores recognised words', () => {
    const r = speechScore('I have never been to Japan', ['i have never been to japan'])
    expect(r.score).toBe(1)
  })
  it('picks the best of several recognition variants', () => {
    const r = speechScore('Good morning', ['good evening', 'good morning'])
    expect(r.score).toBe(1)
    expect(r.best).toBe('good morning')
  })
  it('marks missing words', () => {
    const r = speechScore('the cat sat on the mat', ['the cat'])
    expect(r.score).toBeLessThan(0.5)
    expect(r.words.find((w) => w.w === 'mat')?.ok).toBe(false)
  })
})

describe('shuffle', () => {
  it('keeps all elements', () => {
    const a = [1, 2, 3, 4, 5]
    expect(shuffle(a).sort()).toEqual(a)
    expect(a).toEqual([1, 2, 3, 4, 5])
  })
})
