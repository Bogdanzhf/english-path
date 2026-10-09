import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { DictStar, WordCard } from '../components/WordCard'
import { Empty, LevelBadge, Loader, Modal, PageHead, PosLabel, Segmented } from '../components/ui'
import { useI18n } from '../i18n'
import { loadWords, type WordBank } from '../lib/course'
import { LEVEL_IDS, type LevelId, type Word } from '../lib/types'
import { useApp } from '../state'

const PAGE = 60

export function WordRow({ w, onOpen }: { w: Word; onOpen: (w: Word) => void }) {
  const { lang } = useI18n()
  const { prefs } = useApp()
  return (
    <div className="word-row" role="button" tabIndex={0} onClick={() => onOpen(w)} onKeyDown={(e) => e.key === 'Enter' && onOpen(w)}>
      <AudioButton text={w.w} audioKey={prefs.accent === 'uk' ? w.au : w.aa} accent={prefs.accent} size="sm" />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row nowrap" style={{ gap: 8 }}>
          <span className="w en">{w.w}</span>
          <span className="ipa small hide-mobile">/{prefs.accent === 'uk' ? w.uk : w.us}/</span>
          <PosLabel pos={w.pos} />
        </div>
        <div className="small text-2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lang === 'ru' ? w.ru : w.def}
        </div>
      </div>
      <LevelBadge level={w.lv} />
      <DictStar ids={[w.id]} />
    </div>
  )
}

export function search(bank: WordBank, q: string, level: LevelId | 'all'): Word[] {
  const s = q.trim().toLowerCase()
  let list = level === 'all' ? bank.list : bank.byLevel(level)
  if (!s) return list
  list = list.filter((w) => w.w.toLowerCase().includes(s) || w.ru.toLowerCase().includes(s))
  // сначала точные совпадения и начало слова
  const rank = (w: Word) => {
    const x = w.w.toLowerCase()
    if (x === s) return 0
    if (x.startsWith(s)) return 1
    if (w.ru.toLowerCase().split(/[,;] ?/).some((r) => r === s)) return 1
    if (x.includes(s)) return 2
    return 3
  }
  return [...list].sort((a, b) => rank(a) - rank(b))
}

export default function Words() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [bank, setBank] = useState<WordBank | null>(null)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [level, setLevel] = useState<LevelId | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)
  const [open, setOpen] = useState<Word | null>(null)
  useEffect(() => {
    loadWords().then(setBank)
  }, [])
  useEffect(() => setQ(params.get('q') ?? ''), [params])
  useEffect(() => setLimit(PAGE), [q, level])
  const found = useMemo(() => (bank ? search(bank, q, level) : []), [bank, q, level])
  if (!bank) return <Loader />
  return (
    <div>
      <PageHead title={t('dictionary_title')} subtitle={t('dictionary_subtitle', { n: bank.list.length })} />
      <div className="row mb-4">
        <div className="search grow" style={{ maxWidth: 420 }}>
          <Search size={17} />
          <input
            className="input"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })
            }}
            placeholder={t('search_words_placeholder')}
            aria-label={t('search')}
          />
        </div>
        <Segmented<LevelId | 'all'> options={[{ id: 'all', label: t('all') }, ...LEVEL_IDS.map((l) => ({ id: l, label: l.toUpperCase() }))]} value={level} onChange={setLevel} />
      </div>
      <div className="muted small mb-3">{found.length}</div>
      {found.length ? (
        <div className="stack" style={{ gap: 8 }}>
          {found.slice(0, limit).map((w) => (
            <WordRow key={w.id} w={w} onOpen={setOpen} />
          ))}
          {found.length > limit && (
            <button className="btn btn-secondary" onClick={() => setLimit((l) => l + PAGE)}>
              {t('show_more')} ({found.length - limit})
            </button>
          )}
        </div>
      ) : (
        <Empty emoji="🔎">{t('nothing_found')}</Empty>
      )}
      {open && (
        <Modal title={<span className="en">{open.w}</span>} onClose={() => setOpen(null)} wide>
          <WordCard word={open} />
        </Modal>
      )}
    </div>
  )
}
