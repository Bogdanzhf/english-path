// Выбор слов для тренажёра: из своего словаря или из всего курса, с поиском. Выбор запоминается.

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { WordBank } from '../lib/course'
import { dictWords } from '../lib/mywords'
import { norm } from '../lib/text'
import type { Progress, Word } from '../lib/types'
import { LevelBadge, Segmented } from './ui'

const key = (user: string | number | undefined) => `ep:pick:${user ?? 'anon'}`

export function loadPicked(user: string | number | undefined): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(key(user)) ?? '[]')
    return Array.isArray(ids) ? ids.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function savePicked(user: string | number | undefined, ids: string[]) {
  localStorage.setItem(key(user), JSON.stringify(ids))
}

export function WordPicker({ bank, progress, picked, onChange }: { bank: WordBank; progress: Progress; picked: string[]; onChange: (ids: string[]) => void }) {
  const { t, tr } = useI18n()
  const [from, setFrom] = useState<'dict' | 'course'>('dict')
  const [q, setQ] = useState('')
  const dict = useMemo(() => dictWords(bank, progress), [bank, progress])
  const set = new Set(picked)

  const list = useMemo<Word[]>(() => {
    const query = norm(q)
    const match = (w: Word) => !query || norm(w.w).includes(query) || norm(w.ru).includes(query)
    if (from === 'dict') return dict.filter(match)
    if (query.length < 2) return bank.list.filter((w) => set.has(w.id)) // без запроса — только уже выбранные
    return bank.list.filter(match).slice(0, 60)
  }, [from, q, dict, bank, picked]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => onChange(set.has(id) ? picked.filter((x) => x !== id) : [...picked, id])
  const hard = dict.filter((w) => {
    const st = progress.words[w.id]
    return st && st.wrong > 0 && st.wrong >= st.correct / 2
  })

  return (
    <div className="stack word-picker">
      <div className="row between">
        <Segmented<'dict' | 'course'>
          options={[
            { id: 'dict', label: `${t('pick_from_dict')} · ${dict.length}` },
            { id: 'course', label: t('pick_from_course') },
          ]}
          value={from}
          onChange={setFrom}
        />
        <b className="small">{t('pick_selected', { n: picked.length })}</b>
      </div>
      <div className="search">
        <Search size={17} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('pick_search')} aria-label={t('pick_search')} />
      </div>
      <div className="row">
        <button className="btn btn-secondary btn-sm" onClick={() => onChange([...new Set([...picked, ...list.map((w) => w.id)])])} disabled={!list.length}>
          {t('pick_all')}
        </button>
        {hard.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => onChange([...new Set([...picked, ...hard.map((w) => w.id)])])}>
            {t('pick_hard')} · {hard.length}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => onChange([])} disabled={!picked.length}>
          {t('pick_none')}
        </button>
      </div>
      {from === 'course' && norm(q).length < 2 && <div className="muted small">{t('pick_course_hint')}</div>}
      <div className="pick-list">
        {list.map((w) => (
          <label key={w.id} className={`pick-row${set.has(w.id) ? ' on' : ''}`}>
            <input type="checkbox" checked={set.has(w.id)} onChange={() => toggle(w.id)} />
            <span className="en grow">
              <b>{w.w}</b> <span className="muted small">— {tr(w.ru, w.def)}</span>
            </span>
            {w.u > 0 && <LevelBadge level={w.lv} />}
          </label>
        ))}
      </div>
      {!picked.length && <div className="muted small">{t('pick_empty')}</div>}
    </div>
  )
}
