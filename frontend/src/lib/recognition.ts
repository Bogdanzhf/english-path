// Распознавание речи (Web Speech API): Chrome / Edge на компьютере, Safari на iPhone и iPad.
// Нужен доступ к микрофону; в Chrome распознавание идёт через интернет.

interface SRAlternative { transcript: string; confidence: number }
interface SRResultList { length: number; [i: number]: { length: number; isFinal: boolean; [j: number]: SRAlternative } }
interface SREvent { results: SRResultList }
interface SR {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SRCtor = new () => SR

function ctor(): SRCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canRecognize = () => typeof window !== 'undefined' && !!ctor()

export interface Listening {
  stop(): void
}

export type RecognitionError = 'not-allowed' | 'no-speech' | 'network' | 'unsupported' | 'other'

/**
 * Слушать одну фразу. onInterim — промежуточный текст, onResult — варианты распознавания.
 */
export function listen({
  lang = 'en-US',
  onInterim,
  onResult,
  onError,
  onEnd,
}: {
  lang?: string
  onInterim?: (text: string) => void
  onResult: (alternatives: string[]) => void
  onError?: (e: RecognitionError) => void
  onEnd?: () => void
}): Listening {
  const C = ctor()
  if (!C) {
    onError?.('unsupported')
    onEnd?.()
    return { stop() {} }
  }
  const rec = new C()
  rec.lang = lang
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 5
  let done = false
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1]
    if (last.isFinal) {
      const alts: string[] = []
      for (let i = 0; i < last.length; i++) alts.push(last[i].transcript)
      done = true
      onResult(alts)
    } else {
      onInterim?.(last[0].transcript)
    }
  }
  rec.onerror = (e) => {
    const map: Record<string, RecognitionError> = {
      'not-allowed': 'not-allowed',
      'service-not-allowed': 'not-allowed',
      'no-speech': 'no-speech',
      network: 'network',
    }
    if (e.error !== 'aborted') onError?.(map[e.error] ?? 'other')
  }
  rec.onend = () => {
    if (!done) onResult([])
    onEnd?.()
  }
  try {
    rec.start()
  } catch {
    onError?.('other')
    onEnd?.()
  }
  return { stop: () => rec.stop() }
}
