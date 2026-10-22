import { BookOpenText, Check, ClipboardCheck, Headphones, MessagesSquare, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Empty, LevelBadge, ProgressBar, Segmented, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys, CEFR } from '../lib/course'
import { levelProgress } from '../lib/stats'
import { LEVEL_IDS, type LevelId, type LevelMeta } from '../lib/types'
import { useApp } from '../state'
import { topicOf, unitName } from '../lib/topics'
import { LevelTest } from './Tests'

type Tab = 'vocab' | 'grammar' | 'reading' | 'dialogues' | 'test'

export const SECTION_ORDER = ['tenses', 'verbs', 'modals', 'conditionals', 'passive', 'reported', 'nouns', 'pronouns', 'adjectives', 'prepositions', 'sentences', 'clauses', 'style', 'words']

function LessonMark({ k }: { k: string }) {
  const { progress } = useApp()
  const st = progress.lessons[k]
  if (st?.completed) return <span className="chip green tiny"><Check size={12} /> {st.best_score}%</span>
  if (st?.best_score) return <span className="chip amber tiny">{st.best_score}%</span>
  return null
}

export function GrammarList({ level, compact }: { level: LevelMeta; compact?: boolean }) {
  const { t, tr } = useI18n()
  const groups = useMemo(() => {
    const m = new Map<string, LevelMeta['grammar']>()
    for (const g of level.grammar) m.set(g.section, [...(m.get(g.section) ?? []), g])
    return [...m.entries()].sort((a, b) => SECTION_ORDER.indexOf(a[0]) - SECTION_ORDER.indexOf(b[0]))
  }, [level])
  if (!level.grammar.length) return <Empty emoji="📘">{t('content_soon')}</Empty>
  return (
    <div className="stack">
      {groups.map(([section, topics]) => (
        <div key={section}>
          {!compact && (
            <div className="section-title">
              <h3>{t(`section_${section}` as never)}</h3>
            </div>
          )}
          <div className="grid grid-auto">
            {topics.map((g) => (
              <Link key={g.id} to={`/level/${level.id}/grammar/${g.id}`} className="card pad-sm topic-card">
                <div className="row between nowrap">
                  <span className="section-label">{compact ? t(`section_${section}` as never) : CEFR[level.id]}</span>
                  <LessonMark k={lessonKeys.grammar(level.id, g.id)} />
                </div>
                <h3 className="mt-0 mb-0" style={{ marginTop: 6 }}>{tr(g.titleRu, g.title)}</h3>
                <div className="muted small">{tr(g.summaryRu, g.summary)}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function UnitCard({ level, u }: { level: LevelMeta; u: LevelMeta['units'][number] }) {
  const { tr, plural } = useI18n()
  const { progress } = useApp()
  const k = lessonKeys.vocab(level.id, u.num)
  const done = progress.lessons[k]?.completed
  const topic = topicOf(u)
  return (
    <Link to={`/level/${level.id}/unit/${u.num}`} className="card pad-sm unit-card">
      <span className={`unit-num${done ? ' done' : ''}`}>{done ? <Check size={20} /> : u.num}</span>
      <div className="grow">
        <b>
          <span aria-hidden="true">{topic.emoji}</span> {unitName(u, tr)}
        </b>
        <div className="muted small">
          {u.words} {plural(u.words, ['слово', 'слова', 'слов'], ['word', 'words'])}
          {u.reading && ` · ${tr(u.readingRu ?? '', u.reading)}`}
        </div>
      </div>
      <LessonMark k={k} />
    </Link>
  )
}

/** Уроки уровня: по порядку прохождения или сгруппированные по темам. */
function UnitList({ level }: { level: LevelMeta }) {
  const { t, tr } = useI18n()
  const { progress } = useApp()
  const [view, setView] = useState<'order' | 'topics'>(() => (localStorage.getItem('ep:unit-view') as 'order' | 'topics') || 'order')
  const pick = (v: 'order' | 'topics') => {
    setView(v)
    localStorage.setItem('ep:unit-view', v)
  }
  const groups = useMemo(() => {
    const m = new Map<string, LevelMeta['units']>()
    for (const u of level.units) m.set(u.topic ?? '', [...(m.get(u.topic ?? '') ?? []), u])
    return [...m.entries()]
  }, [level])
  if (!level.units.length) return <Empty emoji="📚">{t('content_soon')}</Empty>
  return (
    <div className="stack">
      <Segmented
        value={view}
        onChange={pick}
        options={[
          { id: 'order', label: t('units_in_order') },
          { id: 'topics', label: t('units_by_topic') },
        ]}
      />
      {view === 'order' ? (
        <div className="grid grid-auto">
          {level.units.map((u) => (
            <UnitCard key={u.num} level={level} u={u} />
          ))}
        </div>
      ) : (
        groups.map(([id, units]) => {
          const topic = topicOf({ topic: id })
          const done = units.filter((u) => progress.lessons[lessonKeys.vocab(level.id, u.num)]?.completed).length
          return (
            <div key={id}>
              <div className="section-title row between">
                <h3>
                  <span aria-hidden="true">{topic.emoji}</span> {tr(topic.ru, topic.en)}
                </h3>
                <span className="muted small">
                  {done} / {units.length}
                </span>
              </div>
              <div className="grid grid-auto">
                {units.map((u) => (
                  <UnitCard key={u.num} level={level} u={u} />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export default function Level() {
  const { lv } = useParams()
  const { t, tr } = useI18n()
  const { course, progress, prefs, setPrefs } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'vocab'
  const level = course?.levels.find((l) => l.id === lv)
  if (!level || !LEVEL_IDS.includes(lv as LevelId)) return <Empty emoji="🧭">{t('not_found')}</Empty>
  const lp = levelProgress(level, progress)
  const isCurrent = (prefs.level ?? prefs.suggestedLevel) === level.id

  return (
    <div className={`lv-${level.id}`}>
      <div className="crumbs">
        <Link to="/course">{t('nav_course')}</Link> ›
      </div>
      <div className="level-hero">
        <LevelBadge level={level.id} large />
        <div className="grow">
          <h1>{t(`level_${level.id}` as never)}</h1>
          <div className="muted small">{t(`level_desc_${level.id}` as never)}</div>
          <div className="row nowrap mt-3" style={{ maxWidth: 420 }}>
            <div className="grow">
              <ProgressBar value={lp.percent} color={`var(--lv-${level.id})`} />
            </div>
            <span className="small muted">{lp.percent}%</span>
          </div>
        </div>
        {isCurrent ? (
          <span className="chip blue hide-mobile">{t('current_level')}</span>
        ) : (
          <button className="btn btn-soft btn-sm hide-mobile" onClick={() => setPrefs({ level: level.id })}>
            {t('set_current_level')}
          </button>
        )}
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { id: 'vocab', label: t('tab_vocab'), icon: <Sparkles size={16} /> },
          { id: 'grammar', label: t('tab_grammar'), icon: <BookOpenText size={16} /> },
          { id: 'reading', label: t('tab_reading'), icon: <Headphones size={16} /> },
          { id: 'dialogues', label: t('tab_dialogues'), icon: <MessagesSquare size={16} /> },
          { id: 'test', label: t('tab_test'), icon: <ClipboardCheck size={16} /> },
        ]}
      />

      {tab === 'vocab' && <UnitList level={level} />}

      {tab === 'grammar' && <GrammarList level={level} />}

      {tab === 'reading' && (
        <div className="grid grid-auto">
          {level.units
            .filter((u) => u.reading)
            .map((u) => (
              <Link key={u.num} to={`/level/${level.id}/reading/${u.num}`} className="card pad-sm unit-card">
                <span className="unit-num">
                  <Headphones size={20} />
                </span>
                <div className="grow">
                  <b>{tr(u.readingRu, u.reading)}</b>
                  <div className="muted small">
                    {t('unit')} {u.num} · {unitName(u, tr)}
                  </div>
                </div>
                <LessonMark k={lessonKeys.reading(level.id, u.num)} />
              </Link>
            ))}
          {!level.units.some((u) => u.reading) && <Empty emoji="🎧">{t('content_soon')}</Empty>}
        </div>
      )}

      {tab === 'dialogues' &&
        (level.dialogues.length ? (
          <div className="grid grid-auto">
            {level.dialogues.map((d) => (
              <Link key={d.id} to={`/level/${level.id}/dialogue/${d.id}`} className="card pad-sm unit-card">
                <span className="unit-num">
                  <MessagesSquare size={20} />
                </span>
                <div className="grow">
                  <b>{tr(d.titleRu, d.title)}</b>
                  <div className="muted small">{tr(d.title, d.titleRu)}</div>
                </div>
                <LessonMark k={lessonKeys.dialogue(d.id)} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty emoji="💬">{t('content_soon')}</Empty>
        ))}

      {tab === 'test' && <LevelTest level={level.id} />}
    </div>
  )
}
