// Общее состояние приложения: курс, пользователь, прогресс, настройки, всплывающие сообщения.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { configureAudio } from './lib/audio'
import { loadCourse } from './lib/course'
import { setSoundOn } from './lib/sounds'
import { emptyProgress, type Grade } from './lib/srs'
import { MODE, store, type CustomWordIn } from './lib/store'
import type { Course, CustomWord, Prefs, Progress, ResultIn, ResultOut, User } from './lib/types'

const PREFS_KEY = 'ep:prefs'
const DEFAULT_PREFS: Required<Pick<Prefs, 'theme' | 'accent' | 'rate' | 'showRu' | 'sound' | 'autoplay'>> = {
  theme: 'system',
  accent: 'us',
  rate: 1,
  showRu: true,
  sound: true,
  autoplay: false,
}
type FullPrefs = Prefs & typeof DEFAULT_PREFS

function readPrefs(): FullPrefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function applyTheme(theme: Prefs['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]:not([media])')?.remove()
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = dark ? '#0e131b' : '#f7f5f2'
  document.head.appendChild(meta)
}

export interface AppState {
  course: Course | null
  user: User | null
  progress: Progress
  prefs: FullPrefs
  ready: boolean
  error: unknown
  mode: 'server' | 'local'
  signedIn(u: User): Promise<void>
  logout(): Promise<void>
  setUser(u: User): void
  refresh(): Promise<void>
  setPrefs(patch: Partial<Prefs>): void
  openLesson(key: string): Promise<void>
  reviews(list: { id: string; grade: Grade }[]): Promise<void>
  setInDict(ids: string[], inDict: boolean): Promise<void>
  addCustom(w: CustomWordIn): Promise<CustomWord>
  editCustom(id: string, w: CustomWordIn): Promise<void>
  deleteCustom(id: string): Promise<void>
  saveResult(r: ResultIn): Promise<ResultOut>
  toast(text: string): void
  toasts: { id: number; text: string }[]
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { lang, setLang } = useI18n()
  const [course, setCourse] = useState<Course | null>(null)
  const [user, setUserState] = useState<User | null>(null)
  const [progress, setProgress] = useState<Progress>(emptyProgress())
  const [prefs, setPrefsState] = useState<FullPrefs>(readPrefs)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const toastId = useRef(0)
  const userRef = useRef<User | null>(null)

  const toast = useCallback((text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  // применяем настройки: тема, озвучка, звуки
  useEffect(() => {
    applyTheme(prefs.theme)
    configureAudio({ rate: prefs.rate, accent: prefs.accent })
    setSoundOn(prefs.sound)
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const on = () => applyTheme('system')
    mq?.addEventListener?.('change', on)
    return () => mq?.removeEventListener?.('change', on)
  }, [prefs])

  const setPrefs = useCallback(
    (patch: Partial<Prefs>) => {
      setPrefsState((p) => ({ ...p, ...patch }))
      if (patch.lang) setLang(patch.lang)
      if (userRef.current) store.savePrefs(patch).catch(() => {})
    },
    [setLang],
  )

  // язык интерфейса тоже сохраняем в профиле
  useEffect(() => {
    if (userRef.current && userRef.current.prefs?.lang !== lang) {
      store.savePrefs({ lang }).catch(() => {})
      userRef.current = { ...userRef.current, prefs: { ...userRef.current.prefs, lang } }
    }
  }, [lang])

  const setUser = useCallback(
    (u: User | null) => {
      userRef.current = u
      setUserState(u)
      if (u?.prefs) {
        const { lang: l, ...rest } = u.prefs
        if (Object.keys(rest).length) setPrefsState((p) => ({ ...p, ...rest }))
        if (l === 'ru' || l === 'en') setLang(l)
      }
    },
    [setLang],
  )

  const refresh = useCallback(async () => {
    try {
      setProgress(await store.getProgress())
    } catch (e) {
      if ((e as { status?: number }).status !== 401) throw e
    }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all([loadCourse(), store.me()])
      .then(async ([c, u]) => {
        if (!alive) return
        setCourse(c)
        setUser(u)
        if (u) setProgress(await store.getProgress())
      })
      .catch((e) => alive && setError(e))
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [setUser])

  useEffect(() => {
    const onExpired = () => {
      userRef.current = null
      setUserState(null)
      setProgress(emptyProgress())
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const signedIn = useCallback(
    async (u: User) => {
      setUser(u)
      setProgress(await store.getProgress())
    },
    [setUser],
  )

  const logout = useCallback(async () => {
    try {
      await store.logout()
    } finally {
      userRef.current = null
      setUserState(null)
      setProgress(emptyProgress())
    }
  }, [])

  const value = useMemo<AppState>(
    () => ({
      course,
      user,
      progress,
      prefs,
      ready,
      error,
      mode: MODE,
      signedIn,
      logout,
      setUser,
      refresh,
      setPrefs,
      toast,
      toasts,
      async openLesson(key) {
        if (progress.lessons[key]?.opened) return
        setProgress((p) => ({ ...p, lessons: { ...p.lessons, [key]: { ...(p.lessons[key] ?? { best_score: 0, completed: false }), opened: true } } }))
        await store.openLesson(key).catch(() => {})
      },
      async reviews(list) {
        if (!list.length) return
        await store.reviews(list)
        await refresh()
      },
      async setInDict(ids, inDict) {
        await store.setInDict(ids, inDict)
        await refresh()
      },
      async addCustom(w) {
        const c = await store.addCustom(w)
        await refresh()
        return c
      },
      async editCustom(id, w) {
        await store.editCustom(id, w)
        await refresh()
      },
      async deleteCustom(id) {
        await store.deleteCustom(id)
        await refresh()
      },
      async saveResult(r) {
        const res = await store.saveResult(r)
        await refresh()
        return res
      },
    }),
    [course, user, progress, prefs, ready, error, signedIn, logout, setUser, refresh, setPrefs, toast, toasts],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}
