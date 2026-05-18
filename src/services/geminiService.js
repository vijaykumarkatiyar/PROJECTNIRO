export async function chatWithCompanion(message, history = [], language = 'hi') {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, history, language }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || 'Chat request failed')
    }

    return data.text || (language === 'en' ? 'Sorry, I did not get a response yet.' : 'माफ़ कीजिए, मुझे अभी जवाब नहीं मिला।')
  } catch (error) {
    console.error('OpenAI chat error:', error)
    return language === 'en'
      ? 'Sorry, I am having trouble getting a response right now. Please try again in a moment.'
      : 'माफ़ कीजिए, अभी जवाब लाने में दिक्कत आ रही है। कृपया थोड़ी देर बाद फिर पूछें।'
  }
}
