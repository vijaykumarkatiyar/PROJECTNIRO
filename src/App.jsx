import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { AvatarCanvas } from './components/AvatarCanvas'
import { ButterflyCursor } from './components/ButterflyCursor'
import { chatWithCompanion } from './services/geminiService'
import { createVisemeTimeline, getVisemeStateAt, SILENCE_VISEME_STATE } from './services/lipsync'
import './App.css'

const HINDI_LANG = 'hi-IN'
const ENGLISH_LANG = 'en-US'
const API_KEY_STORAGE_KEY = 'COMPANION_API_KEY'
const LEGACY_GEMINI_KEY_STORAGE_KEY = 'VITE_GEMINI_API_KEY'
const SPEECH_ENDPOINTS = [
  `${import.meta.env.BASE_URL}api/speech`,
  `${import.meta.env.BASE_URL}api/speech.php`,
]

function isOpenAiApiKey(apiKey = '') {
  return /^sk-[A-Za-z0-9_-]+/.test(String(apiKey).trim())
}

function getStoredOpenAiApiKey() {
  if (typeof window === 'undefined') return ''

  try {
    const primaryKey = localStorage.getItem(API_KEY_STORAGE_KEY) || ''
    if (isOpenAiApiKey(primaryKey)) return primaryKey.trim()

    const legacyKey = localStorage.getItem(LEGACY_GEMINI_KEY_STORAGE_KEY) || ''
    return isOpenAiApiKey(legacyKey) ? legacyKey.trim() : ''
  } catch {
    return ''
  }
}

const LANGUAGE_COPY = {
  hi: {
    code: 'हिं',
    label: 'Hindi',
    locale: HINDI_LANG,
    placeholder: 'कुछ बोलिए...',
    micRetry: 'मुझे आवाज़ साफ़ नहीं सुनाई दी। कृपया फिर से बोलिए।',
    micError: 'माइक से आवाज़ पढ़ने में दिक्कत आ रही है। कृपया फिर कोशिश करें।',
    sendButton: 'Send',
    readButton: 'टेक्स्ट पढ़ें',
  },
  en: {
    code: 'EN',
    label: 'English',
    locale: ENGLISH_LANG,
    placeholder: 'Say something...',
    micRetry: 'I could not hear that clearly. Please try speaking again.',
    micError: 'I had trouble reading the microphone audio. Please try again.',
    sendButton: 'Send',
    readButton: 'Read Text',
  },
}

const AVATAR_LANGUAGE_COPY = {
  female: {
    hi: {
      greeting: 'नमस्ते! मैं आपकी AI शिक्षिका हूं। आप मुझसे कुछ भी पूछ सकते हैं।',
      micUnavailable: 'इस ब्राउज़र में माइक उपलब्ध नहीं है। Mimic mode में लिखकर Send दबाएं, मैं वही बोलकर दोहराऊंगी।',
      mimicPlaceholder: 'माइक दबाकर बोलिए...',
      mimicListening: 'सुन रही हूं...',
    },
    en: {
      greeting: 'Hello! I am your female AI teacher. You can ask me anything.',
      micUnavailable: 'This browser cannot access the microphone. In Mimic mode, type and press Send, and I will repeat it in my female voice.',
      mimicPlaceholder: 'Press mic and speak...',
      mimicListening: 'Listening...',
    },
  },
  male: {
    hi: {
      greeting: 'नमस्ते! मैं आपका AI शिक्षक हूं। आप मुझसे कुछ भी पूछ सकते हैं।',
      micUnavailable: 'इस ब्राउज़र में माइक उपलब्ध नहीं है। Mimic mode में लिखकर Send दबाएं, मैं वही बोलकर दोहराऊंगा।',
      mimicPlaceholder: 'माइक दबाकर बोलिए...',
      mimicListening: 'सुन रहा हूं...',
    },
    en: {
      greeting: 'Hello! I am your male AI teacher. You can ask me anything.',
      micUnavailable: 'This browser cannot access the microphone. In Mimic mode, type and press Send, and I will repeat it in my male voice.',
      mimicPlaceholder: 'Press mic and speak...',
      mimicListening: 'Listening...',
    },
  },
}

function getLanguageCopy(languageMode = 'hi', avatarMode = 'female') {
  const languageCopy = LANGUAGE_COPY[languageMode] || LANGUAGE_COPY.hi
  const avatarCopy = AVATAR_LANGUAGE_COPY[avatarMode]?.[languageMode] || AVATAR_LANGUAGE_COPY.female[languageMode]
  return { ...languageCopy, ...avatarCopy }
}

const MARQUEE_WORDS = [
  'NIPUNUP',
  'NIPUNBHARAT',
  'NIPUNJHANSI',
  'BASIC EDUCATION DEPARTMENT',
  'PRIMARY EDUCATION',
]

const MARQUEE_ROWS = [
  { id: 'row-1', top: '12%', duration: '26s', delay: '-4s', scale: 0.98, opacity: 0.78 },
  { id: 'row-2', top: '25%', duration: '34s', delay: '-11s', scale: 0.86, opacity: 0.66, reverse: true },
  { id: 'row-3', top: '38%', duration: '22s', delay: '-17s', scale: 0.94, opacity: 0.74 },
  { id: 'row-4', top: '51%', duration: '39s', delay: '-8s', scale: 0.8, opacity: 0.62, reverse: true },
  { id: 'row-5', top: '64%', duration: '29s', delay: '-15s', scale: 0.88, opacity: 0.7 },
  { id: 'row-6', top: '77%', duration: '45s', delay: '-22s', scale: 0.74, opacity: 0.58, reverse: true },
]

const LIGHTING_MODES = [
  { id: 'studio', label: 'Studio', icon: '💡' },
  { id: 'warm', label: 'Warm', icon: '🌇' },
  { id: 'cool', label: 'Cool', icon: '❄️' },
  { id: 'neon', label: 'Neon', icon: '🌈' },
  { id: 'night', label: 'Night', icon: '🌙' },
]

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, value))

function getMimicSpeechStats(text) {
  const compactLength = text.replace(/\s+/g, '').length
  const wordCount = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)
  const naturalDurationMs = Math.max(900, compactLength * 78, wordCount * 360)
  return { compactLength, wordCount, naturalDurationMs }
}

function detectTextLanguage(text, fallback = 'hi') {
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length
  const latinCount = (text.match(/[A-Za-z]/g) || []).length
  if (devanagariCount === 0 && latinCount === 0) return fallback
  return devanagariCount >= Math.max(2, latinCount * 0.35) ? 'hi' : 'en'
}

function stabilizeVisemeTimeline(timeline, durationMs) {
  if (!timeline?.visemes?.length) return timeline

  const minDuration = 45
  const segments = timeline.visemes.map((viseme, index) => ({
    viseme,
    duration: Math.max(0, Number(timeline.durations[index]) || 0),
  }))

  const stable = []
  for (const segment of segments) {
    if (!segment.viseme || segment.duration <= 0) continue

    const previous = stable[stable.length - 1]
    if (previous?.viseme === segment.viseme) {
      previous.duration += segment.duration
      continue
    }

    if (segment.duration < minDuration && previous) {
      previous.duration += segment.duration
      continue
    }

    stable.push({ ...segment })
  }

  if (!stable.length) return timeline

  const total = stable.reduce((sum, segment) => sum + segment.duration, 0)
  const scale = total > 0 && durationMs > 0 ? durationMs / total : 1
  let time = 0

  return stable.reduce((result, segment) => {
    const scaledDuration = segment.duration * scale
    result.visemes.push(segment.viseme)
    result.times.push(time)
    result.durations.push(scaledDuration)
    time += scaledDuration
    return result
  }, { visemes: [], times: [], durations: [] })
}

function prepareReadableText(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([।.!?])\s*/g, '$1 ')
    .replace(/([,;:])\s*/g, '$1 ')
    .replace(/\s+(और|लेकिन|क्योंकि|परंतु|so|but|because|however)\s+/gi, ', $1 ')
    .trim()
}

function estimateReadDurationMs(text) {
  const { compactLength, wordCount } = getMimicSpeechStats(text)
  const punctuationPauses = (text.match(/[।.!?,;:]/g) || []).length * 260
  return Math.max(1800, Math.min(24000, compactLength * 92 + wordCount * 340 + punctuationPauses + 900))
}

const VOICE_HINTS = {
  female: {
    hi: ['kalpana', 'heera', 'swara', 'female', 'woman', 'girl'],
    en: ['zira', 'jenny', 'aria', 'samantha', 'susan', 'victoria', 'female', 'woman'],
  },
  male: {
    hi: ['hemant', 'ravi', 'rishi', 'male', 'man', 'boy'],
    en: ['david', 'mark', 'guy', 'ryan', 'george', 'male', 'man', 'boy'],
  },
}

const VOICE_GENDER_EXCLUDES = {
  female: ['male', 'man', 'boy', 'david', 'mark', 'guy', 'ryan', 'george', 'hemant', 'ravi', 'rishi'],
  male: ['female', 'woman', 'girl', 'zira', 'jenny', 'aria', 'samantha', 'susan', 'victoria', 'kalpana', 'heera', 'swara'],
}

function pickPreferredVoice(languageMode = 'hi', avatarMode = 'female') {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  const locale = LANGUAGE_COPY[languageMode]?.locale || HINDI_LANG
  const preferredHints = VOICE_HINTS[avatarMode]?.[languageMode] || []
  const oppositeHints = VOICE_HINTS[avatarMode === 'male' ? 'female' : 'male']?.[languageMode] || []
  const blockedHints = VOICE_GENDER_EXCLUDES[avatarMode] || []

  const voiceScore = (voice) => {
    const name = voice.name.toLowerCase()
    const lang = voice.lang.toLowerCase()
    const localeLower = locale.toLowerCase()
    let score = 0

    if (lang === localeLower) score += 100
    else if (lang.startsWith(languageMode)) score += 70
    else if (languageMode === 'hi' && (lang.startsWith('hi') || lang.includes('in'))) score += 45

    if (name.includes('google')) score += 8
    if (preferredHints.some((word) => name.includes(word))) score += 52
    if (oppositeHints.some((word) => name.includes(word))) score -= 42
    if (blockedHints.some((word) => name.includes(word))) score -= 120

    return score
  }

  const bestVoice = voices
    .map((voice) => ({ voice, score: voiceScore(voice) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.voice || null

  if (bestVoice || avatarMode !== 'male') return bestVoice

  const anyMaleVoice = voices.find((voice) => {
    const name = voice.name.toLowerCase()
    return VOICE_HINTS.male.en.concat(VOICE_HINTS.male.hi).some((word) => name.includes(word)) &&
      !VOICE_GENDER_EXCLUDES.male.some((word) => name.includes(word))
  })

  return anyMaleVoice || null
}

function App() {
  const [inputText, setInputText] = useState('')
  const [messages, setMessages] = useState([])
  const [avatarAction, setAvatarAction] = useState('idle')
  const [isListening, setIsListening] = useState(false)
  const [isMimicMode, setIsMimicMode] = useState(false)
  const [languageMode, setLanguageMode] = useState('hi')
  const [cursorMode, setCursorMode] = useState('butterfly')
  const [lightingMode, setLightingMode] = useState('studio')
  const [avatarMode, setAvatarMode] = useState('female')
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const chatEndRef = useRef(null)
  const hasPlayedGreeting = useRef(false)
  const speakGenRef = useRef(0)
  const speechAudioRef = useRef(null)
  const speechAudioUrlRef = useRef(null)
  const activeUtteranceRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const recordedChunksRef = useRef([])
  const recordingStopTimerRef = useRef(null)
  const recordingModeRef = useRef('chat')
  const recordingStartedAtRef = useRef(0)
  const voiceStartedAtRef = useRef(0)
  const lastVoiceAtRef = useRef(0)
  const pendingStarterGreetingRef = useRef(null)
  const greetingSpeakTimerRef = useRef(null)
  const mimicFlushTimerRef = useRef(null)
  const mimicRestartTimerRef = useRef(null)
  const mimicAutoRestartRef = useRef(false)
  const mimicRateRef = useRef(0.92)
  const silenceMonitorRef = useRef(null)
  const audioContextRef = useRef(null)
  const speechAudioContextRef = useRef(null)
  const speechAudioSourceRef = useRef(null)
  const speechAnalyserRef = useRef(null)
  const speechAnalyserDataRef = useRef(null)
  const speechEnergyRef = useRef(0)
  const visemeTimelineRef = useRef(null)
  const visemeCurrentRef = useRef(SILENCE_VISEME_STATE)
  const visemeRafRef = useRef(null)
  const butterflyCursorRef = useRef(null)
  const butterflyIdleTimerRef = useRef(null)
  const butterflyPerchIndexRef = useRef(-1)
  const butterflyLastPointRef = useRef(null)

  // ── Custom Background States & Presets ──
  const [bgMode, setBgMode] = useState('default') // 'default' | 'solid' | 'splashes' | 'gradual' | 'wallpaper' | 'marquee_text'
  const [solidColor, setSolidColor] = useState('#0f172a')
  const [wallpaperUrl, setWallpaperUrl] = useState('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1200')
  const [customWallpaper, setCustomWallpaper] = useState(null)
  const [showBgSelector, setShowBgSelector] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState(() => {
    return typeof window !== 'undefined'
      ? localStorage.getItem(API_KEY_STORAGE_KEY) || localStorage.getItem(LEGACY_GEMINI_KEY_STORAGE_KEY) || ""
      : ""
  })

  const COLOR_PRESETS = [
    '#0f172a', // Slate Default
    '#1e1b4b', // Royal Indigo
    '#042f2e', // Deep Teal
    '#310b2f', // Mystic Plum
    '#0b132b', // Cyber Navy
    '#18181b', // Matte Charcoal
  ]

  const WALLPAPER_PRESETS = [
    { name: 'Cozy Library', url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1200' },
    { name: 'Modern Studio', url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200' },
    { name: 'Aesthetic Pastel', url: 'https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?q=80&w=1200' },
    { name: 'Cyber Sci-Fi', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200' }
  ]

  const activeLanguage = getLanguageCopy(languageMode, avatarMode)

  // User must click once to unlock browser audio
  const handleStartClick = () => {
    setUserInteracted(true)
    // Unlock speechSynthesis with a silent utterance
    if ('speechSynthesis' in window) {
      const unlock = new SpeechSynthesisUtterance('')
      unlock.lang = activeLanguage.locale
      unlock.volume = 0
      window.speechSynthesis.speak(unlock)
    }
  }

  const onAvatarLoaded = useCallback((loadedAvatarMode = avatarMode) => {
    if (loadedAvatarMode === avatarMode) setAvatarLoaded(true)
  }, [avatarMode])

  const cleanupSpeechAnalyser = useCallback(() => {
    try {
      speechAudioSourceRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    try {
      speechAnalyserRef.current?.disconnect()
    } catch {
      /* ignore */
    }
    speechAudioSourceRef.current = null
    speechAnalyserRef.current = null
    speechAnalyserDataRef.current = null
    speechEnergyRef.current = 0
  }, [])

  const clearGreetingSpeakTimer = useCallback(() => {
    if (!greetingSpeakTimerRef.current) return
    window.clearTimeout(greetingSpeakTimerRef.current)
    greetingSpeakTimerRef.current = null
  }, [])

  const stopActiveSpeech = useCallback(() => {
    speakGenRef.current += 1
    clearGreetingSpeakTimer()
    cleanupSpeechAnalyser()
    if (visemeRafRef.current) {
      cancelAnimationFrame(visemeRafRef.current)
      visemeRafRef.current = null
    }
    if (speechAudioRef.current) {
      speechAudioRef.current.pause()
      speechAudioRef.current = null
    }
    if (speechAudioUrlRef.current) {
      URL.revokeObjectURL(speechAudioUrlRef.current)
      speechAudioUrlRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    activeUtteranceRef.current = null
    visemeTimelineRef.current = null
    visemeCurrentRef.current = { ...SILENCE_VISEME_STATE, forceClose: true }
    setAvatarAction('idle')
  }, [cleanupSpeechAnalyser, clearGreetingSpeakTimer])

  const perchButterflyCursor = useCallback(() => {
    if (cursorMode !== 'butterfly') return
    const cursor = butterflyCursorRef.current
    if (!cursor) return

    const width = window.innerWidth
    const height = window.innerHeight
    const centerX = width / 2
    const perches = [
      { x: centerX - width * 0.06, y: height * 0.22, rotate: '-16deg' },
      { x: centerX + width * 0.07, y: height * 0.25, rotate: '12deg' },
      { x: centerX - width * 0.16, y: height * 0.38, rotate: '-26deg' },
      { x: centerX + width * 0.15, y: height * 0.39, rotate: '22deg' },
      { x: centerX - width * 0.23, y: height * 0.66, rotate: '-10deg' },
      { x: centerX + width * 0.23, y: height * 0.66, rotate: '10deg' },
    ]
    let nextIndex = Math.floor(Math.random() * perches.length)
    if (nextIndex === butterflyPerchIndexRef.current) nextIndex = (nextIndex + 1) % perches.length
    butterflyPerchIndexRef.current = nextIndex

    const perch = perches[nextIndex]
    cursor.classList.add('is-resting')
    cursor.style.setProperty('--cursor-x', `${perch.x}px`)
    cursor.style.setProperty('--cursor-y', `${perch.y}px`)
    cursor.style.setProperty('--cursor-visible', '1')
    cursor.style.setProperty('--butterfly-rest-rotate', perch.rotate)
    cursor.style.setProperty('--butterfly-flight-rotate', perch.rotate)
  }, [cursorMode])

  const moveButterflyCursor = useCallback((event) => {
    if (cursorMode !== 'butterfly') return
    const cursor = butterflyCursorRef.current
    if (!cursor) return

    if (butterflyIdleTimerRef.current) {
      window.clearTimeout(butterflyIdleTimerRef.current)
      butterflyIdleTimerRef.current = null
    }

    const previousPoint = butterflyLastPointRef.current
    const dx = previousPoint ? event.clientX - previousPoint.x : 0
    const dy = previousPoint ? event.clientY - previousPoint.y : 0
    const travel = Math.hypot(dx, dy)
    const bank = travel > 1 ? Math.max(-24, Math.min(24, dx * 0.09 + dy * 0.16)) : 0
    butterflyLastPointRef.current = { x: event.clientX, y: event.clientY }

    cursor.classList.remove('is-resting')
    cursor.style.setProperty('--cursor-x', `${event.clientX}px`)
    cursor.style.setProperty('--cursor-y', `${event.clientY}px`)
    cursor.style.setProperty('--cursor-visible', '1')
    cursor.style.setProperty('--butterfly-flight-rotate', `${-8 + bank}deg`)
    cursor.style.setProperty('--butterfly-rest-rotate', `${-8 + bank}deg`)
    butterflyIdleTimerRef.current = window.setTimeout(perchButterflyCursor, 1700)
  }, [cursorMode, perchButterflyCursor])

  const hideButterflyCursor = useCallback(() => {
    if (butterflyIdleTimerRef.current) {
      window.clearTimeout(butterflyIdleTimerRef.current)
      butterflyIdleTimerRef.current = null
    }
    butterflyLastPointRef.current = null
    butterflyCursorRef.current?.style.setProperty('--cursor-visible', '0')
  }, [])

  useEffect(() => {
    if (cursorMode !== 'butterfly') {
      hideButterflyCursor()
      return undefined
    }

    const handlePointerMove = (event) => moveButterflyCursor(event)
    const handleWindowBlur = () => hideButterflyCursor()

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('mousemove', handlePointerMove, { passive: true })
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      if (butterflyIdleTimerRef.current) {
        window.clearTimeout(butterflyIdleTimerRef.current)
        butterflyIdleTimerRef.current = null
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [cursorMode, hideButterflyCursor, moveButterflyCursor])

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const speak = useCallback((text, isDancing, speechOptions = {}) => {
    const gen = ++speakGenRef.current
    const speechStyle = speechOptions.style || 'teacher'
    const speechLanguage = speechOptions.language || detectTextLanguage(text, languageMode)
    const speechAvatarMode = speechOptions.avatarMode || avatarMode
    const speechLocale = LANGUAGE_COPY[speechLanguage]?.locale || HINDI_LANG
    const targetDurationMs = Number(speechOptions.targetDurationMs || 0)
    const requestedMimicRate = Number(speechOptions.mimicRate || 0)
    const onSpeechComplete = typeof speechOptions.onComplete === 'function' ? speechOptions.onComplete : null
    const speechApiKey = getStoredOpenAiApiKey()
    const { naturalDurationMs: mimicNaturalDuration } = getMimicSpeechStats(text)
    const isMimicSpeech = speechStyle === 'mimic'
    const isReadSpeech = speechStyle === 'read'
    const mimicSpeechRate = isMimicSpeech
      ? requestedMimicRate > 0
        ? clampNumber(requestedMimicRate, 0.72, 1.0)
        : targetDurationMs > 0
          ? clampNumber(mimicNaturalDuration / Math.max(850, targetDurationMs), 0.72, 1.0)
          : 0.88
      : 0.92
    const browserSpeechRate = isMimicSpeech ? mimicSpeechRate : isReadSpeech ? 0.88 : 0.92
    const femalePitch = isMimicSpeech ? 1.1 : isReadSpeech ? 1.03 : 1.06
    const malePitch = isMimicSpeech ? 0.5 : isReadSpeech ? 0.56 : 0.58
    const browserSpeechPitch = speechAvatarMode === 'male' ? malePitch : femalePitch
    let estimatedDuration = Math.max(3500, text.length * 85)
    if (isMimicSpeech) {
      estimatedDuration = Math.max(1400, Math.min(17000, mimicNaturalDuration / Math.max(0.68, mimicSpeechRate) + 700))
    } else if (isReadSpeech && targetDurationMs > 0) {
      estimatedDuration = Math.max(1800, Math.min(26000, targetDurationMs + 900))
    } else if (targetDurationMs > 0) {
      estimatedDuration = Math.max(1600, Math.min(15000, targetDurationMs + 1200))
    }

    if (speechAudioRef.current) {
      speechAudioRef.current.pause()
      speechAudioRef.current = null
    }
    if (speechAudioUrlRef.current) {
      URL.revokeObjectURL(speechAudioUrlRef.current)
      speechAudioUrlRef.current = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    cleanupSpeechAnalyser()
    if (visemeRafRef.current) {
      cancelAnimationFrame(visemeRafRef.current)
      visemeRafRef.current = null
    }
    visemeTimelineRef.current = null
    visemeCurrentRef.current = SILENCE_VISEME_STATE

    const startTalkIfCurrent = () => {
      if (!isDancing && speakGenRef.current === gen) setAvatarAction('talk')
    }
    const endTalkIfCurrent = () => {
      if (!isDancing && speakGenRef.current === gen) setAvatarAction('idle')
    }

    let speechTimeout = null
    let speechStartTime = 0
    let hasFinishedSpeech = false
    let activeTimelineDurationMs = 0
    let pulseStarted = false

    const getSafeSpeechDuration = (durationMs) => {
      const duration = Number(durationMs)
      return Number.isFinite(duration) && duration > 0
        ? Math.max(700, Math.min(32000, duration))
        : estimatedDuration
    }

    const syncVisemeTimeline = (durationMs, force = false) => {
      const safeDuration = getSafeSpeechDuration(durationMs)
      if (!force && Math.abs(safeDuration - activeTimelineDurationMs) < 180) return
      activeTimelineDurationMs = safeDuration
      const rawTimeline = createVisemeTimeline(text, safeDuration, speechLanguage)
      visemeTimelineRef.current = stabilizeVisemeTimeline(rawTimeline, safeDuration)
    }

    const getAudioDurationMs = (audio) =>
      audio && Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration * 1000
        : 0

    const setupSpeechAnalyser = (audio) => {
      cleanupSpeechAnalyser()
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext
        if (!AudioContextClass) return false

        const audioContext = speechAudioContextRef.current || new AudioContextClass()
        speechAudioContextRef.current = audioContext
        if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})

        const source = audioContext.createMediaElementSource(audio)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.58
        source.connect(analyser)
        analyser.connect(audioContext.destination)

        speechAudioSourceRef.current = source
        speechAnalyserRef.current = analyser
        speechAnalyserDataRef.current = new Uint8Array(analyser.fftSize)
        speechEnergyRef.current = 0
        return true
      } catch (error) {
        console.warn('Speech analyser unavailable:', error)
        cleanupSpeechAnalyser()
        return false
      }
    }

    const getSpeechEnergy = () => {
      const analyser = speechAnalyserRef.current
      const samples = speechAnalyserDataRef.current
      if (!analyser || !samples) return null

      analyser.getByteTimeDomainData(samples)
      let sumSquares = 0
      for (let i = 0; i < samples.length; i += 1) {
        const centered = (samples[i] - 128) / 128
        sumSquares += centered * centered
      }

      const rms = Math.sqrt(sumSquares / samples.length)
      const rawEnergy = clampNumber((rms - 0.012) * 8.5, 0, 1)
      const previous = speechEnergyRef.current || 0
      const speed = rawEnergy > previous ? 0.58 : 0.24
      const energy = previous + (rawEnergy - previous) * speed
      speechEnergyRef.current = energy
      return energy
    }

    const getLipDriveEnergy = (visemeState) => {
      const hasActiveMouthShape = visemeState.viseme !== 'sil' || visemeState.nextViseme !== 'sil'
      if (!hasActiveMouthShape) return 0

      const analysedEnergy = getSpeechEnergy()
      if (analysedEnergy == null) return 1

      // The analyser can lag on the first audible frames. Keep a natural
      // floor so lips do not wait until after the voice is already heard.
      return Math.max(0.72, analysedEnergy)
    }

    syncVisemeTimeline(estimatedDuration, true)
    
    const updateVisemeLoop = () => {
      if (speakGenRef.current !== gen) return
      
      const now = performance.now()
      let elapsedMs = now - speechStartTime

      if (speechAudioRef.current) {
        const audio = speechAudioRef.current
        elapsedMs = audio.currentTime * 1000
        speechStartTime = now - elapsedMs
      }

      const visemeState = getVisemeStateAt(visemeTimelineRef.current, elapsedMs)
      visemeCurrentRef.current = {
        ...visemeState,
        energy: getLipDriveEnergy(visemeState),
      }

      visemeRafRef.current = requestAnimationFrame(updateVisemeLoop)
    }

    const startPulse = (startElapsedMs = 0) => {
      if (hasFinishedSpeech || speakGenRef.current !== gen) return
      const audioDurationMs = getAudioDurationMs(speechAudioRef.current)
      if (audioDurationMs > 0) syncVisemeTimeline(audioDurationMs, true)
      const safeStartElapsed = Math.max(0, Number(startElapsedMs) || 0)
      const firstState = getVisemeStateAt(visemeTimelineRef.current, safeStartElapsed)
      visemeCurrentRef.current = {
        ...firstState,
        energy: getLipDriveEnergy(firstState),
      }
      startTalkIfCurrent()
      speechStartTime = performance.now() - safeStartElapsed
      pulseStarted = true
      
      if (visemeRafRef.current) cancelAnimationFrame(visemeRafRef.current)
      visemeRafRef.current = requestAnimationFrame(updateVisemeLoop)
    }

    const armSpeechTimer = (durationMs) => {
      if (speechTimeout) window.clearTimeout(speechTimeout)
      speechTimeout = window.setTimeout(finishSpeech, durationMs)
    }

    const stopPulse = () => {
      if (visemeRafRef.current) {
        cancelAnimationFrame(visemeRafRef.current)
        visemeRafRef.current = null
      }
      if (speechTimeout) {
        window.clearTimeout(speechTimeout)
        speechTimeout = null
      }
    }

    const finishSpeech = () => {
      if (speakGenRef.current !== gen) return
      if (hasFinishedSpeech) return
      hasFinishedSpeech = true
      stopPulse()
      cleanupSpeechAnalyser()
      visemeCurrentRef.current = { ...SILENCE_VISEME_STATE, forceClose: true }
      endTalkIfCurrent()
      activeUtteranceRef.current = null
      if (speechAudioRef.current) speechAudioRef.current = null
      if (speechAudioUrlRef.current) {
        URL.revokeObjectURL(speechAudioUrlRef.current)
        speechAudioUrlRef.current = null
      }
      if (onSpeechComplete) {
        window.setTimeout(() => {
          if (speakGenRef.current === gen) onSpeechComplete()
        }, 160)
      }
    }

    const playBrowserSpeechFallback = () => {
      if (hasFinishedSpeech || speakGenRef.current !== gen) return
      cleanupSpeechAnalyser()
      if (speechAudioRef.current) {
        speechAudioRef.current.pause?.()
        speechAudioRef.current = null
      }
      if (speechAudioUrlRef.current) {
        URL.revokeObjectURL(speechAudioUrlRef.current)
        speechAudioUrlRef.current = null
      }

      let browserSpeechStarted = false
      const ensureBrowserPulse = (extraMs = 900) => {
        if (!browserSpeechStarted) {
          browserSpeechStarted = true
          startPulse()
        }
        armSpeechTimer(estimatedDuration + extraMs)
      }

      if (!('speechSynthesis' in window)) {
        ensureBrowserPulse(1200)
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      activeUtteranceRef.current = utterance // Prevent GC in Chrome/Edge
      utterance.lang = speechLocale
      utterance.rate = browserSpeechRate
      utterance.pitch = browserSpeechPitch
      utterance.volume = 1
      utterance.onstart = () => {
        browserSpeechStarted = true
        startPulse()
        armSpeechTimer(estimatedDuration + 1800)
      }
      utterance.onboundary = (event) => {
        if (hasFinishedSpeech || speakGenRef.current !== gen) return
        if (event.name === 'word') {
          // Re-align our timeline clock with the actual speech elapsed time!
          if (event.elapsedTime !== undefined) {
            const actualElapsedMs = event.elapsedTime * 1000
            speechStartTime = performance.now() - actualElapsedMs
            if (typeof event.charIndex === 'number' && event.charIndex > 1 && text.length > 3) {
              const textProgress = Math.min(0.96, event.charIndex / text.length)
              if (textProgress > 0.08) {
                syncVisemeTimeline((actualElapsedMs / textProgress) + 350)
              }
            }
          }
        }
      }
      utterance.onend = () => {
        activeUtteranceRef.current = null
        finishSpeech()
      }
      utterance.onerror = (event) => {
        activeUtteranceRef.current = null
        if (hasFinishedSpeech || speakGenRef.current !== gen) return
        console.warn('Browser speech synthesis error:', event?.error || 'unknown')
        // Keep the text-driven mouth animation alive even when the browser
        // voice engine rejects a Hindi/English utterance.
        ensureBrowserPulse(900)
      }

      const applyVoiceAndSpeak = () => {
        if (hasFinishedSpeech || speakGenRef.current !== gen) return
        try {
          window.speechSynthesis.resume()
        } catch {
          /* ignore */
        }
        const voice = pickPreferredVoice(speechLanguage, speechAvatarMode)
        if (voice) utterance.voice = voice
        try {
          window.speechSynthesis.speak(utterance)
          const fallbackStartDelay = 420
          window.setTimeout(() => {
            if (!browserSpeechStarted && !hasFinishedSpeech && speakGenRef.current === gen) {
              ensureBrowserPulse(900)
            }
          }, fallbackStartDelay)
        } catch (error) {
          console.warn('Browser speech synthesis failed:', error)
          ensureBrowserPulse(900)
        }
      }

      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        window.setTimeout(applyVoiceAndSpeak, 0)
      } else {
        let started = false
        const onVoices = () => startOnce()
        const startOnce = () => {
          if (started || hasFinishedSpeech || speakGenRef.current !== gen) return
          started = true
          window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
          window.setTimeout(applyVoiceAndSpeak, 0)
        }
        window.speechSynthesis.addEventListener('voiceschanged', onVoices)
        window.setTimeout(startOnce, 500)
      }
    }

    const playOpenAiSpeech = async () => {
      try {
        const payload = {
          text,
          style: speechStyle,
          targetDurationMs,
          language: speechLanguage,
          avatarMode: speechAvatarMode,
        }
        if (speechApiKey) payload.apiKey = speechApiKey

        let blob = null
        let lastSpeechError = null
        for (const endpoint of SPEECH_ENDPOINTS) {
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            })
            const contentType = response.headers.get('content-type') || ''
            if (!response.ok || !contentType.toLowerCase().includes('audio/')) {
              const errorText = await response.text().catch(() => '')
              throw new Error(errorText || `Speech endpoint failed: ${endpoint}`)
            }
            blob = await response.blob()
            break
          } catch (endpointError) {
            lastSpeechError = endpointError
          }
        }

        if (!blob) throw lastSpeechError || new Error('OpenAI speech request failed')
        if (speakGenRef.current !== gen) return

        const audioUrl = URL.createObjectURL(blob)
        const audio = new Audio(audioUrl)
        setupSpeechAnalyser(audio)
        speechAudioRef.current = audio
        speechAudioUrlRef.current = audioUrl

        audio.onloadedmetadata = () => {
          const audioDurationMs = getAudioDurationMs(audio)
          if (audioDurationMs > 0) syncVisemeTimeline(audioDurationMs, true)
        }
        audio.onplay = () => {
          startPulse(audio.currentTime * 1000)
        }
        audio.onplaying = () => {
          const audioDurationMs = getAudioDurationMs(audio)
          if (audioDurationMs > 0) {
            syncVisemeTimeline(audioDurationMs, true)
            armSpeechTimer(audioDurationMs + 2000)
          }
          startPulse(audio.currentTime * 1000)
        }
        audio.onended = finishSpeech
        audio.onerror = () => {
          if (hasFinishedSpeech || speakGenRef.current !== gen) return
          if (speechTimeout) {
            window.clearTimeout(speechTimeout)
            speechTimeout = null
          }
          speechAudioRef.current = null
          if (speechAudioUrlRef.current) {
            URL.revokeObjectURL(speechAudioUrlRef.current)
            speechAudioUrlRef.current = null
          }
          playBrowserSpeechFallback()
        }
        armSpeechTimer(estimatedDuration + 15000)
        await audio.play()
        if (!pulseStarted && !hasFinishedSpeech && speakGenRef.current === gen) {
          startPulse(audio.currentTime * 1000)
        }
      } catch (error) {
        console.error('OpenAI speech error:', error)
        playBrowserSpeechFallback()
      }
    }

    const shouldUseBrowserOnly = isMimicSpeech && speechAvatarMode !== 'male'

    if (shouldUseBrowserOnly) {
      playBrowserSpeechFallback()
    } else {
      playOpenAiSpeech()
    }
  }, [avatarMode, cleanupSpeechAnalyser, languageMode])

  const queueGreetingSpeech = useCallback((greetingRequest) => {
    if (!greetingRequest?.text) return

    clearGreetingSpeakTimer()
    visemeTimelineRef.current = null
    visemeCurrentRef.current = SILENCE_VISEME_STATE
    setAvatarAction('idle')

    const queuedText = greetingRequest.text
    const queuedLanguageMode = greetingRequest.languageMode
    const queuedAvatarMode = greetingRequest.avatarMode

    greetingSpeakTimerRef.current = window.setTimeout(() => {
      greetingSpeakTimerRef.current = null
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (queuedAvatarMode !== avatarMode) return
          speak(queuedText, false, {
            language: queuedLanguageMode,
            avatarMode: queuedAvatarMode,
          })
        })
      })
    }, 650)
  }, [avatarMode, clearGreetingSpeakTimer, speak])

  // Greeting plays only after user clicks (to unlock audio) and avatar is loaded.
  useEffect(() => {
    if (!avatarLoaded || !userInteracted || hasPlayedGreeting.current) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      hasPlayedGreeting.current = true
      const greetingRequest = {
        text: activeLanguage.greeting,
        languageMode,
        avatarMode,
      }
      setMessages([{ text: greetingRequest.text, role: 'model' }])
      queueGreetingSpeech(greetingRequest)
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [avatarLoaded, userInteracted, queueGreetingSpeech, activeLanguage.greeting, languageMode, avatarMode])

  useEffect(() => {
    if (!avatarLoaded || !userInteracted) return

    const pendingGreeting = pendingStarterGreetingRef.current
    if (!pendingGreeting || pendingGreeting.avatarMode !== avatarMode) return

    pendingStarterGreetingRef.current = null
    queueGreetingSpeech(pendingGreeting)
  }, [avatarLoaded, userInteracted, avatarMode, queueGreetingSpeech])

  // Process sending a message
  const handleSend = async (text = inputText) => {
    if (!text.trim()) return

    const userMessage = { text, role: 'user' }
    setMessages(prev => [...prev, userMessage])
    setInputText('')

    // Check for hardcoded trigger words in the mic/text stream FIRST
    const isDancing = text.toLowerCase().includes('dance')
    if (isDancing) {
      setAvatarAction('dance')
    } else {
      setAvatarAction('idle')
    }

    // Call the local OpenAI chat endpoint
    const responseText = await chatWithCompanion(text, messages, languageMode, avatarMode)
    
    setMessages(prev => [...prev, { text: responseText, role: 'model' }])
    
    // Speak and animate. We pass the isDancing flag to prevent TTS from overwriting the dance!
    speak(responseText, isDancing, { language: languageMode, avatarMode })

    if (isDancing) {
       // Reset back to idle after 8 seconds of dancing
       setTimeout(() => setAvatarAction('idle'), 8000)
    }
  }

  const transcribeAudio = async (audioBlob) => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': audioBlob.type || 'audio/webm',
      },
      body: audioBlob,
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Transcription failed')
    }

    return String(data.text || '').trim()
  }

  const handleMimic = (text, options = {}) => {
    const mimicText = text.trim()
    if (!mimicText) return

    setMessages(prev => [
      ...prev,
      { text: mimicText, role: 'user' },
      { text: mimicText, role: 'model' },
    ])
    setInputText('')
    setAvatarAction('talk')
    const restartAfterSpeech = options.restartAfterSpeech === true
    speak(mimicText, false, {
      style: 'mimic',
      targetDurationMs: options.targetDurationMs,
      mimicRate: options.mimicRate,
      language: detectTextLanguage(mimicText, languageMode),
      avatarMode,
      onComplete: restartAfterSpeech
        ? () => {
            if (mimicAutoRestartRef.current) restartMimicListening(180)
          }
        : undefined,
    })
  }

  const handleReadText = (text = inputText) => {
    const rawText = text.trim()
    if (!rawText) return

    const detectedLanguage = detectTextLanguage(rawText, languageMode)
    const readableText = prepareReadableText(rawText)
    const targetDurationMs = estimateReadDurationMs(readableText)

    setMessages(prev => [
      ...prev,
      { text: rawText, role: 'user' },
      { text: rawText, role: 'model' },
    ])
    setInputText('')
    setAvatarAction('talk')
    speak(readableText, false, {
      style: 'read',
      language: detectedLanguage,
      avatarMode,
      targetDurationMs,
    })
  }

  const handleTextSubmit = async (text = inputText) => {
    if (isMimicMode) {
      handleReadText(text)
      return
    }

    await handleSend(text)
  }

  const showVoiceUnavailable = () => {
    const unavailableText = activeLanguage.micUnavailable
    setMessages(prev => [...prev, { text: unavailableText, role: 'model' }])
    speak(unavailableText, false, { language: languageMode, avatarMode })
  }

  const handleTranscribedText = async (transcript, options = {}) => {
    const cleanTranscript = transcript.trim()
    if (!cleanTranscript) {
      const retryText = activeLanguage.micRetry
      setMessages(prev => [...prev, { text: retryText, role: 'model' }])
      speak(retryText, false, { language: languageMode, avatarMode })
      return
    }

    setInputText(cleanTranscript)
    if (recordingModeRef.current === 'mimic') {
      handleMimic(cleanTranscript, options)
    } else {
      await handleSend(cleanTranscript)
    }
  }

  const clearMimicFlushTimer = () => {
    if (mimicFlushTimerRef.current) {
      window.clearTimeout(mimicFlushTimerRef.current)
      mimicFlushTimerRef.current = null
    }
  }

  const clearMimicRestartTimer = () => {
    if (mimicRestartTimerRef.current) {
      window.clearTimeout(mimicRestartTimerRef.current)
      mimicRestartTimerRef.current = null
    }
  }

  const restartMimicListening = (delayMs = 700) => {
    clearMimicRestartTimer()
    mimicRestartTimerRef.current = window.setTimeout(() => {
      mimicRestartTimerRef.current = null
      if (!mimicAutoRestartRef.current || speechRecognitionRef.current || mediaRecorderRef.current) return
      startBrowserSpeechRecognition('mimic')
    }, delayMs)
  }

  const startBrowserSpeechRecognition = (mode = isMimicMode ? 'mimic' : 'chat') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return false

    setUserInteracted(true)
    if (mode === 'mimic') mimicAutoRestartRef.current = true
    recordingModeRef.current = mode
    recordingStartedAtRef.current = performance.now()
    voiceStartedAtRef.current = recordingStartedAtRef.current
    lastVoiceAtRef.current = recordingStartedAtRef.current
    clearMimicFlushTimer()

    const recognition = new SpeechRecognition()
    speechRecognitionRef.current = recognition
    recognition.lang = activeLanguage.locale
    recognition.interimResults = false
    recognition.continuous = false
    recognition.maxAlternatives = 1

    let finalChunk = ''
    let chunkStartedAt = recordingStartedAtRef.current
    let phraseEndedAt = 0
    let hasPendingMimicSpeech = false
    let hasFlushedMimicSpeech = false

    const flushMimicChunk = async () => {
      if (hasFlushedMimicSpeech) return
      const text = finalChunk.trim()
      finalChunk = ''
      if (!text) return
      hasFlushedMimicSpeech = true

      const measuredEndMs = phraseEndedAt || performance.now()
      const measuredDurationMs = Math.max(0, measuredEndMs - chunkStartedAt)
      const { compactLength, wordCount, naturalDurationMs } = getMimicSpeechStats(text)
      const minimumHeardDurationMs = Math.max(620, compactLength * 34, wordCount * 210)
      const heardDurationMs = Math.max(minimumHeardDurationMs, measuredDurationMs + 160)
      const rawRate = clampNumber(naturalDurationMs / Math.max(620, heardDurationMs), 0.68, 1.04)
      const previousRate = mimicRateRef.current || 0.92
      const confidence = wordCount >= 5 || compactLength >= 24
        ? 0.45
        : wordCount >= 3 || compactLength >= 14
          ? 0.34
          : 0.18
      const maxRateStep = wordCount >= 4 || compactLength >= 20 ? 0.11 : 0.06
      const blendedRate = previousRate + (rawRate - previousRate) * confidence
      const mimicRate = clampNumber(
        clampNumber(blendedRate, previousRate - maxRateStep, previousRate + maxRateStep),
        0.72,
        1.0,
      )
      const spokenDurationMs = Math.max(900, naturalDurationMs / mimicRate)
      chunkStartedAt = performance.now()
      hasPendingMimicSpeech = false
      mimicRateRef.current = mimicRate
      if (speechRecognitionRef.current === recognition) {
        try {
          recognition.stop()
        } catch {
          /* ignore */
        }
      }
      await handleTranscribedText(text, {
        targetDurationMs: spokenDurationMs,
        mimicRate,
        restartAfterSpeech: mode === 'mimic',
      })
    }

    recognition.onstart = () => setIsListening(true)
    recognition.onspeechstart = () => {
      if (mode !== 'mimic') return
      chunkStartedAt = performance.now()
      phraseEndedAt = 0
      hasPendingMimicSpeech = true
      hasFlushedMimicSpeech = false
    }
    recognition.onspeechend = () => {
      if (mode !== 'mimic') return
      phraseEndedAt = performance.now()
      try {
        recognition.stop()
      } catch {
        /* ignore */
      }
    }
    recognition.onend = () => {
      clearMimicFlushTimer()
      if (mode === 'mimic' && finalChunk.trim()) void flushMimicChunk()
      speechRecognitionRef.current = null
      setIsListening(false)
    }
    recognition.onerror = (event) => {
      clearMimicFlushTimer()
      speechRecognitionRef.current = null
      setIsListening(false)
      if (event?.error === 'no-speech' && mode === 'mimic' && mimicAutoRestartRef.current) {
        restartMimicListening(350)
      } else if (event?.error !== 'no-speech') {
        showVoiceUnavailable()
      }
    }
    recognition.onresult = async (event) => {
      let interimText = ''
      let completedText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result[0]?.transcript || ''
        if (result.isFinal) completedText += `${transcript} `
        else interimText += `${transcript} `
      }

      if (mode === 'mimic') {
        const heardText = `${completedText} ${interimText}`.trim()
        if (heardText && !hasPendingMimicSpeech) {
          chunkStartedAt = performance.now()
          phraseEndedAt = 0
          hasPendingMimicSpeech = true
        }
        finalChunk = `${finalChunk} ${completedText}`.trim()

        const previewText = `${finalChunk} ${interimText}`.trim()
        if (previewText) setInputText(previewText)

        if (completedText.trim()) {
          clearMimicFlushTimer()
          mimicFlushTimerRef.current = window.setTimeout(flushMimicChunk, 220)
        }
        return
      }

      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
      const targetDurationMs = Math.max(900, performance.now() - recordingStartedAtRef.current)
      await handleTranscribedText(transcript, { targetDurationMs })
    }

    try {
      recognition.start()
      return true
    } catch (error) {
      console.error('Speech recognition start error:', error)
      speechRecognitionRef.current = null
      setIsListening(false)
      return false
    }
  }

  useEffect(() => {
    return () => {
      mimicAutoRestartRef.current = false
      clearMimicFlushTimer()
      clearMimicRestartTimer()
      try {
        speechRecognitionRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const stopVolumeMonitor = () => {
    if (silenceMonitorRef.current) {
      window.clearInterval(silenceMonitorRef.current)
      silenceMonitorRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }

  const startVolumeMonitor = (stream, recorder) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    try {
      const audioContext = new AudioContextClass()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      const samples = new Uint8Array(analyser.fftSize)
      analyser.fftSize = 2048
      source.connect(analyser)
      audioContextRef.current = audioContext

      silenceMonitorRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples)
        let sum = 0
        for (const sample of samples) {
          const centered = (sample - 128) / 128
          sum += centered * centered
        }

        const volume = Math.sqrt(sum / samples.length)
        const now = performance.now()
        if (volume > 0.035) {
          if (!voiceStartedAtRef.current) voiceStartedAtRef.current = now
          lastVoiceAtRef.current = now
        }

        if (
          recordingModeRef.current === 'mimic' &&
          voiceStartedAtRef.current &&
          now - lastVoiceAtRef.current > 850 &&
          now - recordingStartedAtRef.current > 1200 &&
          recorder.state === 'recording'
        ) {
          recorder.stop()
        }
      }, 100)
    } catch {
      stopVolumeMonitor()
    }
  }

  // Mic recording + OpenAI transcription
  const toggleListen = async () => {
    if (isListening) {
      mimicAutoRestartRef.current = false
      clearMimicFlushTimer()
      clearMimicRestartTimer()
      const recorder = mediaRecorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.stop()
      }
      const recognition = speechRecognitionRef.current
      if (recognition) {
        recognition.stop()
        speechRecognitionRef.current = null
      }
      setIsListening(false)
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if ((import.meta.env.PROD || isMimicMode) && startBrowserSpeechRecognition(isMimicMode ? 'mimic' : 'chat')) {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (SpeechRecognition && startBrowserSpeechRecognition(isMimicMode ? 'mimic' : 'chat')) {
        return
      }

      if (inputText.trim()) {
        await handleTextSubmit(inputText)
      } else {
        showVoiceUnavailable()
      }
      return
    }

    try {
      setUserInteracted(true)
      recordingModeRef.current = isMimicMode ? 'mimic' : 'chat'
      mimicAutoRestartRef.current = false
      recordingStartedAtRef.current = performance.now()
      voiceStartedAtRef.current = 0
      lastVoiceAtRef.current = 0

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const preferredMimeType = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported?.('audio/webm')
          ? 'audio/webm'
          : ''
      const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined)

      mediaRecorderRef.current = recorder
      recordedChunksRef.current = []
      startVolumeMonitor(stream, recorder)

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordedChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        if (recordingStopTimerRef.current) {
          window.clearTimeout(recordingStopTimerRef.current)
          recordingStopTimerRef.current = null
        }

        stopVolumeMonitor()
        setIsListening(false)
        stream.getTracks().forEach((track) => track.stop())

        const audioBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        recordedChunksRef.current = []
        mediaRecorderRef.current = null

        if (!audioBlob.size) return

        try {
          const transcript = await transcribeAudio(audioBlob)
          const spokenDurationMs = voiceStartedAtRef.current && lastVoiceAtRef.current
            ? Math.max(700, lastVoiceAtRef.current - voiceStartedAtRef.current + 350)
            : Math.max(900, performance.now() - recordingStartedAtRef.current)
          await handleTranscribedText(transcript, { targetDurationMs: spokenDurationMs })
        } catch (error) {
          console.error('Mic transcription error:', error)
          const errorText = activeLanguage.micError
          setMessages(prev => [...prev, { text: errorText, role: 'model' }])
          speak(errorText, false, { language: languageMode, avatarMode })
        }
      }

      recorder.start()
      setIsListening(true)
      recordingStopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop()
      }, recordingModeRef.current === 'mimic' ? 5000 : 15000)
    } catch (error) {
      console.error('Mic start error:', error)
      stopVolumeMonitor()
      setIsListening(false)
      if (inputText.trim()) {
        await handleTextSubmit(inputText)
      } else {
        showVoiceUnavailable()
      }
    }
  }

  // Get only the latest model message for subtitle display
  const lastModelMsg = [...messages].reverse().find(m => m.role === 'model')

  const toggleDanceMode = () => {
    setAvatarAction(prev => (prev === 'dance' ? 'idle' : 'dance'))
  }

  const updateStarterGreeting = (nextLanguageMode = languageMode, nextAvatarMode = avatarMode) => {
    if (!userInteracted) return

    const nextGreeting = getLanguageCopy(nextLanguageMode, nextAvatarMode).greeting
    const greetingRequest = {
      text: nextGreeting,
      languageMode: nextLanguageMode,
      avatarMode: nextAvatarMode,
    }

    hasPlayedGreeting.current = true
    setMessages(prev => (
      prev.some((message) => message.role === 'user')
        ? [...prev, { text: nextGreeting, role: 'model' }]
        : [{ text: nextGreeting, role: 'model' }]
    ))

    if (!avatarLoaded || nextAvatarMode !== avatarMode) {
      pendingStarterGreetingRef.current = greetingRequest
      return
    }

    pendingStarterGreetingRef.current = null
    queueGreetingSpeech(greetingRequest)
  }

  const toggleLanguageMode = () => {
    const nextLanguageMode = languageMode === 'hi' ? 'en' : 'hi'
    setLanguageMode(nextLanguageMode)
    updateStarterGreeting(nextLanguageMode, avatarMode)
  }

  const handleAvatarModeChange = (nextAvatarMode) => {
    if (nextAvatarMode === avatarMode) return
    stopActiveSpeech()
    setAvatarLoaded(false)
    visemeCurrentRef.current = SILENCE_VISEME_STATE
    setAvatarMode(nextAvatarMode)
    updateStarterGreeting(languageMode, nextAvatarMode)
  }

  const toggleMimicMode = () => {
    if (isListening) return

    clearMimicFlushTimer()
    clearMimicRestartTimer()
    setIsMimicMode(prev => {
      const next = !prev
      mimicAutoRestartRef.current = next
      if (next) mimicRateRef.current = 0.92
      return next
    })
  }

  return (
    <div
      className={`companion-root relative w-full h-[100dvh] overflow-hidden ${cursorMode === 'butterfly' ? 'butterfly-cursor-active' : ''}`}
      onPointerMove={moveButterflyCursor}
      onPointerEnter={moveButterflyCursor}
    >
      {cursorMode === 'butterfly' && <ButterflyCursor cursorRef={butterflyCursorRef} />}
      {/* ── Premium Background Layer Rendering ── */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none transition-colors duration-500">
        {bgMode === 'default' && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950" />
        )}
        
        {bgMode === 'solid' && (
          <div className="absolute inset-0 transition-colors duration-500" style={{ backgroundColor: solidColor }} />
        )}
        
        {bgMode === 'splashes' && (
          <div className="absolute inset-0 bg-slate-950 overflow-hidden">
            <div className="absolute top-[10%] left-[5%] w-[45rem] h-[45rem] rounded-full bg-purple-600/10 blur-[130px] animate-float-1" />
            <div className="absolute bottom-[10%] right-[5%] w-[55rem] h-[55rem] rounded-full bg-pink-600/10 blur-[150px] animate-float-2" />
            <div className="absolute top-[40%] right-[25%] w-[35rem] h-[35rem] rounded-full bg-cyan-600/10 blur-[120px] animate-float-3" />
          </div>
        )}
        
        {bgMode === 'gradual' && (
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 animate-gradient" style={{ backgroundSize: '300% 300%' }} />
        )}
        
        {bgMode === 'wallpaper' && (
          <div 
            className="absolute inset-0 bg-cover bg-center transition-all duration-500" 
            style={{ backgroundImage: `url(${customWallpaper || wallpaperUrl})` }}
          >
            {/* Elegant overlay to maintain contrast with the 3D character */}
            <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[1px]" />
          </div>
        )}

        {bgMode === 'marquee_text' && (
          <div className="marquee-background" aria-hidden="true">
            <div className="marquee-background__room" />
            <div className="marquee-background__floor" />
            <div className="marquee-background__wash" />
            {MARQUEE_ROWS.map((row) => (
              <div
                key={row.id}
                className={`marquee-background__row ${row.reverse ? 'is-reverse' : ''}`}
                style={{
                  top: row.top,
                  '--marquee-duration': row.duration,
                  '--marquee-delay': row.delay,
                  '--marquee-scale': row.scale,
                  '--marquee-opacity': row.opacity,
                }}
              >
                <div className="marquee-background__track">
                  {[0, 1].map((groupIndex) => (
                    <div key={groupIndex} className="marquee-background__group">
                      {MARQUEE_WORDS.map((word) => (
                        <span key={`${row.id}-${groupIndex}-${word}`}>{word}</span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click-to-start overlay — required to unlock browser audio */}
      {!userInteracted && (
        <div
          onClick={handleStartClick}
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm cursor-pointer"
        >
          <div className="text-center animate-pulse">
            <p className="text-4xl mb-4">👋</p>
            <p className="text-lg text-white font-medium">Click anywhere to start</p>
            <p className="text-sm text-slate-400 mt-1">Your AI teacher is ready to meet you</p>
          </div>
        </div>
      )}

      {/* Floating Mode Selection Trigger Button */}
      {userInteracted && (
        <div className="absolute top-3 left-3 z-20">
          <button
            onClick={() => setShowBgSelector(!showBgSelector)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/90 bg-slate-900/80 border border-slate-700/40 hover:bg-slate-800/90 active:scale-95 transition-all shadow-lg backdrop-blur-md pointer-events-auto"
          >
            <span>⚙️</span> Mode Selection
          </button>
        </div>
      )}

      {/* Floating Mode Selection Panel */}
      {showBgSelector && userInteracted && (
        <div className="absolute top-14 left-3 z-30 w-80 rounded-xl border border-slate-700/50 bg-slate-950/90 backdrop-blur-md p-4 text-white shadow-2xl animate-fade-in pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Mode Selection</h3>
            <button 
              onClick={() => setShowBgSelector(false)}
              className="text-slate-400 hover:text-white text-xs transition-colors"
            >
              ✕
            </button>
          </div>
          
          {/* Mode Selector Row */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-[10px]">
            {[
              { id: 'default', label: 'Default', icon: '🌌' },
              { id: 'solid', label: 'Solid', icon: '🎨' },
              { id: 'splashes', label: 'Splashes', icon: '✨' },
              { id: 'gradual', label: 'Flow', icon: '🌈' },
              { id: 'wallpaper', label: 'Wall', icon: '🏠' },
              { id: 'sitting_room', label: '3D Room', icon: '🖥️' },
              { id: 'marquee_text', label: 'Nipun', icon: '🔠' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setBgMode(mode.id)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                  bgMode === mode.id 
                    ? 'bg-purple-600/30 border-purple-500/80 text-white font-medium shadow-md shadow-purple-500/10' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="text-base">{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            ))}
          </div>

          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Avatar Mode</span>
              <button
                type="button"
                onClick={toggleDanceMode}
                aria-pressed={avatarAction === 'dance'}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  avatarAction === 'dance'
                    ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>💃</span>
                <span>{avatarAction === 'dance' ? 'Dancing' : 'Dance mode'}</span>
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Character</span>
              <div className="flex rounded-full bg-slate-800 p-0.5">
                {[
                  { id: 'female', label: 'Female', icon: '♀' },
                  { id: 'male', label: 'Male', icon: '♂' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleAvatarModeChange(mode.id)}
                    aria-pressed={avatarMode === mode.id}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      avatarMode === mode.id
                        ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>{mode.icon}</span>
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cursor Mode</span>
              <div className="flex rounded-full bg-slate-800 p-0.5">
                {[
                  { id: 'butterfly', label: 'Butterfly' },
                  { id: 'system', label: 'Normal' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setCursorMode(mode.id)}
                    aria-pressed={cursorMode === mode.id}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                      cursorMode === mode.id
                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/45 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Lighting Mode</span>
              <span className="text-[10px] font-medium text-slate-500">
                {LIGHTING_MODES.find((mode) => mode.id === lightingMode)?.label}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {LIGHTING_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setLightingMode(mode.id)}
                  aria-pressed={lightingMode === mode.id}
                  title={`${mode.label} lighting`}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-1.5 text-[9px] font-semibold transition-all ${
                    lightingMode === mode.id
                      ? 'border-amber-300/80 bg-amber-400/20 text-white shadow-lg shadow-amber-400/10'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  }`}
                >
                  <span className="text-sm leading-none">{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Explicit API Key Settings Sub-Panel */}
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/45 p-2 space-y-2 animate-slide-up">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block text-left">Explicit API Credentials</span>
            <div className="flex gap-1.5">
              <input
                type="password"
                placeholder="Paste Gemini or OpenAI API key..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="flex-1 bg-slate-950/70 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-white focus:outline-none focus:border-purple-500 placeholder-slate-600"
              />
              <button
                onClick={() => {
                  const cleanedKey = apiKeyInput.trim()

                  if (!cleanedKey) {
                    localStorage.removeItem(API_KEY_STORAGE_KEY)
                    localStorage.removeItem(LEGACY_GEMINI_KEY_STORAGE_KEY)
                    alert("API key cleared.")
                    return
                  }

                  localStorage.setItem(API_KEY_STORAGE_KEY, cleanedKey)
                  if (!/^sk-[A-Za-z0-9_-]+/.test(cleanedKey)) {
                    localStorage.setItem(LEGACY_GEMINI_KEY_STORAGE_KEY, cleanedKey)
                    alert("Gemini API key saved. Static replies will use Gemini directly.")
                    return
                  }

                  alert("OpenAI API key saved. Upload the rebuilt dist with api/chat.php so the domain can use it.")
                }}
                className="px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded text-[11px] font-bold text-white transition-all hover:scale-[1.02] active:scale-95 shrink-0"
              >
                Save
              </button>
            </div>
            <p className="text-[9px] text-slate-500 leading-normal text-left">
              Gemini keys run directly in the browser. OpenAI sk- keys use the uploaded <code className="text-purple-400 font-mono">api/chat.php</code> backend. Link keys: <code className="text-purple-400 font-mono">?gemini_key=</code> or <code className="text-purple-400 font-mono">?openai_key=</code>.
            </p>
          </div>

          {/* Solid Color Controller Sub-Panel */}
          {bgMode === 'solid' && (
            <div className="space-y-2.5 animate-slide-up">
              <label className="text-[11px] text-slate-400 font-medium block">Choose solid color:</label>
              
              {/* Presets Grid */}
              <div className="grid grid-cols-6 gap-2">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSolidColor(color)}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full border transition-all hover:scale-110 active:scale-95 ${
                      solidColor === color ? 'border-white scale-105 shadow-md' : 'border-slate-700/60'
                    }`}
                    title={color}
                  />
                ))}
                {/* Custom Color Input */}
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-slate-700 hover:scale-110 transition-all flex items-center justify-center bg-slate-900">
                  <span className="text-xs pointer-events-none z-10">➕</span>
                  <input
                    type="color"
                    value={solidColor}
                    onChange={(e) => setSolidColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                    title="Custom Color"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Wallpaper Controller Sub-Panel */}
          {bgMode === 'wallpaper' && (
            <div className="space-y-3 animate-slide-up">
              <label className="text-[11px] text-slate-400 font-medium block">Choose preset wall style:</label>
              
              {/* Presets Grid */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                {WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => {
                      setWallpaperUrl(preset.url)
                      setCustomWallpaper(null)
                    }}
                    className={`relative h-14 rounded-lg overflow-hidden border transition-all flex items-end p-1 hover:scale-[1.02] ${
                      !customWallpaper && wallpaperUrl === preset.url 
                        ? 'border-purple-500 ring-1 ring-purple-500/50 scale-[1.01]' 
                        : 'border-slate-800'
                    }`}
                  >
                    <img src={preset.url} alt={preset.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    <span className="relative z-10 font-medium text-white bg-slate-950/80 px-1 py-0.5 rounded text-[8px] truncate max-w-full">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Upload Custom Input */}
              <div className="border-t border-slate-900 pt-2.5">
                <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Or upload custom wallpaper:</label>
                <div className="relative flex items-center justify-center border border-dashed border-slate-700 hover:border-purple-500/50 rounded-lg p-2 bg-slate-900/40 cursor-pointer transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                          if (event.target?.result) {
                            setCustomWallpaper(event.target.result)
                          }
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="text-center text-[10px] text-slate-400">
                    <span>📤 Upload Image File</span>
                  </div>
                </div>
                {customWallpaper && (
                  <div className="flex items-center justify-between text-[9px] text-slate-400 bg-slate-900/60 p-1 rounded mt-2">
                    <span className="truncate max-w-[150px]">Custom wallpaper loaded</span>
                    <button 
                      onClick={() => setCustomWallpaper(null)} 
                      className="text-red-400 hover:text-red-300 font-bold px-1"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Flowing Splashes / Gradual Details */}
          {(bgMode === 'default' || bgMode === 'splashes' || bgMode === 'gradual' || bgMode === 'sitting_room' || bgMode === 'marquee_text') && (
            <div className="text-[10px] text-slate-500 bg-slate-900/30 p-2 rounded border border-slate-900/50 text-center animate-slide-up">
              {bgMode === 'default' && 'Premium deep slate space background with floor shadows.'}
              {bgMode === 'splashes' && 'Gorgeous animated background with slow glowing color splashes.'}
              {bgMode === 'gradual' && 'Calm color gradients gradually flowing over time.'}
              {bgMode === 'sitting_room' && 'Full 3D technological classroom with wood desk, mesh chair, and glowing computer setup.'}
              {bgMode === 'marquee_text' && 'NIPUN text rows moving at mixed speeds.'}
            </div>
          )}
        </div>
      )}

      {/* 3D Canvas Background */}
      <Suspense fallback={<div className="absolute inset-0 z-0 flex items-center justify-center text-purple-400 bg-slate-900">Loading AI Companion...</div>}>
        <AvatarCanvas
          action={avatarAction}
          avatarMode={avatarMode}
          bgMode={bgMode}
          lightingMode={lightingMode}
          onAvatarLoaded={onAvatarLoaded}
          visemeCurrentRef={visemeCurrentRef}
        />
      </Suspense>

      {/* Minimal subtitle — only latest message, small text, doesn't block character */}
      {lastModelMsg && (
        <div className="absolute bottom-20 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
          <p className="text-xs text-slate-300/80 bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full max-w-md text-center truncate">
            {lastModelMsg.text}
          </p>
        </div>
      )}

      {/* Compact input bar — slim and unobtrusive */}
      <div className="absolute bottom-3 inset-x-0 z-10 flex justify-center px-4 pointer-events-none">
        <div className="bg-slate-900/60 backdrop-blur-md p-1 flex gap-1 rounded-full shadow-lg pointer-events-auto max-w-lg w-full border border-slate-700/30">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            placeholder={isMimicMode ? (isListening ? activeLanguage.mimicListening : activeLanguage.mimicPlaceholder) : activeLanguage.placeholder}
            className="min-w-0 flex-1 bg-transparent border-none px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none text-xs"
          />
          <button
            type="button"
            onClick={toggleLanguageMode}
            aria-label={`Switch language mode. Current mode: ${activeLanguage.label}`}
            className="h-8 min-w-9 shrink-0 rounded-full bg-slate-800/80 px-2 text-[11px] font-bold text-cyan-100 transition-all hover:bg-slate-700"
            title={`Mode: ${activeLanguage.label}`}
          >
            {activeLanguage.code}
          </button>
          <button 
            onClick={() => handleTextSubmit()}
            className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium transition-all">
            {isMimicMode ? activeLanguage.readButton : activeLanguage.sendButton}
          </button>
          <button
            onClick={toggleMimicMode}
            disabled={isListening}
            aria-pressed={isMimicMode}
            aria-label="Mimic voice mode"
            className={`w-8 h-8 shrink-0 rounded-full text-white transition-all ${isMimicMode ? 'bg-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-700/50 hover:bg-slate-600/50'} ${isListening ? 'opacity-60 cursor-not-allowed' : ''}`}
            title={isMimicMode ? 'Mimic mode on' : 'Mimic voice'}>
            <span className="text-sm">🗣️</span>
          </button>
          <button 
            onClick={toggleListen}
            aria-label={isMimicMode ? 'Record and mimic voice' : 'Record voice'}
            className={`w-8 h-8 shrink-0 rounded-full text-white transition-all ${isListening ? 'bg-red-500 animate-pulse' : isMimicMode ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-700/50 hover:bg-slate-600/50'}`} 
            title={isMimicMode ? 'Listen and repeat' : 'Voice'}>
            <span className="text-sm">{isListening ? '🛑' : '🎙️'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
