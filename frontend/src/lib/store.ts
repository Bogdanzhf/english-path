// Хранилище аккаунта и прогресса. Два режима с одинаковым интерфейсом:
//  • server — FastAPI: аккаунты с паролем, прогресс на сервере, вход с любого устройства;
//  • local  — статический сайт (GitHub Pages / офлайн): профили и прогресс в памяти браузера.
// Режим выбирается при сборке: --mode static → local.

import { addActivity, applyResult, emptyProgress, emptyWord, review, type Grade } from './srs'
import type { CustomWord, Prefs, Progress, ResultIn, ResultOut, User } from './types'

export const MODE: 'server' | 'local' = import.meta.env.VITE_STATIC === '1' ? 'local' : 'server'
export const APP_ID = 'english-path'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export type CustomWordIn = Omit<CustomWord, 'id' | 'created_at'>

export interface Store {
  mode: 'server' | 'local'
  me(): Promise<User | null>
  logout(): Promise<unknown>
  updateProfile(patch: { display_name?: string; avatar?: string }): Promise<User>
  savePrefs(prefs: Prefs): Promise<unknown>
  deleteAccount(password: string): Promise<unknown>
  getProgress(): Promise<Progress>
  openLesson(key: string): Promise<unknown>
  reviews(list: { id: string; grade: Grade }[]): Promise<unknown>
  setInDict(ids: string[], inDict: boolean): Promise<unknown>
  addCustom(w: CustomWordIn): Promise<CustomWord>
  editCustom(id: string, w: CustomWordIn): Promise<CustomWord>
  deleteCustom(id: string): Promise<unknown>
  saveResult(r: ResultIn): Promise<ResultOut>
  // только сервер
  login?(username: string, password: string): Promise<User>
  register?(form: { username: string; password: string; display_name: string; avatar: string }): Promise<User>
  changePassword?(current: string, next: string): Promise<unknown>
  checkPassword?(password: string, username: string): Promise<{ problems: string[]; strength: number }>
  // только устройство
  listProfiles?(): Promise<User[]>
  createProfile?(p: { display_name: string; avatar: string }): Promise<User>
  switchProfile?(id: string): Promise<User>
  exportData?(): Promise<unknown>
  importData?(data: unknown): Promise<void>
}

export const currentLang = () => (localStorage.getItem('ep:lang') === 'en' ? 'en' : 'ru')

// ---------- сервер ----------

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': APP_ID, 'X-Lang': currentLang() },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, currentLang() === 'en' ? 'Server is unreachable' : 'Сервер недоступен')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    let msg = data?.detail ?? (currentLang() === 'en' ? 'Something went wrong' : 'Что-то пошло не так')
    if (Array.isArray(msg)) msg = msg.map((d: { msg: unknown }) => String(d.msg).replace(/^Value error, /, '')).join('. ')
    if (res.status === 401 && !['/auth/login', '/auth/me'].includes(path)) window.dispatchEvent(new Event('auth:expired'))
    throw new ApiError(res.status, String(msg))
  }
  return data as T
}

const customKey = (id: string) => id.replace(/^c:/, '')

const serverStore: Store = {
  mode: 'server',
  async me() {
    try {
      return await request<User>('GET', '/auth/me')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null
      throw e
    }
  },
  login: (username, password) => request<{ user: User }>('POST', '/auth/login', { username, password }).then((d) => d.user),
  register: (form) => request<{ user: User }>('POST', '/auth/register', form).then((d) => d.user),
  logout: () => request('POST', '/auth/logout'),
  updateProfile: (patch) => request<User>('PATCH', '/auth/me', patch),
  savePrefs: (prefs) => request('PUT', '/auth/prefs', { prefs }),
  changePassword: (current_password, new_password) => request('POST', '/auth/password', { current_password, new_password }),
  deleteAccount: (password) => request('POST', '/auth/delete', { password }),
  checkPassword: (password, username) => request('POST', '/auth/check-password', { password, username }),
  getProgress: () => request<Progress>('GET', '/progress'),
  openLesson: (key) => request('POST', '/progress/lesson', { key }),
  reviews: (list) => request('POST', '/progress/reviews', { reviews: list }),
  setInDict: (ids, in_dict) => request('POST', '/dict', { ids, in_dict }),
  addCustom: (w) => request<CustomWord>('POST', '/custom-words', w),
  editCustom: (id, w) => request<CustomWord>('PUT', `/custom-words/${customKey(id)}`, w),
  deleteCustom: (id) => request('DELETE', `/custom-words/${customKey(id)}`),
  saveResult: (r) => request<ResultOut>('POST', '/progress/result', r),
}

// ---------- устройство ----------

const LS = {
  profiles: 'ep:profiles',
  current: 'ep:current',
  progress: (id: string) => `ep:progress:${id}`,
}

function read<T>(k: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
const write = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v))
const currentId = () => read<string | null>(LS.current, null)
const t = (ru: string, en: string) => (currentLang() === 'en' ? en : ru)

function loadProgress(id: string): Progress {
  return { ...emptyProgress(), ...read<Partial<Progress>>(LS.progress(id), {}) }
}

function mutate<T>(fn: (p: Progress) => T): Promise<T> {
  const id = currentId()
  if (!id) return Promise.reject(new ApiError(401, t('Выберите профиль', 'Choose a profile')))
  const p = loadProgress(id)
  const out = fn(p)
  try {
    write(LS.progress(id), p)
  } catch {
    return Promise.reject(new ApiError(507, t('В браузере закончилось место для прогресса', 'Browser storage is full')))
  }
  return Promise.resolve(out)
}

function profiles(): User[] {
  return read<User[]>(LS.profiles, [])
}

const localStore: Store = {
  mode: 'local',
  async me() {
    const id = currentId()
    return profiles().find((p) => p.id === id) ?? null
  },
  async listProfiles() {
    return profiles()
  },
  async createProfile({ display_name, avatar }) {
    const name = String(display_name ?? '').trim().slice(0, 60)
    if (!name) throw new ApiError(422, t('Введите имя', 'Enter a name'))
    const profile: User = { id: crypto.randomUUID(), username: name, display_name: name, avatar: avatar || '🦊', prefs: {} }
    write(LS.profiles, [...profiles(), profile])
    write(LS.current, profile.id)
    return profile
  },
  async switchProfile(id) {
    const profile = profiles().find((p) => p.id === id)
    if (!profile) throw new ApiError(404, t('Профиль не найден', 'Profile not found'))
    write(LS.current, id)
    return profile
  },
  async logout() {
    localStorage.removeItem(LS.current)
  },
  async updateProfile(patch) {
    const id = currentId()
    const list = profiles().map((p) =>
      p.id === id
        ? { ...p, ...(patch.display_name?.trim() ? { display_name: patch.display_name.trim() } : {}), ...(patch.avatar ? { avatar: patch.avatar } : {}) }
        : p,
    )
    write(LS.profiles, list)
    return list.find((p) => p.id === id)!
  },
  async savePrefs(prefs) {
    const id = currentId()
    write(LS.profiles, profiles().map((p) => (p.id === id ? { ...p, prefs: { ...p.prefs, ...prefs } } : p)))
  },
  async deleteAccount() {
    const id = currentId()
    if (!id) return
    write(LS.profiles, profiles().filter((p) => p.id !== id))
    localStorage.removeItem(LS.progress(id))
    localStorage.removeItem(LS.current)
  },
  async getProgress() {
    const id = currentId()
    return id ? loadProgress(id) : emptyProgress()
  },
  openLesson: (key) =>
    mutate((p) => {
      const row = p.lessons[key] ?? { opened: false, best_score: 0, completed: false }
      if (!row.opened) addActivity(p, 2)
      p.lessons[key] = { ...row, opened: true }
    }),
  reviews: (list) =>
    mutate((p) => {
      for (const r of list) p.words[r.id] = review(p.words[r.id], r.grade)
      addActivity(p, list.length)
    }),
  setInDict: (ids, inDict) =>
    mutate((p) => {
      for (const id of ids) {
        const w = p.words[id] ?? emptyWord()
        p.words[id] = { ...w, in_dict: inDict, added_at: inDict && !w.in_dict ? new Date().toISOString() : w.added_at }
      }
    }),
  addCustom: (w) =>
    mutate((p) => {
      const word = w.word.trim().replace(/\s+/g, ' ')
      if (!word) throw new ApiError(422, t('Введите слово', 'Enter a word'))
      const next = p.custom.reduce((m, c) => Math.max(m, Number(customKey(c.id)) || 0), 0) + 1
      const c: CustomWord = { ...w, word, id: `c:${next}`, created_at: new Date().toISOString() }
      p.custom.push(c)
      p.words[c.id] = { ...emptyWord(), in_dict: true }
      return c
    }),
  editCustom: (id, w) =>
    mutate((p) => {
      const i = p.custom.findIndex((c) => c.id === id)
      if (i < 0) throw new ApiError(404, t('Не найдено', 'Not found'))
      p.custom[i] = { ...p.custom[i], ...w }
      return p.custom[i]
    }),
  deleteCustom: (id) =>
    mutate((p) => {
      p.custom = p.custom.filter((c) => c.id !== id)
      delete p.words[id]
    }),
  saveResult: (r) => mutate((p) => applyResult(p, r)),
  async exportData() {
    const me = await this.me()
    return { app: APP_ID, version: 1, exported_at: new Date().toISOString(), profile: me, progress: await this.getProgress() }
  },
  async importData(data) {
    const d = data as { app?: string; progress?: Progress } | null
    if (d?.app !== APP_ID || !d.progress) throw new ApiError(422, t('Это не файл прогресса English Path', 'This is not an English Path progress file'))
    const id = currentId()
    if (!id) throw new ApiError(401, t('Выберите профиль', 'Choose a profile'))
    write(LS.progress(id), { ...emptyProgress(), ...d.progress })
  },
}

export const store: Store = MODE === 'local' ? localStore : serverStore
