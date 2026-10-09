import { BookOpen, Dumbbell, Layers, List, Star } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Flashcards } from '../components/Flashcards'
import { Quiz } from '../components/Quiz'
import { Reading } from '../components/Reading'
import { WordCard } from '../components/WordCard'
import { Empty, LevelBadge, Loader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys, loadLevel, loadWords, type WordBank } from '../lib/course'
import { toItems, wordQuiz } from '../lib/quiz'
import { rememberVisit } from '../lib/stats'
import type { LevelData, LevelId } from '../lib/types'
import { useApp } from '../state'

type Tab = 'words' | 'cards' | 'practice' | 'story'

export function useLevelData(lv: LevelId | undefined) {
  const [data, setData] = useState<{ level: LevelData; bank: WordBank } | null>(null)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => {
    if (!lv) return
    let alive = true
    setData(null)
    Promise.all([loadLevel(lv), loadWords()])
      .then(([level, bank]) => alive && setData({ level, bank }))
      .catch((e) => alive && setError(e))
    return () => {
      alive = false
    }
  }, [lv])
  return { data, error }
}

export default function Unit() {
  const { lv, num } = useParams()
  const level = lv as LevelId
  const n = Number(num)
  const { t, tr, lang } = useI18n()
  const { course, progress, setInDict, openLesson, toast, prefs } = useApp()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'words'
  const { data, error } = useLevelData(level)
  const [quizSeed, setQuizSeed] = useState(0)
  const meta = course?.levels.find((l) => l.id === level)?.units.find((u) => u.num === n)
  const unit = data?.level.units.find((u) => u.num === n)
  const words = useMemo(() => data?.bank.byUnit(level, n) ?? [], [data, level, n])
  const vocabKey = lessonKeys.vocab(level, n)

  useEffect(() => {
    if (!meta) return
    openLesson(vocabKey)
    rememberVisit({ path: `/level/${level}/unit/${n}`, title: `${meta.title} · ${level.toUpperCase()}`, titleRu: `${meta.titleRu} · ${level.toUpperCase()}` })
  }, [meta, level, n, vocabKey, openLesson])

  const items = useMemo(() => {
    if (!data) return []
    const pool = data.bank.byLevel(level)
    const gen = wordQuiz(words, { lang, accent: prefs.accent, pool, perWord: 1 })
    return [...gen, ...toItems(unit?.exercises ?? [], `${vocabKey}.x`)]
    // quizSeed — пересоздать набор при «Ещё раз»
  }, [data, words, lang, level, unit, vocabKey, quizSeed])

  if (error) return <Empty emoji="📡">{String(error)}</Empty>
  if (!meta) return course ? <Empty emoji="🧭">{t('not_found')}</Empty> : <Loader />
  const allIn = words.length > 0 && words.every((w) => progress.words[w.id]?.in_dict)
  const prev = course?.levels.find((l) => l.id === level)?.units.find((u) => u.num === n - 1)
  const next = course?.levels.find((l) => l.id === level)?.units.find((u) => u.num === n + 1)

  return (
    <div className={`lv-${level}`}>
      <div className="crumbs">
        <Link to="/course">{t('nav_course')}</Link> › <Link to={`/level/${level}`}>{level.toUpperCase()}</Link> ›
      </div>
      <div className="page-head">
        <div className="row nowrap grow" style={{ gap: 14 }}>
          <span className="unit-num">{n}</span>
          <div className="grow">
            <h1 className="mb-0">{tr(meta.titleRu, meta.title)}</h1>
            <div className="muted">
              <LevelBadge level={level} /> &nbsp;{t('unit')} {n} · {t('words_n', { n: meta.words })}
            </div>
          </div>
        </div>
        {words.length > 0 && (
          <button
            className={`btn ${allIn ? 'btn-secondary' : 'btn-soft'}`}
            onClick={async () => {
              await setInDict(
                words.map((w) => w.id),
                !allIn,
              )
              toast(allIn ? t('remove_from_dict') : t('in_dict'))
            }}
          >
            <Star size={16} fill={allIn ? 'currentColor' : 'none'} /> {allIn ? t('in_dict') : t('add_all_to_dict')}
          </button>
        )}
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { id: 'words', label: t('tab_words'), icon: <List size={16} /> },
          { id: 'cards', label: t('tab_cards'), icon: <Layers size={16} /> },
          { id: 'practice', label: t('tab_practice'), icon: <Dumbbell size={16} /> },
          ...(meta.reading ? [{ id: 'story' as Tab, label: t('tab_story'), icon: <BookOpen size={16} /> }] : []),
        ]}
      />

      {!data ? (
        <Loader />
      ) : (
        <>
          {tab === 'words' && (
            <div className="grid grid-2">
              {words.map((w) => (
                <WordCard key={w.id} word={w} />
              ))}
            </div>
          )}
          {tab === 'cards' && <Flashcards items={words.map((w) => ({ id: w.id, word: w }))} mode="learn" />}
          {tab === 'practice' && (
            <div className="stack">
              <p className="muted center">{t('practice_intro')}</p>
              <Quiz
                key={quizSeed}
                items={items}
                saveAs={{ kind: 'vocab', scope: vocabKey, title: `${tr(meta.titleRu, meta.title)} · ${level.toUpperCase()}` }}
                onRestart={() => setQuizSeed((s) => s + 1)}
              />
            </div>
          )}
          {tab === 'story' && unit?.reading && (
            <Reading reading={unit.reading} words={words} scope={lessonKeys.reading(level, n)} title={`${unit.reading.title} · ${level.toUpperCase()}`} />
          )}
        </>
      )}

      <div className="row between mt-5">
        {prev ? (
          <Link className="btn btn-ghost" to={`/level/${level}/unit/${prev.num}`}>
            ← {tr(prev.titleRu, prev.title)}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link className="btn btn-ghost" to={`/level/${level}/unit/${next.num}`}>
            {tr(next.titleRu, next.title)} →
          </Link>
        )}
      </div>
    </div>
  )
}
