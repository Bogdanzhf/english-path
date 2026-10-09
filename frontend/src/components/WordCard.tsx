// Карточка слова: картинка, транскрипция и озвучка в двух акцентах, перевод, определение, пример.

import { Star } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n'
import { asset } from '../lib/course'
import { stage } from '../lib/srs'
import type { Word } from '../lib/types'
import { useApp } from '../state'
import { AudioButton } from './Audio'
import { Md, PosLabel } from './ui'

export function DictStar({ ids, size = 18 }: { ids: string[]; size?: number }) {
  const { progress, setInDict, toast, user } = useApp()
  const { t } = useI18n()
  const inDict = ids.every((id) => progress.words[id]?.in_dict)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  return (
    <button
      type="button"
      className={`icon-btn sm ${inDict ? 'active' : ''}`}
      aria-pressed={inDict}
      aria-label={inDict ? t('remove_from_dict') : t('add_to_dict')}
      title={inDict ? t('remove_from_dict') : t('add_to_dict')}
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation()
        setBusy(true)
        try {
          await setInDict(ids, !inDict)
          toast(inDict ? t('remove_from_dict') : t('in_dict'))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Star size={size} fill={inDict ? 'currentColor' : 'none'} />
    </button>
  )
}

export function WordImage({ word, size = 72 }: { word: Word; size?: number }) {
  if (word.img) return <img className="word-img" src={asset(word.img)} alt="" width={size} height={size} loading="lazy" />
  return (
    <div className={`word-img placeholder lv-${word.lv}`} style={{ width: size, height: size }} aria-hidden>
      {word.w.slice(0, 1).toUpperCase()}
    </div>
  )
}

export function WordCard({ word, compact }: { word: Word; compact?: boolean }) {
  const { lang, t } = useI18n()
  const { prefs, progress } = useApp()
  const [showRu, setShowRu] = useState(lang === 'ru' || prefs.showRu)
  const st = stage(progress.words[word.id])
  return (
    <article className={`word-card${compact ? ' compact' : ''}`}>
      <WordImage word={word} size={compact ? 56 : 76} />
      <div className="grow">
        <div className="row between nowrap">
          <div className="row" style={{ gap: 10 }}>
            <h3 className="word-title en">{word.w}</h3>
            <PosLabel pos={word.pos} />
            {st !== 'new' && <span className={`chip tiny stage-${st}`}>{t(`stage_${st}` as never)}</span>}
          </div>
          <DictStar ids={[word.id]} />
        </div>
        <div className="row ipa-row">
          <span className="ipa-chip">
            <span className="flag">UK</span>
            <span className="ipa">/{word.uk}/</span>
            <AudioButton text={word.w} audioKey={word.au} accent="uk" size="sm" label="British" />
          </span>
          <span className="ipa-chip">
            <span className="flag">US</span>
            <span className="ipa">/{word.us}/</span>
            <AudioButton text={word.w} audioKey={word.aa} accent="us" size="sm" label="American" />
          </span>
        </div>
        {showRu ? (
          <p className="word-ru">{word.ru}</p>
        ) : (
          <button className="btn btn-ghost btn-sm reveal" onClick={() => setShowRu(true)}>
            {t('show_translation')}
          </button>
        )}
        <p className="word-def en">{word.def}</p>
        <div className="example">
          <AudioButton text={word.ex.replace(/\*/g, '')} audioKey={word.ae} size="sm" />
          <div>
            <div className="en">
              <Md inline>{word.ex}</Md>
            </div>
            {showRu && <div className="muted small">{word.exRu}</div>}
          </div>
        </div>
        {word.note && showRu && <p className="word-note small">💡 {word.note}</p>}
      </div>
    </article>
  )
}
