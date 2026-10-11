// Небольшие общие компоненты интерфейса.

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useI18n } from '../i18n'
import { CEFR } from '../lib/course'
import type { LevelId } from '../lib/types'

// Аватары — 3D-картинки Fluent Emoji (одинаково выглядят на Windows и iPhone); в профиле хранится сам символ.
export const AVATARS: Record<string, string> = {
  '🦊': 'fox', '🐼': 'panda', '🦉': 'owl', '🐯': 'tiger-face', '🐺': 'wolf', '🦁': 'lion',
  '🐧': 'penguin', '🐬': 'dolphin', '🚀': 'rocket', '🎧': 'headphone', '📚': 'books', '⚡': 'high-voltage',
}

export function Avatar({ value, large }: { value?: string; large?: boolean }) {
  const file = value ? AVATARS[value] : undefined
  return (
    <span className={large ? 'avatar lg' : 'avatar'} aria-hidden="true">
      {file ? <img src={`${import.meta.env.BASE_URL}img/av/${file}.webp`} alt="" draggable={false} /> : value}
    </span>
  )
}

export function Loader() {
  return (
    <div className="loader" role="status" aria-label="loading">
      <div className="spinner" />
    </div>
  )
}

export function Empty({ emoji = '🗂️', children }: { emoji?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="emoji">{emoji}</div>
      <div>{children}</div>
    </div>
  )
}

export function ProgressBar({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className={`progress${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%`, ...(color ? { ['--bar' as string]: color } : {}) }} />
    </div>
  )
}

export function Ring({ value, size = 52, stroke = 6, color = 'var(--primary)', label }: { value: number; size?: number; stroke?: number; color?: string; label?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: 'stroke-dashoffset 500ms' }}
        />
      </svg>
      <span className="ring-label">{label ?? `${Math.round(v)}%`}</span>
    </div>
  )
}

export function LevelBadge({ level, large }: { level: LevelId; large?: boolean }) {
  return <span className={`level-badge lv-${level}${large ? ' lg' : ''}`}>{CEFR[level]}</span>
}

export function Modal({ title, onClose, children, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: 'min(760px, 100%)' } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export interface TabDef<T extends string> {
  id: T
  label: ReactNode
  icon?: ReactNode
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: TabDef<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab${value === t.id ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string | number>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={String(o.id)} className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode }) {
  return (
    <label className="switch">
      <span>
        {label}
        {hint && <div className="muted small">{hint}</div>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

/** Markdown с таблицами (GFM). *курсив* в английском тексте подсвечивается как ключевое слово. */
export function Md({ children, inline }: { children: string; inline?: boolean }) {
  if (inline) {
    return (
      <Markdown remarkPlugins={[remarkGfm]} components={{ p: ({ children: c }) => <>{c}</> }}>
        {children}
      </Markdown>
    )
  }
  return (
    <div className="md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: c }) => (
            <div className="table-wrap">
              <table className="table">{c}</table>
            </div>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}

export function PageHead({ title, subtitle, crumbs, actions }: { title: ReactNode; subtitle?: ReactNode; crumbs?: { to: string; label: ReactNode }[]; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="grow">
        {crumbs && (
          <div className="crumbs">
            {crumbs.map((c, i) => (
              <span key={i} className="row nowrap" style={{ gap: 6 }}>
                <Link to={c.to}>{c.label}</Link>
                <span>›</span>
              </span>
            ))}
          </div>
        )}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function PosLabel({ pos }: { pos: string }) {
  const { t } = useI18n()
  return <span className="pos">{t(`pos_${pos}` as never)}</span>
}
