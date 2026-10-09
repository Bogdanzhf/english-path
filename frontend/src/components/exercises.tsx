// Виды упражнений. Каждый компонент показывает задание и один раз вызывает onResult
// с итогом проверки; дальше родитель (Quiz) показывает пояснение и кнопку «Дальше».

import { Check, Mic, RotateCcw, Snail, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { asset } from '../lib/course'
import {
  checkGap,
  checkOrder,
  clozeGaps,
  fixedSentence,
  gapAnswer,
  orderTokens,
  parseCloze,
  parseError,
  type LettersEx,
  type QuizEx,
} from '../lib/quiz'
import { canRecognize, listen, type RecognitionError } from '../lib/recognition'
import { play } from '../lib/sounds'
import { matches, nearMiss, plain, shuffle, speechScore } from '../lib/text'
import type { ChoiceEx, ClozeEx, DialogEx, ErrorEx, InputEx, ListenChoiceEx, ListenInputEx, MatchEx, OrderEx, SpeakEx, TfEx } from '../lib/types'
import { useApp } from '../state'
import { AudioButton, playClip } from './Audio'
import { Md } from './ui'

export interface ExResult {
  ok: boolean
  /** для частично верных ответов (пары, пропуски): доля верного */
  partial?: number
  near?: boolean
}
interface ViewProps<T> {
  ex: T
  onResult: (r: ExResult) => void
  answered: boolean
}

/** Текст правильного ответа (показывается после ошибки). */
export function correctText(ex: QuizEx): string | null {
  switch (ex.type) {
    case 'choice':
    case 'odd':
      return ex.options[ex.answer]
    case 'listen':
      return ex.options ? ex.options[ex.answer] : ex.answer[0]
    case 'input':
      return ex.answer[0]
    case 'order':
      return ex.answer
    case 'letters':
      return ex.answer
    case 'cloze':
      return plain(ex.text.replace(/\[\[(.+?)\]\]/g, (_, g: string) => gapAnswer(parseCloze(`[[${g}]]`)[1] as never)))
    case 'error':
      return fixedSentence(ex.text)
    case 'speak':
      return ex.answer
    default:
      return null
  }
}

// ---------- выбор варианта ----------

function useKeyChoice(count: number, pick: (i: number) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const n = Number(e.key)
      if (n >= 1 && n <= count) pick(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [count, pick, enabled])
}

export function ChoiceView({ ex, onResult, answered }: ViewProps<ChoiceEx | ListenChoiceEx>) {
  const [picked, setPicked] = useState<number | null>(null)
  const pick = (i: number) => {
    if (answered || picked !== null) return
    setPicked(i)
    onResult({ ok: i === ex.answer })
  }
  useKeyChoice(ex.options.length, pick, !answered)
  return (
    <div className={`options${ex.options.some((o) => o.length > 40) ? ' wide' : ''}`}>
      {ex.options.map((o, i) => {
        const state = picked === null ? '' : i === ex.answer ? 'ok' : i === picked ? 'bad' : 'dim'
        return (
          <button key={i} className={`option ${state}`} onClick={() => pick(i)} disabled={answered && picked === null}>
            <span className="option-key">{i + 1}</span>
            <span className="grow en">
              <Md inline>{o}</Md>
            </span>
            {state === 'ok' && <Check size={18} />}
          </button>
        )
      })}
    </div>
  )
}

// ---------- ввод ----------

export function InputView({ ex, onResult, answered }: ViewProps<InputEx | ListenInputEx>) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [state, setState] = useState<'' | 'ok' | 'bad'>('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  const check = () => {
    if (answered || !value.trim()) return
    const ok = matches(value, ex.answer)
    setState(ok ? 'ok' : 'bad')
    onResult({ ok, near: !ok && nearMiss(value, ex.answer) })
  }
  return (
    <form
      className="input-row"
      onSubmit={(e) => {
        e.preventDefault()
        check()
      }}
    >
      <input
        ref={ref}
        className={`input en ${state}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('type_answer')}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        readOnly={answered}
        aria-label={t('your_answer')}
      />
      {!answered && (
        <button className="btn btn-primary" type="submit" disabled={!value.trim()}>
          {t('check')}
        </button>
      )}
    </form>
  )
}

// ---------- собрать из плиток (слова предложения, буквы слова, реплики) ----------

function Tiles({
  tokens,
  onCheck,
  answered,
  joiner,
  hint,
  vertical,
}: {
  tokens: string[]
  onCheck: (picked: string[]) => boolean
  answered: boolean
  joiner: string
  hint: string
  vertical?: boolean
}) {
  const { t } = useI18n()
  const pool = useMemo(() => {
    let s = shuffle(tokens.map((tok, i) => ({ tok, i })))
    // не показываем сразу правильный порядок
    for (let k = 0; k < 5 && tokens.length > 1 && s.every((x, j) => x.tok === tokens[j]); k++) s = shuffle(s)
    return s
  }, [tokens])
  const [picked, setPicked] = useState<number[]>([])
  const [state, setState] = useState<'' | 'ok' | 'bad'>('')
  const complete = picked.length === tokens.length
  const check = () => {
    if (answered || !complete) return
    const ok = onCheck(picked.map((i) => pool[i].tok))
    setState(ok ? 'ok' : 'bad')
  }
  useEffect(() => {
    if (answered) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') setPicked((p) => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered])
  return (
    <div className="stack">
      <div className={`tiles-answer ${state}${vertical ? ' vertical' : ''}`} aria-live="polite">
        {picked.length === 0 && <span className="muted small">{hint}</span>}
        {picked.map((i, k) => (
          <button key={k} className="tile placed" disabled={answered} onClick={() => setPicked((p) => p.filter((x) => x !== i))}>
            {pool[i].tok}
          </button>
        ))}
      </div>
      <div className={`tiles-pool${vertical ? ' vertical' : ''}`}>
        {pool.map((p, i) => (
          <button
            key={i}
            className={`tile${picked.includes(i) ? ' used' : ''}`}
            disabled={answered || picked.includes(i)}
            onClick={() => {
              play('tap')
              setPicked((x) => [...x, i])
            }}
          >
            {p.tok}
          </button>
        ))}
      </div>
      {!answered && (
        <div className="row">
          <button className="btn btn-primary" onClick={check} disabled={!complete}>
            {t('check')}
          </button>
          <button className="btn btn-ghost" onClick={() => setPicked((p) => p.slice(0, -1))} disabled={!picked.length}>
            <RotateCcw size={16} /> {t('undo')}
          </button>
        </div>
      )}
      <span className="sr-only">{joiner}</span>
    </div>
  )
}

export function OrderView({ ex, onResult, answered }: ViewProps<OrderEx>) {
  const { t } = useI18n()
  const tokens = useMemo(() => [...orderTokens(ex.answer), ...(ex.extra ?? [])], [ex])
  return (
    <Tiles
      tokens={tokens}
      joiner=" "
      hint={t('tap_words')}
      answered={answered}
      onCheck={(picked) => {
        const ok = checkOrder(ex.answer, picked.filter(Boolean))
        onResult({ ok })
        return ok
      }}
    />
  )
}

export function LettersView({ ex, onResult, answered }: ViewProps<LettersEx>) {
  const { t } = useI18n()
  const tokens = useMemo(() => ex.answer.split('').filter((c) => c !== ' '), [ex])
  return (
    <Tiles
      tokens={tokens}
      joiner=""
      hint={t('tap_letters')}
      answered={answered}
      onCheck={(picked) => {
        const ok = picked.join('').toLowerCase() === ex.answer.replace(/\s/g, '').toLowerCase()
        onResult({ ok })
        return ok
      }}
    />
  )
}

export function DialogView({ ex, onResult, answered }: ViewProps<DialogEx>) {
  const { t } = useI18n()
  return (
    <Tiles
      vertical
      tokens={ex.lines}
      joiner="\n"
      hint={t('tap_words')}
      answered={answered}
      onCheck={(picked) => {
        const ok = picked.every((l, i) => l === ex.lines[i])
        onResult({ ok })
        return ok
      }}
    />
  )
}

// ---------- пары ----------

export function MatchView({ ex, onResult, answered }: ViewProps<MatchEx>) {
  const left = useMemo(() => shuffle(ex.pairs.map((p, i) => ({ text: p[0], i }))), [ex])
  const right = useMemo(() => shuffle(ex.pairs.map((p, i) => ({ text: p[1], i }))), [ex])
  const [sel, setSel] = useState<number | null>(null)
  const [done, setDone] = useState<number[]>([])
  const [bad, setBad] = useState<number | null>(null)
  const [errors, setErrors] = useState(0)
  const pickRight = (i: number) => {
    if (sel === null || answered) return
    if (sel === i) {
      play('tap')
      const next = [...done, i]
      setDone(next)
      setSel(null)
      if (next.length === ex.pairs.length) {
        const partial = Math.max(0, 1 - errors / ex.pairs.length)
        onResult({ ok: errors === 0, partial })
      }
    } else {
      play('wrong')
      setErrors((e) => e + 1)
      setBad(i)
      setTimeout(() => setBad(null), 450)
    }
  }
  return (
    <div className="match">
      <div className="match-col">
        {left.map((l) => (
          <button
            key={l.i}
            className={`match-item en${done.includes(l.i) ? ' done' : ''}${sel === l.i ? ' selected' : ''}`}
            disabled={done.includes(l.i) || answered}
            onClick={() => {
              play('tap')
              setSel(l.i)
            }}
          >
            <Md inline>{l.text}</Md>
          </button>
        ))}
      </div>
      <div className="match-col">
        {right.map((r) => (
          <button
            key={r.i}
            className={`match-item${done.includes(r.i) ? ' done' : ''}${bad === r.i ? ' bad' : ''}`}
            disabled={done.includes(r.i) || answered}
            onClick={() => pickRight(r.i)}
          >
            <Md inline>{r.text}</Md>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- текст с пропусками ----------

export function ClozeView({ ex, onResult, answered }: ViewProps<ClozeEx>) {
  const { t } = useI18n()
  const parts = useMemo(() => parseCloze(ex.text), [ex])
  const gaps = clozeGaps(parts)
  const [values, setValues] = useState<string[]>(() => gaps.map(() => ''))
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const filled = values.every((v) => v.trim() !== '')
  const check = () => {
    if (answered || !filled) return
    const res = gaps.map((g, i) => checkGap(g, values[i]))
    setChecked(res)
    const okCount = res.filter(Boolean).length
    onResult({ ok: okCount === gaps.length, partial: okCount / gaps.length })
  }
  let gi = -1
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        check()
      }}
    >
      <div className="cloze en">
        {parts.map((p, i) => {
          if (typeof p === 'string') return <Md key={i} inline>{p}</Md>
          gi++
          const k = gi
          const cls = checked ? (checked[k] ? 'ok' : 'bad') : ''
          if (p.kind === 'select') {
            return (
              <select key={i} className={`input gap-select ${cls}`} value={values[k]} disabled={answered} onChange={(e) => setValues((v) => v.map((x, j) => (j === k ? e.target.value : x)))}>
                <option value="">…</option>
                {p.options.map((o, oi) => (
                  <option key={oi} value={oi}>
                    {o}
                  </option>
                ))}
              </select>
            )
          }
          const width = Math.max(4, Math.max(...p.answers.map((a) => a.length)) + 2)
          return (
            <span key={i} className="gap-wrap">
              <input
                className={`input gap-input ${cls}`}
                style={{ width: `${width}ch` }}
                value={values[k]}
                readOnly={answered}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label={`gap ${k + 1}`}
                onChange={(e) => setValues((v) => v.map((x, j) => (j === k ? e.target.value : x)))}
              />
              {checked && !checked[k] && <span className="gap-fix">{gapAnswer(p)}</span>}
            </span>
          )
        })}
      </div>
      {!answered && (
        <div>
          <button className="btn btn-primary" type="submit" disabled={!filled}>
            {t('check')}
          </button>
        </div>
      )}
    </form>
  )
}

// ---------- найди ошибку ----------

export function ErrorView({ ex, onResult, answered }: ViewProps<ErrorEx>) {
  const tokens = useMemo(() => parseError(ex.text), [ex])
  const [picked, setPicked] = useState<number | null>(null)
  return (
    <div className="error-sentence en">
      {tokens.map((tok, i) => {
        const state = picked === null ? '' : tok.wrong ? 'ok' : i === picked ? 'bad' : ''
        return (
          <button
            key={i}
            className={`error-word ${state}`}
            disabled={answered}
            onClick={() => {
              if (picked !== null) return
              setPicked(i)
              onResult({ ok: tok.wrong })
            }}
          >
            {tok.text}
            {picked !== null && tok.wrong && <span className="error-fix">{tok.fix}</span>}
          </button>
        )
      })}
    </div>
  )
}

// ---------- верно / неверно ----------

export function TfView({ ex, onResult, answered }: ViewProps<TfEx>) {
  const { t } = useI18n()
  const [answers, setAnswers] = useState<(boolean | null)[]>(() => ex.items.map(() => null))
  const set = (i: number, v: boolean) => {
    if (answered || answers[i] !== null) return
    const next = answers.map((a, j) => (j === i ? v : a))
    setAnswers(next)
    if (ex.items.length > 1) play(v === ex.items[i][1] ? 'tap' : 'wrong')
    if (next.every((a) => a !== null)) {
      const okCount = next.filter((a, j) => a === ex.items[j][1]).length
      onResult({ ok: okCount === ex.items.length, partial: okCount / ex.items.length })
    }
  }
  useKeyChoice(ex.items.length === 1 ? 2 : 0, (k) => set(0, k === 0), !answered)
  return (
    <div className="stack">
      {ex.items.map(([text, truth], i) => {
        const a = answers[i]
        return (
          <div key={i} className={`tf-row${a === null ? '' : a === truth ? ' ok' : ' bad'}`}>
            <div className="grow en">
              <Md inline>{text}</Md>
            </div>
            <div className="row nowrap">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  className={`btn btn-sm ${a === v ? (v === truth ? 'btn-success' : 'btn-danger') : a !== null && v === truth ? 'btn-soft' : 'btn-secondary'}`}
                  onClick={() => set(i, v)}
                  disabled={answered || a !== null}
                >
                  {v ? t('true') : t('false')}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------- говорение ----------

export function SpeakView({ ex, onResult, answered }: ViewProps<SpeakEx>) {
  const { t } = useI18n()
  const { prefs } = useApp()
  const [state, setState] = useState<'idle' | 'listening'>('idle')
  const [interim, setInterim] = useState('')
  const [result, setResult] = useState<ReturnType<typeof speechScore> | null>(null)
  const [err, setErr] = useState<RecognitionError | null>(null)
  const [tries, setTries] = useState(0)
  const supported = canRecognize()
  const start = () => {
    setErr(null)
    setInterim('')
    setState('listening')
    listen({
      lang: prefs.accent === 'uk' ? 'en-GB' : 'en-US',
      onInterim: setInterim,
      onError: setErr,
      onEnd: () => setState('idle'),
      onResult: (alts) => {
        if (!alts.length) return
        const r = speechScore(ex.answer, alts)
        setResult(r)
        const n = tries + 1
        setTries(n)
        // засчитываем при 80% совпадения или после трёх попыток с лучшим результатом
        if (r.score >= 0.8) onResult({ ok: true })
        else if (n >= 3) onResult({ ok: false, partial: r.score })
        else play('wrong')
      },
    })
  }
  return (
    <div className="stack speak">
      <div className="speak-target en">
        <AudioButton text={ex.answer} audioKey={ex.audioKey} />
        <span className="grow">
          {result
            ? result.words.map((w, i) => (
                <span key={i} className={w.ok ? 'sw-ok' : 'sw-bad'}>
                  {w.w}{' '}
                </span>
              ))
            : ex.answer}
        </span>
      </div>
      {ex.ru && <div className="muted small">{ex.ru}</div>}
      {supported ? (
        <div className="row">
          <button className={`mic-btn${state === 'listening' ? ' on' : ''}`} onClick={start} disabled={answered || state === 'listening'} aria-label={t('speak_press')}>
            <Mic size={26} />
          </button>
          <div className="grow small">
            {state === 'listening' ? (
              <b>{t('speak_listening')}</b>
            ) : result ? (
              <>
                <b>{t('speak_score', { n: Math.round(result.score * 100) })}</b>
                <div className="muted">
                  {t('speak_heard')}: «{result.best}»
                </div>
              </>
            ) : (
              <span className="muted">{t('speak_press')}</span>
            )}
            {state === 'listening' && interim && <div className="muted">«{interim}»</div>}
            {err && <div className="alert error small mt-3">{t(err === 'not-allowed' ? 'speak_denied' : err === 'no-speech' ? 'speak_nothing' : err === 'network' ? 'speak_network' : 'speak_unsupported')}</div>}
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="alert warn small">{t('speak_unsupported')}</div>
          {!answered && (
            <div className="row">
              <span className="muted small">{t('speak_self_check')}:</span>
              <button className="btn btn-success btn-sm" onClick={() => onResult({ ok: true })}>
                {t('speak_ok')}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => onResult({ ok: false })}>
                {t('speak_again')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- аудирование: кнопки прослушивания ----------

export function ListenPrompt({ text, audioKey, autoplay = true }: { text: string; audioKey?: string | null; autoplay?: boolean }) {
  const { t } = useI18n()
  const id = `listen|${audioKey}|${text}`
  useEffect(() => {
    if (autoplay) {
      const timer = setTimeout(() => playClip(id, text, audioKey), 250)
      return () => clearTimeout(timer)
    }
  }, [id, text, audioKey, autoplay])
  return (
    <div className="listen-prompt">
      <button className="listen-big" onClick={() => playClip(id, text, audioKey)} aria-label={t('replay')}>
        <Volume2 size={34} />
      </button>
      <button className="btn btn-ghost btn-sm" onClick={() => playClip(`${id}|slow`, text, audioKey, { rate: 0.7 })}>
        <Snail size={16} /> {t('slow')}
      </button>
    </div>
  )
}

export function ExImage({ src }: { src?: string }) {
  if (!src) return null
  return <img className="ex-img" src={asset(src)} alt="" loading="lazy" />
}
