import { Headphones } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, LevelBadge, PageHead } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys } from '../lib/course'
import type { LevelId } from '../lib/types'
import { useApp } from '../state'

export default function ReadingIndex() {
  const { t, tr } = useI18n()
  const { course, progress, prefs } = useApp()
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  if (!course) return null
  const meta = course.levels.find((l) => l.id === level)!
  const units = meta.units.filter((u) => u.reading)
  return (
    <div>
      <PageHead title={t('reading_title')} subtitle={t('reading_subtitle')} />
      <div className="row mb-4">
        {course.levels.map((l) => (
          <button key={l.id} className={`chip${level === l.id ? ' selected' : ''}`} onClick={() => setLevel(l.id)} style={{ height: 38, padding: '0 6px' }}>
            <LevelBadge level={l.id} />
            <span style={{ paddingRight: 6 }}>{l.units.filter((u) => u.reading).length}</span>
          </button>
        ))}
      </div>
      {units.length ? (
        <div className={`grid grid-auto lv-${level}`}>
          {units.map((u) => {
            const st = progress.lessons[lessonKeys.reading(level, u.num)]
            return (
              <Link key={u.num} to={`/level/${level}/reading/${u.num}`} className="card pad-sm unit-card">
                <span className={`unit-num${st?.completed ? ' done' : ''}`}>
                  <Headphones size={20} />
                </span>
                <div className="grow">
                  <b className="en">{tr(u.readingRu, u.reading)}</b>
                  <div className="muted small">
                    {t('unit')} {u.num} · {tr(u.titleRu, u.title)}
                  </div>
                </div>
                {st?.best_score ? <span className={`chip tiny ${st.completed ? 'green' : 'amber'}`}>{st.best_score}%</span> : null}
              </Link>
            )
          })}
        </div>
      ) : (
        <Empty emoji="🎧">{t('content_soon')}</Empty>
      )}
    </div>
  )
}
