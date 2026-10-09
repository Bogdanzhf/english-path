import { Layers, Table2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LevelBadge, PageHead } from '../components/ui'
import { useI18n } from '../i18n'
import type { LevelId } from '../lib/types'
import { useApp } from '../state'
import { GrammarList } from './Level'

export default function GrammarIndex() {
  const { t } = useI18n()
  const { course, prefs } = useApp()
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  if (!course) return null
  const meta = course.levels.find((l) => l.id === level)!
  return (
    <div>
      <PageHead title={t('grammar_title')} subtitle={t('grammar_subtitle')} />
      <div className="grid grid-2 mb-4">
        <Link to="/grammar/tenses" className="card pad-sm row nowrap tone-violet" style={{ gap: 14 }}>
          <div className="card-icon mb-0">
            <Table2 size={22} />
          </div>
          <div>
            <b>{t('tenses_map')}</b>
            <div className="muted small">{t('tenses_map_hint')}</div>
          </div>
        </Link>
        <Link to="/grammar/irregular" className="card pad-sm row nowrap tone-teal" style={{ gap: 14 }}>
          <div className="card-icon mb-0">
            <Layers size={22} />
          </div>
          <div>
            <b>{t('irregular_verbs')}</b>
            <div className="muted small">{t('irregular_hint')}</div>
          </div>
        </Link>
      </div>
      <div className="row mb-4">
        {course.levels.map((l) => (
          <button key={l.id} className={`chip${level === l.id ? ' selected' : ''}`} onClick={() => setLevel(l.id)} style={{ height: 38, padding: '0 6px 0 6px' }}>
            <LevelBadge level={l.id} />
            <span style={{ paddingRight: 6 }}>{t('topics_count', { n: l.grammar.length })}</span>
          </button>
        ))}
      </div>
      <GrammarList level={meta} />
    </div>
  )
}
