import { textToVisemeTimeline, VISEME_TO_MORPH } from './lipsyncEn'
import { textToVisemeTimelineHindi } from './lipsyncHi'

export { VISEME_TO_MORPH }

export const SILENCE_VISEME_STATE = Object.freeze({
  viseme: 'sil',
  nextViseme: 'sil',
  phase: 0,
  energy: 0,
})

export function createVisemeTimeline(text, durationMs, language = 'en') {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1200
  return language === 'hi'
    ? textToVisemeTimelineHindi(text, safeDuration)
    : textToVisemeTimeline(text, safeDuration)
}

export function getVisemeStateAt(timeline, elapsedMs) {
  if (!timeline?.times?.length) return SILENCE_VISEME_STATE

  const lastIndex = timeline.times.length - 1
  const lastStart = timeline.times[lastIndex] || 0
  const lastDuration = Math.max(1, timeline.durations[lastIndex] || 1)
  if (elapsedMs < 0 || elapsedMs >= lastStart + lastDuration) return SILENCE_VISEME_STATE

  let index = 0
  for (let i = 0; i < timeline.times.length; i += 1) {
    if (elapsedMs >= timeline.times[i]) index = i
    else break
  }

  const currentStart = timeline.times[index] || 0
  const currentDuration = Math.max(1, timeline.durations[index] || 1)
  const nextIndex = index + 1

  return {
    viseme: timeline.visemes[index] || 'sil',
    nextViseme: timeline.visemes[nextIndex] || 'sil',
    phase: Math.min(1, Math.max(0, (elapsedMs - currentStart) / currentDuration)),
  }
}
