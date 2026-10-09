// Генераторы для игр: кроссворд и «найди слова».

import { shuffle } from './text'

export interface CrossWord {
  word: string
  clue: string
  row: number
  col: number
  dir: 'across' | 'down'
  num: number
}
export interface Crossword {
  rows: number
  cols: number
  words: CrossWord[]
}

const clean = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, '')

/** Кроссворд из слов: жадно пристраиваем слова к пересечениям, пробуем несколько раз и берём лучший. */
export function buildCrossword(entries: { word: string; clue: string }[], tries = 30): Crossword {
  const list = entries.map((e) => ({ ...e, word: clean(e.word) })).filter((e) => e.word.length >= 3 && e.word.length <= 13)
  let best: { placed: Omit<CrossWord, 'num'>[]; score: number } = { placed: [], score: -1 }
  for (let t = 0; t < tries; t++) {
    const order = t === 0 ? [...list].sort((a, b) => b.word.length - a.word.length) : shuffle(list)
    const grid = new Map<string, string>()
    const placed: Omit<CrossWord, 'num'>[] = []
    const key = (r: number, c: number) => `${r},${c}`
    const canPlace = (w: string, r: number, c: number, dir: 'across' | 'down') => {
      let crosses = 0
      const dr = dir === 'down' ? 1 : 0
      const dc = dir === 'across' ? 1 : 0
      if (grid.has(key(r - dr, c - dc)) || grid.has(key(r + dr * w.length, c + dc * w.length))) return -1
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i
        const cc = c + dc * i
        const ch = grid.get(key(rr, cc))
        if (ch) {
          if (ch !== w[i]) return -1
          crosses++
        } else {
          // соседние клетки сбоку должны быть пустыми, иначе получатся лишние слова
          if (grid.has(key(rr + dc, cc + dr)) || grid.has(key(rr - dc, cc - dr))) return -1
        }
      }
      return crosses
    }
    const put = (w: string, r: number, c: number, dir: 'across' | 'down', clue: string) => {
      for (let i = 0; i < w.length; i++) grid.set(key(r + (dir === 'down' ? i : 0), c + (dir === 'across' ? i : 0)), w[i])
      placed.push({ word: w, clue, row: r, col: c, dir })
    }
    for (const e of order) {
      if (!placed.length) {
        put(e.word, 0, 0, 'across', e.clue)
        continue
      }
      let bestPos: { r: number; c: number; dir: 'across' | 'down'; crosses: number } | null = null
      for (const p of placed) {
        for (let i = 0; i < p.word.length; i++) {
          for (let j = 0; j < e.word.length; j++) {
            if (p.word[i] !== e.word[j]) continue
            const dir = p.dir === 'across' ? 'down' : 'across'
            const r = p.dir === 'across' ? p.row - j : p.row + i
            const c = p.dir === 'across' ? p.col + i : p.col - j
            const crosses = canPlace(e.word, r, c, dir)
            if (crosses > 0 && (!bestPos || crosses > bestPos.crosses)) bestPos = { r, c, dir, crosses }
          }
        }
      }
      if (bestPos) put(e.word, bestPos.r, bestPos.c, bestPos.dir, e.clue)
    }
    const rs = placed.flatMap((p) => [p.row, p.row + (p.dir === 'down' ? p.word.length - 1 : 0)])
    const cs = placed.flatMap((p) => [p.col, p.col + (p.dir === 'across' ? p.word.length - 1 : 0)])
    const area = (Math.max(...rs) - Math.min(...rs) + 1) * (Math.max(...cs) - Math.min(...cs) + 1)
    const score = placed.length * 1000 - area
    if (score > best.score) best = { placed, score }
  }
  const minR = Math.min(...best.placed.map((p) => p.row))
  const minC = Math.min(...best.placed.map((p) => p.col))
  const norm = best.placed.map((p) => ({ ...p, row: p.row - minR, col: p.col - minC }))
  // нумерация клеток слева направо, сверху вниз
  const starts = [...new Set(norm.map((p) => `${p.row},${p.col}`))].sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number)
    const [br, bc] = b.split(',').map(Number)
    return ar - br || ac - bc
  })
  const words = norm.map((p) => ({ ...p, num: starts.indexOf(`${p.row},${p.col}`) + 1 }))
  const rows = Math.max(...words.map((p) => p.row + (p.dir === 'down' ? p.word.length : 1)))
  const cols = Math.max(...words.map((p) => p.col + (p.dir === 'across' ? p.word.length : 1)))
  return { rows, cols, words }
}

export interface WordSearch {
  size: number
  grid: string[][]
  words: { word: string; cells: [number, number][] }[]
}

const DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
]

export function buildWordSearch(input: string[], size = 12): WordSearch {
  const words = shuffle(input.map(clean).filter((w) => w.length >= 3 && w.length <= size)).slice(0, 10)
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''))
  const placed: WordSearch['words'] = []
  for (const w of words.sort((a, b) => b.length - a.length)) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const [dr, dc] = DIRS[Math.floor(Math.random() * DIRS.length)]
      const r0 = Math.floor(Math.random() * size)
      const c0 = Math.floor(Math.random() * size)
      const cells: [number, number][] = []
      let ok = true
      for (let i = 0; i < w.length; i++) {
        const r = r0 + dr * i
        const c = c0 + dc * i
        if (r < 0 || r >= size || c < 0 || c >= size || (grid[r][c] && grid[r][c] !== w[i])) {
          ok = false
          break
        }
        cells.push([r, c])
      }
      if (!ok) continue
      cells.forEach(([r, c], i) => (grid[r][c] = w[i]))
      placed.push({ word: w, cells })
      break
    }
  }
  const abc = 'ABCDEFGHIJKLMNOPRSTUVWY'
  for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = abc[Math.floor(Math.random() * abc.length)]
  return { size, grid, words: placed }
}

/** Клетки по прямой между двумя точками (или null, если не по прямой). */
export function lineCells(a: [number, number], b: [number, number]): [number, number][] | null {
  const dr = Math.sign(b[0] - a[0])
  const dc = Math.sign(b[1] - a[1])
  const len = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
  if (!(a[0] === b[0] || a[1] === b[1] || Math.abs(b[0] - a[0]) === Math.abs(b[1] - a[1]))) return null
  return Array.from({ length: len + 1 }, (_, i) => [a[0] + dr * i, a[1] + dc * i] as [number, number])
}
