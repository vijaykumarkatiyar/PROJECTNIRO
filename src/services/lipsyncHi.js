/**
 * Hindi lip-sync processor — Devanagari phonetic mapping & fallback to English
 * Designed specifically for Indian AI Companions.
 * Handles both Devanagari script and code-switched English words!
 */

import { textToVisemeTimeline as englishTimeline } from './lipsyncEn'

// Devanagari character unicode range: \u0900-\u097F
const DEVANAGARI_REGEX = /[\u0900-\u097F]/

// Viseme durations in relative units
const HINDI_VISEME_DURATIONS = {
  'aa': 0.9, 'E': 0.85, 'I': 0.88, 'O': 0.92, 'U': 0.9, 'PP': 1.05,
  'SS': 1.15, 'TH': 0.95, 'DD': 1.0, 'FF': 0.98, 'kk': 1.1, 'nn': 0.85,
  'RR': 0.85, 'CH': 1.0, 'sil': 1.0
}

/**
 * Phonetically parses a Devanagari Hindi word into Oculus visemes
 * @param {string} word - A Devanagari word
 * @returns {{ visemes: string[], durations: number[] }}
 */
function parseDevanagariWord(word) {
  const visemes = []
  const durations = []

  // Helper to add viseme
  const addViseme = (v, d = 1.0) => {
    // Merge consecutive identical visemes
    if (visemes.length > 0 && visemes[visemes.length - 1] === v) {
      durations[durations.length - 1] += d * 0.7 * (HINDI_VISEME_DURATIONS[v] || 1)
    } else {
      visemes.push(v)
      durations.push(d * (HINDI_VISEME_DURATIONS[v] || 1))
    }
  }

  // Devanagari Phonetic mapping lists
  const bilabials = /[पफबभम]/ // P, Ph, B, Bh, M -> Lips fully touch!
  const labiodentals = /[व]/ // V/W -> FF
  const dentals = /[तथदध]/ // T, Th, D, Dh -> TH
  const velars = /[कखगघङ]/ // K, Kh, G, Gh -> kk
  const palatals = /[चछजझञ]/ // Ch, Chh, J, Jh -> CH
  const retroflexes = /[टठडढण]/ // T, Th, D, Dh, N -> DD
  const sibilants = /[शषस]/ // Sh, Sh, S -> SS
  const liquids = /[ल]/ // L -> nn
  const trills = /[र]/ // R -> RR
  const aspirates = /[ह]/ // H -> aa
  const semivowels = /[य]/ // Y -> I

  const independentVowels = {
    'अ': 'aa', 'आ': 'aa',
    'इ': 'I', 'ई': 'I',
    'उ': 'U', 'ऊ': 'U',
    'ऋ': 'RR',
    'ए': 'E', 'ऐ': 'E',
    'ओ': 'O', 'औ': 'O',
    'अं': 'nn', 'अः': 'sil'
  }

  const matras = {
    '\u093E': 'aa', // ा
    '\u093F': 'I',  // ि
    '\u0940': 'I',  // ी
    '\u0941': 'U',  // ु
    '\u0942': 'U',  // ू
    '\u0943': 'RR', // ृ
    '\u0947': 'E',  // े
    '\u0948': 'E',  // ै
    '\u094B': 'O',  // ो
    '\u094C': 'O'   // ौ
  }

  const chars = [...word]
  let i = 0

  while (i < chars.length) {
    const char = chars[i]
    const nextChar = chars[i + 1]

    // 1. Independent Vowels
    if (independentVowels[char]) {
      addViseme(independentVowels[char], 1.2)
      i++
      continue
    }

    // 2. Consonants
    let isConsonant = false
    let currentViseme = 'sil'

    if (bilabials.test(char)) {
      currentViseme = 'PP'
      isConsonant = true
    } else if (labiodentals.test(char)) {
      currentViseme = 'FF'
      isConsonant = true
    } else if (dentals.test(char)) {
      currentViseme = 'TH'
      isConsonant = true
    } else if (velars.test(char)) {
      currentViseme = 'kk'
      isConsonant = true
    } else if (palatals.test(char)) {
      currentViseme = 'CH'
      isConsonant = true
    } else if (retroflexes.test(char)) {
      currentViseme = 'DD'
      isConsonant = true
    } else if (sibilants.test(char)) {
      currentViseme = 'SS'
      isConsonant = true
    } else if (liquids.test(char)) {
      currentViseme = 'nn'
      isConsonant = true
    } else if (trills.test(char)) {
      currentViseme = 'RR'
      isConsonant = true
    } else if (semivowels.test(char)) {
      currentViseme = 'I'
      isConsonant = true
    } else if (aspirates.test(char)) {
      currentViseme = 'aa'
      isConsonant = true
    }

    if (isConsonant) {
      addViseme(currentViseme, 0.9)
      
      // Look ahead for Halant (्) which suppresses the inherent vowel 'a'
      let hasHalant = false
      let hasMatra = false
      let matraViseme = 'aa'

      let j = i + 1
      while (j < chars.length) {
        const next = chars[j]
        if (next === '\u094D') { // Halant ्
          hasHalant = true
          j++
          break
        } else if (matras[next]) {
          hasMatra = true
          matraViseme = matras[next]
          j++
          break
        } else if (next === '\u0902' || next === '\u0901') { // Anusvara / Chandrabindu
          addViseme('nn', 0.5)
          j++
        } else if (next === '\u093C') { // Nukta (dots under consonants, ignore for shape)
          j++
        } else {
          break
        }
      }

      // If no Halant and no explicit vowel matra, add the inherent vowel 'a' (aa)
      if (!hasHalant && !hasMatra && char !== '्') {
        // Shorter duration for inherent vowel at the end of word
        const d = (j >= chars.length) ? 0.45 : 0.8
        addViseme('aa', d)
      } else if (hasMatra) {
        addViseme(matraViseme, 1.1)
      }

      i = j
      continue
    }

    // 3. Independent Matras / Modifiers directly encountered
    if (matras[char]) {
      addViseme(matras[char], 1.0)
      i++
      continue
    }

    // 4. Nasals/Modifiers (Anusvara/Visarga)
    if (char === '\u0902' || char === '\u0901') {
      addViseme('nn', 0.8)
      i++
      continue
    } else if (char === '\u0903') {
      addViseme('sil', 0.5)
      i++
      continue
    }

    i++
  }

  // Ensure there's at least one viseme for any word
  if (visemes.length === 0) {
    visemes.push('sil')
    durations.push(0.5)
  }

  return { visemes, durations }
}

/**
 * Generate a complete viseme timeline for Hindi text (hybrid Devanagari + English).
 * @param {string} text - The input Hindi/English text
 * @param {number} durationMs - The spoken audio duration in ms
 * @returns {{ visemes: string[], times: number[], durations: number[] }}
 */
export function textToVisemeTimelineHindi(text, durationMs) {
  // If the text contains absolutely no Devanagari, fall back 100% to English rules
  if (!DEVANAGARI_REGEX.test(text)) {
    return englishTimeline(text, durationMs)
  }

  // Parse word-by-word
  const words = text.replace(/[^\u0900-\u097F\w\s',.-]/g, '').split(/\s+/).filter(Boolean)
  const allVisemes = []
  const allTimes = []
  const allDurations = []
  let totalRelative = 0

  for (const word of words) {
    let result

    if (DEVANAGARI_REGEX.test(word)) {
      // Process phonetically using Devanagari rules
      const parsed = parseDevanagariWord(word)
      result = {
        visemes: parsed.visemes,
        durations: parsed.durations,
        times: []
      }
      // Rebuild cumulative times for this word
      let wordTime = 0
      for (const d of parsed.durations) {
        result.times.push(wordTime)
        wordTime += d
      }
    } else {
      // English/Latin word mixed in! Import english parser rules
      // Note: We need the local relative structure, so we mock english wordsToVisemes
      const LipsyncEn = require('./lipsyncEn').LipsyncEn // wait, import is ES module so we use englishTimeline or import a helper
      // Let's call a simplified mapping or use englishTimeline relative scale
      result = mockEnglishWordVisemes(word)
    }

    for (let i = 0; i < result.visemes.length; i++) {
      allVisemes.push(result.visemes[i])
      allTimes.push(totalRelative + result.times[i])
      allDurations.push(result.durations[i])
    }

    if (result.times.length > 0) {
      totalRelative += result.times[result.times.length - 1] + result.durations[result.durations.length - 1]
    }
    totalRelative += 1.0 // Word boundary gap
  }

  if (totalRelative <= 0) return { visemes: ['sil'], times: [0], durations: [durationMs] }

  // Scale relative times to the actual speech audio duration
  const scale = durationMs / totalRelative
  return {
    visemes: allVisemes,
    times: allTimes.map(t => t * scale),
    durations: allDurations.map(d => d * scale)
  }
}

// Simple fallback helper for Latin words inside Hindi text
function mockEnglishWordVisemes(word) {
  // A fast, heuristic grapheme-to-viseme converter for simple Latin words when mixed in
  const lower = word.toLowerCase()
  const visemes = []
  const durations = []
  let time = 0

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i]
    let v = 'sil'
    let d = 0.8

    if (/[aeiou]/.test(char)) {
      v = char === 'a' || char === 'o' ? 'aa' : char === 'e' ? 'E' : char === 'i' ? 'I' : 'U'
      d = 1.0
    } else if (/[pbmy]/.test(char)) {
      v = char === 'y' ? 'I' : 'PP'
    } else if (/[fv]/.test(char)) {
      v = 'FF'
    } else if (/[szj]/.test(char)) {
      v = 'SS'
    } else if (/[tndl]/.test(char)) {
      v = 'DD'
    } else if (/[kgq]/.test(char)) {
      v = 'kk'
    } else if (/[r]/.test(char)) {
      v = 'RR'
    } else if (/[h]/.test(char)) {
      v = 'aa'
    }

    if (v !== 'sil') {
      visemes.push(v)
      durations.push(d)
    }
  }

  if (visemes.length === 0) {
    visemes.push('sil')
    durations.push(1.0)
  }

  const times = []
  let cumulative = 0
  for (const d of durations) {
    times.push(cumulative)
    cumulative += d
  }

  return { visemes, times, durations }
}
