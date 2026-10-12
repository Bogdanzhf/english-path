// Упражнения: разбор разметки (пропуски, ошибки), проверка ответов и генерация
// упражнений на слова из словаря курса.

import { matches, plain, sample, shuffle } from './text'
import type { Exercise, Word } from './types'

// Внутренние типы, которые создаются генератором (в YAML их нет)
export interface LettersEx {
  type: 'letters'
  q: string
  answer: string
  explain?: string
  explainRu?: string
  img?: string
  task?: string
  taskRu?: string
  audio?: undefined
  audioKey?: undefined
}
export type QuizEx = (Exercise | LettersEx) & {
  /** фраза, которую можно прослушать рядом с вопросом */
  say?: { text: string; key?: string | null; accent?: 'uk' | 'us' }
  /** подсказка-перевод под вопросом */
  hint?: string
  /** текст, к которому относится вопрос (чтение в тестах) */
  context?: { title: string; text: string }
}

export interface QuizItem {
  key: string
  ex: QuizEx
  wordId?: string
}

// ---------- пропуски [[...]] ----------

export interface ClozeGap { kind: 'input'; answers: string[] }
export interface ClozeSelect { kind: 'select'; options: string[]; answer: number }
export type ClozePart = string | ClozeGap | ClozeSelect

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = []
  let last = 0
  for (const m of text.matchAll(/\[\[(.+?)\]\]/g)) {
    parts.push(text.slice(last, m.index))
    const body = m[1]
    if (body.includes('/')) {
      const raw = body.split('/')
      const answer = raw.findIndex((o) => o.startsWith('*'))
      parts.push({ kind: 'select', options: raw.map((o) => o.replace(/^\*/, '').trim()), answer })
    } else {
      parts.push({ kind: 'input', answers: body.split('|').map((s) => s.trim()) })
    }
    last = (m.index ?? 0) + m[0].length
  }
  parts.push(text.slice(last))
  return parts
}

export const clozeGaps = (parts: ClozePart[]) => parts.filter((p): p is ClozeGap | ClozeSelect => typeof p !== 'string')

export function checkGap(gap: ClozeGap | ClozeSelect, value: string): boolean {
  if (gap.kind === 'select') return Number(value) === gap.answer
  return matches(value, gap.answers)
}

export const gapAnswer = (gap: ClozeGap | ClozeSelect) => (gap.kind === 'select' ? gap.options[gap.answer] : gap.answers[0])

// ---------- найди ошибку {{неверно=>верно}} ----------

export interface ErrorToken { text: string; wrong: boolean; fix?: string }

export function parseError(text: string): ErrorToken[] {
  const tokens: ErrorToken[] = []
  const re = /\{\{(.+?)=>(.+?)\}\}/g
  let last = 0
  const pushWords = (s: string) => {
    for (const w of s.split(/(\s+)/)) if (w.trim()) tokens.push({ text: w, wrong: false })
  }
  for (const m of text.matchAll(re)) {
    pushWords(text.slice(last, m.index))
    tokens.push({ text: m[1], wrong: true, fix: m[2] })
    last = (m.index ?? 0) + m[0].length
  }
  pushWords(text.slice(last))
  return tokens
}

/** Слова предложения без ошибки (для показа правильного варианта). */
export const fixedSentence = (text: string) => text.replace(/\{\{(.+?)=>(.+?)\}\}/g, '$2')

// ---------- собрать предложение ----------

export const orderTokens = (answer: string) => answer.trim().split(/\s+/)

export function checkOrder(answer: string, picked: string[]): boolean {
  return matches(picked.join(' '), [answer])
}

// ---------- упражнения на слова ----------

/** Пример с пропуском на месте выделенного слова: «I *enjoy* it» → «I ___ it», ответ «enjoy». */
export function exampleGap(word: Word): { text: string; answer: string } {
  const m = word.ex.match(/\*([^*]+)\*/)
  const answer = m ? m[1] : word.w
  return { text: word.ex.replace(/\*[^*]+\*/, '_____'), answer }
}

export type WordMode = 'meaning' | 'reverse' | 'definition' | 'cloze' | 'listen' | 'spell' | 'letters' | 'match' | 'tf'
export const WORD_MODES: WordMode[] = ['meaning', 'reverse', 'definition', 'cloze', 'listen', 'spell', 'letters', 'match', 'tf']

export interface WordGenOptions {
  lang: 'ru' | 'en'
  accent?: 'uk' | 'us'
  /** слова, из которых берутся неверные варианты (обычно — весь уровень) */
  pool?: Word[]
}

const wordAudio = (w: Word, accent: 'uk' | 'us' = 'us') => ({ text: w.w, key: accent === 'uk' ? w.au : w.aa, accent })

function distractors(word: Word, pool: Word[], n: number, by: (w: Word) => string): string[] {
  const own = by(word).toLowerCase()
  const samePos = pool.filter((w) => w.id !== word.id && w.pos === word.pos)
  const other = pool.filter((w) => w.id !== word.id && w.pos !== word.pos)
  const seen = new Set([own])
  const out: string[] = []
  for (const w of [...shuffle(samePos), ...shuffle(other)]) {
    const v = by(w)
    if (seen.has(v.toLowerCase())) continue
    seen.add(v.toLowerCase())
    out.push(v)
    if (out.length === n) break
  }
  return out
}

function choice(correct: string, wrong: string[]) {
  const options = shuffle([correct, ...wrong])
  return { options, answer: options.indexOf(correct) }
}

/** Одно упражнение заданного вида на слово. */
export function wordExercise(word: Word, mode: WordMode, opts: WordGenOptions): QuizItem {
  const pool = opts.pool && opts.pool.length >= 4 ? opts.pool : [word]
  const ru = opts.lang === 'ru'
  const meaning = (w: Word) => (ru ? w.ru : w.def)
  const key = `${word.id}:${mode}`
  const say = wordAudio(word, opts.accent)
  // после ответа — слово с транскрипцией и переводом, чтобы закрепить значение
  const ipa = opts.accent === 'uk' ? word.uk : word.us
  const gloss = { explainRu: `**${word.w}** /${ipa}/ — ${word.ru}`, explain: `**${word.w}** /${ipa}/ — ${plain(word.def)}` }
  switch (mode) {
    case 'meaning':
      return {
        key,
        wordId: word.id,
        ex: { type: 'choice', q: `**${word.w}**`, ...choice(meaning(word), distractors(word, pool, 3, meaning)), say, img: word.img,
          task: 'What does the word mean?', taskRu: 'Что означает слово?' },
      }
    case 'reverse':
      return {
        key,
        wordId: word.id,
        ex: { type: 'choice', q: ru ? word.ru : word.def, ...choice(word.w, distractors(word, pool, 3, (w) => w.w)), img: word.img,
          task: 'Choose the word', taskRu: 'Выберите слово' },
      }
    case 'definition':
      return {
        key,
        wordId: word.id,
        ex: { type: 'choice', q: word.def, ...choice(word.w, distractors(word, pool, 3, (w) => w.w)), ...gloss,
          task: 'Which word matches the definition?', taskRu: 'Какое слово подходит к определению?' },
      }
    case 'cloze': {
      const gap = exampleGap(word)
      const others = distractors(word, pool, 3, (w) => exampleGap(w).answer)
      return {
        key,
        wordId: word.id,
        ex: { type: 'choice', q: gap.text, ...choice(gap.answer, others), hint: word.exRu, ...gloss,
          task: 'Complete the sentence', taskRu: 'Вставьте слово в предложение' },
      }
    }
    case 'listen':
      return {
        key,
        wordId: word.id,
        ex: { type: 'listen', audio: word.w, audioKey: opts.accent === 'uk' ? word.au : word.aa, answer: [word.w], ...gloss,
          task: 'Listen and type the word', taskRu: 'Послушайте и напишите слово' },
      }
    case 'spell':
      return {
        key,
        wordId: word.id,
        ex: { type: 'input', q: ru ? `${word.ru}  ·  _${word.pos}_` : `${word.def}  ·  _${word.pos}_`, answer: [word.w], img: word.img,
          task: 'Write the word in English', taskRu: 'Напишите слово по-английски' },
      }
    case 'letters':
      return {
        key,
        wordId: word.id,
        ex: { type: 'letters', q: ru ? word.ru : word.def, answer: word.w, img: word.img,
          task: 'Build the word from letters', taskRu: 'Соберите слово из букв' },
      }
    case 'tf': {
      const right = Math.random() < 0.5
      const shown = right ? meaning(word) : distractors(word, pool, 1, meaning)[0] ?? meaning(word)
      return {
        key,
        wordId: word.id,
        ex: { type: 'tf', items: [[`**${word.w}** — ${shown}`, shown === meaning(word)]], say, ...gloss,
          task: 'True or false?', taskRu: 'Верно или неверно?' },
      }
    }
    case 'match':
    default: {
      const group = [word, ...sample(pool.filter((w) => w.id !== word.id), 4)]
      return {
        key,
        wordId: word.id,
        ex: { type: 'match', pairs: group.map((w) => [w.w, ru ? w.ru : plain(w.def)] as [string, string]),
          task: 'Match the pairs', taskRu: 'Соедините пары' },
      }
    }
  }
}

/** Набор упражнений по списку слов: каждое слово — разными способами, вперемешку. */
export function wordQuiz(words: Word[], opts: WordGenOptions & { modes?: WordMode[]; perWord?: number; limit?: number }): QuizItem[] {
  const modes = opts.modes?.length ? opts.modes : (['meaning', 'reverse', 'cloze', 'listen', 'spell', 'letters', 'tf'] as WordMode[])
  const perWord = opts.perWord ?? 1
  const items: QuizItem[] = []
  for (const w of shuffle(words)) {
    for (const m of sample(modes, Math.min(perWord, modes.length))) items.push(wordExercise(w, m, opts))
  }
  const out = shuffle(items).slice(0, opts.limit ?? items.length)
  // одно упражнение «пары» на каждые 10 вопросов — разнообразие
  if (!opts.modes && words.length >= 5 && out.length >= 8) {
    out.splice(Math.floor(out.length / 2), 0, wordExercise(words[0], 'match', { ...opts, pool: words }))
  }
  return out
}

/** Упражнения из YAML → элементы теста. */
export const toItems = (list: Exercise[], prefix: string): QuizItem[] => list.map((ex, i) => ({ key: `${prefix}.${i}`, ex }))
