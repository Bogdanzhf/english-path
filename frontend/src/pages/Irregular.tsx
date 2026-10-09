import { Dumbbell, Search, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AudioButton } from '../components/Audio'
import { Quiz } from '../components/Quiz'
import { Empty, LevelBadge, PageHead, Segmented, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import type { QuizItem } from '../lib/quiz'
import { sample } from '../lib/text'
import { LEVEL_IDS, type IrregularVerb, type LevelId } from '../lib/types'
import { useApp } from '../state'

/** «was/were» → «[[was|were]]»: любая из форм засчитывается. */
const gap = (form: string) => `[[${form.split('/').map((s) => s.trim()).join('|')}]]`

export function verbItems(verbs: IrregularVerb[], n: number): QuizItem[] {
  return sample(verbs, n).map((v) => ({
    key: `irr.${v.base}`,
    ex: { type: 'cloze', text: `**${v.base}** — ${gap(v.past)} — ${gap(v.pp)}`, task: `Past Simple & Past Participle · ${v.ru}`, taskRu: `Past Simple и Past Participle · ${v.ru}` },
  }))
}

export default function Irregular() {
  const { t } = useI18n()
  const { course } = useApp()
  const [tab, setTab] = useState<'table' | 'train'>('table')
  const [q, setQ] = useState('')
  const [maxLevel, setMaxLevel] = useState<LevelId | 'all'>('all')
  const [seed, setSeed] = useState(0)
  const verbs = useMemo(() => course?.irregular ?? [], [course])
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const lvl = maxLevel === 'all' ? 6 : LEVEL_IDS.indexOf(maxLevel)
    return verbs.filter(
      (v) => LEVEL_IDS.indexOf(v.level) <= lvl && (!s || [v.base, v.past, v.pp, v.ru].some((x) => x.toLowerCase().includes(s))),
    )
  }, [verbs, q, maxLevel])
  const items = useMemo(() => verbItems(filtered, Math.min(15, filtered.length)), [filtered, seed])

  return (
    <div>
      <PageHead title={t('irregular_verbs')} subtitle={`${verbs.length} · ${t('irregular_hint')}`} crumbs={[{ to: '/grammar', label: t('nav_grammar') }]} />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'table', label: t('irregular_verbs'), icon: <Table2 size={16} /> },
          { id: 'train', label: t('irregular_train'), icon: <Dumbbell size={16} /> },
        ]}
      />
      <div className="row mb-4">
        <div className="search grow" style={{ maxWidth: 360 }}>
          <Search size={17} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </div>
        <Segmented<LevelId | 'all'>
          options={[{ id: 'all', label: t('all') }, ...LEVEL_IDS.slice(0, 4).map((l) => ({ id: l, label: `≤ ${l.toUpperCase()}` }))]}
          value={maxLevel}
          onChange={setMaxLevel}
        />
      </div>
      {tab === 'table' &&
        (filtered.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th />
                  <th>{t('base_form')}</th>
                  <th>{t('past_simple')}</th>
                  <th>{t('past_participle')}</th>
                  <th>{t('translation')}</th>
                  <th className="hide-mobile">{t('level')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.base}>
                    <td style={{ width: 44 }}>
                      <AudioButton text={`${v.base}, ${v.past}, ${v.pp}`} audioKey={v.a} size="sm" />
                    </td>
                    <td className="en">
                      <b>{v.base}</b>
                    </td>
                    <td className="en">{v.past}</td>
                    <td className="en">{v.pp}</td>
                    <td>{v.ru}</td>
                    <td className="hide-mobile">
                      <LevelBadge level={v.level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty emoji="🔎">{t('nothing_found')}</Empty>
        ))}
      {tab === 'train' && (items.length ? <Quiz key={seed} items={items} saveAs={{ kind: 'words', scope: 'irregular', title: t('irregular_verbs') }} onRestart={() => setSeed((s) => s + 1)} /> : <Empty>{t('nothing_found')}</Empty>)}
    </div>
  )
}
