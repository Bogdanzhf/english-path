// Вход: на сервере — логин/пароль и регистрация, в статической версии — локальные профили.

import { AlertCircle, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo } from '../components/Layout'
import { Avatar, AVATARS, Segmented } from '../components/ui'
import { useI18n } from '../i18n'
import { store } from '../lib/store'
import type { User } from '../lib/types'
import { useApp } from '../state'

export function AvatarPicker({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  return (
    <div className="avatar-picker">
      {Object.keys(AVATARS).map((a) => (
        <button key={a} type="button" className="avatar-pick" onClick={() => onChange(a)} aria-pressed={value === a} aria-label={AVATARS[a]}>
          <Avatar value={a} />
        </button>
      ))}
    </div>
  )
}

function Strength({ password, username }: { password: string; username: string }) {
  const { t } = useI18n()
  const [info, setInfo] = useState<{ problems: string[]; strength: number } | null>(null)
  useEffect(() => {
    if (!password || !store.checkPassword) return setInfo(null)
    const timer = setTimeout(() => store.checkPassword!(password, username).then(setInfo).catch(() => {}), 300)
    return () => clearTimeout(timer)
  }, [password, username])
  if (!info) return null
  const colors = ['var(--red)', 'var(--amber)', 'var(--amber)', 'var(--green)', 'var(--green)']
  return (
    <div className="small">
      <div className="row nowrap">
        <div className="progress thin grow">
          <span style={{ width: `${(info.strength + 1) * 20}%`, ['--bar' as string]: colors[info.strength] }} />
        </div>
        <span className="muted">
          {t('password_strength')}: {t(`strength_${info.strength}` as never)}
        </span>
      </div>
      {info.problems[0] && <div style={{ color: 'var(--red)', marginTop: 4 }}>{info.problems[0]}</div>}
    </div>
  )
}

function ServerLogin() {
  const { t } = useI18n()
  const { signedIn } = useApp()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ username: '', password: '', password2: '', display_name: '', avatar: Object.keys(AVATARS)[0] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'register' && form.password !== form.password2) return setError(t('passwords_differ'))
    setBusy(true)
    try {
      const u =
        mode === 'login'
          ? await store.login!(form.username, form.password)
          : await store.register!({ username: form.username, password: form.password, display_name: form.display_name, avatar: form.avatar })
      await signedIn(u)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="stack gap-4" onSubmit={submit}>
      <Segmented
        options={[
          { id: 'login', label: t('login_title') },
          { id: 'register', label: t('register_title') },
        ]}
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError('')
        }}
      />
      <div className="field">
        <label htmlFor="username">{t('username')}</label>
        <input id="username" className="input" value={form.username} onChange={set('username')} autoComplete="username" autoCapitalize="off" required />
      </div>
      {mode === 'register' && (
        <div className="field">
          <label htmlFor="display_name">{t('display_name')}</label>
          <input id="display_name" className="input" value={form.display_name} onChange={set('display_name')} autoComplete="nickname" />
        </div>
      )}
      <div className="field">
        <label htmlFor="password">{t('password')}</label>
        <input
          id="password"
          className="input"
          type="password"
          value={form.password}
          onChange={set('password')}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          required
        />
        {mode === 'register' && <Strength password={form.password} username={form.username} />}
      </div>
      {mode === 'register' && (
        <>
          <div className="field">
            <label htmlFor="password2">{t('password_repeat')}</label>
            <input id="password2" className="input" type="password" value={form.password2} onChange={set('password2')} autoComplete="new-password" required />
          </div>
          <div className="field">
            <span className="label-text">{t('avatar')}</span>
            <AvatarPicker value={form.avatar} onChange={(avatar) => setForm((f) => ({ ...f, avatar }))} />
          </div>
        </>
      )}
      {error && (
        <div className="alert error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      <button className="btn btn-primary btn-lg" disabled={busy}>
        {mode === 'login' ? t('sign_in') : t('sign_up')}
      </button>
    </form>
  )
}

export function LocalProfiles() {
  const { t } = useI18n()
  const { signedIn } = useApp()
  const [profiles, setProfiles] = useState<User[]>([])
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(Object.keys(AVATARS)[0])
  const [error, setError] = useState('')
  useEffect(() => {
    store.listProfiles!().then((p) => {
      setProfiles(p)
      setCreating(p.length === 0)
    })
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await signedIn(await store.createProfile!({ display_name: name, avatar }))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="stack gap-4">
      {!creating && (
        <>
          <h2 className="mb-0">{t('profiles_title')}</h2>
          <div className="stack">
            {profiles.map((p) => (
              <button key={p.id} className="word-row" onClick={async () => signedIn(await store.switchProfile!(String(p.id)))}>
                <Avatar value={p.avatar} />
                <span className="w grow">{p.display_name}</span>
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" onClick={() => setCreating(true)}>
            <Plus size={18} /> {t('new_profile')}
          </button>
        </>
      )}
      {creating && (
        <form className="stack gap-4" onSubmit={create}>
          <div className="field">
            <label htmlFor="pname">{t('display_name')}</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={60} />
          </div>
          <div className="field">
            <span className="label-text">{t('avatar')}</span>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
          {error && <div className="alert error">{error}</div>}
          <button className="btn btn-primary btn-lg">{t('create_profile')}</button>
          {profiles.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>
              {t('back')}
            </button>
          )}
        </form>
      )}
      <p className="muted small mb-0">{t('profiles_hint')}</p>
    </div>
  )
}

export default function Login() {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="login-page">
      <div className="login-side">
        <div className="row" style={{ gap: 12 }}>
          <Logo size={44} />
          <b style={{ fontFamily: 'var(--font-head)', fontSize: '1.4rem' }}>English Path</b>
        </div>
        <h1>{t('welcome_title')}</h1>
        <p>{t('welcome_text')}</p>
        <div className="login-levels">
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l, i) => (
            <span key={l} className={`level-badge lv-${['a1', 'a2', 'b1', 'b2', 'c1', 'c2'][i]}`}>
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="login-card card">
        <div className="row end">
          <Segmented
            options={[
              { id: 'ru', label: 'RU' },
              { id: 'en', label: 'EN' },
            ]}
            value={lang}
            onChange={setLang}
          />
        </div>
        {store.mode === 'server' ? <ServerLogin /> : <LocalProfiles />}
      </div>
    </div>
  )
}
