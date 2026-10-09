// Текст для чтения и аудирования: озвучка по предложениям, перевод абзацев,
// режимы «читать», «слушать без текста», «диктант» и вопросы на понимание.

import { BookOpen, Eye, Headphones, Languages, Pause, PenLine, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import { speakAll, stop, type Accent } from '../lib/audio'
import { splitByWords, wordsRegex } from '../lib/highlight'
import { toItems } from '../lib/quiz'
import { feedback } from '../lib/sounds'
import { expand, norm } from '../lib/text'
import type { Reading as ReadingT, Sentence, Word } from '../lib/types'
import { useApp } from '../state'
import { AudioButton, playClip } from './Audio'
import { Quiz } from './Quiz'
import { Segmented, Tabs } from './ui'

type Mode = 'read' | 'listen' | 'dictation' | 'questions'

const voiceAccent = (voice: string): Accent => (voice.endsWith('uk') ? 'uk' : 'us')

function Player({ sentences, accent, current, setCurrent }: { sentences: Sentence[]; accent: Accent; current: number; setCurrent: (i: number) => void }) {
  const { t } = useI18n()
  const { prefs, setPrefs } = useApp()
  const [playing, setPlaying] = useState(false)
  const stopRef = useRef<() => void>(() => {})
  useEffect(() => () => stop(), [])
  const start = (from = 0) => {
    setPlaying(true)
    stopRef.current = speakAll(
      sentences.map((s) => ({ text: s.en, key: s.a, accent })),
      { from, onIndex: setCurrent, onEnd: () => (setPlaying(false), setCurrent(-1)), pause: 350 },
    )
  }
  return (
    <div className="player">
      <button
        className="btn btn-primary"
        onClick={() => {
          if (playing) {
            stopRef.current()
            setPlaying(false)
          } else start(current > 0 ? current : 0)
        }}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? t('pause') : t('play_all')}
      </button>
      {current > 0 && !playing && (
        <button className="btn btn-ghost btn-sm" onClick={() => (setCurrent(-1), start(0))}>
          <RotateCcw size={15} />
        </button>
      )}
      <div className="grow" />
      <Segmented
        options={[
          { id: 0.75, label: '0.75×' },
          { id: 1, label: '1×' },
          { id: 1.25, label: '1.25×' },
        ]}
        value={prefs.rate}
        onChange={(rate) => {
          setPrefs({ rate })
          if (playing) {
            stopRef.current()
            setTimeout(() => start(current), 50)
          }
        }}
      />
    </div>
  )
}

function Dictation({ sentences, accent, onDone }: { sentences: Sentence[]; accent: Accent; onDone: (score: number, total: number) => void }) {
  const { t } = useI18n()
  const list = useMemo(() => sentences.filter((s) => s.en.split(' ').length <= 22).slice(0, 8), [sentences])
  const [i, setI] = useState(0)
  const [value, setValue] = useState('')
  const [checked, setChecked] = useState<{ w: string; ok: boolean }[] | null>(null)
  const [score, setScore] = useState(0)
  const s = list[i]
  useEffect(() => {
    if (s) {
      const timer = setTimeout(() => playClip(`dict|${i}`, s.en, s.a, { accent }), 300)
      return () => clearTimeout(timer)
    }
  }, [s, i, accent])
  if (!s) {
    return (
      <div className="card center">
        <h3>{t('dictation_done')}</h3>
        <p className="muted">{t('result_score', { score, total: list.length, percent: Math.round((score * 100) / Math.max(1, list.length)) })}</p>
        <button className="btn btn-primary" onClick={() => (setI(0), setScore(0), setChecked(null), setValue(''))}>
          <RotateCcw size={16} /> {t('restart')}
        </button>
      </div>
    )
  }
  const check = () => {
    const target = s.en.split(/\s+/)
    const mine = expand(value).split(' ')
    const words = target.map((w) => {
      const parts = expand(w).split(' ')
      return { w, ok: parts.every((p) => mine.includes(p)) }
    })
    const ok = norm(expand(value)) === norm(expand(s.en))
    const good = words.filter((x) => x.ok).length / words.length >= 0.9
    setChecked(words)
    feedback(ok || good)
    if (ok || good) setScore((x) => x + 1)
  }
  const next = () => {
    const n = i + 1
    setI(n)
    setValue('')
    setChecked(null)
    if (n >= list.length) onDone(score, list.length)
  }
  return (
    <div className="ex-card">
      <div className="ex-task">
        {t('dictation_hint')} · {i + 1}/{list.length}
      </div>
      <div className="row">
        <AudioButton text={s.en} audioKey={s.a} accent={accent} />
        <AudioButton text={s.en} audioKey={s.a} accent={accent} slow label={t('slow')} />
      </div>
      <textarea
        className="input en"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={!!checked}
        autoCapitalize="sentences"
        spellCheck={false}
        rows={3}
        aria-label={t('your_answer')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (checked) next()
            else if (value.trim()) check()
          }
        }}
      />
      {checked && (
        <div className="speak-target en" style={{ fontSize: '1.05rem' }}>
          <span>
            {checked.map((w, k) => (
              <span key={k} className={w.ok ? 'sw-ok' : 'sw-bad'}>
                {w.w}{' '}
              </span>
            ))}
          </span>
        </div>
      )}
      <div className="row">
        {!checked ? (
          <button className="btn btn-primary" onClick={check} disabled={!value.trim()}>
            {t('check')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={next}>
            {t('next')}
          </button>
        )}
      </div>
    </div>
  )
}

export function Reading({ reading, words, scope, title }: { reading: ReadingT; words: Word[]; scope: string; title: string }) {
  const { t, lang } = useI18n()
  const { openLesson } = useApp()
  const [mode, setMode] = useState<Mode>('read')
  const [showRu, setShowRu] = useState<boolean>(false)
  const [openRu, setOpenRu] = useState<Set<number>>(new Set())
  const [current, setCurrent] = useState(-1)
  const [revealed, setRevealed] = useState(false)
  const accent = voiceAccent(reading.voice)
  const re = useMemo(() => wordsRegex(words.map((w) => w.w)), [words])
  const sentences = useMemo(() => reading.paras.flatMap((p) => p.s), [reading])
  const questions = useMemo(() => toItems(reading.questions, scope), [reading, scope])

  useEffect(() => {
    openLesson(scope)
  }, [scope, openLesson])
  useEffect(() => () => stop(), [])
  useEffect(() => {
    if (current >= 0) document.querySelector(`[data-s="${current}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])

  let idx = -1
  const text = (
    <div className="reading en">
      {reading.paras.map((p, pi) => (
        <div key={pi} className="reading-para">
          {p.s.map((s) => {
            idx++
            const k = idx
            return (
              <span key={k}>
                <span data-s={k} className={`sentence${current === k ? ' current' : ''}`} onClick={() => (setCurrent(k), playClip(`s|${k}`, s.en, s.a, { accent }))}>
                  {splitByWords(s.en, re).map((part, j) =>
                    part.hit ? (
                      <span key={j} className="target-word">
                        {part.text}
                      </span>
                    ) : (
                      part.text
                    ),
                  )}
                </span>{' '}
              </span>
            )
          })}
          {(showRu || openRu.has(pi)) && <div className="para-ru">{p.ru}</div>}
          {!showRu && lang === 'ru' && !openRu.has(pi) && (
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: -8 }} onClick={() => setOpenRu((s) => new Set(s).add(pi))}>
              <Languages size={14} /> {t('translation')}
            </button>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="reading-meta">
        <h2 className="mb-0 grow en">{reading.title}</h2>
        <span className="chip">{accent === 'uk' ? `UK · ${t('voice_uk')}` : `US · ${t('voice_us')}`}</span>
      </div>
      {lang === 'ru' && <p className="muted" style={{ marginTop: -8 }}>{reading.titleRu}</p>}
      <Tabs<Mode>
        value={mode}
        onChange={(m) => {
          stop()
          setCurrent(-1)
          setMode(m)
        }}
        tabs={[
          { id: 'read', label: t('rmode_read'), icon: <BookOpen size={16} /> },
          { id: 'listen', label: t('rmode_listen'), icon: <Headphones size={16} /> },
          { id: 'dictation', label: t('rmode_dictation'), icon: <PenLine size={16} /> },
          { id: 'questions', label: t('questions'), icon: <Eye size={16} /> },
        ]}
      />
      {mode === 'read' && (
        <>
          <Player sentences={sentences} accent={accent} current={current} setCurrent={setCurrent} />
          <div className="row between mb-3">
            <span className="muted small">{t('tap_sentence')}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowRu((s) => !s)}>
              <Languages size={15} /> {showRu ? t('hide_translation') : t('show_translation')}
            </button>
          </div>
          <div className="card">{text}</div>
          {reading.glossary.length > 0 && (
            <div className="card mt-4">
              <h3>{t('glossary')}</h3>
              <div className="grid grid-2">
                {reading.glossary.map(([en, ru]) => (
                  <div key={en} className="small">
                    <b className="en">{en}</b> — {ru}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={() => setMode('questions')}>
              {t('questions')}
            </button>
          </div>
        </>
      )}
      {mode === 'listen' && (
        <>
          <Player sentences={sentences} accent={accent} current={current} setCurrent={setCurrent} />
          {revealed ? (
            <div className="card">{text}</div>
          ) : (
            <div className="card center stack" style={{ alignItems: 'center' }}>
              <div className="listen-big" style={{ cursor: 'default' }}>
                <Headphones size={34} />
              </div>
              <p className="muted mb-0">{current >= 0 ? `${current + 1} / ${sentences.length}` : t('play_all')}</p>
              <button className="btn btn-secondary" onClick={() => setRevealed(true)}>
                <Eye size={16} /> {t('reveal_text')}
              </button>
            </div>
          )}
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={() => setMode('questions')}>
              {t('questions')}
            </button>
          </div>
        </>
      )}
      {mode === 'dictation' && <Dictation sentences={sentences} accent={accent} onDone={() => {}} />}
      {mode === 'questions' && <Quiz items={questions} saveAs={{ kind: 'reading', scope, title }} />}
    </div>
  )
}
