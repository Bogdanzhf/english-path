import type { UnitMeta } from './types'

/** Темы уроков v2: значок и название для группировки на странице уровня. */
export const TOPICS: Record<string, { emoji: string; ru: string; en: string }> = {
  people: { emoji: '👥', ru: 'Люди и отношения', en: 'People and relationships' },
  phrases: { emoji: '💬', ru: 'Разговорные фразы', en: 'Everyday phrases' },
  grammar: { emoji: '🧩', ru: 'Служебные слова', en: 'Function words' },
  food: { emoji: '🍎', ru: 'Еда и напитки', en: 'Food and drink' },
  home: { emoji: '🏠', ru: 'Дом и быт', en: 'Home and everyday life' },
  clothes: { emoji: '👕', ru: 'Одежда и внешность', en: 'Clothes and appearance' },
  body: { emoji: '🩺', ru: 'Тело и здоровье', en: 'Body and health' },
  time: { emoji: '⏰', ru: 'Время и даты', en: 'Time and dates' },
  numbers: { emoji: '🔢', ru: 'Числа и количество', en: 'Numbers and quantity' },
  place: { emoji: '📍', ru: 'Место и направление', en: 'Place and direction' },
  actions: { emoji: '🏃', ru: 'Действия и движение', en: 'Actions and movement' },
  describing: { emoji: '🔍', ru: 'Описание', en: 'Describing' },
  manner: { emoji: '📏', ru: 'Как и насколько: наречия', en: 'How and how much' },
  feelings: { emoji: '😊', ru: 'Чувства и характер', en: 'Feelings and character' },
  mind: { emoji: '🧠', ru: 'Мысли и мнения', en: 'Thinking and opinions' },
  communication: { emoji: '🗣️', ru: 'Общение и язык', en: 'Communication and language' },
  events: { emoji: '📅', ru: 'События и ситуации', en: 'Events and situations' },
  city: { emoji: '🏙️', ru: 'Город и места', en: 'Places and the city' },
  travel: { emoji: '✈️', ru: 'Путешествия и транспорт', en: 'Travel and transport' },
  shopping: { emoji: '🛒', ru: 'Покупки и деньги', en: 'Shopping and money' },
  work: { emoji: '💼', ru: 'Работа и профессии', en: 'Work and jobs' },
  education: { emoji: '🎓', ru: 'Учёба', en: 'Education' },
  leisure: { emoji: '⚽', ru: 'Досуг и спорт', en: 'Free time and sport' },
  arts: { emoji: '🎭', ru: 'Искусство и медиа', en: 'Arts and media' },
  nature: { emoji: '🌳', ru: 'Природа и погода', en: 'Nature and weather' },
  animals: { emoji: '🐾', ru: 'Животные', en: 'Animals' },
  objects: { emoji: '📦', ru: 'Предметы и материалы', en: 'Objects and materials' },
  tech: { emoji: '💻', ru: 'Технологии', en: 'Technology' },
  science: { emoji: '🔬', ru: 'Наука', en: 'Science' },
  environment: { emoji: '🌍', ru: 'Экология', en: 'Environment' },
  society: { emoji: '🏛️', ru: 'Общество и политика', en: 'Society and politics' },
  law: { emoji: '⚖️', ru: 'Закон и преступность', en: 'Law and crime' },
  economy: { emoji: '📈', ru: 'Экономика и бизнес', en: 'Economy and business' },
  phrasal: { emoji: '🔗', ru: 'Фразовые глаголы', en: 'Phrasal verbs' },
  idioms: { emoji: '💡', ru: 'Идиомы', en: 'Idioms' },
  essay: { emoji: '✍️', ru: 'Академическая лексика', en: 'Academic language' },
}

export const topicOf = (u: Pick<UnitMeta, 'topic'>) => TOPICS[u.topic ?? ''] ?? { emoji: '📚', ru: 'Разное', en: 'Other' }

/** «Actions and movement · 3» — номер части, если уроков с таким названием несколько. */
export function unitName(u: Pick<UnitMeta, 'title' | 'titleRu' | 'part' | 'parts'>, tr: (ru: string, en: string) => string): string {
  const base = tr(u.titleRu, u.title)
  return u.parts && u.parts > 1 ? `${base} · ${u.part}` : base
}
