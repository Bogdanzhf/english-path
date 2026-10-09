import { ClipboardCheck, Compass, History, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Quiz } from '../components/Quiz'
import { Empty, LevelBadge, Loader, PageHead, Segmented, Switch } from '../components/ui'
import { useI18n } from '../i18n'
import { CEFR, loadLevel, loadWords } from '../lib/course'
import type { QuizItem } from '../lib/quiz'
import { buildTest, type TestSections } from '../lib/tests'
import { LEVEL_IDS, type LevelId } from '../lib/types'
import { useApp } from '../state'

function TestRunner({ level, sections, count, title, kind }: { level: LevelId; sections: TestSections; count: number; title: string; kind: string }) {
  const { lang } = useI18n()
  const { prefs } = useApp()
  const [items, setItems] = useState<QuizItem[] | null>(null)
  const [seed, setSeed] = useState(0)
  const sig = JSON.stringify(sections) // объект создаётся заново при каждой отрисовке родителя
  useEffect(() => {
    let alive = true
    Promise.all([loadLevel(level), loadWords()]).then(([lv, bank]) => {
      if (alive) setItems(buildTest(lv, bank, { sections: JSON.parse(sig), count, lang, accent: prefs.accent }))
    })
    return () => {
      alive = false
    }
  }, [level, sig, count, lang, prefs.accent, seed])
  if (!items) return <Loader />
  if (!items.length) return <Empty>—</Empty>
  return <Quiz key={seed} items={items} title={title} saveAs={{ kind, scope: `${kind}.${level}`, title }} onRestart={() => setSeed((s) => s + 1)} />
}

export function LevelTest({ level }: { level: LevelId }) {
  const { t } = useI18n()
  const [started, setStarted] = useState(false)
  const title = t('level_test', { level: CEFR[level] })
  if (started) return <TestRunner level={level} sections={{ vocab: true, grammar: true, reading: true, listening: true }} count={30} title={title} kind="level" />
  return (
    <div className="card row between">
      <div className="row nowrap grow" style={{ gap: 14 }}>
        <LevelBadge level={level} large />
        <div>
          <h3 className="mb-0">{title}</h3>
          <div className="muted small">{t('level_test_desc')} · 30</div>
        </div>
      </div>
      <button className="btn btn-primary" onClick={() => setStarted(true)}>
        {t('start')}
      </button>
    </div>
  )
}

function CustomTest() {
  const { t } = useI18n()
  const { prefs } = useApp()
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  const [sections, setSections] = useState<TestSections>({ vocab: true, grammar: true, reading: false, listening: true })
  const [count, setCount] = useState(20)
  const [run, setRun] = useState(0)
  if (run) {
    return (
      <div className="stack">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => setRun(0)}>
            ← {t('custom_test')}
          </button>
        </div>
        <TestRunner key={run} level={level} sections={sections} count={count} title={`${t('custom_test')} · ${CEFR[level]}`} kind="custom" />
      </div>
    )
  }
  const set = (k: keyof TestSections) => (v: boolean) => setSections((s) => ({ ...s, [k]: v }))
  return (
    <div className="card stack">
      <h3 className="mb-0">{t('custom_test')}</h3>
      <span className="muted small">{t('custom_test_desc')}</span>
      <Segmented<LevelId> options={LEVEL_IDS.map((l) => ({ id: l, label: l.toUpperCase() }))} value={level} onChange={setLevel} />
      <div>
        <Switch label={t('include_vocab')} checked={sections.vocab} onChange={set('vocab')} />
        <Switch label={t('include_grammar')} checked={sections.grammar} onChange={set('grammar')} />
        <Switch label={t('include_reading')} checked={sections.reading} onChange={set('reading')} />
        <Switch label={t('include_listening')} checked={sections.listening} onChange={set('listening')} />
      </div>
      <div className="row">
        <span className="label-text">{t('questions_count')}</span>
        <Segmented<number> options={[10, 20, 30, 40].map((n) => ({ id: n, label: String(n) }))} value={count} onChange={setCount} />
      </div>
      <div>
        <button className="btn btn-primary" disabled={!Object.values(sections).some(Boolean)} onClick={() => setRun((r) => r + 1)}>
          {t('start')}
        </button>
      </div>
    </div>
  )
}

export default function Tests() {
  const { t, lang } = useI18n()
  const { progress, prefs } = useApp()
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  return (
    <div className="stack gap-5">
      <PageHead title={t('tests_title')} subtitle={t('tests_subtitle')} />
      <Link to="/tests/placement" className="card row nowrap tone-violet" style={{ gap: 16 }}>
        <div className="card-icon mb-0">
          <Compass size={22} />
        </div>
        <div className="grow">
          <h3 className="mb-0">{t('placement_title')}</h3>
          <div className="muted small">{t('placement_hint')}</div>
        </div>
        {prefs.suggestedLevel && <LevelBadge level={prefs.suggestedLevel} />}
      </Link>
      <section>
        <div className="section-title">
          <ClipboardCheck size={20} />
          <h2>{t('tab_test')}</h2>
        </div>
        <div className="mb-3">
          <Segmented<LevelId> options={LEVEL_IDS.map((l) => ({ id: l, label: l.toUpperCase() }))} value={level} onChange={setLevel} />
        </div>
        <LevelTest key={level} level={level} />
      </section>
      <section>
        <div className="section-title">
          <SlidersHorizontal size={20} />
          <h2>{t('custom_test')}</h2>
        </div>
        <CustomTest />
      </section>
      <section>
        <div className="section-title">
          <History size={20} />
          <h2>{t('history')}</h2>
        </div>
        {progress.results.length ? (
          <div className="card pad-sm list">
            {progress.results.slice(0, 40).map((r) => {
              const p = Math.round((r.score * 100) / r.total)
              return (
                <div key={r.id} className="list-item small">
                  <span className="grow">{r.title}</span>
                  <span className="muted nowrap hide-mobile">{new Date(r.created_at).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="muted nowrap">
                    {r.score}/{r.total}
                  </span>
                  <span className={`chip ${p >= 85 ? 'green' : p >= 70 ? 'blue' : 'amber'}`}>{p}%</span>
                </div>
              )
            })}
          </div>
        ) : (
          <Empty emoji="📋">{t('no_results')}</Empty>
        )}
      </section>
    </div>
  )
}
