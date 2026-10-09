import { Compass } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ExResult } from '../components/exercises'
import { ExercisePrompt, ExerciseView, Feedback } from '../components/Quiz'
import { Empty, LevelBadge, PageHead, ProgressBar } from '../components/ui'
import { useI18n } from '../i18n'
import { CEFR } from '../lib/course'
import { feedback, play } from '../lib/sounds'
import { shuffle } from '../lib/text'
import { LEVEL_IDS, type LevelId, type PlacementItem } from '../lib/types'
import { useApp } from '../state'

const QUESTIONS = 24

/** Лестница: после верного ответа уровень растёт, после ошибки — снижается; шаг постепенно уменьшается. */
function nextIndex(estimate: number, used: Set<number>, items: PlacementItem[]): number {
  const target = Math.round(estimate)
  for (let d = 0; d < LEVEL_IDS.length; d++) {
    for (const lv of [target + d, target - d]) {
      if (lv < 0 || lv >= LEVEL_IDS.length) continue
      const cand = items.map((it, i) => ({ it, i })).filter(({ it, i }) => !used.has(i) && it.level === LEVEL_IDS[lv])
      if (cand.length) return shuffle(cand)[0].i
    }
  }
  return -1
}

export function estimateLevel(history: { level: LevelId; ok: boolean }[]): LevelId {
  // самый высокий уровень, где верно хотя бы 60% ответов, а на всех уровнях ниже — не меньше 50%
  let best = 0
  for (let i = 0; i < LEVEL_IDS.length; i++) {
    const at = history.filter((h) => h.level === LEVEL_IDS[i])
    if (!at.length) continue
    const acc = at.filter((h) => h.ok).length / at.length
    if (acc >= 0.6) best = i
    else if (acc < 0.5) break
  }
  return LEVEL_IDS[best]
}

export default function Placement() {
  const { t } = useI18n()
  const { course, setPrefs, prefs, saveResult } = useApp()
  const items = useMemo(() => course?.placement ?? [], [course])
  const [started, setStarted] = useState(false)
  const [estimate, setEstimate] = useState(2)
  const [step, setStep] = useState(1)
  const [used, setUsed] = useState<Set<number>>(new Set())
  const [current, setCurrent] = useState<number>(-1)
  const [result, setResult] = useState<ExResult | null>(null)
  const [history, setHistory] = useState<{ level: LevelId; ok: boolean }[]>([])
  const [done, setDone] = useState<LevelId | null>(null)

  const start = () => {
    const u = new Set<number>()
    const first = nextIndex(2, u, items)
    u.add(first)
    setUsed(u)
    setCurrent(first)
    setEstimate(2)
    setStep(1)
    setHistory([])
    setDone(null)
    setResult(null)
    setStarted(true)
  }

  const onResult = (r: ExResult) => {
    if (result) return
    setResult(r)
    feedback(r.ok)
  }

  const next = () => {
    if (!result) return
    const item = items[current]
    const h = [...history, { level: item.level, ok: result.ok }]
    setHistory(h)
    const est = Math.max(0, Math.min(5, estimate + (result.ok ? step : -step)))
    setEstimate(est)
    setStep(Math.max(0.35, step * 0.8))
    setResult(null)
    const idx = h.length >= QUESTIONS ? -1 : nextIndex(est, used, items)
    if (idx < 0) {
      const lv = estimateLevel(h)
      setDone(lv)
      play('success')
      const score = h.filter((x) => x.ok).length
      saveResult({ kind: 'placement', scope: 'placement', title: `${t('placement_title')}: ${CEFR[lv]}`, score, total: h.length }).catch(() => {})
      setPrefs({ suggestedLevel: lv })
      return
    }
    setUsed((u) => new Set(u).add(idx))
    setCurrent(idx)
  }

  if (!items.length) return <Empty emoji="🧭">{t('content_soon')}</Empty>

  if (done) {
    const byLevel = LEVEL_IDS.map((lv) => {
      const at = history.filter((h) => h.level === lv)
      return { lv, n: at.length, ok: at.filter((h) => h.ok).length }
    }).filter((x) => x.n)
    return (
      <div className="quiz-result card">
        <div className="ex-task">{t('placement_result')}</div>
        <LevelBadge level={done} large />
        <h2>{t(`level_${done}` as never)}</h2>
        <p className="muted">{t('placement_note')}</p>
        <div className="stack" style={{ width: '100%', maxWidth: 360 }}>
          {byLevel.map((x) => (
            <div key={x.lv} className="row nowrap small">
              <LevelBadge level={x.lv} />
              <div className="grow">
                <ProgressBar value={(x.ok / x.n) * 100} thin color={`var(--lv-${x.lv})`} />
              </div>
              <span className="muted">
                {x.ok}/{x.n}
              </span>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          {prefs.level !== done && (
            <button className="btn btn-primary" onClick={() => setPrefs({ level: done })}>
              {t('placement_use')}
            </button>
          )}
          <Link className="btn btn-secondary" to={`/level/${done}`}>
            {t('open')} {CEFR[done]}
          </Link>
          <button className="btn btn-ghost" onClick={start}>
            {t('restart')}
          </button>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div>
        <PageHead title={t('placement_title')} crumbs={[{ to: '/tests', label: t('nav_tests') }]} />
        <div className="card stack" style={{ maxWidth: 640 }}>
          <div className="card-icon tone-violet">
            <Compass size={22} />
          </div>
          <p>{t('placement_intro')}</p>
          <p className="muted small">{t('placement_hint')}</p>
          <div>
            <button className="btn btn-primary btn-lg" onClick={start}>
              {t('start')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const item = items[current]
  return (
    <div className="quiz">
      <div className="quiz-top">
        <div className="quiz-title">{t('placement_title')}</div>
        <div className="row nowrap">
          <div className="grow">
            <ProgressBar value={(history.length / QUESTIONS) * 100} thin />
          </div>
          <span className="small muted">{t('question_n', { n: history.length + 1, total: QUESTIONS })}</span>
        </div>
      </div>
      <div className="ex-card" key={current}>
        <ExercisePrompt ex={item} />
        <ExerciseView ex={item} onResult={onResult} answered={!!result} />
      </div>
      {result && <Feedback ex={item} result={result} onNext={next} last={history.length + 1 >= QUESTIONS} />}
      {!result && (
        <div className="row end">
          <button className="btn btn-ghost btn-sm" onClick={() => onResult({ ok: false })}>
            {t('skip')}
          </button>
        </div>
      )}
    </div>
  )
}
