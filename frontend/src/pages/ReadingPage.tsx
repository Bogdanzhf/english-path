import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Reading } from '../components/Reading'
import { Empty, Loader } from '../components/ui'
import { useI18n } from '../i18n'
import { lessonKeys } from '../lib/course'
import { rememberVisit } from '../lib/stats'
import type { LevelId } from '../lib/types'
import { useLevelData } from './Unit'

export default function ReadingPage() {
  const { lv, num } = useParams()
  const level = lv as LevelId
  const n = Number(num)
  const { t, tr } = useI18n()
  const { data, error } = useLevelData(level)
  const unit = data?.level.units.find((u) => u.num === n)
  const words = useMemo(() => data?.bank.byUnit(level, n) ?? [], [data, level, n])
  useEffect(() => {
    if (unit?.reading) rememberVisit({ path: `/level/${level}/reading/${n}`, title: unit.reading.title, titleRu: unit.reading.titleRu })
  }, [unit, level, n])
  if (error) return <Empty emoji="📡">{String(error)}</Empty>
  if (!data) return <Loader />
  if (!unit?.reading) return <Empty emoji="🧭">{t('not_found')}</Empty>
  return (
    <div className={`lv-${level}`}>
      <div className="crumbs">
        <Link to="/reading">{t('nav_reading')}</Link> › <Link to={`/level/${level}?tab=reading`}>{level.toUpperCase()}</Link> ›{' '}
        <Link to={`/level/${level}/unit/${n}`}>
          {t('unit')} {n}: {tr(unit.titleRu, unit.title)}
        </Link>
      </div>
      <Reading reading={unit.reading} words={words} scope={lessonKeys.reading(level, n)} title={`${unit.reading.title} · ${level.toUpperCase()}`} />
    </div>
  )
}
