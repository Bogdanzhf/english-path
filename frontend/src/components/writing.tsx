// Письмо: перевод и трансформация предложений, «своё предложение со словом».

import { Check, Lightbulb, PencilLine, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Показать результат проверки целиком (на телефоне он оказывается под нижней панелью). */
function useRevealOnChange(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (dep) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [dep])
  return ref
}
import { useI18n } from '../i18n'
import { play } from '../lib/sounds'
import type { ComposeEx, WriteEx } from '../lib/types'
import { checkCompose, checkWrite, diffWords, type ComposeCheck, type WriteCheck } from '../lib/writing'
import { useApp } from '../state'
import type { ExResult } from './exercises'
import { Md } from './ui'

interface Props<T> {
  ex: T
  onResult: (r: ExResult) => void
  answered: boolean
}

/** Поле для предложения: Enter — проверить, Shift+Enter — новая строка. */
function SentenceBox({ value, onChange, onSubmit, readOnly, state }: { value: string; onChange: (v: string) => void; onSubmit: () => void; readOnly: boolean; state: string }) {
  const { t } = useI18n()
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => ref.current?.focus({ preventScroll: true }), [])
  return (
    <textarea
      ref={ref}
      className={`input en sentence-box ${state}`}
      value={value}
      rows={2}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          onSubmit()
        }
      }}
      placeholder={t('write_placeholder')}
      autoCapitalize="sentences"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      readOnly={readOnly}
      aria-label={t('your_answer')}
    />
  )
}

/** Образец с подсветкой отличий от ответа пользователя. */
export function DiffLine({ mine, model }: { mine: string; model: string }) {
  return (
    <div className="diff en">
      {diffWords(mine, model).map((d, i) => (
        <span key={i} className={`diff-${d.kind}`} title={d.kind}>
          {d.text}
        </span>
      ))}
    </div>
  )
}

// ---------- перевод и трансформация ----------

export function WriteView({ ex, onResult, answered }: Props<WriteEx>) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const [res, setRes] = useState<WriteCheck | null>(null)
  const [decided, setDecided] = useState(false)
  const resultRef = useRevealOnChange(res)

  const check = () => {
    if (answered || res || !value.trim()) return
    const r = checkWrite(value, ex.answer, ex.strict)
    setRes(r)
    if (r.verdict === 'ok') {
      setDecided(true)
      onResult({ ok: true })
    } else play('wrong')
  }
  const decide = (ok: boolean) => {
    setDecided(true)
    onResult(ok ? { ok: true } : { ok: false, near: res?.verdict === 'near', partial: res?.verdict === 'near' ? 0.5 : 0 })
  }

  return (
    <div className="stack">
      {ex.text && (
        <div className="write-source en">
          <Md inline>{ex.text}</Md>
        </div>
      )}
      <SentenceBox value={value} onChange={setValue} onSubmit={check} readOnly={answered || !!res} state={res ? (res.verdict === 'ok' ? 'ok' : res.verdict === 'near' ? 'near' : 'bad') : ''} />
      {!res && !answered && (
        <div className="row">
          <button className="btn btn-primary" onClick={check} disabled={!value.trim()}>
            {t('check')}
          </button>
        </div>
      )}
      {res && (
        <div ref={resultRef} className={`write-result ${res.verdict}`}>
          {res.verdict === 'ok' ? (
            <div className="small">
              {res.typos ? t('write_ok_typos') : t('write_ok')}
              {(res.typos || value.trim() !== res.model) && <DiffLine mine={value} model={res.model} />}
            </div>
          ) : (
            <>
              <div className="small">
                <b>{res.verdict === 'near' ? t('write_near') : t('write_compare')}</b>
              </div>
              {ex.strict ? <div className="diff en">{res.model}</div> : <DiffLine mine={value} model={res.model} />}
              {ex.strict && <div className="muted small">{t('write_punct')}</div>}
              {ex.answer.length > 1 && (
                <div className="muted small">
                  {t('write_also')}: {ex.answer.filter((a) => a !== res.model).join(' · ')}
                </div>
              )}
              <div className="diff-legend muted tiny">
                <span className="diff-missing">{t('diff_missing')}</span> <span className="diff-extra">{t('diff_extra')}</span> <span className="diff-typo">{t('diff_typo')}</span>
              </div>
              {!decided && (
                <div className="row">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setRes(null)
                    }}
                  >
                    <RotateCcw size={15} /> {t('write_retry')}
                  </button>
                  <button className="btn btn-soft btn-sm" onClick={() => decide(true)}>
                    <Check size={15} /> {t('write_mine_ok')}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => decide(false)}>
                    {t('write_got_it')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- своё предложение ----------

export function ComposeView({ ex, onResult, answered }: Props<ComposeEx>) {
  const { t } = useI18n()
  const { course } = useApp()
  const [value, setValue] = useState(ex.start ? ex.start + ' ' : '')
  const [res, setRes] = useState<ComposeCheck | null>(null)
  const [done, setDone] = useState(false)
  const resultRef = useRevealOnChange(res)

  const check = () => {
    if (answered || done || !value.trim()) return
    const r = checkCompose(value, ex, course?.irregular ?? [])
    setRes(r)
    if (r.ok) {
      setDone(true)
      onResult({ ok: true })
    } else play('wrong')
  }

  return (
    <div className="stack">
      {ex.start && (
        <div className="muted small">
          {t('compose_start')}: <b className="en">{ex.start} …</b>
        </div>
      )}
      <SentenceBox value={value} onChange={(v) => (setValue(v), setRes(null))} onSubmit={check} readOnly={answered || done} state={done ? 'ok' : res ? 'bad' : ''} />
      {!done && !answered && (
        <div className="row">
          <button className="btn btn-primary" onClick={check} disabled={!value.trim()}>
            <PencilLine size={16} /> {t('check')}
          </button>
          {!!ex.must?.length && (
            <span className="muted small">
              {t('compose_use')}: <b className="en">{ex.must.join(', ')}</b>
            </span>
          )}
        </div>
      )}
      {res && !res.ok && (
        <div ref={resultRef} className="alert warn small">
          {res.missing.length > 0 && <div>{t('compose_missing', { w: res.missing.join(', ') })}</div>}
          {res.badStart && <div>{t('compose_bad_start', { s: ex.start ?? '' })}</div>}
          {res.tooShort && <div>{t('compose_too_short', { n: ex.min ?? 4 })}</div>}
        </div>
      )}
      {done && (
        <div ref={resultRef} className="write-result ok small">
          <div>{t('compose_done')}</div>
          {ex.model.map((m, i) => (
            <div key={i} className="en mt-0">
              <Lightbulb size={14} /> <Md inline>{m}</Md>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
