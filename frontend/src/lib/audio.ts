// Озвучка: заранее записанные mp3 нейроголосов (public/audio), а если файла нет —
// синтез речи браузера (Web Speech API). Работает и на iPhone/iPad (Safari).

import { asset } from './course'

export type Accent = 'uk' | 'us'

const settings = { rate: 1, accent: 'us' as Accent }
export function configureAudio(opts: { rate?: number; accent?: Accent }) {
  if (opts.rate) settings.rate = opts.rate
  if (opts.accent) settings.accent = opts.accent
}
export const audioSettings = () => ({ ...settings })

// ---------- синтез речи браузера ----------

let voices: SpeechSynthesisVoice[] = []
const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined

function pickVoices() {
  voices = synth?.getVoices() ?? []
}
if (synth) {
  pickVoices()
  synth.onvoiceschanged = pickVoices
}

function bestVoice(accent: Accent): SpeechSynthesisVoice | undefined {
  const lang = accent === 'uk' ? 'en-gb' : 'en-us'
  const en = voices.filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith('en'))
  const exact = en.filter((v) => v.lang.toLowerCase().replace('_', '-') === lang)
  const good = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => /natural|neural|online|enhanced|premium|google|samantha|daniel|serena|ava|sonia/i.test(v.name)) ?? list[0]
  return good(exact) ?? good(en)
}

export const canSpeak = () => !!synth

const clean = (t: string) => t.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim()

function ttsUtterance(text: string, accent: Accent, rate: number) {
  const u = new SpeechSynthesisUtterance(clean(text))
  u.lang = accent === 'uk' ? 'en-GB' : 'en-US'
  u.rate = Math.max(0.5, Math.min(1.6, 0.95 * rate))
  const v = bestVoice(accent)
  if (v) u.voice = v
  return u
}

// ---------- воспроизведение ----------

let current: HTMLAudioElement | null = null
let token = 0 // номер текущего воспроизведения: новая команда отменяет старую

export function stop() {
  token++
  if (current) {
    current.pause()
    current.src = ''
    current = null
  }
  synth?.cancel()
}

export const audioUrl = (key: string) => asset(`audio/${key.slice(0, 2)}/${key}.mp3`)

export interface Clip {
  text: string
  key?: string | null
  accent?: Accent
}

function playOne(clip: Clip, my: number, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (my !== token) return resolve()
    const accent = clip.accent ?? settings.accent
    const fallback = () => {
      if (my !== token || !synth) return resolve()
      const u = ttsUtterance(clip.text, accent, rate)
      u.onend = () => resolve()
      u.onerror = () => resolve()
      synth.speak(u)
    }
    if (!clip.key) return fallback()
    const a = new Audio(audioUrl(clip.key))
    current = a
    a.playbackRate = rate
    ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    a.onended = () => resolve()
    a.onerror = () => fallback()
    a.play().catch(fallback)
  })
}

/** Прочитать одну фразу. */
export function speak(text: string, key?: string | null, opts: { accent?: Accent; rate?: number } = {}) {
  stop()
  const my = token
  return playOne({ text, key, accent: opts.accent }, my, opts.rate ?? settings.rate)
}

/**
 * Прочитать несколько фраз подряд (текст, диалог). onIndex(i) вызывается перед каждой фразой;
 * возвращает функцию остановки.
 */
export function speakAll(
  clips: Clip[],
  { onIndex, onEnd, rate, pause = 250, from = 0 }: { onIndex?: (i: number) => void; onEnd?: () => void; rate?: number; pause?: number; from?: number } = {},
) {
  stop()
  const my = token
  ;(async () => {
    for (let i = from; i < clips.length; i++) {
      if (my !== token) return
      onIndex?.(i)
      await playOne(clips[i], my, rate ?? settings.rate)
      if (pause) await new Promise((r) => setTimeout(r, pause))
    }
    if (my === token) onEnd?.()
  })()
  return stop
}
