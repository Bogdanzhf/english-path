import { describe, expect, it } from 'vitest'
import { buildCrossword, buildWordSearch, lineCells } from './games'

const ENTRIES = ['planet', 'travel', 'animal', 'garden', 'lemon', 'rain', 'night', 'train', 'apple', 'tiger'].map((w) => ({ word: w, clue: w }))

describe('buildCrossword', () => {
  it('places words without conflicts', () => {
    const cw = buildCrossword(ENTRIES)
    expect(cw.words.length).toBeGreaterThanOrEqual(5)
    const cells = new Map<string, string>()
    for (const w of cw.words) {
      for (let i = 0; i < w.word.length; i++) {
        const r = w.dir === 'down' ? w.row + i : w.row
        const c = w.dir === 'across' ? w.col + i : w.col
        expect(r).toBeLessThan(cw.rows)
        expect(c).toBeLessThan(cw.cols)
        const k = `${r},${c}`
        if (cells.has(k)) expect(cells.get(k)).toBe(w.word[i])
        cells.set(k, w.word[i])
      }
    }
  })
  it('skips too short words', () => {
    const cw = buildCrossword([{ word: 'go', clue: '' }, { word: 'window', clue: '' }])
    expect(cw.words.map((w) => w.word)).toEqual(['WINDOW'])
  })
})

describe('buildWordSearch', () => {
  it('hides words that can be read along their cells', () => {
    const ws = buildWordSearch(ENTRIES.map((e) => e.word), 12)
    expect(ws.grid).toHaveLength(12)
    expect(ws.words.length).toBeGreaterThanOrEqual(6)
    for (const w of ws.words) expect(w.cells.map(([r, c]) => ws.grid[r][c]).join('')).toBe(w.word)
  })
})

describe('lineCells', () => {
  it('returns cells on straight lines only', () => {
    expect(lineCells([0, 0], [0, 3])).toHaveLength(4)
    expect(lineCells([0, 0], [2, 2])).toEqual([[0, 0], [1, 1], [2, 2]])
    expect(lineCells([0, 0], [1, 3])).toBeNull()
  })
})
