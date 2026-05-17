import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { AvatarCanvas } from './components/AvatarCanvas'
import { chatWithCompanion } from './services/geminiService'
import './App.css'

const GREETING_TEXT =
  "Welcome! I am your AI teacher. Feel free to ask me anything!"

const DEMO_LIP_LINE =
  'Hello! This is a demo line — one, two, three — so you can check lip sync and the talk camera.'

const DEMO_FAKE_REPLY =
  'Demo reply: no Gemini call. If you see this subtitle and hear speech, TTS and chat UI are wired up.'

const showDemoPanel =
  import.meta.env.DEV ||
  import.meta.env.VITE_SHOW_DEMO === 'true' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1')

function pickPreferredVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.name.includes('Google') && v.lang.startsWith('en')) ||
    voices.find((v) => v.name.includes('Google')) ||
    voices.find((v) => v.name.includes('Female') || v.name.includes('Zira')) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0] ||
    null
  )
}

function App() {
  const [inputText, setInputText] = useState('')
  const [messages, setMessages] = useState([])
  const [avatarAction, setAvatarAction] = useState('idle')
  const [isListening, setIsListening] = useState(false)
  const [avatarLoaded, setAvatarLoaded] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const chatEndRef = useRef(null)
  const hasPlayedGreeting = useRef(false)
  const speakGenRef = useRef(0)
  const wordEventRef = useRef(0) // timestamp of last spoken word boundary

  // User must click once to unlock browser audio
  const handleStartClick = () => {
    setUserInteracted(true)
    // Unlock speechSynthesis with a silent utterance
    if ('speechSynthesis' in window) {
      const unlock = new SpeechSynthesisUtterance('')
      unlock.volume = 0
      window.speechSynthesis.speak(unlock)
    }
  }

  const onAvatarLoaded = useCallback(() => {
    setAvatarLoaded(true)
  }, [])

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const speak = useCallback((text, isDancing) => {
    const gen = ++speakGenRef.current
    const estimatedDuration = Math.max(3500, text.length * 85)

    const startTalkIfCurrent = () => {
      if (!isDancing && speakGenRef.current === gen) setAvatarAction('talk')
    }
    const endTalkIfCurrent = () => {
      if (!isDancing && speakGenRef.current === gen) setAvatarAction('idle')
    }

    if (!('speechSynthesis' in window)) {
      // No TTS available — start lip sync immediately with timer fallback
      startTalkIfCurrent()
      window.setTimeout(endTalkIfCurrent, estimatedDuration)
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1.1

    // Timer-based word pulse fallback (onboundary is unreliable in most browsers)
    let wordPulseInterval = null

    // Sync lip animation with actual audio start
    utterance.onstart = () => {
      startTalkIfCurrent()
      wordEventRef.current = performance.now()
      // Pulse wordEventRef every ~250ms to keep lips moving throughout speech
      wordPulseInterval = window.setInterval(() => {
        wordEventRef.current = performance.now()
      }, 250)
    }
    // Also use real boundary events when available (overrides the timer pulse)
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        wordEventRef.current = performance.now()
      }
    }
    utterance.onend = () => {
      if (wordPulseInterval) window.clearInterval(wordPulseInterval)
      wordEventRef.current = 0 // signal mouth to close
      endTalkIfCurrent()
    }
    utterance.onerror = () => {
      if (wordPulseInterval) window.clearInterval(wordPulseInterval)
      wordEventRef.current = 0
      endTalkIfCurrent()
    }

    // Chrome needs speak() after cancel on a later task; Safari often needs resume()
    const applyVoiceAndSpeak = () => {
      try {
        window.speechSynthesis.resume()
      } catch {
        /* ignore */
      }
      const voice = pickPreferredVoice()
      if (voice) utterance.voice = voice
      window.speechSynthesis.speak(utterance)
    }

    const runSpeak = () => {
      window.setTimeout(applyVoiceAndSpeak, 0)
    }

    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      runSpeak()
    } else {
      let started = false
      const onVoices = () => startOnce()
      const startOnce = () => {
        if (started) return
        started = true
        window.speechSynthesis.removeEventListener('voiceschanged', onVoices)
        runSpeak()
      }
      window.speechSynthesis.addEventListener('voiceschanged', onVoices)
      window.setTimeout(startOnce, 500)
    }

    // Safety fallback — if onstart never fires (some browsers), start after a short delay
    window.setTimeout(() => {
      if (speakGenRef.current === gen && !isDancing) {
        setAvatarAction((prev) => {
          if (prev === 'idle') {
            wordEventRef.current = performance.now()
            if (!wordPulseInterval) {
              wordPulseInterval = window.setInterval(() => {
                wordEventRef.current = performance.now()
              }, 250)
            }
            return 'talk'
          }
          return prev
        })
      }
    }, 300)

    window.setTimeout(() => {
      if (wordPulseInterval) window.clearInterval(wordPulseInterval)
      wordEventRef.current = 0
      endTalkIfCurrent()
    }, estimatedDuration + 3000)
  }, [])

  // Greeting plays only after user clicks (to unlock audio) and avatar is loaded.
  useEffect(() => {
    if (!avatarLoaded || !userInteracted || hasPlayedGreeting.current) return

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      hasPlayedGreeting.current = true
      setMessages([{ text: GREETING_TEXT, role: 'model' }])
      speak(GREETING_TEXT, false)
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [avatarLoaded, userInteracted, speak])

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

    // Call Gemini
    const responseText = await chatWithCompanion(text, messages)
    
    setMessages(prev => [...prev, { text: responseText, role: 'model' }])
    
    // Speak and animate. We pass the isDancing flag to prevent TTS from overwriting the dance!
    speak(responseText, isDancing)

    if (isDancing) {
       // Reset back to idle after 8 seconds of dancing
       setTimeout(() => setAvatarAction('idle'), 8000)
    }
  }

  // STT
  const toggleListen = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition.")
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInputText(transcript)
      handleSend(transcript)
    }

    recognition.start()
  }

  // Get only the latest model message for subtitle display
  const lastModelMsg = [...messages].reverse().find(m => m.role === 'model')

  const runDemoLipSync = () => {
    setMessages((prev) => [...prev, { text: DEMO_LIP_LINE, role: 'model' }])
    speak(DEMO_LIP_LINE, false)
  }

  const runDemoDance = () => {
    setAvatarAction('dance')
    window.setTimeout(() => setAvatarAction('idle'), 8000)
  }

  const runDemoFakeChat = () => {
    setMessages((prev) => [
      ...prev,
      { text: '[demo] Hello companion', role: 'user' },
      { text: DEMO_FAKE_REPLY, role: 'model' },
    ])
    speak(DEMO_FAKE_REPLY, false)
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden">
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

      {/* 3D Canvas Background */}
      <Suspense fallback={<div className="absolute inset-0 z-0 flex items-center justify-center text-purple-400 bg-slate-900">Loading AI Companion...</div>}>
        <AvatarCanvas
          action={avatarAction}
          onAvatarLoaded={onAvatarLoaded}
          wordEventRef={wordEventRef}
          onDance={() => {
            setAvatarAction('dance')
            setTimeout(() => setAvatarAction('idle'), 8000)
          }}
        />
      </Suspense>

      {showDemoPanel && (
        <div className="absolute top-3 right-3 z-20 pointer-events-auto flex flex-col gap-1.5 rounded-lg border border-slate-600/40 bg-slate-950/85 backdrop-blur-sm p-2 max-w-[11rem] shadow-xl">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 px-0.5">Demo</p>
          <button
            type="button"
            onClick={runDemoLipSync}
            className="rounded-md bg-slate-800/90 px-2 py-1.5 text-left text-[11px] text-slate-100 hover:bg-slate-700/90 transition-colors">
            Lip sync + TTS
          </button>
          <button
            type="button"
            onClick={runDemoDance}
            className="rounded-md bg-slate-800/90 px-2 py-1.5 text-left text-[11px] text-slate-100 hover:bg-slate-700/90 transition-colors">
            Dance 8s
          </button>
          <button
            type="button"
            onClick={runDemoFakeChat}
            className="rounded-md bg-slate-800/90 px-2 py-1.5 text-left text-[11px] text-slate-100 hover:bg-slate-700/90 transition-colors">
            Fake chat reply
          </button>
          <p className="text-[9px] leading-tight text-slate-500 px-0.5">
            Prod: add <span className="text-slate-400">?demo=1</span> or{' '}
            <span className="text-slate-400">VITE_SHOW_DEMO=true</span>
          </p>
        </div>
      )}

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
        <div className="bg-slate-900/60 backdrop-blur-md p-1 flex gap-1 rounded-full shadow-lg pointer-events-auto max-w-sm w-full border border-slate-700/30">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Say something..." 
            className="flex-1 bg-transparent border-none px-3 py-1.5 text-white placeholder-slate-500 focus:outline-none text-xs"
          />
          <button 
            onClick={() => handleSend()}
            className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-medium transition-all">
            Send
          </button>
          <button 
            onClick={toggleListen}
            className={`p-1.5 rounded-full text-white transition-all ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-700/50 hover:bg-slate-600/50'}`} 
            title="Voice">
            <span className="text-sm">{isListening ? '🛑' : '🎙️'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
