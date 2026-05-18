import { GoogleGenerativeAI } from "@google/generative-ai"

export async function chatWithCompanion(message, history = [], language = 'hi') {
  // 1. Try to call the local dev server backend proxy first (ideal in development)
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history, language }),
    })

    if (response.ok) {
      const data = await response.json().catch(() => ({}))
      if (data.text) {
        return data.text
      }
    }
  } catch (backendError) {
    console.warn('Backend proxy unavailable, falling back to direct client-side Gemini API call:', backendError)
  }

  // 2. Fall back to client-side direct Gemini API call (essential when deployed statically to a website host)
  try {
    // Resolve key from: 1. URL Parameter (?key=) | 2. LocalStorage | 3. Baked-in Env Fallback
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const urlKey = urlParams ? urlParams.get("key") : null
    const localKey = typeof window !== 'undefined' ? localStorage.getItem("VITE_GEMINI_API_KEY") : null
    const apiKey = urlKey || localKey || import.meta.env.VITE_GEMINI_API_KEY || ""

    if (!apiKey) {
      throw new Error("No Gemini API key found. Please provide via URL (?key=...), save in Settings, or configure in .env")
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    // Using gemini-1.5-flash which is extremely fast, cost-efficient, and robust
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const chatInstructions = language === 'en'
      ? 'You are a friendly AI teacher companion. Always respond in natural English. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
      : 'You are a friendly AI teacher companion. Always respond in natural Hindi, using Devanagari script. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'

    // Map message history to Gemini format (user -> model)
    // Note: Gemini's startChat API requires the first history message to be from the 'user'
    const formattedHistory = []
    let hasSeenUser = false
    for (const item of history) {
      if (item.role === 'user') {
        hasSeenUser = true
      }
      if (hasSeenUser) {
        formattedHistory.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: String(item.text || '') }],
        })
      }
    }

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: {
        parts: [{ text: chatInstructions }]
      },
    })

    const result = await chat.sendMessage(message)
    const replyText = result.response.text()

    if (replyText) {
      return replyText
    }

    throw new Error("Empty response from Gemini")
  } catch (clientError) {
    console.error('Direct client-side Gemini error:', clientError)
    return language === 'en'
      ? 'Sorry, I am having trouble getting a response right now. Please try again in a moment.'
      : 'माफ़ कीजिए, अभी जवाब लाने में दिक्कत आ रही है। कृपया थोड़ी देर बाद फिर पूछें।'
  }
}
