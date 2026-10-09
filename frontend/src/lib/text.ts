// Сравнение ответов: регистр, апострофы, сокращения (don't = do not), лишние пробелы и знаки.

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bshan't\b/g, 'shall not'],
  [/\bain't\b/g, 'am not'],
  [/\blet's\b/g, 'let us'],
  [/n't\b/g, ' not'],
  [/'re\b/g, ' are'],
  [/'ve\b/g, ' have'],
  [/'ll\b/g, ' will'],
  [/'m\b/g, ' am'],
  [/'d\b/g, ' would'], // 'd = had/would — обе формы допускаются ниже
]

/** Базовая нормализация: нижний регистр, единые апострофы, без пунктуации по краям и двойных пробелов. */
export function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,!?;:"()…—–-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Нормализация с раскрытием сокращений: «don't» и «do not» совпадают. */
export function expand(s: string): string {
  let t = norm(s)
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep)
  return t.replace(/\bcan not\b/g, 'cannot').replace(/\s+/g, ' ').trim()
}

function variants(s: string): string[] {
  const e = expand(s)
  return e.includes(' would') ? [e, e.replace(/ would\b/g, ' had')] : [e]
}

/** Совпадает ли ответ пользователя с одним из допустимых. */
export function matches(input: string, answers: string[]): boolean {
  const mine = variants(input)
  return answers.some((a) => variants(a).some((v) => mine.includes(v)))
}

/** Почти правильно: одна опечатка в слове длиннее 4 букв (подсказка «проверьте написание»). */
export function nearMiss(input: string, answers: string[]): boolean {
  const a = expand(input)
  return answers.some((ans) => {
    const b = expand(ans)
    return b.length > 4 && levenshtein(a, b) === 1
  })
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

const NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
}

const speechWords = (s: string) =>
  expand(s)
    .split(' ')
    .filter(Boolean)
    .map((w) => NUMBERS[w] ?? w)

/**
 * Оценка произношения по распознанному тексту: какие слова образца прозвучали.
 * Возвращает долю совпавших слов (0–1) и разметку слов образца.
 */
export function speechScore(target: string, heard: string[]): { score: number; words: { w: string; ok: boolean }[]; best: string } {
  const tWords = target.replace(/[*_]/g, '').split(/\s+/).filter(Boolean)
  let best = { score: -1, words: [] as { w: string; ok: boolean }[], best: '' }
  for (const h of heard.length ? heard : ['']) {
    const pool = speechWords(h)
    const used = new Array(pool.length).fill(false)
    const words = tWords.map((w) => {
      const parts = speechWords(w)
      const ok = parts.every((p) => {
        const i = pool.findIndex((x, k) => !used[k] && (x === p || (p.length > 3 && levenshtein(x, p) <= 1)))
        if (i >= 0) used[i] = true
        return i >= 0
      })
      return { w, ok }
    })
    const score = words.length ? words.filter((x) => x.ok).length / words.length : 0
    if (score > best.score) best = { score, words, best: h }
  }
  return best
}

export function shuffle<T>(arr: readonly T[], rnd = Math.random): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const sample = <T,>(arr: readonly T[], n: number, rnd = Math.random) => shuffle(arr, rnd).slice(0, n)

/** Убрать markdown-выделение *слово* → слово. */
export const plain = (s: string) => s.replace(/\*\*?([^*]+)\*\*?/g, '$1')
