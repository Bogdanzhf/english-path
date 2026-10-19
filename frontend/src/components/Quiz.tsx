// Прохождение набора упражнений: по одному, с проверкой, звуками, пояснениями и итогом.

import { ArrowRight, CheckCircle2, Lightbulb, RotateCcw, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { QuizEx, QuizItem } from '../lib/quiz'
import { feedback, play } from '../lib/sounds'
import type { ResultOut } from '../lib/types'
import { useApp } from '../state'
import { AudioButton } from './Audio'
import {
  ChoiceView,
  ClozeView,
  correctText,
  DialogView,
  ErrorView,
  ExImage,
  InputView,
  LettersView,
  ListenPrompt,
  MatchView,
  OrderView,
  SpeakView,
  TfView,
  type ExResult,
} from './exercises'
import { Md, ProgressBar, Ring } from './ui'
import { ComposeView, WriteView } from './writing'

const TASK_KEYS = {
  choice: 'task_choice',
  odd: 'task_odd',
  input: 'task_input',
  order: 'task_order',
  match: 'task_match',
  cloze: 'task_cloze',
  error: 'task_error',
  tf: 'task_tf',
  dialog: 'task_dialog',
  listen: 'task_listen',
  speak: 'task_speak',
  letters: 'task_letters',
  write: 'task_write',
  compose: 'task_compose',
} as const

export function ExerciseView({ ex, onResult, answered }: { ex: QuizEx; onResult: (r: ExResult) => void; answered: boolean }) {
  switch (ex.type) {
    case 'choice':
    case 'odd':
      return <ChoiceView ex={ex} onResult={onResult} answered={answered} />
    case 'listen':
      return ex.options ? <ChoiceView ex={ex} onResult={onResult} answered={answered} /> : <InputView ex={ex} onResult={onResult} answered={answered} />
    case 'input':
      return <InputView ex={ex} onResult={onResult} answered={answered} />
    case 'order':
      return <OrderView ex={ex} onResult={onResult} answered={answered} />
    case 'letters':
      return <LettersView ex={ex} onResult={onResult} answered={answered} />
    case 'match':
      return <MatchView ex={ex} onResult={onResult} answered={answered} />
    case 'cloze':
      return <ClozeView ex={ex} onResult={onResult} answered={answered} />
    case 'error':
      return <ErrorView ex={ex} onResult={onResult} answered={answered} />
    case 'tf':
      return <TfView ex={ex} onResult={onResult} answered={answered} />
    case 'dialog':
      return <DialogView ex={ex} onResult={onResult} answered={answered} />
    case 'speak':
      return <SpeakView ex={ex} onResult={onResult} answered={answered} />
    case 'write':
      return <WriteView ex={ex} onResult={onResult} answered={answered} />
    case 'compose':
      return <ComposeView ex={ex} onResult={onResult} answered={answered} />
  }
}

/** Заголовок задания, вопрос, картинка и аудио. */
export function ExercisePrompt({ ex }: { ex: QuizEx }) {
  const { t, tr, lang } = useI18n()
  const task = tr(ex.taskRu, ex.task) ?? ex.task ?? t(TASK_KEYS[ex.type])
  const q = 'q' in ex ? ex.q : undefined
  return (
    <div className="ex-prompt">
      <div className="ex-task">{task}</div>
      {ex.context && (
        <details className="ex-context" open>
          <summary>{ex.context.title}</summary>
          <div className="en">
            <Md>{ex.context.text}</Md>
          </div>
        </details>
      )}
      {ex.type === 'listen' && <ListenPrompt text={ex.audio} audioKey={ex.audioKey} />}
      {ex.type !== 'listen' && ex.audio && <ListenPrompt text={ex.audio} audioKey={ex.audioKey} autoplay={false} />}
      <div className="row nowrap ex-q-row">
        <ExImage src={ex.img} />
        {q && (
          <div className="ex-q en grow">
            <Md>{q}</Md>
          </div>
        )}
        {ex.say && <AudioButton text={ex.say.text} audioKey={ex.say.key} accent={ex.say.accent} />}
      </div>
      {ex.hint && lang === 'ru' && <div className="ex-hint">{ex.hint}</div>}
    </div>
  )
}

export function Feedback({ ex, result, onNext, last }: { ex: QuizEx; result: ExResult; onNext: () => void; last: boolean }) {
  const { t, tr } = useI18n()
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  const answer = correctText(ex)
  const explain = tr(ex.explainRu ?? ex.explain, ex.explain ?? ex.explainRu)
  const showAnswer = !result.ok && answer && !['match', 'tf', 'dialog'].includes(ex.type)
  return (
    <div className={`feedback ${result.ok ? 'ok' : 'bad'}`} role="status">
      <div className="row nowrap" style={{ alignItems: 'flex-start' }}>
        {result.ok ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
        <div className="grow">
          <b>{result.ok ? t('correct') : result.near ? t('almost') : t('wrong')}</b>
          {showAnswer && (
            <div className="mt-0">
              {t('correct_answer')}: <b className="en">{answer}</b>
            </div>
          )}
          {explain && (
            <div className="explain">
              <Lightbulb size={15} /> <Md inline>{explain}</Md>
            </div>
          )}
        </div>
      </div>
      <button ref={ref} className="btn btn-primary" onClick={onNext}>
        {last ? t('finish') : t('next')} <ArrowRight size={17} />
      </button>
    </div>
  )
}

export interface QuizSummary {
  score: number
  total: number
  percent: number
  answers: { item: QuizItem; result: ExResult }[]
}

export function Quiz({
  items,
  onFinish,
  title,
  onRestart,
  extraResult,
  saveAs,
}: {
  items: QuizItem[]
  onFinish?: (s: QuizSummary) => Promise<ResultOut | void> | ResultOut | void
  title?: ReactNode
  onRestart?: () => void
  extraResult?: (s: QuizSummary) => ReactNode
  /** сохранить результат: вид, раздел и заголовок (слова обновят интервальное повторение) */
  saveAs?: { kind: string; scope: string; title: string }
}) {
  const { t } = useI18n()
  const { saveResult, user } = useApp()
  const [index, setIndex] = useState(0)
  const [current, setCurrent] = useState<ExResult | null>(null)
  const [answers, setAnswers] = useState<{ item: QuizItem; result: ExResult }[]>([])
  const [summary, setSummary] = useState<QuizSummary | null>(null)
  const [saved, setSaved] = useState<ResultOut | null>(null)
  const item = items[index]

  const onResult = useCallback(
    (r: ExResult) => {
      if (current) return
      setCurrent(r)
      feedback(r.ok)
    },
    [current],
  )

  const finish = async (all: { item: QuizItem; result: ExResult }[]) => {
    const score = all.reduce((s, a) => s + (a.result.ok ? 1 : (a.result.partial ?? 0) >= 0.5 ? 0.5 : 0), 0)
    const total = all.length
    const percent = total ? Math.round((score * 100) / total) : 0
    const s = { score, total, percent, answers: all }
    setSummary(s)
    play(percent >= 70 ? 'success' : 'tryAgain')
    let res: ResultOut | void = undefined
    if (saveAs && user && total) {
      const words = all.filter((a) => a.item.wordId).map((a) => ({ id: a.item.wordId!, correct: a.result.ok }))
      res = await saveResult({ ...saveAs, score: Math.round(score), total, words }).catch(() => undefined)
    }
    const r2 = await onFinish?.(s)
    setSaved(res ?? r2 ?? null)
  }

  const next = () => {
    if (!current || !item) return
    const all = [...answers, { item, result: current }]
    setAnswers(all)
    setCurrent(null)
    if (index + 1 >= items.length) finish(all)
    else setIndex(index + 1)
  }

  // Enter — «Дальше», когда ответ уже проверен
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.tagName !== 'BUTTON') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!items.length) return <div className="empty">—</div>

  if (summary) {
    return (
      <QuizResult
        summary={summary}
        saved={saved}
        extra={extraResult?.(summary)}
        onRestart={
          onRestart ??
          (() => {
            setIndex(0)
            setAnswers([])
            setSummary(null)
            setSaved(null)
          })
        }
      />
    )
  }

  return (
    <div className="quiz">
      <div className="quiz-top">
        {title && <div className="quiz-title">{title}</div>}
        <div className="row nowrap">
          <div className="grow">
            <ProgressBar value={(index / items.length) * 100} thin />
          </div>
          <span className="small muted nowrap">{t('question_n', { n: index + 1, total: items.length })}</span>
        </div>
      </div>
      <div className={`ex-card${current ? (current.ok ? ' is-ok' : ' is-bad') : ''}`} key={item.key + index}>
        <ExercisePrompt ex={item.ex} />
        <ExerciseView ex={item.ex} onResult={onResult} answered={!!current} />
      </div>
      {current && <Feedback ex={item.ex} result={current} onNext={next} last={index + 1 >= items.length} />}
      {!current && (
        <div className="row end">
          <button className="btn btn-ghost btn-sm" onClick={() => onResult({ ok: false })}>
            {t('skip')}
          </button>
        </div>
      )}
    </div>
  )
}

function QuizResult({ summary, saved, onRestart, extra }: { summary: QuizSummary; saved: ResultOut | null; onRestart: () => void; extra?: ReactNode }) {
  const { t } = useI18n()
  const [showMistakes, setShowMistakes] = useState(false)
  const mistakes = useMemo(() => summary.answers.filter((a) => !a.result.ok), [summary])
  const p = summary.percent
  const color = p >= 85 ? 'var(--green)' : p >= 70 ? 'var(--primary)' : 'var(--amber)'
  return (
    <div className="quiz-result card">
      <Ring value={p} size={120} stroke={10} color={color} label={<span style={{ fontSize: '1.6rem' }}>{p}%</span>} />
      <h2>{p >= 85 ? t('result_great') : p >= 70 ? t('result_good') : t('result_try')}</h2>
      <p className="muted">{t('result_score', { score: summary.score, total: summary.total, percent: p })}</p>
      {saved?.completed && <div className="chip green">✓ {t('completed')}</div>}
      {extra}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onRestart}>
          <RotateCcw size={17} /> {t('restart')}
        </button>
        {mistakes.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowMistakes((s) => !s)}>
            {t('review_mistakes')} ({mistakes.length})
          </button>
        )}
      </div>
      {showMistakes && (
        <div className="mistakes">
          {mistakes.map(({ item }, i) => (
            <div key={i} className="mistake">
              <div className="small muted">{'q' in item.ex && item.ex.q ? <Md inline>{item.ex.q}</Md> : item.ex.type === 'listen' ? item.ex.audio : null}</div>
              <div>
                {t('correct_answer')}: <b className="en">{correctText(item.ex) ?? '—'}</b>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
