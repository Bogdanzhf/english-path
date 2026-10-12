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
// Один общий <audio> на всё приложение. Safari на iPhone/iPad разрешает звук только после касания:
// элемент, запущенный хоть раз по касанию, дальше играет и без него (следующие фразы текста,
// автопроизношение карточки). Новый Audio() на каждую фразу iOS блокировал бы.

let el: HTMLAudioElement | null = null
const player = () => (el ??= new Audio())
let token = 0 // номер текущего воспроизведения: новая команда отменяет старую
let settle: (() => void) | null = null // завершить ожидание прерванной фразы

/** Короткая тишина (WAV), чтобы «разбудить» плеер при первом касании. */
function silentWav() {
  const n = 800
  const buf = new Uint8Array(44 + n)
  const v = new DataView(buf.buffer)
  const str = (o: number, s: string) => [...s].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)))
  str(0, 'RIFF'), v.setUint32(4, 36 + n, true), str(8, 'WAVEfmt '), v.setUint32(16, 16, true)
  v.setUint16(20, 1, true), v.setUint16(22, 1, true), v.setUint32(24, 8000, true), v.setUint32(28, 8000, true)
  v.setUint16(32, 1, true), v.setUint16(34, 8, true), str(36, 'data'), v.setUint32(40, n, true)
  buf.fill(128, 44)
  let bin = ''
  buf.forEach((b) => (bin += String.fromCharCode(b)))
  return 'data:audio/wav;base64,' + btoa(bin)
}

let unlocked = false
/** Вызывается при первом касании: разблокирует плеер и синтез речи на iOS. */
export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return
  unlocked = true
  const a = player()
  if (!a.src) {
    a.src = silentWav()
    a.play().catch(() => (unlocked = false))
  }
  if (synth && !synth.speaking) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  }
}

export function stop() {
  token++
  settle?.()
  settle = null
  if (el) {
    el.onended = el.onerror = null
    el.pause()
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
    settle = resolve
    const accent = clip.accent ?? settings.accent
    let fellBack = false
    const fallback = () => {
      if (fellBack) return
      fellBack = true
      if (my !== token || !synth) return resolve()
      const u = ttsUtterance(clip.text, accent, rate)
      u.onend = () => resolve()
      u.onerror = () => resolve()
      synth.speak(u)
    }
    if (!clip.key) return fallback()
    const a = player()
    a.onended = () => my === token && resolve()
    a.onerror = () => my === token && fallback()
    a.src = audioUrl(clip.key)
    a.defaultPlaybackRate = rate
    a.playbackRate = rate
    ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    a.play().catch((e: DOMException) => {
      // AbortError — фразу прервала следующая команда, это не ошибка
      if (my === token && e?.name !== 'AbortError') fallback()
    })
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
