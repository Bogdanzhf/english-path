// Флеш-карточки: слово → перевод/определение/пример. Два режима:
//  • learn — «знаю / не знаю» (первое знакомство со словами юнита);
//  • review — оценки интервального повторения (не помню / трудно / помню / легко).

import { RotateCcw, Shuffle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { AGAIN, EASY, GOOD, HARD, preview, type Grade } from '../lib/srs'
import { shuffle } from '../lib/text'
import type { Word } from '../lib/types'
import { useApp } from '../state'
import { AudioButton, playClip } from './Audio'
import { WordImage } from './WordCard'
import { Md, PosLabel, ProgressBar } from './ui'
import { play } from '../lib/sounds'

export interface CardItem {
  id: string
  word?: Word
  custom?: { word: string; translation: string; ipa: string; example: string; note: string }
}

function Front({ item }: { item: CardItem }) {
  const w = item.word
  return (
    <>
      {w && <WordImage word={w} size={96} />}
      <div className="flash-word en">{w?.w ?? item.custom?.word}</div>
      {w && <PosLabel pos={w.pos} />}
      {w && <div className="ipa">/{w.us}/</div>}
      {item.custom?.ipa && <div className="ipa">/{item.custom.ipa}/</div>}
    </>
  )
}

function Back({ item }: { item: CardItem }) {
  const { lang } = useI18n()
  const w = item.word
  if (!w) {
    const c = item.custom!
    return (
      <>
        <div className="flash-word en" style={{ fontSize: '1.5rem' }}>{c.word}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{c.translation}</div>
        {c.example && <div className="example en">{c.example}</div>}
        {c.note && <div className="muted small">{c.note}</div>}
      </>
    )
  }
  return (
    <>
      <div className="flash-word en" style={{ fontSize: '1.5rem' }}>{w.w}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{lang === 'ru' ? w.ru : w.def}</div>
      {lang === 'ru' && <div className="muted small en">{w.def}</div>}
      <div className="example" style={{ textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
        <AudioButton text={w.ex.replace(/\*/g, '')} audioKey={w.ae} size="sm" />
        <div>
          <div className="en">
            <Md inline>{w.ex}</Md>
          </div>
          <div className="muted small">{w.exRu}</div>
        </div>
      </div>
    </>
  )
}

export function Flashcards({ items, mode, onDone }: { items: CardItem[]; mode: 'learn' | 'review'; onDone?: (known: number, unknown: number) => void }) {
  const { t } = useI18n()
  const { reviews, progress, prefs, user } = useApp()
  const [order, setOrder] = useState(items)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const [pending, setPending] = useState<{ id: string; grade: Grade }[]>([])
  const item = order[i]
  const finished = i >= order.length

  useEffect(() => {
    setOrder(items)
    setI(0)
    setFlipped(false)
    setKnown(0)
  }, [items])

  // произносим слово при показе карточки (если включено в настройках)
  useEffect(() => {
    if (!item || !prefs.autoplay) return
    const w = item.word
    const text = w?.w ?? item.custom?.word ?? ''
    const timer = setTimeout(() => playClip(`card|${item.id}`, text, w ? (prefs.accent === 'uk' ? w.au : w.aa) : null), 200)
    return () => clearTimeout(timer)
  }, [item, prefs.autoplay, prefs.accent])

  const flush = (list: { id: string; grade: Grade }[]) => {
    if (user && list.length) reviews(list).catch(() => {})
  }

  const grade = (g: Grade) => {
    if (!item) return
    play(g === AGAIN ? 'wrong' : 'correct')
    const next = [...pending, { id: item.id, grade: g }]
    if (g !== AGAIN) setKnown((k) => k + 1)
    setFlipped(false)
    const last = i + 1 >= order.length
    if (last || next.length >= 10) {
      flush(next)
      setPending([])
    } else setPending(next)
    setI(i + 1)
    if (last) onDone?.(g !== AGAIN ? known + 1 : known, order.length - (g !== AGAIN ? known + 1 : known))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || finished) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setFlipped((f) => !f)
      } else if (flipped && mode === 'review' && ['1', '2', '3', '4'].includes(e.key)) grade((Number(e.key) - 1) as Grade)
      else if (flipped && mode === 'learn' && (e.key === '1' || e.key === '2')) grade(e.key === '1' ? AGAIN : GOOD)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!order.length) return null

  if (finished) {
    return (
      <div className="card center stack" style={{ alignItems: 'center', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ fontSize: '2.6rem' }}>🎉</div>
        <h2 className="mb-0">{t('cards_done')}</h2>
        <p className="muted">{t('cards_result', { known, unknown: order.length - known })}</p>
        <div className="row">
          <button
            className="btn btn-primary"
            onClick={() => {
              setOrder(shuffle(items))
              setI(0)
              setKnown(0)
            }}
          >
            <RotateCcw size={17} /> {t('restart')}
          </button>
        </div>
      </div>
    )
  }

  const ws = progress.words[item.id]
  const days = (g: Grade) => {
    const d = preview(ws, g)
    return d === 0 ? '10 ' + t('minutes_short') : `${Math.round(d)} ${t('days_short')}`
  }

  return (
    <div>
      <div className="row nowrap mb-4" style={{ maxWidth: 560, margin: '0 auto var(--space-4)' }}>
        <div className="grow">
          <ProgressBar value={(i / order.length) * 100} thin />
        </div>
        <span className="small muted">
          {i + 1}/{order.length}
        </span>
        <button className="icon-btn sm" onClick={() => setOrder([...order.slice(0, i), ...shuffle(order.slice(i))])} title="shuffle" aria-label="shuffle">
          <Shuffle size={16} />
        </button>
      </div>
      <div className="flashcard-wrap">
        <div className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped((f) => !f)} role="button" aria-label={t('flip_card')} tabIndex={0}>
          <div className="flash-face front">
            <Front item={item} />
            <span className="muted tiny">{t('flip_card')}</span>
          </div>
          <div className="flash-face back">
            <Back item={item} />
          </div>
        </div>
      </div>
      <div className="row mt-3" style={{ justifyContent: 'center' }}>
        {item.word && <AudioButton text={item.word.w} audioKey={prefs.accent === 'uk' ? item.word.au : item.word.aa} accent={prefs.accent} />}
        {item.custom && <AudioButton text={item.custom.word} />}
      </div>
      {!flipped ? (
        <div className="row mt-4" style={{ justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => setFlipped(true)}>
            {t('show_answer')}
          </button>
        </div>
      ) : mode === 'learn' ? (
        <div className="grades" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button className="btn grade-again" onClick={() => grade(AGAIN)}>
            {t('i_dont_know')}
          </button>
          <button className="btn grade-good" onClick={() => grade(GOOD)}>
            {t('i_know')}
          </button>
        </div>
      ) : (
        <div className="grades">
          <button className="btn grade-again" onClick={() => grade(AGAIN)}>
            {t('grade_again')}
            <small>{days(AGAIN)}</small>
          </button>
          <button className="btn grade-hard" onClick={() => grade(HARD)}>
            {t('grade_hard')}
            <small>{days(HARD)}</small>
          </button>
          <button className="btn grade-good" onClick={() => grade(GOOD)}>
            {t('grade_good')}
            <small>{days(GOOD)}</small>
          </button>
          <button className="btn grade-easy" onClick={() => grade(EASY)}>
            {t('grade_easy')}
            <small>{days(EASY)}</small>
          </button>
        </div>
      )}
    </div>
  )
}
