import { MessagesSquare, Mic } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Quiz } from '../components/Quiz'
import { Empty, LevelBadge, PageHead, Segmented, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys, loadWords } from '../lib/course'
import type { QuizItem } from '../lib/quiz'
import { canRecognize } from '../lib/recognition'
import { sample } from '../lib/text'
import type { LevelId } from '../lib/types'
import { useApp } from '../state'

/** Тренажёр произношения: слова и примеры уровня — произнести вслух. */
function Pronunciation({ level }: { level: LevelId }) {
  const { t, lang } = useI18n()
  const { prefs } = useApp()
  const [kind, setKind] = useState<'words' | 'sentences'>('words')
  const [items, setItems] = useState<QuizItem[] | null>(null)
  const [seed, setSeed] = useState(0)
  useEffect(() => {
    loadWords().then((bank) => {
      const words = sample(bank.byLevel(level), 10)
      setItems(
        words.map((w) => ({
          key: `${w.id}.say.${kind}`,
          ex:
            kind === 'words'
              ? { type: 'speak', answer: w.w, ru: lang === 'ru' ? w.ru : w.def, audioKey: prefs.accent === 'uk' ? w.au : w.aa }
              : { type: 'speak', answer: w.ex.replace(/\*/g, ''), ru: lang === 'ru' ? w.exRu : undefined, audioKey: w.ae },
        })),
      )
    })
  }, [level, kind, lang, prefs.accent, seed])
  return (
    <div className="stack">
      <p className="muted mb-0">{t('pronunciation_hint')}</p>
      {!canRecognize() && <div className="alert warn small">{t('speak_unsupported')}</div>}
      <Segmented
        options={[
          { id: 'words', label: t('tab_words') },
          { id: 'sentences', label: t('example') },
        ]}
        value={kind}
        onChange={setKind}
      />
      {items?.length ? <Quiz key={`${kind}${seed}`} items={items} saveAs={{ kind: 'speaking', scope: `pron.${level}`, title: `${t('pronunciation')} · ${level.toUpperCase()}` }} onRestart={() => setSeed((s) => s + 1)} /> : <Empty emoji="🎙️">{t('content_soon')}</Empty>}
    </div>
  )
}

export default function Speaking() {
  const { t, tr } = useI18n()
  const { course, progress, prefs } = useApp()
  const [level, setLevel] = useState<LevelId>(prefs.level ?? prefs.suggestedLevel ?? 'a1')
  const [tab, setTab] = useState<'dialogues' | 'pron'>('dialogues')
  if (!course) return null
  const meta = course.levels.find((l) => l.id === level)!
  return (
    <div>
      <PageHead title={t('speaking_title')} subtitle={t('speaking_subtitle')} />
      <div className="row mb-4">
        {course.levels.map((l) => (
          <button key={l.id} className={`chip${level === l.id ? ' selected' : ''}`} onClick={() => setLevel(l.id)} style={{ height: 38, padding: '0 6px' }}>
            <LevelBadge level={l.id} />
            <span style={{ paddingRight: 6 }}>{l.dialogues.length}</span>
          </button>
        ))}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'dialogues', label: t('tab_dialogues'), icon: <MessagesSquare size={16} /> },
          { id: 'pron', label: t('pronunciation'), icon: <Mic size={16} /> },
        ]}
      />
      {tab === 'dialogues' &&
        (meta.dialogues.length ? (
          <div className={`grid grid-auto lv-${level}`}>
            {meta.dialogues.map((d) => {
              const st = progress.lessons[lessonKeys.dialogue(d.id)]
              return (
                <Link key={d.id} to={`/level/${level}/dialogue/${d.id}`} className="card pad-sm unit-card">
                  <span className={`unit-num${st?.completed ? ' done' : ''}`}>
                    <MessagesSquare size={20} />
                  </span>
                  <div className="grow">
                    <b>{tr(d.titleRu, d.title)}</b>
                    <div className="muted small en">{tr(d.title, '')}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <Empty emoji="💬">{t('content_soon')}</Empty>
        ))}
      {tab === 'pron' && <Pronunciation level={level} />}
    </div>
  )
}
