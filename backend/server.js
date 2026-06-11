import 'dotenv/config'
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3001

// --- Config -----------------------------------------------------------------

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,https://tangsanyi-blog.onrender.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const UPSTREAM_TIMEOUT_MS = 20_000
const MAX_HISTORY = 20
const MAX_MESSAGE_CHARS = 4_000

// --- CORS middleware --------------------------------------------------------
// Echo a single allowed Origin (never `*`) and set `Vary: Origin` so caches
// don't hand the wrong CORS headers to a different origin. Requests with no
// Origin header (curl, server-to-server) get no CORS headers at all.

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin)
    res.header('Vary', 'Origin')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// Chat messages are short — 8kb is plenty and prevents payload-based DoS.
app.use(express.json({ limit: '8kb' }))

// --- Rate limiter -----------------------------------------------------------
// In-memory; fine for a single-instance Render deploy. If scaling out,
// swap the Map for a shared store (Redis, Upstash, etc.).

function chatRateLimit({ windowMs, max }) {
  const hits = new Map()
  return function rateLimit(req, res, next) {
    const key = req.ip || req.socket.remoteAddress || 'unknown'
    const now = Date.now()
    const cutoff = now - windowMs
    const list = (hits.get(key) || []).filter((t) => t > cutoff)
    if (list.length >= max) {
      const retryAfter = Math.ceil((list[0] + windowMs - now) / 1000)
      res.header('Retry-After', String(retryAfter))
      return res.status(429).json({ error: 'rate_limited', retryAfter })
    }
    list.push(now)
    hits.set(key, list)
    next()
  }
}

// --- History validation -----------------------------------------------------
// Strictly validate client-supplied conversation history. Reject anything
// that isn't `user` or `assistant` (notably `system`) to prevent the client
// from injecting system-style instructions to the upstream model.

function validateHistory(raw) {
  if (raw === undefined) return { ok: true, history: [] }
  if (!Array.isArray(raw)) return { ok: false, error: 'history must be an array' }
  if (raw.length > MAX_HISTORY) {
    return { ok: false, error: `history exceeds ${MAX_HISTORY} messages` }
  }
  const out = []
  for (const [i, m] of raw.entries()) {
    if (!m || typeof m !== 'object') {
      return { ok: false, error: `history[${i}] must be an object` }
    }
    if (m.role !== 'user' && m.role !== 'assistant') {
      return { ok: false, error: `history[${i}].role must be "user" or "assistant"` }
    }
    if (typeof m.content !== 'string') {
      return { ok: false, error: `history[${i}].content must be a string` }
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return { ok: false, error: `history[${i}].content exceeds ${MAX_MESSAGE_CHARS} chars` }
    }
    out.push({ role: m.role, content: m.content })
  }
  return { ok: true, history: out }
}

// --- Routes -----------------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'my-blog backend is running',
    timestamp: new Date().toISOString(),
  })
})

app.post('/chat', chatRateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX }), async (req, res) => {
  const { message, history: rawHistory } = req.body || {}

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message exceeds ${MAX_MESSAGE_CHARS} chars` })
  }

  const v = validateHistory(rawHistory)
  if (!v.ok) return res.status(400).json({ error: v.error })

  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey || apiKey === 'your-key-here') {
    console.error('MINIMAX_API_KEY is not set or is still the placeholder')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const upstreamMessages = [...v.history, { role: 'user', content: message.trim() }]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  // NOTE: do not `req.on('close', ...)` here — in Express 5 / Node 20+ the
  // 'close' event fires as soon as the response is sent (keep-alive releases
  // the connection), which aborts the in-flight upstream fetch and turns
  // successful calls into spurious 504s. The 20s timer covers the real
  // client-disconnect case.

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M3',
        messages: upstreamMessages,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('MiniMax API error:', response.status, errorText.slice(0, 200))
      if (response.status === 429) {
        const ra = response.headers.get('retry-after')
        if (ra) res.header('Retry-After', ra)
        return res.status(429).json({ error: 'upstream_rate_limited' })
      }
      return res.status(502).json({ error: 'upstream_error' })
    }

    const data = await response.json()
    // Avoid logging full conversation content (PII once multi-turn is in use).
    console.log('MiniMax ok:', {
      id: data.id,
      usage: data.usage,
      finish_reason: data.choices?.[0]?.finish_reason,
    })
    const answer = data.choices?.[0]?.message?.content || 'No response'

    res.json({ answer })
  } catch (err) {
    if (err?.name === 'AbortError') {
      return res.status(504).json({ error: 'upstream_timeout' })
    }
    console.error('Chat error:', err)
    return res.status(502).json({ error: 'upstream_unreachable' })
  } finally {
    clearTimeout(timer)
  }
})

// --- Listen -----------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Allowed origins: [${ALLOWED_ORIGINS.join(', ')}]`)
  console.log(`Rate limit: ${RATE_LIMIT_MAX} req / ${RATE_LIMIT_WINDOW_MS / 1000}s on /chat`)
})
