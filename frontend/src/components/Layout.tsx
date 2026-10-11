// Каркас страницы: боковое меню, верхняя панель с поиском и переключателями, нижние вкладки на телефоне.

import {
  BookA,
  BookOpenText,
  Brain,
  ClipboardCheck,
  Gamepad2,
  GraduationCap,
  Headphones,
  House,
  Layers,
  LibraryBig,
  Menu,
  MessagesSquare,
  Moon,
  Search,
  Star,
  Sun,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { isDue } from '../lib/srs'
import { useApp } from '../state'
import { Avatar } from './ui'

interface NavItem {
  to: string
  key: DictKey
  icon: ReactNode
  end?: boolean
  badge?: number
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="brand-logo" style={{ width: size, height: size }}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 19c3-1 4-4 6-8s4-6 10-7" />
        <circle cx="4" cy="19" r="1.6" fill="currentColor" />
        <path d="M16 4h4v4" />
      </svg>
    </span>
  )
}

function useDueCount() {
  const { progress } = useApp()
  return useMemo(() => {
    const now = Date.now()
    return Object.values(progress.words).filter((w) => isDue(w, now)).length
  }, [progress.words])
}

export function Layout() {
  const { t, lang, setLang } = useI18n()
  const { user, prefs, setPrefs } = useApp()
  const due = useDueCount()
  const loc = useLocation()
  const nav = useNavigate()
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    setMore(false)
    window.scrollTo({ top: 0 })
  }, [loc.pathname])

  const learn: NavItem[] = [
    { to: '/', key: 'nav_home', icon: <House size={20} />, end: true },
    { to: '/course', key: 'nav_course', icon: <GraduationCap size={20} /> },
    { to: '/grammar', key: 'nav_grammar', icon: <BookOpenText size={20} /> },
    { to: '/reading', key: 'nav_reading', icon: <Headphones size={20} /> },
    { to: '/speaking', key: 'nav_speaking', icon: <MessagesSquare size={20} /> },
    { to: '/words', key: 'nav_dictionary', icon: <LibraryBig size={20} /> },
  ]
  const practice: NavItem[] = [
    { to: '/review', key: 'nav_review', icon: <Brain size={20} />, badge: due },
    { to: '/my-words', key: 'nav_my_words', icon: <Star size={20} /> },
    { to: '/games', key: 'nav_games', icon: <Gamepad2 size={20} /> },
    { to: '/tests', key: 'nav_tests', icon: <ClipboardCheck size={20} /> },
  ]
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches)

  const navLink = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={t(item.key)}>
      {item.icon}
      <span className="label">{t(item.key)}</span>
      {!!item.badge && <span className="badge">{item.badge > 99 ? '99+' : item.badge}</span>}
    </NavLink>
  )

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    nav(`/words?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <Logo />
          <span className="brand-text">
            English Path
            <small>{t('app_tagline')}</small>
          </span>
        </Link>
        <div className="nav-section">{t('nav_section_learn')}</div>
        {learn.map(navLink)}
        <div className="nav-section">{t('nav_section_practice')}</div>
        {practice.map(navLink)}
        <div className="sidebar-foot">
          {user && (
            <NavLink to="/profile" className="user-chip">
              <Avatar value={user.avatar} />
              <span className="label grow">
                <b>{user.display_name}</b>
                <div className="tiny muted">{t('nav_profile')}</div>
              </span>
            </NavLink>
          )}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link to="/" className="brand">
            <Logo size={32} />
          </Link>
          <form className="search" onSubmit={submitSearch} role="search">
            <Search size={17} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search_words_placeholder')} aria-label={t('search')} />
          </form>
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm lang-toggle"
              onClick={() => {
                const l = lang === 'ru' ? 'en' : 'ru'
                setLang(l)
                setPrefs({ lang: l })
              }}
              title={t('ui_language')}
              aria-label={t('ui_language')}
            >
              <b>{lang === 'ru' ? 'RU' : 'EN'}</b>
            </button>
            <button className="icon-btn hide-mobile" onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })} aria-label={dark ? t('theme_light') : t('theme_dark')} title={dark ? t('theme_light') : t('theme_dark')}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="btn btn-ghost btn-sm hide-mobile"
              onClick={() => setPrefs({ accent: prefs.accent === 'uk' ? 'us' : 'uk' })}
              title={t('accent')}
              aria-label={t('accent')}
            >
              {prefs.accent === 'uk' ? 'UK' : 'US'}
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottombar" aria-label="main">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <House size={21} />
          {t('nav_home')}
        </NavLink>
        <NavLink to="/course" className={({ isActive }) => (isActive ? 'active' : '')}>
          <GraduationCap size={21} />
          {t('nav_course')}
        </NavLink>
        <NavLink to="/review" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Brain size={21} />
          {t('nav_review')}
          {due > 0 && <span className="badge">{due > 99 ? '99+' : due}</span>}
        </NavLink>
        <NavLink to="/my-words" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Star size={21} />
          {t('nav_my_words')}
        </NavLink>
        <button onClick={() => setMore(true)} className={more ? 'active' : ''}>
          <Menu size={21} />
          {t('nav_more')}
        </button>
      </nav>

      {more && (
        <div className="sheet-backdrop" onClick={() => setMore(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grip" />
            <div className="sheet-grid">
              {[
                { to: '/grammar', key: 'nav_grammar' as DictKey, icon: <BookOpenText size={22} /> },
                { to: '/reading', key: 'nav_reading' as DictKey, icon: <Headphones size={22} /> },
                { to: '/speaking', key: 'nav_speaking' as DictKey, icon: <MessagesSquare size={22} /> },
                { to: '/words', key: 'nav_dictionary' as DictKey, icon: <LibraryBig size={22} /> },
                { to: '/games', key: 'nav_games' as DictKey, icon: <Gamepad2 size={22} /> },
                { to: '/tests', key: 'nav_tests' as DictKey, icon: <ClipboardCheck size={22} /> },
                { to: '/grammar/irregular', key: 'irregular_verbs' as DictKey, icon: <Layers size={22} /> },
                { to: '/grammar/tenses', key: 'tenses_map' as DictKey, icon: <BookA size={22} /> },
                { to: '/profile', key: 'nav_profile' as DictKey, icon: <UserRound size={22} /> },
              ].map((i) => (
                <Link key={i.to} to={i.to}>
                  {i.icon}
                  {t(i.key)}
                </Link>
              ))}
            </div>
            <div className="row mt-4" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
                {dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? t('theme_light') : t('theme_dark')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setPrefs({ accent: prefs.accent === 'uk' ? 'us' : 'uk' })}>
                {prefs.accent === 'uk' ? 'UK' : 'US'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Toasts() {
  const { toasts } = useApp()
  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  )
}
