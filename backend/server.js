import 'dotenv/config'
import express from 'express'
import {
  PROFESSIONS,
  findProfession,
  listProfessions,
  buildTranslatorMessages,
} from './professions.js'
import { lookupConceptMeta } from './concept-meta.js'

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
// Stream-friendly timeout. The old 25s was set for non-streaming JSON
// responses under Render free's 30s HTTP cap. Now that translator mode
// streams, we can wait longer. Render treats SSE as a long-lived connection
// (no 30s cap). For non-streaming calls (AIChat page), 60s is still safe:
// Render paid plans allow up to 90s; free plans will return 504 at ~30s on
// non-streaming requests, but the AIChat page is short enough not to hit it.
const UPSTREAM_TIMEOUT_MS = Number(process.env.UPSTREAM_TIMEOUT_MS) || 60_000
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

// --- Upstream call ----------------------------------------------------------
// Shared between the free-form chat path and the translator path. Centralising
// timeout / error mapping / logging keeps the two paths from drifting.

async function forwardToUpstream(messages, meta = null) {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey || apiKey === 'your-key-here') {
    console.error('MINIMAX_API_KEY is not set or is still the placeholder')
    return { status: 500, body: { error: 'Server configuration error' } }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  // NOTE: do not also `req.on('close', ...)` here — in Express 5 / Node 20+ the
  // 'close' event fires as soon as the response is sent, which would abort the
  // in-flight upstream fetch. The 20s timer covers the real client-disconnect.

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'MiniMax-M3', messages }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      console.error('MiniMax API error:', response.status, errorText.slice(0, 200))
      if (response.status === 429) {
        return {
          status: 429,
          headers: { 'Retry-After': response.headers.get('retry-after') || '10' },
          body: { error: 'upstream_rate_limited' },
        }
      }
      return { status: 502, body: { error: 'upstream_error' } }
    }

    const data = await response.json()
    // Avoid logging full conversation content (PII once multi-turn is in use).
    console.log('MiniMax ok:', {
      id: data.id,
      usage: data.usage,
      finish_reason: data.choices?.[0]?.finish_reason,
    })
    const answer = data.choices?.[0]?.message?.content || 'No response'
    return { status: 200, body: meta ? { answer, meta } : { answer } }
  } catch (err) {
    if (err?.name === 'AbortError') {
      return { status: 504, body: { error: 'upstream_timeout' } }
    }
    console.error('Chat error:', err)
    return { status: 502, body: { error: 'upstream_unreachable' } }
  } finally {
    clearTimeout(timer)
  }
}

function writeResult(res, result) {
  if (result.headers) {
    for (const [k, v] of Object.entries(result.headers)) {
      if (v) res.header(k, v)
    }
  }
  res.status(result.status).json(result.body)
}

// --- SSE streaming ----------------------------------------------------------
// For long outputs (AI Translator's 6-section structured answer), forwarding
// the upstream MiniMax stream chunk-by-chunk means the user sees text as
// soon as the model produces it, and we sidestep any hard 30s response-time
// cap on the platform (Render free tier). The connection stays open the
// whole time, so it doesn't count against normal HTTP timeouts.
//
// Wire format (text/event-stream):
//   data: {"content":"…"}\n\n         — each upstream delta, one event
//   data: {"error":"upstream_…"}\n\n  — final error event (optional)
//   data: [DONE]\n\n                   — terminator; client should stop reading
//
// We check `res.writableEnded` / `res.destroyed` before each write to avoid
// the same Express 5 / Node 20+ `req.on('close')` premature-fire bug we hit
// on the non-streaming path: this is a polling check instead of an event
// subscription, so it doesn't fire on keep-alive release.

async function streamUpstream(req, res, messages, meta = null) {
  const apiKey = process.env.MINIMAX_API_KEY
  if (!apiKey || apiKey === 'your-key-here') {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.end(`data: ${JSON.stringify({ error: 'Server configuration error' })}\n\ndata: [DONE]\n\n`)
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // tell proxies not to buffer
  res.flushHeaders?.()

  // Send any non-stream metadata (e.g. concept lookup) as a leading event
  // so the client can render structured data without parsing the answer text.
  if (meta) {
    res.write(`data: ${JSON.stringify({ meta })}\n\n`)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  const safeWrite = (chunk) => {
    if (res.writableEnded || res.destroyed) {
      controller.abort()
      return false
    }
    return res.write(chunk)
  }

  try {
    const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: 'MiniMax-M3', messages, stream: true }),
      signal: controller.signal,
    })

    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '')
      console.error('MiniMax stream error:', response.status, errorText.slice(0, 200))
      safeWrite(`data: ${JSON.stringify({ error: 'upstream_error' })}\n\n`)
      safeWrite('data: [DONE]\n\n')
      return res.end()
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Upstream uses "data: {json}\n\n" lines. Split on blank-line boundary.
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const line = rawEvent.replace(/^data:\s*/, '').trim()
        if (line === '[DONE]') {
          safeWrite('data: [DONE]\n\n')
          return res.end()
        }
        if (!line) continue
        try {
          const parsed = JSON.parse(line)
          const content = parsed?.choices?.[0]?.delta?.content
          if (content) {
            safeWrite(`data: ${JSON.stringify({ content })}\n\n`)
          }
        } catch {
          // partial / malformed chunk — skip
        }
      }
    }

    safeWrite('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    if (err?.name === 'AbortError') {
      safeWrite(`data: ${JSON.stringify({ error: 'upstream_timeout' })}\n\n`)
    } else {
      console.error('Stream error:', err)
      safeWrite(`data: ${JSON.stringify({ error: 'upstream_unreachable' })}\n\n`)
    }
    safeWrite('data: [DONE]\n\n')
    res.end()
  } finally {
    clearTimeout(timer)
  }
}

// --- Routes -----------------------------------------------------------------

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'my-blog backend is running',
    timestamp: new Date().toISOString(),
  })
})

// Public list of supported professions for the AI Translator dropdown.
// Server is the single source of truth — adding a profession in
// professions.js flows through here automatically.
app.get('/professions', (_req, res) => {
  res.json({ professions: listProfessions() })
})

app.post('/chat', chatRateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX }), async (req, res) => {
  const body = req.body || {}

  // --- translator mode: server builds the prompt, client only chooses
  // profession + concept. Keeps the system prompt server-controlled so the
  // client can't inject instructions to the model.
  if (body.mode === 'translator') {
    const { profession: profId, concept } = body
    if (typeof profId !== 'string' || !profId) {
      return res.status(400).json({ error: 'profession is required in translator mode' })
    }
    if (typeof concept !== 'string' || !concept.trim()) {
      return res.status(400).json({ error: 'concept is required in translator mode' })
    }
    if (concept.length > MAX_MESSAGE_CHARS) {
      return res.status(400).json({ error: `concept exceeds ${MAX_MESSAGE_CHARS} chars` })
    }
    const prof = findProfession(profId)
    if (!prof) {
      return res.status(400).json({
        error: `unknown profession: ${profId}`,
        available: PROFESSIONS.map((p) => p.id),
      })
    }

    const messages = buildTranslatorMessages(prof, concept.trim())
    const meta = lookupConceptMeta(concept)
    if (body.stream === true) {
      return streamUpstream(req, res, messages, meta)
    }
    const result = await forwardToUpstream(messages, meta)
    return writeResult(res, result)
  }

  // --- default mode: free-form chat (unchanged behaviour for AIChat page)
  const { message, history: rawHistory } = body

  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' })
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `message exceeds ${MAX_MESSAGE_CHARS} chars` })
  }

  const v = validateHistory(rawHistory)
  if (!v.ok) return res.status(400).json({ error: v.error })

  const upstreamMessages = [...v.history, { role: 'user', content: message.trim() }]
  const result = await forwardToUpstream(upstreamMessages)
  return writeResult(res, result)
})

// --- Listen -----------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
  console.log(`Allowed origins: [${ALLOWED_ORIGINS.join(', ')}]`)
  console.log(`Rate limit: ${RATE_LIMIT_MAX} req / ${RATE_LIMIT_WINDOW_MS / 1000}s on /chat`)
  console.log(`Professions: ${PROFESSIONS.length} (${PROFESSIONS.map((p) => p.id).join(', ')})`)
})
