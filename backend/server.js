import 'dotenv/config'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'my-blog backend is running',
    timestamp: new Date().toISOString(),
  })
})

app.post('/chat', async (req, res) => {
  const { message } = req.body

  if (!message) {
    return res.status(400).json({ error: 'message is required' })
  }

  const apiKey = process.env.MINIMAX_API_KEY

  if (!apiKey) {
    console.error('MINIMAX_API_KEY is not set')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M3',
        messages: [
          { role: 'user', content: message },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('MiniMax API error:', response.status, errorText)
      return res.status(500).json({ error: 'AI service error' })
    }

    const data = await response.json()
    console.log('MiniMax response:', JSON.stringify(data, null, 2))
    const answer = data.choices?.[0]?.message?.content || 'No response'

    res.json({ answer })
  } catch (error) {
    console.error('Chat error:', error)
    res.status(500).json({ error: 'Request failed' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})
