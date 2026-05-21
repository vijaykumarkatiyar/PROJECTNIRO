const API_KEY_STORAGE_KEY = 'COMPANION_API_KEY'
const LEGACY_GEMINI_KEY_STORAGE_KEY = 'VITE_GEMINI_API_KEY'
const BACKEND_CHAT_ENDPOINTS = [
  `${import.meta.env.BASE_URL}api/chat`,
  `${import.meta.env.BASE_URL}api/chat.php`,
]
const KEY_QUERY_PARAMS = ['openai_key', 'openaiKey', 'gemini_key', 'geminiKey', 'google_key', 'api_key', 'key']
const GEMINI_MODELS = [
  import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((model, index, list) => model && list.indexOf(model) === index)

function isOpenAiKey(apiKey) {
  return /^sk-[A-Za-z0-9_-]+/.test(apiKey)
}

function getSavedApiKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const urlParams = new URLSearchParams(window.location.search)
    const urlKey = KEY_QUERY_PARAMS.map((key) => urlParams.get(key)).find(Boolean)

    if (urlKey) {
      const cleanedKey = urlKey.trim()
      localStorage.setItem(API_KEY_STORAGE_KEY, cleanedKey)
      if (!isOpenAiKey(cleanedKey)) {
        localStorage.setItem(LEGACY_GEMINI_KEY_STORAGE_KEY, cleanedKey)
      }
      return cleanedKey
    }

    return (
      localStorage.getItem(API_KEY_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_GEMINI_KEY_STORAGE_KEY) ||
      ''
    )
  } catch (keyError) {
    console.warn('Unable to read API key from browser storage:', keyError)
    return ''
  }
}

function getFriendlyClientError(language, apiKey, error) {
  const message = String(error?.message || error || '')

  if (isOpenAiKey(apiKey)) {
    return language === 'en'
      ? 'Your OpenAI key is saved, but this page has no working /api/chat backend here. Use the Vite dev server, or upload api/chat.php to PHP hosting.'
      : 'आपकी OpenAI key save है, लेकिन यहाँ /api/chat backend काम नहीं कर रहा। Vite dev server चलाएँ, या PHP hosting पर api/chat.php upload करें।'
  }

  if (!apiKey) {
    return language === 'en'
      ? 'No API key is available. Add a Gemini key in Mode Selection or open this page with ?key=YOUR_GEMINI_KEY.'
      : 'API key उपलब्ध नहीं है। Mode Selection में Gemini key जोड़ें या page को ?key=YOUR_GEMINI_KEY के साथ खोलें।'
  }

  if (/api key not valid|invalid api key|permission denied|unauthorized|forbidden/i.test(message)) {
    return language === 'en'
      ? 'The Gemini key was rejected. Please check that it is a valid Google AI Studio Gemini key and that browser/API restrictions allow this site.'
      : 'Gemini key reject हो गई है। कृपया Google AI Studio की सही Gemini key लगाएँ और browser/API restrictions में इस site को allow करें।'
  }

  if (/referer|referrer|api_key_service_blocked|api key restrictions|requests from this/i.test(message)) {
    return language === 'en'
      ? 'Gemini blocked this website. In Google AI Studio, allow this local/live referrer for the API key, or remove the key restriction.'
      : 'Gemini ने इस website को block किया है। Google AI Studio में इस API key के लिए local/live referrer allow करें, या key restriction हटाएँ।'
  }

  if (/quota|billing|exceeded|resource has been exhausted/i.test(message)) {
    return language === 'en'
      ? 'The Gemini key is working but its quota or billing limit is blocking replies.'
      : 'Gemini key काम कर रही है, लेकिन quota या billing limit replies रोक रही है।'
  }

  if (/failed to fetch|networkerror|load failed|abort/i.test(message)) {
    return language === 'en'
      ? 'The browser could not reach Gemini. Check internet access, ad blockers, and API key website restrictions.'
      : 'Browser Gemini तक नहीं पहुँच पा रहा। Internet, ad blocker और API key website restrictions check करें।'
  }

  return language === 'en'
    ? 'Sorry, I am having trouble getting a response right now. Please try again in a moment.'
    : 'माफ़ कीजिए, अभी जवाब लाने में दिक्कत आ रही है। कृपया थोड़ी देर बाद फिर पूछें।'
}

function normalizeAvatarMode(avatarMode = 'female') {
  return avatarMode === 'male' ? 'male' : 'female'
}

function getCompanionInstructions(language, avatarMode = 'female') {
  const normalizedAvatar = normalizeAvatarMode(avatarMode)
  const isMale = normalizedAvatar === 'male'

  if (language === 'en') {
    return isMale
      ? 'You are speaking as the currently selected male AI teacher companion. The selected language mode is English and it always wins over the language/script used by the student. If the student writes in Hindi, Devanagari, Hinglish, or any other language, still answer only in natural English. Keep your persona, examples, and self-references consistent with a male teacher avatar and male voice. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
      : 'You are speaking as the currently selected female AI teacher companion. The selected language mode is English and it always wins over the language/script used by the student. If the student writes in Hindi, Devanagari, Hinglish, or any other language, still answer only in natural English. Keep your persona, examples, and self-references consistent with a female teacher avatar and female voice. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
  }

  return isMale
    ? 'You are speaking as the currently selected male AI teacher companion. The selected language mode is Hindi and it always wins over the language/script used by the student. If the student writes in English, Latin script, Hinglish, or any other language, still answer only in natural Hindi using Devanagari script. Use masculine self-reference and grammar, such as "मैं आपका AI शिक्षक हूँ" and "मैं समझा रहा हूँ". Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
    : 'You are speaking as the currently selected female AI teacher companion. The selected language mode is Hindi and it always wins over the language/script used by the student. If the student writes in English, Latin script, Hinglish, or any other language, still answer only in natural Hindi using Devanagari script. Use feminine self-reference and grammar, such as "मैं आपकी AI शिक्षिका हूँ" and "मैं समझा रही हूँ". Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
}

async function tryBackendChat(message, history, language, apiKey, avatarMode) {
  const payload = { message, history, language, avatarMode: normalizeAvatarMode(avatarMode) }
  if (isOpenAiKey(apiKey)) {
    payload.apiKey = apiKey
  }

  for (const endpoint of BACKEND_CHAT_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('application/json')) {
        console.warn('Backend chat endpoint unavailable or not JSON, falling back:', {
          endpoint,
          status: response.status,
          contentType,
        })
        continue
      }

      const data = await response.json().catch(() => ({}))
      if (data.text) {
        return data.text
      }
      if (data.error) {
        console.warn('Backend chat endpoint returned an error:', { endpoint, error: data.error })
      }
    } catch (backendError) {
      console.warn('Backend chat endpoint unavailable, falling back:', { endpoint, backendError })
    }
  }

  return null
}

async function fetchJsonWithTimeout(url, options, timeoutMs = 16000) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    const data = await response.json().catch(() => ({}))
    return { response, data }
  } finally {
    window.clearTimeout(timeout)
  }
}

function getGeminiContents(message, history = []) {
  const contents = []
  let hasSeenUser = false

  for (const item of history) {
    const text = String(item.text || '').trim()
    if (!text) continue
    if (item.role === 'user') {
      hasSeenUser = true
    }
    if (hasSeenUser) {
      contents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text }],
      })
    }
  }

  contents.push({
    role: 'user',
    parts: [{ text: message }],
  })

  return contents
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    ?.filter(Boolean)
    ?.join('\n')
    ?.trim() || ''
}

async function tryGeminiChat(message, history, language, apiKey, avatarMode) {
  const chatInstructions = getCompanionInstructions(language, avatarMode)

  const requestBody = {
    systemInstruction: {
      parts: [{ text: chatInstructions }],
    },
    contents: getGeminiContents(message, history),
  }
  const errors = []

  for (const model of GEMINI_MODELS) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

    try {
      const { response, data } = await fetchJsonWithTimeout(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorMessage = data?.error?.message || `Gemini ${model} returned HTTP ${response.status}`
        errors.push(`${model}: ${errorMessage}`)
        if (/api key|permission|referer|referrer|quota|billing|forbidden|unauthorized/i.test(errorMessage)) {
          break
        }
        continue
      }

      const replyText = extractGeminiText(data)
      if (replyText) {
        return replyText
      }

      const blockReason = data?.promptFeedback?.blockReason
      errors.push(`${model}: ${blockReason || 'empty response'}`)
    } catch (error) {
      errors.push(`${model}: ${error?.message || String(error)}`)
    }
  }

  throw new Error(errors.join(' | ') || 'Gemini request failed')
}

export async function chatWithCompanion(message, history = [], language = 'hi', avatarMode = 'female') {
  const apiKey = getSavedApiKey().trim()

  if (!apiKey || isOpenAiKey(apiKey)) {
    const backendText = await tryBackendChat(message, history, language, apiKey, avatarMode)
    if (backendText) {
      return backendText
    }
  }

  try {
    if (!apiKey || isOpenAiKey(apiKey)) {
      return getFriendlyClientError(language, apiKey)
    }

    return await tryGeminiChat(message, history, language, apiKey, avatarMode)
  } catch (clientError) {
    console.error('Direct Gemini browser error:', clientError)
    return getFriendlyClientError(language, apiKey, clientError)
  }
}
