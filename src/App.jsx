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

  // ── Custom Background States & Presets ──
  const [bgMode, setBgMode] = useState('default') // 'default' | 'solid' | 'splashes' | 'gradual' | 'wallpaper'
  const [solidColor, setSolidColor] = useState('#0f172a')
  const [wallpaperUrl, setWallpaperUrl] = useState('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1200')
  const [customWallpaper, setCustomWallpaper] = useState(null)
  const [showBgSelector, setShowBgSelector] = useState(false)

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

      {/* Floating Background Selector Trigger Button */}
      {userInteracted && (
        <div className="absolute top-3 left-3 z-20">
          <button
            onClick={() => setShowBgSelector(!showBgSelector)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white/90 bg-slate-900/80 border border-slate-700/40 hover:bg-slate-800/90 active:scale-95 transition-all shadow-lg backdrop-blur-md pointer-events-auto"
          >
            <span>🖼️</span> Background
          </button>
        </div>
      )}

      {/* Floating Background Selection Panel */}
      {showBgSelector && userInteracted && (
        <div className="absolute top-14 left-3 z-30 w-80 rounded-xl border border-slate-700/50 bg-slate-950/90 backdrop-blur-md p-4 text-white shadow-2xl animate-fade-in pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">Customize Background</h3>
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
          {(bgMode === 'default' || bgMode === 'splashes' || bgMode === 'gradual' || bgMode === 'sitting_room') && (
            <div className="text-[10px] text-slate-500 bg-slate-900/30 p-2 rounded border border-slate-900/50 text-center animate-slide-up">
              {bgMode === 'default' && 'Premium deep slate space background with floor shadows.'}
              {bgMode === 'splashes' && 'Gorgeous animated background with slow glowing color splashes.'}
              {bgMode === 'gradual' && 'Calm color gradients gradually flowing over time.'}
              {bgMode === 'sitting_room' && 'Full 3D technological classroom with wood desk, mesh chair, and glowing computer setup.'}
            </div>
          )}
        </div>
      )}

      {/* 3D Canvas Background */}
      <Suspense fallback={<div className="absolute inset-0 z-0 flex items-center justify-center text-purple-400 bg-slate-900">Loading AI Companion...</div>}>
        <AvatarCanvas
          action={avatarAction}
          bgMode={bgMode}
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
