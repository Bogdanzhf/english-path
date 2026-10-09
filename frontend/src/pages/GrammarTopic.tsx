import { BookOpenText, Dumbbell, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { Quiz } from '../components/Quiz'
import { Empty, LevelBadge, Loader, Md, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys } from '../lib/course'
import { toItems } from '../lib/quiz'
import { rememberVisit } from '../lib/stats'
import { shuffle } from '../lib/text'
import type { LevelId } from '../lib/types'
import { useApp } from '../state'
import { useLevelData } from './Unit'

type Tab = 'rule' | 'examples' | 'practice'

export default function GrammarTopic() {
  const { lv, id } = useParams()
  const level = lv as LevelId
  const { t, tr, lang } = useI18n()
  const { course, openLesson } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'rule'
  const { data, error } = useLevelData(level)
  const [seed, setSeed] = useState(0)
  const topic = data?.level.grammar.find((g) => g.id === id)
  const meta = course?.levels.find((l) => l.id === level)
  const idx = meta?.grammar.findIndex((g) => g.id === id) ?? -1
  const key = lessonKeys.grammar(level, id ?? '')

  useEffect(() => {
    if (!topic) return
    openLesson(key)
    rememberVisit({ path: `/level/${level}/grammar/${topic.id}`, title: topic.title, titleRu: topic.titleRu })
  }, [topic, key, level, openLesson])

  const items = useMemo(() => (topic ? toItems(topic.exercises, key) : []), [topic, key])
  // при «Ещё раз» упражнения перемешиваются
  const shuffled = useMemo(() => (seed ? shuffle(items) : items), [items, seed])

  if (error) return <Empty emoji="📡">{String(error)}</Empty>
  if (!data) return <Loader />
  if (!topic) return <Empty emoji="🧭">{t('not_found')}</Empty>
  const prev = idx > 0 ? meta?.grammar[idx - 1] : undefined
  const next = meta && idx >= 0 && idx < meta.grammar.length - 1 ? meta.grammar[idx + 1] : undefined

  return (
    <div className={`lv-${level}`}>
      <div className="crumbs">
        <Link to="/grammar">{t('nav_grammar')}</Link> › <Link to={`/level/${level}?tab=grammar`}>{level.toUpperCase()}</Link> › {t(`section_${topic.section}` as never)}
      </div>
      <div className="page-head">
        <div className="grow">
          <h1>{tr(topic.titleRu, topic.title)}</h1>
          <p>
            <LevelBadge level={level} /> &nbsp;{tr(topic.summaryRu, topic.summary)}
          </p>
        </div>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { id: 'rule', label: t('tab_rule'), icon: <BookOpenText size={16} /> },
          ...(topic.examples.length ? [{ id: 'examples' as Tab, label: t('tab_examples'), icon: <ListChecks size={16} /> }] : []),
          { id: 'practice', label: `${t('tab_practice')} · ${topic.exercises.length}`, icon: <Dumbbell size={16} /> },
        ]}
      />
      {tab === 'rule' && (
        <div className="stack gap-4">
          <div className="card">
            <Md>{lang === 'ru' ? topic.theoryRu : topic.theory}</Md>
          </div>
          <div className="row">
            <button className="btn btn-primary" onClick={() => setParams({ tab: topic.examples.length ? 'examples' : 'practice' }, { replace: true })}>
              {topic.examples.length ? t('tab_examples') : t('tab_practice')} →
            </button>
          </div>
        </div>
      )}
      {tab === 'examples' && (
        <div className="stack">
          {topic.examples.map((e, i) => (
            <div key={i} className="example">
              <AudioButton text={e.en} audioKey={e.a} size="sm" />
              <div>
                <div className="en">
                  <Md inline>{e.en}</Md>
                </div>
                {lang === 'ru' && <div className="muted small">{e.ru}</div>}
              </div>
            </div>
          ))}
          <div className="row mt-3">
            <button className="btn btn-primary" onClick={() => setParams({ tab: 'practice' }, { replace: true })}>
              {t('tab_practice')} →
            </button>
          </div>
        </div>
      )}
      {tab === 'practice' && (
        <Quiz key={seed} items={shuffled} saveAs={{ kind: 'grammar', scope: key, title: topic.title }} onRestart={() => setSeed((s) => s + 1)} />
      )}
      <div className="row between mt-5">
        {prev ? (
          <Link className="btn btn-ghost" to={`/level/${level}/grammar/${prev.id}`}>
            ← {tr(prev.titleRu, prev.title)}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn btn-ghost" to={`/level/${level}/grammar/${next.id}`}>
            {tr(next.titleRu, next.title)} →
          </Link>
        )}
      </div>
    </div>
  )
}
