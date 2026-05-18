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
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""
    if (!apiKey) {
      throw new Error("VITE_GEMINI_API_KEY is not configured in .env")
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    // Using gemini-1.5-flash which is extremely fast, cost-efficient, and robust
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

    const chatInstructions = language === 'en'
      ? 'You are a friendly AI teacher companion. Always respond in natural English. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
      : 'You are a friendly AI teacher companion. Always respond in natural Hindi, using Devanagari script. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'

    // Map message history to Gemini format (user -> model)
    const formattedHistory = history.map(item => ({
      role: item.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(item.text || '') }],
    }))

    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: chatInstructions,
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
