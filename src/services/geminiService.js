import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(apiKey)

export async function chatWithCompanion(message, history = []) {
  if (!apiKey) {
    return "Please provide a VITE_GEMINI_API_KEY in your .env file so I can think!"
  }

  try {
    // Using the recommended gemini-1.5-flash for chat interactions
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: "You are a friendly, knowledgeable, and supportive AI teacher. Keep responses conversational, concise (1-3 sentences), and educational. You love helping students learn and explaining concepts in simple terms. You can also dance when asked."
    })
    
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }))

    const chat = model.startChat({
      history: chatHistory
    })

    const result = await chat.sendMessage(message)
    return result.response.text()
  } catch (error) {
    console.error("Gemini Error:", error)
    return "Oops, my brain disconnected. Please check the logs."
  }
}
