// Поиск слов юнита в тексте с учётом форм: travel → travels, travelled, traveling…

const VOWELS = 'aeiou'

export function wordForms(word: string): string[] {
  const w = word.toLowerCase().trim()
  if (w.includes(' ')) {
    // фразовые глаголы и выражения: изменяется первое слово (figure out → figured out)
    const [head, ...rest] = w.split(' ')
    return wordForms(head).map((f) => [f, ...rest].join(' '))
  }
  const forms = new Set([w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}er`, `${w}est`, `${w}ly`])
  if (w.endsWith('y') && !VOWELS.includes(w.at(-2) ?? '')) {
    const stem = w.slice(0, -1)
    ;['ies', 'ied', 'ier', 'iest', 'ily'].forEach((s) => forms.add(stem + s))
  }
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1)
    ;['ing', 'ed', 'er', 'est'].forEach((s) => forms.add(stem + s))
  }
  if (w.endsWith('ie')) forms.add(`${w.slice(0, -2)}ying`)
  const last = w.at(-1) ?? ''
  if (w.length >= 3 && !VOWELS.includes(last) && VOWELS.includes(w.at(-2) ?? '') && !VOWELS.includes(w.at(-3) ?? '') && !'wxy'.includes(last)) {
    ;['ed', 'ing', 'er', 'est'].forEach((s) => forms.add(w + last + s))
  }
  if (/(s|x|z|ch|sh)$/.test(w)) forms.add(`${w}es`)
  if (w.endsWith('f')) forms.add(`${w.slice(0, -1)}ves`)
  if (w.endsWith('fe')) forms.add(`${w.slice(0, -2)}ves`)
  return [...forms]
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function wordsRegex(words: string[]): RegExp | null {
  const forms = [...new Set(words.flatMap(wordForms))].sort((a, b) => b.length - a.length)
  if (!forms.length) return null
  return new RegExp(`\\b(${forms.map(esc).join('|')})\\b`, 'gi')
}

/** Разбить текст на куски: [обычный, найденное слово, обычный, …]. */
export function splitByWords(text: string, re: RegExp | null): { text: string; hit: boolean }[] {
  if (!re) return [{ text, hit: false }]
  const out: { text: string; hit: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if ((m.index ?? 0) > last) out.push({ text: text.slice(last, m.index), hit: false })
    out.push({ text: m[0], hit: true })
    last = (m.index ?? 0) + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false })
  return out
}
