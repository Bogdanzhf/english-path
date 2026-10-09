import { ArrowRight, BookOpenText, Brain, Compass, Headphones, MessagesSquare, Sparkles, Star, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { LevelBadge, ProgressBar } from '../components/ui'
import { useI18n } from '../i18n'
import { CEFR } from '../lib/course'
import { lastDays, lastVisit, levelProgress, nextInLevel, wordStats } from '../lib/stats'
import type { LevelId } from '../lib/types'
import { useApp } from '../state'

export default function Dashboard() {
  const { t, tr, lang } = useI18n()
  const { user, course, progress, prefs } = useApp()
  const stats = useMemo(() => wordStats(progress), [progress])
  const days = useMemo(() => lastDays(progress, 21), [progress])
  const level: LevelId = prefs.level ?? prefs.suggestedLevel ?? 'a1'
  const next = course ? nextInLevel(course, level, progress) : {}
  const last = lastVisit()
  const max = Math.max(10, ...days.map((d) => d.points))
  const completed = Object.values(progress.lessons).filter((l) => l.completed).length

  return (
    <div className="stack gap-5">
      <section className="hero">
        <div className="row between" style={{ alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
          <div className="grow">
            <h1>{t('hello', { name: user?.display_name ?? '' })}</h1>
            <p>{t('dash_subtitle')}</p>
            <div className="row mt-4">
              {last ? (
                <Link to={last.path} className="btn btn-secondary btn-lg">
                  {t('continue')}: {tr(last.titleRu, last.title)} <ArrowRight size={18} />
                </Link>
              ) : (
                next.unit && (
                  <Link to={`/level/${level}/unit/${next.unit.num}`} className="btn btn-secondary btn-lg">
                    {t('start')}: {tr(next.unit.titleRu, next.unit.title)} <ArrowRight size={18} />
                  </Link>
                )
              )}
            </div>
          </div>
          <Link to={`/level/${level}`} className="hero-level" title={t('current_level')}>
            <span className="tiny">{t('current_level')}</span>
            <b>{CEFR[level]}</b>
          </Link>
        </div>
      </section>

      <section className="grid grid-4">
        <Link to="/review" className="card pad-sm tone-coral">
          <div className="card-icon">
            <Brain size={22} />
          </div>
          <div className="stat">
            <b>{stats.due}</b>
            <span>{t('due_reviews')}</span>
          </div>
        </Link>
        <Link to="/my-words" className="card pad-sm tone-amber">
          <div className="card-icon">
            <Star size={22} />
          </div>
          <div className="stat">
            <b>{stats.inDict}</b>
            <span>{t('words_in_dict')}</span>
          </div>
        </Link>
        <div className="card pad-sm tone-green">
          <div className="card-icon">
            <Trophy size={22} />
          </div>
          <div className="stat">
            <b>{stats.learned}</b>
            <span>{t('words_learned')}</span>
          </div>
        </div>
        <Link to="/course" className="card pad-sm tone-primary">
          <div className="card-icon">
            <Sparkles size={22} />
          </div>
          <div className="stat">
            <b>{completed}</b>
            <span>{t('lessons_done')}</span>
          </div>
        </Link>
      </section>

      {!prefs.suggestedLevel && (
        <section className="card row between tone-violet">
          <div className="row nowrap grow" style={{ gap: 16 }}>
            <div className="card-icon mb-0">
              <Compass size={22} />
            </div>
            <div className="grow">
              <h3 className="mb-0">{t('take_placement')}</h3>
              <div className="muted small">{t('placement_hint')}</div>
            </div>
          </div>
          <Link to="/tests/placement" className="btn btn-soft">
            {t('start')} <ArrowRight size={17} />
          </Link>
        </section>
      )}

      <section>
        <h2>{t('quick_actions')}</h2>
        <div className="grid grid-4">
          {next.unit && (
            <Link to={`/level/${level}/unit/${next.unit.num}`} className="card pad-sm tone-primary">
              <div className="card-icon">
                <Sparkles size={22} />
              </div>
              <b>{t('qa_words')}</b>
              <div className="muted small">{tr(next.unit.titleRu, next.unit.title)}</div>
            </Link>
          )}
          {next.grammar && (
            <Link to={`/level/${level}/grammar/${next.grammar.id}`} className="card pad-sm tone-violet">
              <div className="card-icon">
                <BookOpenText size={22} />
              </div>
              <b>{t('qa_grammar')}</b>
              <div className="muted small">{tr(next.grammar.titleRu, next.grammar.title)}</div>
            </Link>
          )}
          {next.reading && (
            <Link to={`/level/${level}/reading/${next.reading.num}`} className="card pad-sm tone-teal">
              <div className="card-icon">
                <Headphones size={22} />
              </div>
              <b>{t('qa_listen')}</b>
              <div className="muted small">{tr(next.reading.readingRu, next.reading.reading)}</div>
            </Link>
          )}
          {next.dialogue && (
            <Link to={`/level/${level}/dialogue/${next.dialogue.id}`} className="card pad-sm tone-coral">
              <div className="card-icon">
                <MessagesSquare size={22} />
              </div>
              <b>{t('qa_speak')}</b>
              <div className="muted small">{tr(next.dialogue.titleRu, next.dialogue.title)}</div>
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card">
          <h3>{t('level_progress')}</h3>
          <div className="stack">
            {course?.levels.map((l) => {
              const lp = levelProgress(l, progress)
              return (
                <Link key={l.id} to={`/level/${l.id}`} className="row nowrap level-row">
                  <LevelBadge level={l.id} />
                  <div className="grow">
                    <div className="row between small">
                      <span>{t(`level_${l.id}` as never)}</span>
                      <span className="muted">
                        {lp.done}/{lp.total}
                      </span>
                    </div>
                    <ProgressBar value={lp.percent} thin color={`var(--lv-${l.id})`} />
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
        <div className="card">
          <h3>{t('activity')}</h3>
          <div className="activity-chart" aria-label={t('activity')}>
            {days.map((d, i) => (
              <div
                key={d.day}
                className={`bar${d.points === 0 ? ' zero' : ''}${i === days.length - 1 ? ' today' : ''}`}
                style={{ height: `${Math.max(4, (d.points / max) * 100)}%` }}
                title={`${new Date(d.day).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short' })}: ${t('activity_points', { n: d.points })}`}
              />
            ))}
          </div>
          <h3 className="mt-5">{t('last_results')}</h3>
          {progress.results.length === 0 ? (
            <p className="muted small">{t('no_results')}</p>
          ) : (
            <div className="list">
              {progress.results.slice(0, 5).map((r) => {
                const p = Math.round((r.score * 100) / r.total)
                return (
                  <div key={r.id} className="list-item small">
                    <span className="grow">{r.title}</span>
                    <span className={`chip ${p >= 85 ? 'green' : p >= 70 ? 'blue' : 'amber'}`}>{p}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
