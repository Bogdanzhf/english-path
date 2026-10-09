import { Dumbbell, Languages, MessageCircle, Mic, Pause, Play, Quote, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AudioButton, playClip } from '../components/Audio'
import { Quiz } from '../components/Quiz'
import { Empty, LevelBadge, Loader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { speak, speakAll, stop, type Accent } from '../lib/audio'
import { lessonKeys } from '../lib/course'
import type { QuizItem } from '../lib/quiz'
import { toItems } from '../lib/quiz'
import { canRecognize, listen } from '../lib/recognition'
import { feedback } from '../lib/sounds'
import { rememberVisit } from '../lib/stats'
import { speechScore } from '../lib/text'
import type { Dialogue, LevelId } from '../lib/types'
import { useApp } from '../state'
import { useLevelData } from './Unit'

type Tab = 'listen' | 'role' | 'phrases' | 'practice'
const COLORS = ['var(--primary)', 'var(--coral)', 'var(--teal)', 'var(--violet)']
const accentOf = (voice: string): Accent => (voice.endsWith('uk') ? 'uk' : 'us')

function Bubbles({ d, current, hidden, showRu, onLine }: { d: Dialogue; current: number; hidden?: string; showRu: boolean; onLine?: (i: number) => void }) {
  const speakers = Object.keys(d.speakers)
  return (
    <div className="dialogue">
      {d.lines.map((l, i) => {
        const k = speakers.indexOf(l.speaker)
        const right = k % 2 === 1
        const isHidden = hidden === l.speaker && current < i
        return (
          <div key={i} className={`bubble-row${right ? ' right' : ''}`} data-line={i}>
            <span className="speaker-dot" style={{ ['--sp' as string]: COLORS[k % COLORS.length] }}>
              {l.speaker.slice(0, 2)}
            </span>
            <div className={`bubble${current === i ? ' current' : ''}${isHidden ? ' hidden-line' : ''}`} onClick={() => onLine?.(i)}>
              <div className="who">{l.speaker}</div>
              <div className="en">{isHidden ? '…' : l.en}</div>
              {showRu && !isHidden && <div className="ru">{l.ru}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ListenTab({ d }: { d: Dialogue }) {
  const { t, lang } = useI18n()
  const [current, setCurrent] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [showRu, setShowRu] = useState(lang === 'ru')
  useEffect(() => () => stop(), [])
  useEffect(() => {
    if (current >= 0) document.querySelector(`[data-line="${current}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [current])
  const play = () => {
    setPlaying(true)
    speakAll(
      d.lines.map((l) => ({ text: l.en, key: l.a, accent: accentOf(d.speakers[l.speaker]) })),
      { onIndex: setCurrent, onEnd: () => (setPlaying(false), setCurrent(-1)), pause: 450 },
    )
  }
  return (
    <div>
      <div className="player">
        <button className="btn btn-primary" onClick={() => (playing ? (stop(), setPlaying(false)) : play())}>
          {playing ? <Pause size={18} /> : <Play size={18} />} {playing ? t('pause') : t('dialogue_listen')}
        </button>
        <div className="grow" />
        <button className="btn btn-ghost btn-sm" onClick={() => setShowRu((s) => !s)}>
          <Languages size={15} /> {showRu ? t('hide_translation') : t('show_translation')}
        </button>
      </div>
      <Bubbles
        d={d}
        current={current}
        showRu={showRu}
        onLine={(i) => {
          setCurrent(i)
          const l = d.lines[i]
          playClip(`dl|${d.id}|${i}`, l.en, l.a, { accent: accentOf(d.speakers[l.speaker]) })
        }}
      />
    </div>
  )
}

function RoleTab({ d }: { d: Dialogue }) {
  const { t, lang } = useI18n()
  const { prefs } = useApp()
  const speakers = Object.keys(d.speakers)
  const [role, setRole] = useState<string | null>(null)
  const [i, setI] = useState(0)
  const [state, setState] = useState<'idle' | 'playing' | 'listening' | 'done'>('idle')
  const [scores, setScores] = useState<Record<number, number>>({})
  const [heard, setHeard] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      stop()
    }
  }, [])
  const supported = canRecognize()

  // реплики собеседника звучат автоматически, на своей — ждём речь пользователя
  useEffect(() => {
    if (!role || state !== 'playing') return
    if (i >= d.lines.length) return setState('done')
    const l = d.lines[i]
    if (l.speaker === role) return setState('idle')
    speak(l.en, l.a, { accent: accentOf(d.speakers[l.speaker]) }).then(() => {
      if (alive.current) setI((x) => x + 1)
    })
  }, [role, state, i, d])

  useEffect(() => {
    document.querySelector(`[data-line="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [i])

  const sayMine = () => {
    const l = d.lines[i]
    setHeard('')
    setState('listening')
    listen({
      lang: prefs.accent === 'uk' ? 'en-GB' : 'en-US',
      onInterim: setHeard,
      onError: () => setState('idle'),
      onResult: (alts) => {
        if (!alts.length) return setState('idle')
        const r = speechScore(l.en, alts)
        setHeard(r.best)
        setScores((s) => ({ ...s, [i]: Math.max(s[i] ?? 0, r.score) }))
        feedback(r.score >= 0.7)
        if (r.score >= 0.7) {
          setI((x) => x + 1)
          setState('playing')
        } else setState('idle')
      },
    })
  }
  const skipMine = () => {
    setScores((s) => ({ ...s, [i]: s[i] ?? 0 }))
    setI((x) => x + 1)
    setState('playing')
  }

  if (!role) {
    return (
      <div className="card stack">
        <h3>{t('role_choose')}</h3>
        {!supported && <div className="alert warn small">{t('speak_unsupported')}</div>}
        <div className="row">
          {speakers.map((s, k) => (
            <button key={s} className="btn btn-secondary btn-lg" onClick={() => (setRole(s), setI(0), setScores({}), setState('playing'))}>
              <span className="speaker-dot" style={{ ['--sp' as string]: COLORS[k % COLORS.length], width: 28, height: 28 }}>
                {s.slice(0, 2)}
              </span>
              {s}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const mineIdx = d.lines.map((l, k) => (l.speaker === role ? k : -1)).filter((k) => k >= 0)
  const avg = mineIdx.length ? Math.round((mineIdx.reduce((s, k) => s + (scores[k] ?? 0), 0) / mineIdx.length) * 100) : 0
  const line = d.lines[i]
  return (
    <div className="stack">
      <Bubbles d={d} current={i} hidden={undefined} showRu={lang === 'ru'} />
      {state === 'done' ? (
        <div className="card center stack" style={{ alignItems: 'center' }}>
          <h3 className="mb-0">{t('speak_score', { n: avg })}</h3>
          <button className="btn btn-primary" onClick={() => (setRole(null), setState('idle'))}>
            <RotateCcw size={16} /> {t('restart')}
          </button>
        </div>
      ) : (
        line?.speaker === role &&
        state !== 'playing' && (
          <div className="card stack" style={{ position: 'sticky', bottom: 'calc(var(--bottombar-h) + 12px)' }}>
            <div className="ex-task">{t('role_your_turn')}</div>
            <div className="speak-target en">
              <AudioButton text={line.en} audioKey={line.a} accent={accentOf(d.speakers[line.speaker])} />
              <span className="grow">{line.en}</span>
            </div>
            <div className="row">
              {supported && (
                <button className={`mic-btn${state === 'listening' ? ' on' : ''}`} onClick={sayMine} disabled={state === 'listening'} aria-label={t('speak_press')}>
                  <Mic size={26} />
                </button>
              )}
              <div className="grow small">
                {state === 'listening' ? <b>{t('speak_listening')}</b> : heard ? <span className="muted">«{heard}» · {t('speak_score', { n: Math.round((scores[i] ?? 0) * 100) })}</span> : <span className="muted">{t('speak_press')}</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={skipMine}>
                {t('next')} →
              </button>
            </div>
          </div>
        )
      )}
    </div>
  )
}

export default function DialoguePage() {
  const { lv, id } = useParams()
  const level = lv as LevelId
  const { t, tr, lang } = useI18n()
  const { openLesson } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'listen'
  const { data, error } = useLevelData(level)
  const d = data?.level.dialogues.find((x) => x.id === id)
  const key = lessonKeys.dialogue(id ?? '')
  const [seed, setSeed] = useState(0)

  useEffect(() => {
    if (!d) return
    openLesson(key)
    rememberVisit({ path: `/level/${level}/dialogue/${d.id}`, title: d.title, titleRu: d.titleRu })
  }, [d, key, level, openLesson])

  const items = useMemo<QuizItem[]>(() => {
    if (!d) return []
    const own = toItems(d.exercises, key)
    const order: QuizItem = { key: `${key}.order`, ex: { type: 'dialog', lines: d.lines.slice(0, 6).map((l) => `${l.speaker}: ${l.en}`) } }
    const say: QuizItem[] = d.phrases.slice(0, 3).map((p, i) => ({ key: `${key}.say${i}`, ex: { type: 'speak', answer: p.en, ru: lang === 'ru' ? p.ru : undefined, audioKey: p.a } }))
    return [...own, ...(d.lines.length >= 3 ? [order] : []), ...say]
    // seed — новая попытка
  }, [d, key, lang, seed])

  if (error) return <Empty emoji="📡">{String(error)}</Empty>
  if (!data) return <Loader />
  if (!d) return <Empty emoji="🧭">{t('not_found')}</Empty>

  return (
    <div className={`lv-${level}`}>
      <div className="crumbs">
        <Link to="/speaking">{t('nav_speaking')}</Link> › <Link to={`/level/${level}?tab=dialogues`}>{level.toUpperCase()}</Link> ›
      </div>
      <div className="page-head">
        <div className="grow">
          <h1>{tr(d.titleRu, d.title)}</h1>
          <p>
            <LevelBadge level={level} /> &nbsp;{tr(d.sceneRu, d.scene)}
          </p>
        </div>
      </div>
      <Tabs<Tab>
        value={tab}
        onChange={(v) => {
          stop()
          setParams({ tab: v }, { replace: true })
        }}
        tabs={[
          { id: 'listen', label: t('dialogue_listen'), icon: <MessageCircle size={16} /> },
          { id: 'role', label: t('role_play'), icon: <Mic size={16} /> },
          ...(d.phrases.length ? [{ id: 'phrases' as Tab, label: t('useful_phrases'), icon: <Quote size={16} /> }] : []),
          { id: 'practice', label: t('tab_practice'), icon: <Dumbbell size={16} /> },
        ]}
      />
      {tab === 'listen' && <ListenTab d={d} />}
      {tab === 'role' && <RoleTab d={d} />}
      {tab === 'phrases' && (
        <div className="stack">
          {d.phrases.map((p, i) => (
            <div key={i} className="example">
              <AudioButton text={p.en} audioKey={p.a} size="sm" />
              <div>
                <div className="en">
                  <b>{p.en}</b>
                </div>
                {lang === 'ru' && <div className="muted small">{p.ru}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'practice' && <Quiz key={seed} items={items} saveAs={{ kind: 'dialogue', scope: key, title: d.title }} onRestart={() => setSeed((s) => s + 1)} />}
    </div>
  )
}
