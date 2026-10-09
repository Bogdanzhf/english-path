import { Brain, Grid3x3, Puzzle, Search, Timer, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { Empty, Loader, PageHead, Segmented } from '../components/ui'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { loadWords, type WordBank } from '../lib/course'
import { buildCrossword, buildWordSearch, lineCells } from '../lib/games'
import { dictWords } from '../lib/mywords'
import { feedback, play } from '../lib/sounds'
import { matches, sample, shuffle } from '../lib/text'
import { LEVEL_IDS, type LevelId, type Word } from '../lib/types'
import { useApp } from '../state'

const GAMES: { id: string; key: DictKey; desc: DictKey; icon: ReactNode; tone: string }[] = [
  { id: 'memory', key: 'game_memory', desc: 'game_memory_desc', icon: <Brain size={22} />, tone: 'tone-primary' },
  { id: 'crossword', key: 'game_crossword', desc: 'game_crossword_desc', icon: <Grid3x3 size={22} />, tone: 'tone-violet' },
  { id: 'wordsearch', key: 'game_wordsearch', desc: 'game_wordsearch_desc', icon: <Search size={22} />, tone: 'tone-teal' },
  { id: 'hangman', key: 'game_hangman', desc: 'game_hangman_desc', icon: <Puzzle size={22} />, tone: 'tone-coral' },
  { id: 'sprint', key: 'game_sprint', desc: 'game_sprint_desc', icon: <Zap size={22} />, tone: 'tone-amber' },
  { id: 'verbs', key: 'game_verbs', desc: 'game_verbs_desc', icon: <Timer size={22} />, tone: 'tone-green' },
]

type Source = { kind: 'level'; level: LevelId; unit: number | 0 } | { kind: 'dict' }

function useGameWords(bank: WordBank | null, source: Source): Word[] {
  const { progress } = useApp()
  return useMemo(() => {
    if (!bank) return []
    if (source.kind === 'dict') return dictWords(bank, progress).filter((w) => /^[a-z' -]+$/i.test(w.w))
    return source.unit ? bank.byUnit(source.level, source.unit) : bank.byLevel(source.level)
  }, [bank, source, progress])
}

function SourcePicker({ source, setSource }: { source: Source; setSource: (s: Source) => void }) {
  const { t, tr } = useI18n()
  const { course } = useApp()
  const level = source.kind === 'level' ? source.level : 'a1'
  const units = course?.levels.find((l) => l.id === level)?.units ?? []
  return (
    <div className="card pad-sm stack mb-4">
      <span className="label-text">{t('choose_words')}</span>
      <div className="row">
        <Segmented<string>
          options={[...LEVEL_IDS.map((l) => ({ id: l, label: l.toUpperCase() })), { id: 'dict', label: `⭐ ${t('source_dict')}` }]}
          value={source.kind === 'dict' ? 'dict' : source.level}
          onChange={(v) => setSource(v === 'dict' ? { kind: 'dict' } : { kind: 'level', level: v as LevelId, unit: 0 })}
        />
        {source.kind === 'level' && units.length > 0 && (
          <select className="input" style={{ width: 'auto', minHeight: 36 }} value={source.unit} onChange={(e) => setSource({ ...source, unit: Number(e.target.value) })} aria-label={t('unit')}>
            <option value={0}>{t('all')}</option>
            {units.map((u) => (
              <option key={u.num} value={u.num}>
                {u.num}. {tr(u.titleRu, u.title)}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

function Won({ text, onAgain }: { text: ReactNode; onAgain: () => void }) {
  const { t } = useI18n()
  return (
    <div className="card center stack" style={{ alignItems: 'center' }}>
      <div style={{ fontSize: '2.6rem' }}>🏆</div>
      <h2 className="mb-0">{text}</h2>
      <button className="btn btn-primary" onClick={onAgain}>
        {t('new_game')}
      </button>
    </div>
  )
}

// ---------- Memory ----------

function Memory({ words }: { words: Word[] }) {
  const { t, lang } = useI18n()
  const [seed, setSeed] = useState(0)
  const cards = useMemo(() => {
    const ws = sample(words, 8)
    return shuffle(ws.flatMap((w) => [{ id: w.id, text: w.w, en: true }, { id: w.id, text: lang === 'ru' ? w.ru : w.def, en: false }]))
  }, [words, lang, seed])
  const [open, setOpen] = useState<number[]>([])
  const [found, setFound] = useState<string[]>([])
  const [moves, setMoves] = useState(0)
  useEffect(() => {
    setOpen([])
    setFound([])
    setMoves(0)
  }, [cards])
  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || found.includes(cards[i].id)) return
    play('tap')
    const next = [...open, i]
    setOpen(next)
    if (next.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = next
      if (cards[a].id === cards[b].id && cards[a].en !== cards[b].en) {
        setTimeout(() => {
          feedback(true)
          setFound((f) => [...f, cards[a].id])
          setOpen([])
        }, 350)
      } else setTimeout(() => setOpen([]), 900)
    }
  }
  if (cards.length && found.length === cards.length / 2) return <Won text={`${t('you_won')} · ${t('moves')}: ${moves}`} onAgain={() => setSeed((s) => s + 1)} />
  return (
    <div>
      <div className="row between mb-3">
        <span className="chip">
          {t('moves')}: {moves}
        </span>
        <span className="chip green">
          {t('found')}: {found.length}/{cards.length / 2}
        </span>
      </div>
      <div className="memory-grid">
        {cards.map((c, i) => {
          const shown = open.includes(i) || found.includes(c.id)
          return (
            <button key={i} className={`memory-card${shown ? ' shown' : ''}${found.includes(c.id) ? ' found' : ''}`} onClick={() => flip(i)} aria-label={shown ? c.text : '?'}>
              <span className={c.en ? 'en' : ''}>{shown ? c.text : '?'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Кроссворд ----------

function CrosswordGame({ words }: { words: Word[] }) {
  const { t, lang } = useI18n()
  const [seed, setSeed] = useState(0)
  const cw = useMemo(
    () => buildCrossword(sample(words.filter((w) => !w.w.includes(' ')), 10).map((w) => ({ word: w.w, clue: lang === 'ru' ? `${w.ru} (${w.def})` : w.def }))),
    [words, lang, seed],
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    setValues({})
    setChecked(false)
  }, [cw])
  const cells = useMemo(() => {
    const m = new Map<string, { ch: string; num?: number }>()
    for (const w of cw.words) {
      for (let i = 0; i < w.word.length; i++) {
        const k = `${w.row + (w.dir === 'down' ? i : 0)},${w.col + (w.dir === 'across' ? i : 0)}`
        m.set(k, { ch: w.word[i], num: i === 0 ? w.num : m.get(k)?.num })
      }
    }
    return m
  }, [cw])
  const solved = [...cells.entries()].every(([k, c]) => (values[k] ?? '').toUpperCase() === c.ch)
  useEffect(() => {
    if (solved && cells.size) play('success')
  }, [solved, cells.size])
  const refs = useRef<Record<string, HTMLInputElement | null>>({})
  const lastDir = useRef<'across' | 'down'>('across')
  const move = (r: number, c: number) => {
    const d = lastDir.current
    const k = d === 'across' ? `${r},${c + 1}` : `${r + 1},${c}`
    if (cells.has(k)) refs.current[k]?.focus()
    else {
      const alt = d === 'across' ? `${r + 1},${c}` : `${r},${c + 1}`
      if (cells.has(alt)) {
        lastDir.current = d === 'across' ? 'down' : 'across'
        refs.current[alt]?.focus()
      }
    }
  }
  if (cw.words.length < 2) return <Empty>{t('not_enough_words')}</Empty>
  return (
    <div className="crossword">
      <div className="cw-grid" style={{ gridTemplateColumns: `repeat(${cw.cols}, var(--cw-cell))` }}>
        {Array.from({ length: cw.rows * cw.cols }, (_, i) => {
          const r = Math.floor(i / cw.cols)
          const c = i % cw.cols
          const k = `${r},${c}`
          const cell = cells.get(k)
          if (!cell) return <div key={k} className="cw-empty" />
          const v = values[k] ?? ''
          const state = checked || solved ? (v.toUpperCase() === cell.ch ? ' ok' : v ? ' bad' : '') : ''
          return (
            <div key={k} className={`cw-cell${state}`}>
              {cell.num && <span className="cw-num">{cell.num}</span>}
              <input
                ref={(el) => {
                  refs.current[k] = el
                }}
                maxLength={1}
                value={v}
                aria-label={`${r + 1}:${c + 1}`}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => {
                  const ch = e.target.value.slice(-1).toUpperCase()
                  setValues((x) => ({ ...x, [k]: ch }))
                  setChecked(false)
                  if (ch) move(r, c)
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="cw-clues">
        {(['across', 'down'] as const).map((dir) => (
          <div key={dir}>
            <h4>{t(dir)}</h4>
            <ol className="small">
              {cw.words
                .filter((w) => w.dir === dir)
                .sort((a, b) => a.num - b.num)
                .map((w) => (
                  <li key={w.num + dir} value={w.num}>
                    {w.clue} <span className="muted">({w.word.length})</span>
                  </li>
                ))}
            </ol>
          </div>
        ))}
        <div className="row">
          <button className="btn btn-primary btn-sm" onClick={() => setChecked(true)}>
            {t('check')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSeed((s) => s + 1)}>
            {t('new_game')}
          </button>
        </div>
        {solved && <div className="alert ok">🏆 {t('you_won')}</div>}
      </div>
    </div>
  )
}

// ---------- Найди слова ----------

function WordSearchGame({ words }: { words: Word[] }) {
  const { t, lang } = useI18n()
  const [seed, setSeed] = useState(0)
  const pool = useMemo(() => sample(words.filter((w) => !w.w.includes(' ') && w.w.length <= 11), 12), [words, seed])
  const ws = useMemo(() => buildWordSearch(pool.map((w) => w.w), 12), [pool])
  const [start, setStart] = useState<[number, number] | null>(null)
  const [found, setFound] = useState<string[]>([])
  useEffect(() => {
    setFound([])
    setStart(null)
  }, [ws])
  const foundCells = new Set(ws.words.filter((w) => found.includes(w.word)).flatMap((w) => w.cells.map(([r, c]) => `${r},${c}`)))
  const pick = (r: number, c: number) => {
    if (!start) return setStart([r, c])
    const line = lineCells(start, [r, c])
    setStart(null)
    if (!line) return
    const s = line.map(([a, b]) => `${a},${b}`).join('|')
    const hit = ws.words.find((w) => !found.includes(w.word) && (w.cells.map(([a, b]) => `${a},${b}`).join('|') === s || [...w.cells].reverse().map(([a, b]) => `${a},${b}`).join('|') === s))
    if (hit) {
      feedback(true)
      setFound((f) => [...f, hit.word])
    } else play('wrong')
  }
  const meaning = (word: string) => {
    const w = pool.find((x) => x.w.toUpperCase().replace(/[^A-Z]/g, '') === word)
    return w ? (lang === 'ru' ? w.ru : w.def) : ''
  }
  if (ws.words.length && found.length === ws.words.length) return <Won text={t('you_won')} onAgain={() => setSeed((s) => s + 1)} />
  return (
    <div className="wordsearch">
      <div className="ws-grid" style={{ gridTemplateColumns: `repeat(${ws.size}, 1fr)` }}>
        {ws.grid.map((row, r) =>
          row.map((ch, c) => (
            <button key={`${r},${c}`} className={`ws-cell${foundCells.has(`${r},${c}`) ? ' found' : ''}${start && start[0] === r && start[1] === c ? ' start' : ''}`} onClick={() => pick(r, c)}>
              {ch}
            </button>
          )),
        )}
      </div>
      <div className="ws-list">
        <p className="muted small">{lang === 'ru' ? 'Нажмите на первую и последнюю букву слова.' : 'Tap the first and the last letter of a word.'}</p>
        {ws.words.map((w) => (
          <div key={w.word} className={`ws-word${found.includes(w.word) ? ' found' : ''}`}>
            {found.includes(w.word) ? <b className="en">{w.word.toLowerCase()}</b> : <span className="muted">{'•'.repeat(w.word.length)}</span>}
            <span className="small text-2"> — {meaning(w.word)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Угадай слово ----------

function Hangman({ words }: { words: Word[] }) {
  const { t, lang } = useI18n()
  const { prefs } = useApp()
  const pick = useCallback(() => sample(words.filter((w) => /^[a-z]+$/i.test(w.w)), 1)[0], [words])
  const [word, setWord] = useState<Word | undefined>(pick)
  const [guessed, setGuessed] = useState<string[]>([])
  const [score, setScore] = useState(0)
  useEffect(() => setWord(pick()), [pick])
  useEffect(() => setGuessed([]), [word])
  const target = word?.w.toLowerCase() ?? ''
  const wrong = guessed.filter((g) => !target.includes(g)).length
  const won = target && [...target].every((ch) => guessed.includes(ch))
  const lost = wrong >= 6
  const guess = useCallback(
    (ch: string) => {
      if (won || lost || guessed.includes(ch)) return
      setGuessed((g) => [...g, ch])
      play(target.includes(ch) ? 'tap' : 'wrong')
    },
    [won, lost, guessed, target],
  )
  useEffect(() => {
    if (won) {
      play('success')
      setScore((s) => s + 1)
    } else if (lost) play('tryAgain')
  }, [won, lost])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => /^[a-z]$/i.test(e.key) && guess(e.key.toLowerCase())
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [guess])
  if (!word) return <Empty>{t('not_enough_words')}</Empty>
  return (
    <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <span className="chip">
          {t('lives')}: {'❤️'.repeat(6 - wrong)}
          {'🤍'.repeat(wrong)}
        </span>
        <span className="chip green">
          {t('score')}: {score}
        </span>
      </div>
      <p className="mb-0" style={{ fontSize: '1.1rem' }}>
        {lang === 'ru' ? word.ru : word.def}
      </p>
      <div className="hangman-word en">
        {[...target].map((ch, i) => (
          <span key={i} className={guessed.includes(ch) || lost ? (guessed.includes(ch) ? 'ok' : 'miss') : ''}>
            {guessed.includes(ch) || lost ? ch : ''}
          </span>
        ))}
      </div>
      {(won || lost) && (
        <div className="stack" style={{ alignItems: 'center' }}>
          <div className="row">
            <b>{won ? t('you_won') : t('game_over')}</b>
            <AudioButton text={word.w} audioKey={prefs.accent === 'uk' ? word.au : word.aa} />
          </div>
          <button className="btn btn-primary" onClick={() => setWord(pick())}>
            {t('next')}
          </button>
        </div>
      )}
      <div className="keyboard">
        {'qwertyuiopasdfghjklzxcvbnm'.split('').map((ch) => (
          <button key={ch} className={`key${guessed.includes(ch) ? (target.includes(ch) ? ' ok' : ' bad') : ''}`} disabled={guessed.includes(ch) || !!won || lost} onClick={() => guess(ch)}>
            {ch}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- Спринт ----------

function Sprint({ words }: { words: Word[] }) {
  const { t, lang } = useI18n()
  const [running, setRunning] = useState(false)
  const [time, setTime] = useState(60)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [card, setCard] = useState<{ w: Word; shown: string; truth: boolean } | null>(null)
  const meaning = useCallback((w: Word) => (lang === 'ru' ? w.ru : w.def), [lang])
  const nextCard = useCallback(() => {
    const [w, other] = sample(words, 2)
    if (!w) return
    const truth = Math.random() < 0.5 || !other
    setCard({ w, shown: truth ? meaning(w) : meaning(other), truth })
  }, [words, meaning])
  useEffect(() => {
    if (!running) return
    if (time <= 0) {
      setRunning(false)
      play('success')
      return
    }
    const id = setTimeout(() => setTime((x) => x - 1), 1000)
    return () => clearTimeout(id)
  }, [running, time])
  const answer = useCallback(
    (v: boolean) => {
      if (!card || !running) return
      const ok = v === card.truth
      feedback(ok)
      setStreak((s) => (ok ? s + 1 : 0))
      setScore((s) => (ok ? s + 10 + Math.min(streak, 5) * 2 : s))
      nextCard()
    },
    [card, running, streak, nextCard],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') answer(false)
      if (e.key === 'ArrowRight') answer(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])
  if (words.length < 4) return <Empty>{t('not_enough_words')}</Empty>
  if (!running) {
    return (
      <div className="card center stack" style={{ alignItems: 'center' }}>
        {time <= 0 && <h2 className="mb-0">{t('score')}: {score}</h2>}
        <p className="muted">{t('game_sprint_desc')} · ← / →</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            setTime(60)
            setScore(0)
            setStreak(0)
            nextCard()
            setRunning(true)
          }}
        >
          {time <= 0 ? t('new_game') : t('start')}
        </button>
      </div>
    )
  }
  return (
    <div className="card center stack" style={{ alignItems: 'center' }}>
      <div className="row">
        <span className="chip amber">⏱ {time}</span>
        <span className="chip green">
          {t('score')}: {score}
        </span>
        {streak >= 3 && <span className="chip coral">🔥 ×{streak}</span>}
      </div>
      {card && (
        <>
          <div className="flash-word en">{card.w.w}</div>
          <div style={{ fontSize: '1.2rem' }}>{card.shown}</div>
        </>
      )}
      <div className="row">
        <button className="btn btn-danger btn-lg" onClick={() => answer(false)}>
          ✗ {t('false')}
        </button>
        <button className="btn btn-success btn-lg" onClick={() => answer(true)}>
          ✓ {t('true')}
        </button>
      </div>
    </div>
  )
}

// ---------- Гонка глаголов ----------

function VerbRace() {
  const { t } = useI18n()
  const { course } = useApp()
  const verbs = course?.irregular ?? []
  const [running, setRunning] = useState(false)
  const [time, setTime] = useState(90)
  const [score, setScore] = useState(0)
  const [verb, setVerb] = useState(verbs[0])
  const [past, setPast] = useState('')
  const [pp, setPp] = useState('')
  const [flash, setFlash] = useState<'' | 'ok' | 'bad'>('')
  const ref = useRef<HTMLInputElement>(null)
  const next = useCallback(() => {
    setVerb(sample(verbs, 1)[0])
    setPast('')
    setPp('')
    setTimeout(() => ref.current?.focus(), 30)
  }, [verbs])
  useEffect(() => {
    if (!running) return
    if (time <= 0) {
      setRunning(false)
      play('success')
      return
    }
    const id = setTimeout(() => setTime((x) => x - 1), 1000)
    return () => clearTimeout(id)
  }, [running, time])
  if (!verbs.length) return <Empty>{t('content_soon')}</Empty>
  if (!running) {
    return (
      <div className="card center stack" style={{ alignItems: 'center' }}>
        {time <= 0 && <h2 className="mb-0">{t('score')}: {score}</h2>}
        <p className="muted">{t('game_verbs_desc')} · 90 s</p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            setTime(90)
            setScore(0)
            next()
            setRunning(true)
          }}
        >
          {time <= 0 ? t('new_game') : t('start')}
        </button>
      </div>
    )
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = matches(past, verb.past.split('/')) && matches(pp, verb.pp.split('/'))
    feedback(ok)
    setFlash(ok ? 'ok' : 'bad')
    setTimeout(() => setFlash(''), 500)
    if (ok) setScore((s) => s + 1)
    else setTime((x) => Math.max(0, x - 3))
    next()
  }
  return (
    <form className={`card stack verb-race ${flash}`} onSubmit={submit} style={{ alignItems: 'center', textAlign: 'center' }}>
      <div className="row">
        <span className="chip amber">⏱ {time}</span>
        <span className="chip green">
          {t('score')}: {score}
        </span>
      </div>
      <div className="flash-word en">{verb.base}</div>
      <div className="muted">{verb.ru}</div>
      <div className="row nowrap" style={{ width: '100%', maxWidth: 420 }}>
        <input ref={ref} className="input en" value={past} onChange={(e) => setPast(e.target.value)} placeholder="Past Simple" autoCapitalize="off" autoComplete="off" aria-label="Past Simple" />
        <input className="input en" value={pp} onChange={(e) => setPp(e.target.value)} placeholder="Past Participle" autoCapitalize="off" autoComplete="off" aria-label="Past Participle" />
      </div>
      <button className="btn btn-primary" disabled={!past.trim() || !pp.trim()}>
        {t('check')}
      </button>
    </form>
  )
}

export default function Games() {
  const { game } = useParams()
  const { t } = useI18n()
  const nav = useNavigate()
  const { prefs } = useApp()
  const [bank, setBank] = useState<WordBank | null>(null)
  const [source, setSource] = useState<Source>({ kind: 'level', level: prefs.level ?? prefs.suggestedLevel ?? 'a1', unit: 0 })
  const words = useGameWords(bank, source)
  useEffect(() => {
    loadWords().then(setBank)
  }, [])
  const meta = GAMES.find((g) => g.id === game)

  if (!meta) {
    return (
      <div>
        <PageHead title={t('games_title')} subtitle={t('games_subtitle')} />
        <div className="grid grid-auto">
          {GAMES.map((g) => (
            <Link key={g.id} to={`/games/${g.id}`} className={`card ${g.tone}`}>
              <div className="card-icon">{g.icon}</div>
              <h3>{t(g.key)}</h3>
              <p className="muted small mb-0">{t(g.desc)}</p>
            </Link>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div>
      <PageHead title={t(meta.key)} subtitle={t(meta.desc)} crumbs={[{ to: '/games', label: t('games_title') }]} />
      {game !== 'verbs' && <SourcePicker source={source} setSource={setSource} />}
      {!bank ? (
        <Loader />
      ) : game !== 'verbs' && words.length < 4 ? (
        <Empty>
          {t('not_enough_words')}
          <div className="mt-3">
            <button className="btn btn-secondary btn-sm" onClick={() => nav('/course')}>
              {t('nav_course')}
            </button>
          </div>
        </Empty>
      ) : (
        <>
          {game === 'memory' && <Memory words={words} />}
          {game === 'crossword' && <CrosswordGame words={words} />}
          {game === 'wordsearch' && <WordSearchGame words={words} />}
          {game === 'hangman' && <Hangman words={words} />}
          {game === 'sprint' && <Sprint words={words} />}
          {game === 'verbs' && <VerbRace />}
        </>
      )}
    </div>
  )
}
