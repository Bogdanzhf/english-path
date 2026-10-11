import { Download, Info, LogOut, Upload, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { Avatar, PageHead, Segmented, Switch } from '../components/ui'
import { useI18n } from '../i18n'
import { store } from '../lib/store'
import { useApp } from '../state'
import { AvatarPicker } from './Login'

function PasswordForm() {
  const { t } = useI18n()
  const { toast } = useApp()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        setError('')
        try {
          await store.changePassword!(cur, next)
          setCur('')
          setNext('')
          toast(t('password_changed'))
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      <h3 className="mb-0">{t('change_password')}</h3>
      <input type="text" autoComplete="username" hidden readOnly />
      <input className="input" type="password" placeholder={t('current_password')} value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required aria-label={t('current_password')} />
      <input className="input" type="password" placeholder={t('new_password')} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required aria-label={t('new_password')} />
      {error && <div className="alert error small">{error}</div>}
      <div>
        <button className="btn btn-secondary">{t('save')}</button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { t, lang, setLang } = useI18n()
  const { user, setUser, prefs, setPrefs, logout, mode, refresh, toast, progress } = useApp()
  const [name, setName] = useState(user?.display_name ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  if (!user) return null

  const saveProfile = async (patch: { display_name?: string; avatar?: string }) => {
    setUser({ ...(await store.updateProfile(patch)), prefs: user.prefs })
    toast(t('saved'))
  }

  const exportData = async () => {
    const data = await store.exportData!()
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `english-path-${user.display_name}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text())
      if (!confirm(t('import_confirm'))) return
      await store.importData!(data)
      await refresh()
      toast(t('import_done'))
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <div className="stack gap-5" style={{ maxWidth: 820 }}>
      <PageHead title={t('profile_title')} subtitle={mode === 'local' ? t('storage_local') : t('storage_server')} />

      <section className="card stack">
        <div className="row nowrap" style={{ gap: 16 }}>
          <Avatar value={user.avatar} large />
          <div className="grow">
            <h2 className="mb-0">{user.display_name}</h2>
            {mode === 'server' && <div className="muted small">@{user.username}</div>}
          </div>
        </div>
        <AvatarPicker value={user.avatar} onChange={(avatar) => saveProfile({ avatar })} />
        <form
          className="row nowrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) saveProfile({ display_name: name })
          }}
        >
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label={t('display_name')} />
          <button className="btn btn-secondary">{t('save')}</button>
        </form>
      </section>

      <section className="card">
        <h3>{t('appearance')}</h3>
        <div className="row between" style={{ padding: '8px 0' }}>
          <span>{t('ui_language')}</span>
          <Segmented
            options={[
              { id: 'ru', label: 'Русский' },
              { id: 'en', label: 'English' },
            ]}
            value={lang}
            onChange={(l) => {
              setLang(l)
              setPrefs({ lang: l })
            }}
          />
        </div>
        <div className="row between" style={{ padding: '8px 0' }}>
          <span>{t('theme')}</span>
          <Segmented
            options={[
              { id: 'light', label: t('theme_light') },
              { id: 'dark', label: t('theme_dark') },
              { id: 'system', label: t('theme_system') },
            ]}
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
          />
        </div>
      </section>

      <section className="card">
        <h3>{t('audio_settings')}</h3>
        <div className="row between" style={{ padding: '8px 0' }}>
          <span>{t('accent')}</span>
          <div className="row">
            <Segmented
              options={[
                { id: 'uk', label: `UK · ${t('accent_uk')}` },
                { id: 'us', label: `US · ${t('accent_us')}` },
              ]}
              value={prefs.accent}
              onChange={(accent) => setPrefs({ accent })}
            />
            <AudioButton text="Hello! How are you today?" accent={prefs.accent} />
          </div>
        </div>
        <div className="row between" style={{ padding: '8px 0' }}>
          <span>{t('speech_rate')}</span>
          <Segmented
            options={[0.75, 0.9, 1, 1.15, 1.3].map((r) => ({ id: r, label: `${r}×` }))}
            value={prefs.rate}
            onChange={(rate) => setPrefs({ rate })}
          />
        </div>
        <Switch label={t('sound_effects')} checked={prefs.sound} onChange={(sound) => setPrefs({ sound })} />
        <Switch label={t('autoplay_words')} checked={prefs.autoplay} onChange={(autoplay) => setPrefs({ autoplay })} />
      </section>

      <section className="card">
        <h3>{t('learning_settings')}</h3>
        <Switch label={t('show_ru_default')} hint={lang === 'en' ? 'English mode hides Russian translations until you tap “Show translation”.' : undefined} checked={prefs.showRu} onChange={(showRu) => setPrefs({ showRu })} />
        <div className="muted small">
          {t('words_in_dict')}: {Object.values(progress.words).filter((w) => w.in_dict).length} · {t('lessons_done')}: {Object.values(progress.lessons).filter((l) => l.completed).length} · {t('history')}: {progress.results.length}
        </div>
      </section>

      <section className="card stack">
        <h3 className="mb-0">{t('account')}</h3>
        {mode === 'local' ? (
          <>
            <p className="muted small mb-0">{t('backup_hint')}</p>
            <div className="row">
              <button className="btn btn-secondary" onClick={exportData}>
                <Download size={17} /> {t('export_progress')}
              </button>
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                <Upload size={17} /> {t('import_progress')}
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
            </div>
            <div className="row">
              <button className="btn btn-ghost" onClick={logout}>
                <Users size={17} /> {t('switch_profile')}
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  if (confirm(t('delete_confirm'))) {
                    await store.deleteAccount('')
                    await logout()
                  }
                }}
              >
                {t('delete_profile')}
              </button>
            </div>
          </>
        ) : (
          <>
            <PasswordForm />
            <hr />
            <div className="row">
              <button className="btn btn-secondary" onClick={logout}>
                <LogOut size={17} /> {t('sign_out')}
              </button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const pwd = prompt(`${t('delete_confirm')}\n\n${t('password')}:`)
                  if (!pwd) return
                  try {
                    await store.deleteAccount(pwd)
                    await logout()
                  } catch (e) {
                    alert((e as Error).message)
                  }
                }}
              >
                {t('delete_account')}
              </button>
            </div>
          </>
        )}
      </section>

      <Link to="/about" className="card pad-sm row nowrap" style={{ gap: 12 }}>
        <Info size={20} /> {t('about_title')}
      </Link>
    </div>
  )
}
