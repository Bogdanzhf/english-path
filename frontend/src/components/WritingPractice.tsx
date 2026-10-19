// Вкладка «Письмо»: выбор количества и видов заданий, затем упражнения.

import { PencilLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import type { QuizItem } from '../lib/quiz'
import { WRITING_KINDS, itemKind, pickWriting, type WritingKind } from '../lib/writing'
import { Quiz } from './Quiz'
import { Segmented } from './ui'

const COUNTS = [5, 10, 20, 0] as const // 0 — все
const PREF_KEY = 'ep:writing'

function loadPrefs(): { count: number; kinds: WritingKind[] } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? '')
    if (typeof p.count === 'number' && Array.isArray(p.kinds)) return p
  } catch {
    /* по умолчанию */
  }
  return { count: 10, kinds: [...WRITING_KINDS] }
}

export function WritingPractice({ items, intro, saveAs }: { items: QuizItem[]; intro: string; saveAs: { scope: string; title: string } }) {
  const { t } = useI18n()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [run, setRun] = useState(0) // 0 — экран настроек
  const available = useMemo(() => WRITING_KINDS.filter((k) => items.some((it) => itemKind(it) === k)), [items])
  const kinds = prefs.kinds.filter((k) => available.includes(k))
  const total = items.filter((it) => kinds.includes(itemKind(it))).length
  const save = (p: typeof prefs) => {
    setPrefs(p)
    localStorage.setItem(PREF_KEY, JSON.stringify(p))
  }
  // набор пересобирается при каждом запуске
  const picked = useMemo(() => (run ? pickWriting(items, kinds, prefs.count || items.length) : []), [run]) // eslint-disable-line react-hooks/exhaustive-deps

  if (run && picked.length) {
    return (
      <div className="stack">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => setRun(0)}>
            {t('writing_settings')}
          </button>
        </div>
        <Quiz key={run} items={picked} saveAs={{ kind: 'writing', ...saveAs }} onRestart={() => setRun((r) => r + 1)} />
      </div>
    )
  }

  return (
    <div className="card stack writing-setup">
      <p className="muted mb-0">{intro}</p>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label-text">{t('writing_kinds')}</span>
        <div className="row">
          {available.map((k) => {
            const on = kinds.includes(k)
            return (
              <button
                key={k}
                className={`chip${on ? ' blue' : ''}`}
                aria-pressed={on}
                onClick={() => save({ ...prefs, kinds: on ? prefs.kinds.filter((x) => x !== k) : [...prefs.kinds, k] })}
              >
                {t(`wkind_${k}` as DictKey)} · {items.filter((it) => itemKind(it) === k).length}
              </button>
            )
          })}
        </div>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <span className="label-text">{t('writing_count')}</span>
        <Segmented<number>
          options={COUNTS.map((c) => ({ id: c, label: c ? String(c) : `${t('writing_all')} · ${total}` }))}
          value={prefs.count}
          onChange={(count) => save({ ...prefs, count })}
        />
      </div>
      {!kinds.length && <div className="alert warn small">{t('writing_none')}</div>}
      <div>
        <button className="btn btn-primary" disabled={!kinds.length || !total} onClick={() => setRun((r) => r + 1)}>
          <PencilLine size={17} /> {t('writing_start')}
        </button>
      </div>
    </div>
  )
}
