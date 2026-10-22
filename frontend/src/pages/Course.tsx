import { BookOpenText, Check, Compass, Headphones, MessagesSquare, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LevelBadge, PageHead, ProgressBar } from '../components/ui'
import { useI18n } from '../i18n'
import { levelProgress } from '../lib/stats'
import { useApp } from '../state'

export default function Course() {
  const { t, plural } = useI18n()
  const { course, progress, prefs } = useApp()
  if (!course) return null
  return (
    <div>
      <PageHead
        title={t('course_title')}
        subtitle={t('course_subtitle')}
        actions={
          <Link to="/tests/placement" className="btn btn-soft">
            <Compass size={17} /> {t('take_placement')}
          </Link>
        }
      />
      <div className="grid grid-auto">
        {course.levels.map((l) => {
          const lp = levelProgress(l, progress)
          const words = l.units.reduce((s, u) => s + u.words, 0)
          const current = (prefs.level ?? prefs.suggestedLevel) === l.id
          return (
            <Link key={l.id} to={`/level/${l.id}`} className={`card level-card lv-${l.id}`}>
              <div className="row between">
                <LevelBadge level={l.id} large />
                <div className="row">
                  {current && <span className="chip blue">{t('current_level')}</span>}
                  {prefs.suggestedLevel === l.id && !current && <span className="chip violet">{t('suggested_level')}</span>}
                  {lp.percent === 100 && (
                    <span className="chip green">
                      <Check size={14} /> {t('completed')}
                    </span>
                  )}
                </div>
              </div>
              <h2 className="mt-3">{t(`level_${l.id}` as never)}</h2>
              <p className="muted small">{t(`level_desc_${l.id}` as never)}</p>
              <div className="row small text-2" style={{ gap: 14 }}>
                <span className="row" style={{ gap: 5 }}>
                  <Sparkles size={15} /> {words} {plural(words, ['слово', 'слова', 'слов'], ['word', 'words'])}
                </span>
                <span className="row" style={{ gap: 5 }}>
                  <BookOpenText size={15} /> {t('topics_count', { n: l.grammar.length })}
                </span>
                <span className="row" style={{ gap: 5 }}>
                  <Headphones size={15} /> {l.units.filter((u) => u.reading).length}
                </span>
                <span className="row" style={{ gap: 5 }}>
                  <MessagesSquare size={15} /> {l.dialogues.length}
                </span>
              </div>
              <div className="mt-4">
                <div className="row between small muted mb-0">
                  <span>{t('completed')}</span>
                  <span>{lp.percent}%</span>
                </div>
                <ProgressBar value={lp.percent} color={`var(--lv-${l.id})`} />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
