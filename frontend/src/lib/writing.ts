// Письмо: проверка своих предложений (перевод, трансформация, «своё предложение со словом»)
// и генерация таких заданий из слов юнита и примеров грамматики.

import { expand, levenshtein, plain, shuffle } from './text'
import type { ComposeEx, IrregularVerb, OrderEx, Word, WriteEx } from './types'
import type { QuizItem } from './quiz'

// ---------- сравнение предложений ----------

const S_PRONOUNS = /\b(he|she|it|that|there|what|who|where|here|how|this)'s\b/g

/** Варианты нормализованного предложения: 's = is / has, 'd = would / had. */
function forms(s: string): string[] {
  const base = expand(s).replace(/[*_]/g, '')
  const out = new Set<string>()
  for (const sv of base.match(S_PRONOUNS) ? [base.replace(S_PRONOUNS, '$1 is'), base.replace(S_PRONOUNS, '$1 has')] : [base])
    for (const dv of sv.includes(' would') ? [sv, sv.replace(/ would\b/g, ' had')] : [sv]) out.add(dv.replace(/\s+/g, ' ').trim())
  return [...out]
}

const words = (s: string) => s.split(' ').filter(Boolean)

/** Расстояние между предложениями в словах (замена/пропуск/лишнее слово = 1). */
function wordDistance(a: string[], b: string[]): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      const same = a[i - 1] === b[j - 1] || (Math.max(a[i - 1].length, b[j - 1].length) >= 5 && levenshtein(a[i - 1], b[j - 1]) === 1)
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (same ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

export interface DiffToken {
  text: string
  kind: 'same' | 'missing' | 'extra' | 'typo'
}

/** Отличия ответа от образца: какие слова пропущены, лишние или с опечаткой. */
export function diffWords(mine: string, model: string): DiffToken[] {
  const a = words(forms(mine)[0])
  const b = words(forms(model)[0])
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ text: b[j], kind: 'same' }), i++, j++
    } else if (i < a.length && j < b.length && a[i].length > 3 && levenshtein(a[i], b[j]) <= 2 && dp[i + 1][j + 1] >= Math.max(dp[i + 1][j], dp[i][j + 1])) {
      out.push({ text: b[j], kind: 'typo' }), i++, j++
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push({ text: b[j], kind: 'missing' }), j++
    } else {
      out.push({ text: a[i], kind: 'extra' }), i++
    }
  }
  return out
}

export interface WriteCheck {
  verdict: 'ok' | 'near' | 'wrong'
  /** ближайший образец — с ним сравнивается ответ */
  model: string
  /** верно, но с опечатками в словах */
  typos?: boolean
}

/** Строгое сравнение с пунктуацией (задания на запятые, точку с запятой, двоеточие). */
const punct = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/\s*([,;:.!?—–-])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]\s*$/, '')
    .trim()

/** Проверка перевода/трансформации: точно (с учётом сокращений), почти (1 слово на 6) или неверно. */
export function checkWrite(input: string, answers: string[], strict = false): WriteCheck {
  if (strict) {
    const hit = answers.find((a) => punct(a) === punct(input))
    return hit ? { verdict: 'ok', model: hit } : { verdict: 'wrong', model: answers[0] ?? '' }
  }
  const mine = forms(input)
  let best = { d: Infinity, model: answers[0] ?? '' }
  for (const ans of answers)
    for (const f of forms(ans))
      for (const m of mine) {
        if (m === f) return { verdict: 'ok', model: ans }
        const d = wordDistance(words(m), words(f))
        if (d < best.d) best = { d, model: ans }
      }
  const len = Math.max(1, words(forms(best.model)[0]).length)
  if (best.d === 0) return { verdict: 'ok', model: best.model, typos: true } // отличия только в опечатках
  return { verdict: best.d <= Math.max(1, Math.floor(len / 6)) ? 'near' : 'wrong', model: best.model }
}

// ---------- «своё предложение со словом» ----------

/** Все формы слова: окончания -s/-ed/-ing/-er и неправильные глаголы (catch → caught). */
export function wordForms(word: string, irregular: IrregularVerb[] = []): string[] {
  const w = expand(word).replace(/\s+/g, '')
  const set = new Set([w])
  const stems = new Set([w, w.replace(/(e|y)$/, '')])
  if (w.endsWith('s')) stems.add(w.slice(0, -1)) // senses → sense
  if (/[^aeiouwxy]$/.test(w)) stems.add(w + w.at(-1)) // plan → planned, equip → equipped
  if (w.endsWith('c')) stems.add(w + 'k') // mimic → mimicked
  for (const st of stems) {
    set.add(st)
    for (const suf of ['s', 'es', 'ed', 'd', 'ing', 'er', 'est', 'ly', 'ies', 'ied', 'ier', 'iest', 'ment', 'ness']) set.add(st + suf)
  }
  const irr = irregular.find((v) => v.base.toLowerCase() === w)
  for (const f of irr ? `${irr.past}/${irr.pp}`.split(/[/,]/) : EXTRA_IRREGULAR[w] ?? []) set.add(f.trim().toLowerCase())
  return [...set]
}

// неправильные глаголы из словаря курса, которых нет в таблице неправильных глаголов
const EXTRA_IRREGULAR: Record<string, string[]> = {
  creep: ['crept'], cling: ['clung'], dwell: ['dwelt', 'dwelled'], weep: ['wept'], kneel: ['knelt', 'kneeled'],
  sting: ['stung'], swear: ['swore', 'sworn'], tread: ['trod', 'trodden'], weave: ['wove', 'woven'], stride: ['strode'],
  sow: ['sowed', 'sown'], seek: ['sought'], forbid: ['forbade', 'forbidden'], foresee: ['foresaw', 'foreseen'], undergo: ['underwent', 'undergone'],
  overcome: ['overcame'], withdraw: ['withdrew', 'withdrawn'], bind: ['bound'], grind: ['ground'], slay: ['slew', 'slain'],
}

export interface ComposeCheck {
  ok: boolean
  missing: string[]
  tooShort: boolean
  badStart: boolean
}

/** Своё предложение: нужные слова на месте (в любой форме), начало совпадает, не короче min слов. */
export function checkCompose(input: string, ex: Pick<ComposeEx, 'must' | 'start' | 'min'>, irregular: IrregularVerb[] = []): ComposeCheck {
  const text = expand(input).replace(/[*_]/g, '')
  const list = words(text)
  // chemist's → chemist: притяжательное 's не мешает найти слово
  const tokens = new Set([...list, ...list.map((t) => t.replace(/'s?$/, ''))])
  const missing = (ex.must ?? []).filter((m) => {
    // выражения и фразовые глаголы: первое слово — в любой форме, остальные — как есть
    const [head, ...rest] = words(expand(m))
    if (!head) return false
    if (rest.length && wordForms(head + rest.join(''), irregular).some((f) => tokens.has(f))) return false // re-entry → reentry
    return !(wordForms(head, irregular).some((f) => tokens.has(f)) && rest.every((p) => tokens.has(p)))
  })
  const tooShort = list.length < (ex.min ?? 4)
  const badStart = !!ex.start && !text.startsWith(expand(ex.start))
  return { ok: !missing.length && !tooShort && !badStart, missing, tooShort, badStart }
}

// ---------- генерация заданий ----------

export type WritingKind = 'translate' | 'compose' | 'order' | 'transform'
export const WRITING_KINDS: WritingKind[] = ['translate', 'compose', 'order', 'transform']

const clean = (s: string) => plain(s).replace(/\s+/g, ' ').trim()
const kindOf = (ex: WriteEx | ComposeEx | OrderEx): WritingKind => (ex.type === 'compose' ? 'compose' : ex.type === 'order' ? 'order' : ex.text ? 'transform' : 'translate')
export const itemKind = (it: QuizItem) => kindOf(it.ex as WriteEx | ComposeEx | OrderEx)

/** Перевод примера на английский: «Мы с сестрой согласны…» → My sister and I agree… */
export function translateItem(word: Word, key: string): QuizItem {
  return {
    key: `${key}.t.${word.id}`,
    wordId: word.id,
    ex: { type: 'write', q: word.exRu, answer: [clean(word.ex)], must: [word.w], hint: `${word.w} — ${word.ru}`,
      task: 'Translate into English', taskRu: 'Переведите на английский' },
  }
}

/** Своё предложение со словом; пример из курса — образец для сравнения. */
export function composeItem(word: Word, key: string): QuizItem {
  return {
    key: `${key}.c.${word.id}`,
    wordId: word.id,
    ex: { type: 'compose', q: `**${word.w}** — ${word.ru}`, must: [word.w], model: [clean(word.ex)], min: 4,
      task: 'Write your own sentence with the word', taskRu: 'Составьте своё предложение с этим словом' },
  }
}

/** Порядок слов: собрать пример из перемешанных слов. */
export function orderItem(en: string, ru: string, key: string, wordId?: string): QuizItem | null {
  const sentence = clean(en)
  const n = sentence.split(' ').length
  if (n < 4 || n > 14) return null
  return { key: `${key}.o`, wordId, ex: { type: 'order', q: ru, answer: sentence, task: 'Put the words in order', taskRu: 'Составьте предложение из слов' } }
}

/** Задания «Письмо» для юнита: перевод примеров, свои предложения, порядок слов. */
export function unitWriting(list: Word[], key: string): QuizItem[] {
  const out: QuizItem[] = []
  for (const w of list) {
    out.push(translateItem(w, key), composeItem(w, key))
    const o = orderItem(w.ex, w.exRu, `${key}.${w.id}`, w.id)
    if (o) out.push(o)
  }
  return out
}

/** Задания «Письмо» для темы грамматики: авторские (трансформация, свободное письмо) + перевод примеров. */
export function grammarWriting(topic: { writing?: (WriteEx | ComposeEx)[]; examples: { en: string; ru: string }[] }, key: string): QuizItem[] {
  const own: QuizItem[] = (topic.writing ?? []).map((ex, i) => ({ key: `${key}.w${i}`, ex }))
  const fromExamples = topic.examples.flatMap((e, i) => {
    const tr: QuizItem = { key: `${key}.e${i}`, ex: { type: 'write', q: e.ru, answer: [clean(e.en)], task: 'Translate into English', taskRu: 'Переведите на английский' } }
    const o = orderItem(e.en, e.ru, `${key}.e${i}`)
    return o ? [tr, o] : [tr]
  })
  return [...own, ...fromExamples]
}

/** Подборка: нужные виды, вперемешку, но без двух одинаковых видов подряд, если можно. */
export function pickWriting(items: QuizItem[], kinds: WritingKind[], count: number): QuizItem[] {
  const pool = shuffle(items.filter((it) => kinds.includes(itemKind(it))))
  const byKind = new Map<WritingKind, QuizItem[]>()
  for (const it of pool) byKind.set(itemKind(it), [...(byKind.get(itemKind(it)) ?? []), it])
  const out: QuizItem[] = []
  const usedWords = new Set<string>()
  while (out.length < Math.min(count, pool.length)) {
    let added = false
    for (const k of shuffle([...byKind.keys()])) {
      const list = byKind.get(k)!
      // одно слово — не больше одного задания подряд по кругу
      const idx = list.findIndex((it) => !it.wordId || !usedWords.has(it.wordId))
      const it = list.splice(idx >= 0 ? idx : 0, 1)[0]
      if (!it) continue
      out.push(it)
      if (it.wordId) usedWords.add(it.wordId)
      added = true
      if (out.length >= count) break
    }
    if (!added) break
    if (usedWords.size > 12) usedWords.clear()
  }
  return out
}
