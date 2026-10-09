// Кнопки озвучки.

import { Pause, Snail, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { speak, stop, type Accent } from '../lib/audio'

let listeners: ((id: string | null) => void)[] = []
let playingId: string | null = null
function setPlaying(id: string | null) {
  playingId = id
  listeners.forEach((l) => l(id))
}

/** Какая кнопка сейчас звучит — чтобы подсвечивать её и гасить остальные. */
function usePlaying(id: string) {
  const [on, setOn] = useState(playingId === id)
  useEffect(() => {
    const l = (p: string | null) => setOn(p === id)
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [id])
  return on
}

export function playClip(id: string, text: string, key?: string | null, opts: { accent?: Accent; rate?: number } = {}) {
  setPlaying(id)
  speak(text, key, opts).then(() => {
    if (playingId === id) setPlaying(null)
  })
}

export function stopAll() {
  stop()
  setPlaying(null)
}

export function AudioButton({
  text,
  audioKey,
  accent,
  size = 'md',
  label,
  slow,
  className = '',
}: {
  text: string
  audioKey?: string | null
  accent?: Accent
  size?: 'sm' | 'md'
  label?: string
  slow?: boolean
  className?: string
}) {
  const id = `${accent ?? ''}|${audioKey ?? ''}|${text}|${slow ? 's' : ''}`
  const on = usePlaying(id)
  return (
    <button
      type="button"
      className={`icon-btn ${size === 'sm' ? 'sm' : ''} ${on ? 'playing' : 'primary'} ${className}`}
      aria-label={label ?? `play: ${text}`}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        if (on) return stopAll()
        playClip(id, text, audioKey, { accent, rate: slow ? 0.7 : undefined })
      }}
    >
      {on ? <Pause size={size === 'sm' ? 15 : 18} /> : slow ? <Snail size={size === 'sm' ? 15 : 18} /> : <Volume2 size={size === 'sm' ? 15 : 18} />}
    </button>
  )
}
