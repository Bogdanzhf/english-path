import { Link } from 'react-router-dom'
import { AudioButton } from '../components/Audio'
import { PageHead } from '../components/ui'
import { useI18n } from '../i18n'
import { useApp } from '../state'

interface Tense {
  name: string
  form: string
  neg: string
  q: string
  ex: string
  use: [string, string]
  markers: string
  topic?: string // уровень/id темы грамматики
}

const ROWS = [
  { id: 'present', ru: 'Настоящее', en: 'Present' },
  { id: 'past', ru: 'Прошедшее', en: 'Past' },
  { id: 'future', ru: 'Будущее', en: 'Future' },
]
const COLS = [
  { id: 'simple', ru: 'Simple — факт, регулярность', en: 'Simple — fact, habit' },
  { id: 'continuous', ru: 'Continuous — процесс', en: 'Continuous — in progress' },
  { id: 'perfect', ru: 'Perfect — результат к моменту', en: 'Perfect — result by a point' },
  { id: 'perfcont', ru: 'Perfect Continuous — длительность до момента', en: 'Perfect Continuous — duration up to a point' },
]

const T: Record<string, Tense> = {
  'present.simple': {
    name: 'Present Simple',
    form: 'I work / she works',
    neg: "I don't work / she doesn't work",
    q: 'Do you work? / Does she work?',
    ex: 'She works in a hospital.',
    use: ['Факты, привычки, расписания', 'Facts, habits, timetables'],
    markers: 'always, usually, often, every day',
    topic: 'a1/present-simple',
  },
  'present.continuous': {
    name: 'Present Continuous',
    form: 'I am working',
    neg: "I'm not working",
    q: 'Are you working?',
    ex: "I'm reading a great book at the moment.",
    use: ['Действие сейчас, временная ситуация, планы', 'Now, temporary situations, arrangements'],
    markers: 'now, at the moment, today, these days',
    topic: 'a1/present-continuous',
  },
  'present.perfect': {
    name: 'Present Perfect',
    form: 'I have worked',
    neg: "I haven't worked",
    q: 'Have you worked?',
    ex: "I've already finished my homework.",
    use: ['Результат к настоящему, опыт, «уже/ещё не»', 'Result now, experience, already/yet'],
    markers: 'already, yet, just, ever, never, since, for',
    topic: 'a2/present-perfect',
  },
  'present.perfcont': {
    name: 'Present Perfect Continuous',
    form: 'I have been working',
    neg: "I haven't been working",
    q: 'Have you been working?',
    ex: "She's been learning English for two years.",
    use: ['Длится до сих пор, акцент на длительности', 'Still going on, focus on duration'],
    markers: 'for, since, all day, how long',
    topic: 'b1/present-perfect-continuous',
  },
  'past.simple': {
    name: 'Past Simple',
    form: 'I worked / I went',
    neg: "I didn't work",
    q: 'Did you work?',
    ex: 'We visited London last summer.',
    use: ['Завершённое действие в прошлом', 'Finished action in the past'],
    markers: 'yesterday, last week, ago, in 2010',
    topic: 'a1/past-simple',
  },
  'past.continuous': {
    name: 'Past Continuous',
    form: 'I was working',
    neg: "I wasn't working",
    q: 'Were you working?',
    ex: 'I was cooking when you called.',
    use: ['Процесс в момент в прошлом, фон событий', 'In progress at a past moment, background'],
    markers: 'while, when, at 5 pm yesterday',
    topic: 'a2/past-continuous',
  },
  'past.perfect': {
    name: 'Past Perfect',
    form: 'I had worked',
    neg: "I hadn't worked",
    q: 'Had you worked?',
    ex: 'The train had left before we arrived.',
    use: ['Раньше другого действия в прошлом', 'Before another past action'],
    markers: 'before, after, by the time, already',
    topic: 'b1/past-perfect',
  },
  'past.perfcont': {
    name: 'Past Perfect Continuous',
    form: 'I had been working',
    neg: "I hadn't been working",
    q: 'Had you been working?',
    ex: 'He was tired because he had been running.',
    use: ['Длилось до момента в прошлом', 'Lasted up to a past moment'],
    markers: 'for, since, how long, before',
    topic: 'b2/narrative-tenses',
  },
  'future.simple': {
    name: 'Future Simple',
    form: 'I will work',
    neg: "I won't work",
    q: 'Will you work?',
    ex: "I think it will rain tomorrow.",
    use: ['Прогноз, решение в момент речи, обещание', 'Prediction, instant decision, promise'],
    markers: 'tomorrow, next year, I think, probably',
    topic: 'a2/future-will-going-to',
  },
  'future.continuous': {
    name: 'Future Continuous',
    form: 'I will be working',
    neg: "I won't be working",
    q: 'Will you be working?',
    ex: "This time tomorrow I'll be flying to Rome.",
    use: ['Процесс в момент в будущем', 'In progress at a future moment'],
    markers: 'this time tomorrow, at 8 tonight',
    topic: 'b1/future-continuous-perfect',
  },
  'future.perfect': {
    name: 'Future Perfect',
    form: 'I will have worked',
    neg: "I won't have worked",
    q: 'Will you have worked?',
    ex: "By June, I'll have finished the course.",
    use: ['Завершится к моменту в будущем', 'Completed by a future point'],
    markers: 'by, by the time, by then',
    topic: 'b1/future-continuous-perfect',
  },
  'future.perfcont': {
    name: 'Future Perfect Continuous',
    form: 'I will have been working',
    neg: "I won't have been working",
    q: 'Will you have been working?',
    ex: "Next year I'll have been working here for ten years.",
    use: ['Сколько будет длиться к моменту в будущем', 'Duration up to a future point'],
    markers: 'for … by, by the time',
    topic: 'b2/future-perfect-continuous',
  },
}

export default function Tenses() {
  const { t, tr } = useI18n()
  const { course } = useApp()
  const topicExists = (topic?: string) => {
    if (!topic || !course) return false
    const [lv, id] = topic.split('/')
    return !!course.levels.find((l) => l.id === lv)?.grammar.some((g) => g.id === id)
  }
  return (
    <div>
      <PageHead title={t('tenses_map')} subtitle={t('tenses_map_hint')} crumbs={[{ to: '/grammar', label: t('nav_grammar') }]} />
      <div className="tense-grid">
        <div className="th corner" />
        {COLS.map((c) => (
          <div key={c.id} className="th hide-mobile">
            {tr(c.ru, c.en)}
          </div>
        ))}
        {ROWS.map((r) => (
          <div key={r.id} style={{ display: 'contents' }}>
            <div className="th" style={{ alignSelf: 'center' }}>
              {tr(r.ru, r.en)}
            </div>
            {COLS.map((c) => {
              const x = T[`${r.id}.${c.id}`]
              return (
                <div key={c.id} className="tense-cell">
                  <div className="row between nowrap">
                    <h4 className="mb-0">{x.name}</h4>
                    <AudioButton text={x.ex} size="sm" />
                  </div>
                  <div className="muted tiny">{tr(x.use[0], x.use[1])}</div>
                  <code>+ {x.form}</code>
                  <code>− {x.neg}</code>
                  <code>? {x.q}</code>
                  <div className="en mt-0" style={{ marginTop: 6 }}>
                    <i>{x.ex}</i>
                  </div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>
                    {x.markers}
                  </div>
                  {topicExists(x.topic) && (
                    <Link to={`/level/${x.topic!.split('/')[0]}/grammar/${x.topic!.split('/')[1]}`} className="small" style={{ display: 'inline-block', marginTop: 6 }}>
                      {t('tab_rule')} →
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
