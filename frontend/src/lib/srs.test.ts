import { describe, expect, it } from 'vitest'
import { AGAIN, EASY, GOOD, HARD, applyResult, emptyProgress, isDue, review, stage } from './srs'

const now = new Date('2026-01-01T10:00:00Z')

describe('review (SM-2)', () => {
  it('grows intervals on good answers', () => {
    let w = review(undefined, GOOD, now)
    expect(w.interval).toBe(1)
    w = review(w, GOOD, now)
    expect(w.interval).toBe(3)
    w = review(w, GOOD, now)
    expect(w.interval).toBe(7.5) // 3 × 2.5
    expect(w.correct).toBe(3)
  })
  it('easy answers jump further and raise ease', () => {
    const w = review(undefined, EASY, now)
    expect(w.interval).toBe(3)
    expect(w.ease).toBeCloseTo(2.65)
  })
  it('hard answers lower ease', () => {
    const w = review(review(undefined, GOOD, now), HARD, now)
    expect(w.ease).toBeCloseTo(2.35)
    expect(w.interval).toBeGreaterThanOrEqual(1)
  })
  it('a lapse resets the word and schedules it in 10 minutes', () => {
    const w = review(review(review(undefined, GOOD, now), GOOD, now), AGAIN, now)
    expect(w.reps).toBe(0)
    expect(w.interval).toBe(0)
    expect(w.lapses).toBe(1)
    expect(new Date(w.due_at).getTime() - now.getTime()).toBe(10 * 60_000)
  })
  it('ease never drops below 1.3', () => {
    let w = review(undefined, AGAIN, now)
    for (let i = 0; i < 20; i++) w = review(w, AGAIN, now)
    expect(w.ease).toBe(1.3)
  })
  it('caps intervals at a year', () => {
    let w = review(undefined, EASY, now)
    for (let i = 0; i < 20; i++) w = review(w, EASY, now)
    expect(w.interval).toBe(365)
  })
})

describe('stage / isDue', () => {
  it('moves from new to learned', () => {
    expect(stage(undefined)).toBe('new')
    let w = review(undefined, GOOD, now)
    expect(stage(w)).toBe('learning')
    w = review(w, GOOD, now)
    expect(stage(w)).toBe('review')
    for (let i = 0; i < 3; i++) w = review(w, GOOD, now)
    expect(stage(w)).toBe('learned')
  })
  it('knows when a word is due', () => {
    const w = review(undefined, GOOD, now)
    expect(isDue(w, now.getTime())).toBe(false)
    expect(isDue(w, now.getTime() + 2 * 86_400_000)).toBe(true)
    expect(isDue(undefined)).toBe(false)
  })
})

describe('applyResult', () => {
  it('completes a lesson at 70% and updates words', () => {
    const p = emptyProgress()
    expect(applyResult(p, { kind: 'vocab', scope: 'v.a1.01', score: 6, total: 10 }).completed).toBe(false)
    const r = applyResult(p, { kind: 'vocab', scope: 'v.a1.01', score: 7, total: 10, words: [{ id: 'a1.01.agree', correct: true }] })
    expect(r).toMatchObject({ percent: 70, passed: true, completed: true })
    expect(p.lessons['v.a1.01']).toEqual({ opened: true, best_score: 70, completed: true })
    expect(p.words['a1.01.agree'].correct).toBe(1)
    expect(p.results).toHaveLength(2)
  })
  it('does not create lessons for tests and games', () => {
    const p = emptyProgress()
    applyResult(p, { kind: 'game', scope: 'crossword', score: 5, total: 5 })
    expect(p.lessons).toEqual({})
  })
})
