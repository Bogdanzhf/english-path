// Типы данных курса (их пишет backend/app/export.py) и прогресса пользователя.

export type LevelId = 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
export const LEVEL_IDS: LevelId[] = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2']

export interface Word {
  id: string
  w: string
  pos: string
  uk: string
  us: string
  ru: string
  def: string
  ex: string
  exRu: string
  note?: string
  lv: LevelId
  u: number
  au?: string // озвучка слова, британский голос
  aa?: string // американский голос
  ae?: string // пример
  img?: string
}

// ---------- упражнения ----------

interface ExBase {
  task?: string
  taskRu?: string
  explain?: string
  explainRu?: string
  audio?: string
  audioKey?: string | null
  img?: string
}
export interface ChoiceEx extends ExBase { type: 'choice' | 'odd'; q?: string; options: string[]; answer: number }
export interface ListenChoiceEx extends ExBase { type: 'listen'; q?: string; options: string[]; answer: number; audio: string }
export interface ListenInputEx extends ExBase { type: 'listen'; q?: string; options?: undefined; answer: string[]; audio: string }
export interface InputEx extends ExBase { type: 'input'; q: string; answer: string[] }
export interface OrderEx extends ExBase { type: 'order'; q?: string; answer: string; extra?: string[] }
export interface MatchEx extends ExBase { type: 'match'; q?: string; pairs: [string, string][] }
export interface ClozeEx extends ExBase { type: 'cloze'; q?: string; text: string }
export interface ErrorEx extends ExBase { type: 'error'; q?: string; text: string }
export interface TfEx extends ExBase { type: 'tf'; q?: string; items: [string, boolean][] }
export interface DialogEx extends ExBase { type: 'dialog'; q?: string; lines: string[] }
export interface SpeakEx extends ExBase { type: 'speak'; q?: string; answer: string; ru?: string }

export type Exercise =
  | ChoiceEx | ListenChoiceEx | ListenInputEx | InputEx | OrderEx | MatchEx | ClozeEx | ErrorEx | TfEx | DialogEx | SpeakEx

// ---------- курс ----------

export interface UnitMeta { num: number; title: string; titleRu: string; words: number; reading: string | null; readingRu: string | null }
export interface GrammarMeta {
  id: string
  title: string
  titleRu: string
  section: string
  summary: string
  summaryRu: string
  exercises: number
}
export interface DialogueMeta { id: string; title: string; titleRu: string; lines: number }
export interface LevelMeta { id: LevelId; units: UnitMeta[]; grammar: GrammarMeta[]; dialogues: DialogueMeta[] }
export interface IrregularVerb { base: string; past: string; pp: string; ru: string; level: LevelId; a?: string | null }
export type PlacementItem = Exercise & { level: LevelId; section?: string }

export interface Course {
  version: number
  levels: LevelMeta[]
  irregular: IrregularVerb[]
  placement: PlacementItem[]
}

export interface Sentence { en: string; a: string | null }
export interface Reading {
  title: string
  titleRu: string
  voice: string
  paras: { s: Sentence[]; ru: string }[]
  questions: Exercise[]
  glossary: [string, string][]
}
export interface UnitData { num: number; title: string; titleRu: string; reading: Reading | null; exercises: Exercise[] }
export interface GrammarTopic extends Omit<GrammarMeta, 'exercises'> {
  theory: string
  theoryRu: string
  examples: { en: string; ru: string; a: string | null }[]
  exercises: Exercise[]
}
export interface DialogueLine { speaker: string; en: string; ru: string; a: string | null }
export interface Dialogue {
  id: string
  title: string
  titleRu: string
  scene: string
  sceneRu: string
  speakers: Record<string, string>
  lines: DialogueLine[]
  phrases: { en: string; ru: string; a: string | null }[]
  exercises: Exercise[]
}
export interface LevelData { id: LevelId; units: UnitData[]; grammar: GrammarTopic[]; dialogues: Dialogue[] }

// ---------- пользователь и прогресс ----------

export interface Prefs {
  lang?: 'ru' | 'en'
  theme?: 'light' | 'dark' | 'system'
  accent?: 'uk' | 'us'
  rate?: number
  showRu?: boolean
  sound?: boolean
  autoplay?: boolean
  suggestedLevel?: LevelId
  level?: LevelId
}

export interface User { id: number | string; username: string; display_name: string; avatar: string; prefs?: Prefs }

export interface LessonState { opened: boolean; best_score: number; completed: boolean }
export interface WordState {
  in_dict: boolean
  ease: number
  interval: number
  reps: number
  lapses: number
  correct: number
  wrong: number
  due_at: string
  seen_at: string | null
  added_at: string | null
}
export interface CustomWord { id: string; word: string; translation: string; ipa: string; example: string; note: string; created_at: string }
export interface ResultRow { id: number | string; kind: string; scope: string; title: string; score: number; total: number; created_at: string }
export interface Progress {
  lessons: Record<string, LessonState>
  words: Record<string, WordState>
  custom: CustomWord[]
  results: ResultRow[]
  activity: Record<string, number>
}

export interface ResultIn {
  kind: string
  scope: string
  title?: string
  score: number
  total: number
  words?: { id: string; correct: boolean }[]
}
export interface ResultOut { percent: number; passed: boolean; completed: boolean }
