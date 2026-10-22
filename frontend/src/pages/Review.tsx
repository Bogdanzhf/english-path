import { Brain, Dumbbell } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Flashcards, type CardItem } from '../components/Flashcards'
import { Quiz } from '../components/Quiz'
import { WordPicker, loadPicked, savePicked } from '../components/WordPicker'
import { Empty, Loader, PageHead, Segmented, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import type { DictKey } from '../i18n/dict'
import { loadWords, type WordBank } from '../lib/course'
import { dictWords, resolveWord } from '../lib/mywords'
import { WORD_MODES, wordQuiz, type WordMode } from '../lib/quiz'
import { isDue } from '../lib/srs'
import { sample, shuffle } from '../lib/text'
import { composeItem, translateItem } from '../lib/writing'
import { LEVEL_IDS, type LevelId, type Word } from '../lib/types'
import { useApp } from '../state'

type Source = 'dict' | 'due' | 'level' | 'hard' | 'pick'
// письменные режимы: перевод примера и своё предложение со словом
type TrainerMode = WordMode | 'mixed' | 'w_translate' | 'w_compose'
const TRAINER_MODES: TrainerMode[] = ['mixed', ...WORD_MODES, 'w_translate', 'w_compose']
const NEW_PER_SESSION = 10

export default function Review() {
  const { t, lang, plural } = useI18n()
  const { progress, prefs, user } = useApp()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'session' | 'train'>(params.get('source') ? 'train' : 'session')
  const [bank, setBank] = useState<WordBank | null>(null)
  const [source, setSource] = useState<Source>((params.get('source') as Source) || 'dict')
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  const [mode, setMode] = useState<TrainerMode | null>(null)
  const [picked, setPickedState] = useState<string[]>(() => loadPicked(user?.id))
  const setPicked = (ids: string[]) => {
    setPickedState(ids)
    savePicked(user?.id, ids)
  }
  const [seed, setSeed] = useState(0)
  const [sessionKey, setSessionKey] = useState(0)
  useEffect(() => {
    loadWords().then(setBank)
  }, [])

  // сессия: слова, которым пора на повторение + немного новых из словаря
  const session = useMemo<CardItem[]>(() => {
    if (!bank) return []
    const now = Date.now()
    const due: CardItem[] = []
    const fresh: CardItem[] = []
    const custom = new Map(progress.custom.map((c) => [c.id, c]))
    for (const [id, st] of Object.entries(progress.words)) {
      const item: CardItem | null = bank.byId.has(id) ? { id, word: bank.byId.get(id) } : custom.has(id) ? { id, custom: custom.get(id) } : null
      if (!item) continue
      if (isDue(st, now)) due.push(item)
      else if (st.in_dict && !st.seen_at) fresh.push(item)
    }
    return [...due, ...fresh.slice(0, NEW_PER_SESSION)]
    // пересчитываем только при новой сессии, чтобы карточки не прыгали после каждой оценки
  }, [bank, sessionKey])

  const pool = useMemo<Word[]>(() => {
    if (!bank) return []
    if (source === 'dict') return dictWords(bank, progress)
    if (source === 'level') return sample(bank.byLevel(level), 30)
    if (source === 'pick') return picked.map((id) => resolveWord(bank, progress, id)).filter((w): w is Word => !!w)
    const ids = Object.entries(progress.words)
      .filter(([, st]) => (source === 'due' ? isDue(st) : st.wrong > 0 && st.wrong >= st.correct / 2))
      .map(([id]) => id)
    return ids.map((id) => resolveWord(bank, progress, id)).filter((w): w is Word => !!w)
  }, [bank, source, level, progress, picked])

  const minWords = source === 'pick' ? 1 : 4
  const items = useMemo(() => {
    if (!mode || pool.length < minWords || !bank) return []
    // выбранные вручную слова — все (до 30), иначе случайные 15
    const words = source === 'pick' ? shuffle(pool).slice(0, 30) : sample(pool, 15)
    if (mode === 'w_translate') return words.filter((w) => w.exRu).map((w) => translateItem(w, 'trainer'))
    if (mode === 'w_compose') return words.map((w) => composeItem(w, 'trainer'))
    const modes = mode === 'mixed' ? undefined : [mode]
    const distractors = pool.length >= 8 ? pool : [...pool, ...bank.byLevel(words[0]?.lv ?? 'a1')]
    return wordQuiz(words, { lang, accent: prefs.accent, pool: distractors, modes, perWord: 1 })
  }, [mode, pool, bank, lang, prefs.accent, seed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bank) return <Loader />

  return (
    <div>
      <PageHead title={t('review_title')} subtitle={t('review_subtitle')} />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v)
          setMode(null)
        }}
        tabs={[
          { id: 'session', label: `${t('review_session')} · ${session.length}`, icon: <Brain size={16} /> },
          { id: 'train', label: t('trainers'), icon: <Dumbbell size={16} /> },
        ]}
      />
      {tab === 'session' &&
        (session.length ? (
          <Flashcards key={sessionKey} items={session} mode="review" onDone={() => setTimeout(() => setSessionKey((k) => k + 1), 1500)} />
        ) : (
          <Empty emoji="🌿">
            <b>{t('no_due')}</b>
            <div className="small mt-3">{t('review_empty')}</div>
          </Empty>
        ))}
      {tab === 'train' && !mode && (
        <div className="stack gap-4">
          <div className="card stack">
            <span className="label-text">{t('trainer_source')}</span>
            <Segmented<Source>
              options={[
                { id: 'dict', label: t('source_dict') },
                { id: 'due', label: t('source_due') },
                { id: 'level', label: t('source_level') },
                { id: 'hard', label: t('source_hard') },
                { id: 'pick', label: t('source_pick') },
              ]}
              value={source}
              onChange={setSource}
            />
            {source === 'level' && <Segmented<LevelId> options={LEVEL_IDS.map((l) => ({ id: l, label: l.toUpperCase() }))} value={level} onChange={setLevel} />}
            {source === 'pick' && <WordPicker bank={bank} progress={progress} picked={picked} onChange={setPicked} />}
            {source !== 'pick' && <div className="muted small">{pool.length} {plural(pool.length, ['слово', 'слова', 'слов'], ['word', 'words'])}</div>}
            {source !== 'pick' && pool.length < 4 && <div className="alert warn small">{t('not_enough_words')}</div>}
          </div>
          <div className="grid grid-auto-sm">
            {TRAINER_MODES.map((m) => (
              <button key={m} className={`card pad-sm${m.startsWith('w_') ? ' tone-violet' : ''}`} disabled={pool.length < minWords} onClick={() => (setMode(m), setSeed((s) => s + 1))}>
                <b>{t(`mode_${m}` as DictKey)}</b>
              </button>
            ))}
          </div>
        </div>
      )}
      {tab === 'train' && mode && (
        <div className="stack">
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setMode(null)}>
              ← {t('trainers')}
            </button>
          </div>
          <Quiz key={seed} items={items} saveAs={{ kind: 'words', scope: `trainer.${source}.${mode}`, title: `${t('trainers')}: ${t(`mode_${mode}` as DictKey)}` }} onRestart={() => setSeed((s) => s + 1)} />
        </div>
      )}
    </div>
  )
}
