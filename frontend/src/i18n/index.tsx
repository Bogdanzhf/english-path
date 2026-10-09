// Язык интерфейса: русский или английский. Строки лежат в dict.ts парами [ru, en].

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DICT, type DictKey } from './dict'

export type Lang = 'ru' | 'en'
const KEY = 'ep:lang'

export const initialLang = (): Lang => {
  const saved = localStorage.getItem(KEY)
  if (saved === 'ru' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
}

type Vars = Record<string, string | number>

export interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  /** строка интерфейса по ключу; {name} подставляется из vars */
  t: (key: DictKey, vars?: Vars) => string
  /** выбрать вариант контента: русский или английский */
  tr: <T>(ru: T, en: T) => T
  /** склонение по числу: plural(5, ['слово','слова','слов'], ['word','words']) */
  plural: (n: number, ru: [string, string, string], en: [string, string]) => string
}

const Ctx = createContext<I18n | null>(null)

function fill(s: string, vars?: Vars) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s
}

export function ruPlural(n: number, forms: [string, string, string]) {
  const a = Math.abs(n) % 100
  const b = a % 10
  if (a > 10 && a < 20) return forms[2]
  if (b > 1 && b < 5) return forms[1]
  if (b === 1) return forms[0]
  return forms[2]
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(KEY, l)
    document.documentElement.lang = l
    setLangState(l)
  }, [])
  const value = useMemo<I18n>(() => {
    document.documentElement.lang = lang
    const i = lang === 'en' ? 1 : 0
    return {
      lang,
      setLang,
      t: (key, vars) => fill(DICT[key]?.[i] ?? key, vars),
      tr: (ru, en) => (lang === 'en' ? en : ru),
      plural: (n, ru, en) => (lang === 'en' ? (n === 1 ? en[0] : en[1]) : ruPlural(n, ru)),
    }
  }, [lang, setLang])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useI18n(): I18n {
  const v = useContext(Ctx)
  if (!v) throw new Error('useI18n outside provider')
  return v
}
