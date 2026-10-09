import { Brain, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { WordCard } from '../components/WordCard'
import { Empty, Loader, Modal, PageHead, Segmented } from '../components/ui'
import { useI18n } from '../i18n'
import { loadWords, type WordBank } from '../lib/course'
import { isDue, stage, type WordStage } from '../lib/srs'
import type { CustomWordIn } from '../lib/store'
import type { CustomWord, Word } from '../lib/types'
import { useApp } from '../state'
import { WordRow } from './Words'

const EMPTY: CustomWordIn = { word: '', translation: '', ipa: '', example: '', note: '' }

function CustomForm({ initial, onClose }: { initial?: CustomWord; onClose: () => void }) {
  const { t } = useI18n()
  const { addCustom, editCustom, toast } = useApp()
  const [form, setForm] = useState<CustomWordIn>(initial ? { word: initial.word, translation: initial.translation, ipa: initial.ipa, example: initial.example, note: initial.note } : EMPTY)
  const [error, setError] = useState('')
  const set = (k: keyof CustomWordIn) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (initial) await editCustom(initial.id, form)
      else await addCustom(form)
      toast(t('saved'))
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <Modal title={initial ? t('edit') : t('add_own_word')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <div className="field">
          <label htmlFor="cw-word">{t('own_word')}</label>
          <div className="row nowrap">
            <input id="cw-word" className="input en" value={form.word} onChange={set('word')} required maxLength={80} autoFocus autoCapitalize="off" />
            {form.word.trim() && <AudioButton text={form.word} />}
          </div>
        </div>
        <div className="field">
          <label htmlFor="cw-tr">{t('own_translation')}</label>
          <input id="cw-tr" className="input" value={form.translation} onChange={set('translation')} maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="cw-ipa">{t('own_ipa')}</label>
          <input id="cw-ipa" className="input ipa" value={form.ipa} onChange={set('ipa')} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="cw-ex">{t('own_example')}</label>
          <textarea id="cw-ex" className="input en" value={form.example} onChange={set('example')} maxLength={300} rows={2} />
        </div>
        <div className="field">
          <label htmlFor="cw-note">{t('own_note')}</label>
          <input id="cw-note" className="input" value={form.note} onChange={set('note')} maxLength={300} />
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('cancel')}
          </button>
          <button className="btn btn-primary">{t('save')}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function MyWords() {
  const { t, lang } = useI18n()
  const { progress, deleteCustom } = useApp()
  const [bank, setBank] = useState<WordBank | null>(null)
  const [filter, setFilter] = useState<WordStage | 'all' | 'due'>('all')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<CustomWord | 'new' | null>(null)
  const [open, setOpen] = useState<Word | null>(null)
  useEffect(() => {
    loadWords().then(setBank)
  }, [])

  const course = useMemo(() => {
    if (!bank) return []
    return Object.entries(progress.words)
      .filter(([id, st]) => st.in_dict && bank.byId.has(id))
      .map(([id, st]) => ({ w: bank.byId.get(id)!, st }))
      .sort((a, b) => (b.st.added_at ?? '').localeCompare(a.st.added_at ?? ''))
  }, [bank, progress.words])

  const match = (id: string, text: string) => {
    const st = progress.words[id]
    if (filter === 'due' && !isDue(st)) return false
    if (filter !== 'all' && filter !== 'due' && stage(st) !== filter) return false
    return !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase())
  }
  const courseShown = course.filter(({ w }) => match(w.id, `${w.w} ${w.ru}`))
  const customShown = progress.custom.filter((c) => match(c.id, `${c.word} ${c.translation}`))
  const counts = useMemo(() => {
    const all = [...course.map((c) => c.st), ...progress.custom.map((c) => progress.words[c.id])]
    return {
      all: all.length,
      due: all.filter((s) => isDue(s)).length,
      new: all.filter((s) => stage(s) === 'new').length,
      learning: all.filter((s) => stage(s) === 'learning').length,
      review: all.filter((s) => stage(s) === 'review').length,
      learned: all.filter((s) => stage(s) === 'learned').length,
    }
  }, [course, progress])

  if (!bank) return <Loader />
  return (
    <div>
      <PageHead
        title={t('my_words_title')}
        subtitle={t('my_words_subtitle')}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setForm('new')}>
              <Plus size={17} /> {t('add_own_word')}
            </button>
            {counts.all >= 4 && (
              <Link className="btn btn-primary" to="/review?source=dict">
                <Brain size={17} /> {t('train_dict')}
              </Link>
            )}
          </>
        }
      />
      <div className="row mb-4">
        <div className="search grow" style={{ maxWidth: 340 }}>
          <Search size={17} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </div>
        <Segmented<WordStage | 'all' | 'due'>
          options={[
            { id: 'all', label: `${t('all')} ${counts.all}` },
            { id: 'due', label: `${t('due_now')} ${counts.due}` },
            { id: 'new', label: `${t('stage_new')} ${counts.new}` },
            { id: 'learning', label: `${t('stage_learning')} ${counts.learning}` },
            { id: 'review', label: `${t('stage_review')} ${counts.review}` },
            { id: 'learned', label: `${t('stage_learned')} ${counts.learned}` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>
      {counts.all === 0 && <Empty emoji="⭐">{t('empty_dict')}</Empty>}
      {customShown.length > 0 && (
        <>
          <h3>{t('own_words')}</h3>
          <div className="stack mb-4" style={{ gap: 8 }}>
            {customShown.map((c) => (
              <div key={c.id} className="word-row" style={{ cursor: 'default' }}>
                <AudioButton text={c.word} size="sm" />
                <div className="grow">
                  <div className="row nowrap" style={{ gap: 8 }}>
                    <span className="w en">{c.word}</span>
                    {c.ipa && <span className="ipa small">/{c.ipa}/</span>}
                  </div>
                  <div className="small text-2">{c.translation}</div>
                  {c.example && <div className="small muted en">{c.example}</div>}
                </div>
                <span className={`chip tiny stage-${stage(progress.words[c.id])}`}>{t(`stage_${stage(progress.words[c.id])}` as never)}</span>
                <button className="icon-btn sm" onClick={() => setForm(c)} aria-label={t('edit')}>
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-btn sm"
                  aria-label={t('delete')}
                  onClick={() => {
                    if (confirm(`${t('delete')}: ${c.word}?`)) deleteCustom(c.id)
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {courseShown.length > 0 && (
        <>
          <h3>{t('course_words')}</h3>
          <div className="stack" style={{ gap: 8 }}>
            {courseShown.map(({ w, st }) => (
              <div key={w.id}>
                <WordRow w={w} onOpen={setOpen} />
                {st.seen_at && (
                  <div className="tiny muted" style={{ padding: '2px 12px' }}>
                    {t('next_review')}: {new Date(st.due_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {form && <CustomForm initial={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {open && (
        <Modal title={<span className="en">{open.w}</span>} onClose={() => setOpen(null)} wide>
          <WordCard word={open} />
        </Modal>
      )}
    </div>
  )
}
