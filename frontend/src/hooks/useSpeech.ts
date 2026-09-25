import { useCallback, useEffect, useRef, useState } from 'react'
import type { Audio } from '@/api/types'

/**
 * Plays a voice message: a pre-recorded file when `audio.src` is set, otherwise
 * speech synthesis in `audio.lang`. `play()` resolves to false when the browser
 * blocked autoplay (no user gesture yet) — show a manual play button then.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const audioEl = useRef<HTMLAudioElement | null>(null)

  const stop = useCallback(() => {
    if (audioEl.current) {
      audioEl.current.pause()
      audioEl.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const play = useCallback(
    async (audio: Audio | null | undefined): Promise<boolean> => {
      if (!audio) return false
      stop()
      if (audio.src) {
        const src = /^(https?:)?\//.test(audio.src) ? audio.src : `/audio/${audio.src}`
        const el = new window.Audio(src)
        audioEl.current = el
        el.onended = () => setSpeaking(false)
        try {
          setSpeaking(true)
          await el.play()
          el.onerror = () => setSpeaking(false)
          return true
        } catch (err) {
          setSpeaking(false)
          audioEl.current = null
          // Autoplay blocked — the caller shows a manual "play" button (a user gesture).
          if (err instanceof DOMException && err.name === 'NotAllowedError') return false
          // The file failed to load or decode — fall back to speech synthesis below.
        }
      }
      if (!('speechSynthesis' in window) || !audio.text) return false
      const synth = window.speechSynthesis
      const utter = new SpeechSynthesisUtterance(audio.text)
      const lang = audio.lang || 'ru-RU'
      utter.lang = lang
      const voices = synth.getVoices()
      const voice =
        voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(lang.slice(0, 2)))
      if (voice) utter.voice = voice
      utter.rate = lang.startsWith('en') ? 0.95 : 1.05
      return new Promise<boolean>((resolve) => {
        let started = false
        utter.onstart = () => {
          started = true
          setSpeaking(true)
          resolve(true)
        }
        utter.onend = () => setSpeaking(false)
        utter.onerror = () => {
          setSpeaking(false)
          if (!started) resolve(false)
        }
        synth.speak(utter)
        // Chrome silently drops speech without a user gesture — detect it.
        window.setTimeout(() => {
          if (!started) {
            synth.cancel()
            resolve(false)
          }
        }, 1200)
      })
    },
    [stop],
  )

  useEffect(() => stop, [stop])

  return { play, stop, speaking }
}
