import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function openAiChatPlugin() {
  return {
    name: 'local-openai-chat',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''
      const model = env.OPENAI_MODEL || env.VITE_OPENAI_MODEL || 'gpt-5.2'
      const speechModel = env.OPENAI_TTS_MODEL || env.VITE_OPENAI_TTS_MODEL || 'gpt-4o-mini-tts'
      const speechVoice = env.OPENAI_TTS_VOICE || env.VITE_OPENAI_TTS_VOICE || 'coral'
      const mimicSpeechVoice = env.OPENAI_MIMIC_TTS_VOICE || env.VITE_OPENAI_MIMIC_TTS_VOICE || 'shimmer'
      const transcriptionModel =
        env.OPENAI_TRANSCRIBE_MODEL || env.VITE_OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'

      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname
        const isChatRequest = pathname.endsWith('/api/chat')
        const isSpeechRequest = pathname.endsWith('/api/speech')
        const isTranscribeRequest = pathname.endsWith('/api/transcribe')
        if (!isChatRequest && !isSpeechRequest && !isTranscribeRequest) {
          next()
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'OPENAI_API_KEY is missing in .env.local' }))
          return
        }

        let requestLanguage = 'hi'

        try {
          const readBody = (asBuffer = false) =>
            new Promise((resolve, reject) => {
              const chunks = []
              req.on('data', (chunk) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              })
              req.on('end', () => {
                const buffer = Buffer.concat(chunks)
                resolve(asBuffer ? buffer : buffer.toString('utf8'))
              })
              req.on('error', reject)
            })

          if (isTranscribeRequest) {
            const audioBuffer = await readBody(true)
            if (!audioBuffer.length) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Audio is required' }))
              return
            }

            const contentType = req.headers['content-type'] || 'audio/webm'
            const extension = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm'
            const formData = new FormData()
            formData.append('file', new Blob([audioBuffer], { type: contentType }), `voice.${extension}`)
            formData.append('model', transcriptionModel)
            formData.append('prompt', 'Hindi, English, and Hinglish classroom conversation.')

            const openAiTranscriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
              body: formData,
            })

            const data = await openAiTranscriptionResponse.json().catch(() => ({}))
            if (!openAiTranscriptionResponse.ok) {
              const errorMessage = data?.error?.message || 'OpenAI transcription request failed'
              throw new Error(errorMessage)
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ text: data.text || '' }))
            return
          }

          const body = await readBody()
          const payload = JSON.parse(body || '{}')
          const message = String(payload.message || '').trim()
          const speechText = String(payload.text || '').trim()
          const speechStyle = String(payload.style || 'teacher').trim().toLowerCase()
          const targetDurationMs = Number(payload.targetDurationMs || 0)
          requestLanguage = String(payload.language || 'hi').trim().toLowerCase() === 'en' ? 'en' : 'hi'
          const history = Array.isArray(payload.history) ? payload.history.slice(-12) : []

          if (isSpeechRequest) {
            if (!speechText) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Text is required' }))
              return
            }

            const isMimicSpeech = speechStyle === 'mimic'
            const targetSeconds = targetDurationMs > 0
              ? Math.max(0.7, Math.min(12, targetDurationMs / 1000))
              : 0
            const estimatedSeconds = Math.max(0.8, speechText.length * 0.085)
            const mimicSpeed = targetSeconds > 0
              ? Math.max(0.65, Math.min(1.8, estimatedSeconds / targetSeconds))
              : 1.12
            const teacherSpeechInstructions = requestLanguage === 'en'
              ? 'Speak in clear, natural English with a warm teacher-like tone.'
              : 'Speak in clear, natural Hindi with a warm teacher-like tone.'
            const speechInstructions = isMimicSpeech
              ? [
                'Repeat the input text exactly with no extra words.',
                'Use a bright, playful, childlike cartoon voice, like a fun talking-toy repeat.',
                'Keep it clear and friendly, not serious or teacher-like.',
                requestLanguage === 'en' ? 'Use natural English pronunciation.' : 'Use natural Hindi or Hinglish pronunciation when needed.',
                targetSeconds > 0
                  ? `Match the user's speaking pace; aim for about ${targetSeconds.toFixed(1)} seconds total.`
                  : 'Use a quick playful pace.',
              ].join(' ')
              : teacherSpeechInstructions

            const openAiSpeechResponse = await fetch('https://api.openai.com/v1/audio/speech', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: speechModel,
                voice: isMimicSpeech ? mimicSpeechVoice : speechVoice,
                input: speechText.slice(0, 4000),
                instructions: speechInstructions,
                response_format: 'mp3',
                speed: isMimicSpeech ? mimicSpeed : 1,
              }),
            })

            if (!openAiSpeechResponse.ok) {
              const errorText = await openAiSpeechResponse.text().catch(() => '')
              throw new Error(errorText || 'OpenAI speech request failed')
            }

            const audioBuffer = Buffer.from(await openAiSpeechResponse.arrayBuffer())
            res.statusCode = 200
            res.setHeader('Content-Type', 'audio/mpeg')
            res.setHeader('Cache-Control', 'no-store')
            res.end(audioBuffer)
            return
          }

          if (!message) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Message is required' }))
            return
          }

          const transcript = [
            ...history.map((item) => {
              const speaker = item.role === 'user' ? 'Student' : 'Teacher'
              return `${speaker}: ${String(item.text || '')}`
            }),
            `Student: ${message}`,
            'Teacher:',
          ].join('\n')

          const chatInstructions = requestLanguage === 'en'
            ? 'You are a friendly AI teacher companion. Always respond in natural English. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
            : 'You are a friendly AI teacher companion. Always respond in natural Hindi, using Devanagari script. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'

          const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              instructions: chatInstructions,
              input: transcript,
            }),
          })

          const data = await openAiResponse.json().catch(() => ({}))
          if (!openAiResponse.ok) {
            const errorMessage = data?.error?.message || 'OpenAI request failed'
            throw new Error(errorMessage)
          }

          const text =
            data.output_text ||
            data.output
              ?.flatMap((item) => item.content || [])
              ?.map((content) => content.text)
              ?.filter(Boolean)
              ?.join('\n') ||
            (requestLanguage === 'en'
              ? 'Sorry, I did not get a response yet.'
              : 'माफ़ कीजिए, मुझे अभी जवाब नहीं मिला।')

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ text }))
        } catch (error) {
          server.config.logger.error(`OpenAI local API error: ${error.message}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: requestLanguage === 'en'
              ? 'Sorry, I am having trouble getting a response right now.'
              : 'माफ़ कीजिए, अभी जवाब लाने में दिक्कत आ रही है।',
          }))
        }
      })
    },
  }
}

export default defineConfig({
  base: '/companion/',   // ✅ ADD THIS LINE
  plugins: [
    tailwindcss(),
    react(),
    openAiChatPlugin()
  ],
  optimizeDeps: {
    entries: ['index.html']
  }
})
