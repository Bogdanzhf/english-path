// Звуки обратной связи: синтез через Web Audio — без файлов, мгновенно, работает офлайн и на iPad.
// На iPhone/iPad звук не слышен, если включён беззвучный режим переключателем на корпусе.

const KEY = 'ep:sound'
let ctx: AudioContext | null = null

export const soundOn = () => localStorage.getItem(KEY) !== 'off'
export const setSoundOn = (on: boolean) => localStorage.setItem(KEY, on ? 'on' : 'off')

function audio(): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx ??= new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Первое касание: создать и запустить звуковой контекст (iOS разрешает это только по касанию). */
export function unlockSounds() {
  audio()
}

/** Одна нота: частота, начало (с), длительность (с), тембр, громкость. */
function note(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.18, slideTo?: number) {
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

const SOUNDS = {
  // светлый «дзинь»: две ноты вверх + обертон колокольчика
  correct(ac: AudioContext) {
    note(ac, 880, 0, 0.16, 'sine', 0.15)
    note(ac, 1318.5, 0.07, 0.32, 'sine', 0.15)
    note(ac, 2637, 0.07, 0.22, 'sine', 0.03)
  },
  // мягкая «маленькая неудача»: две ноты вниз, приглушённо
  wrong(ac: AudioContext) {
    note(ac, 370, 0, 0.15, 'triangle', 0.16)
    note(ac, 294, 0.12, 0.28, 'triangle', 0.15, 262)
  },
  // лёгкий щелчок — открыта карточка, выбрана буква
  tap(ac: AudioContext) {
    note(ac, 1200, 0, 0.06, 'sine', 0.06)
  },
  // итог «пройдено»: восходящее арпеджио
  success(ac: AudioContext) {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(ac, f, i * 0.09, 0.3, 'sine', 0.13))
    note(ac, 2093, 0.36, 0.5, 'sine', 0.04)
  },
  // итог «ещё немного практики»: спокойные две ноты
  tryAgain(ac: AudioContext) {
    note(ac, 523.25, 0, 0.25, 'triangle', 0.12)
    note(ac, 440, 0.18, 0.4, 'triangle', 0.11)
  },
}

export type SoundName = keyof typeof SOUNDS

export function play(name: SoundName) {
  if (!soundOn()) return
  try {
    const ac = audio()
    if (ac) SOUNDS[name](ac)
  } catch {
    // звук — не главное: при любой ошибке просто молчим
  }
}

/** Ответ проверен: верно или нет. */
export const feedback = (ok: boolean) => play(ok ? 'correct' : 'wrong')
