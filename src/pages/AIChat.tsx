import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE } from '../lib/apiBase'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'my-blog-chat-history'
const HISTORY_TURNS = 20 // messages to send back to the backend (not words)

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m): m is Message =>
        m &&
        typeof m.id === 'string' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    )
  } catch {
    return []
  }
}

function saveHistory(messages: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
  } catch {
    // Safari private mode / quota — ignore.
  }
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Persist on every change.
  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cancel any in-flight request when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const handleClear = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setInput('')
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    // Cancel any previous in-flight request before starting a new one.
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    // Snapshot history to send — exclude the message we just appended,
    // and cap to the last N messages for token economy.
    const historyToSend = messages.slice(-HISTORY_TURNS).map(({ role, content }) => ({
      role,
      content,
    }))

    const pushError = (content: string) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content },
      ])
    }

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history: historyToSend }),
        signal: controller.signal,
      })

      // Read body once; downstream branches need it.
      const data = await response.json().catch(() => ({} as { error?: string }))

      if (response.ok) {
        const answer = typeof data.answer === 'string' ? data.answer : 'No response'
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: answer },
        ])
      } else if (response.status === 429) {
        pushError('请求过于频繁，请稍后再试')
      } else if (response.status >= 500) {
        pushError('服务暂时不可用，请稍后重试')
      } else {
        // 4xx — surface backend's error code if present.
        pushError(data.error ? `请求失败：${data.error}` : '请求失败，请检查输入后重试')
      }
    } catch (err) {
      // AbortError fires when a newer send supersedes us, or on unmount.
      // Either way, don't pollute the chat with an error message.
      if (err instanceof Error && err.name === 'AbortError') return
      // TypeError on fetch typically means network failure / offline / CORS.
      pushError('网络异常，请检查连接后重试')
    } finally {
      // Only reset loading if WE are still the current controller.
      if (abortRef.current === controller) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !!input.trim() && !loading

  return (
    <main className="ai-chat">
      <div className="ai-chat__container">
        <header className="ai-chat__header">
          <div>
            <h1 className="ai-chat__title">AI 助手</h1>
            <p className="ai-chat__subtitle">有什么可以帮你的？</p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className="ai-chat__clear"
              onClick={handleClear}
              aria-label="清空对话"
            >
              清空对话
            </button>
          )}
        </header>

        <div className="ai-chat__messages" role="log" aria-live="polite">
          {messages.length === 0 && !loading ? (
            <div className="ai-chat__empty">
              <p>发送一条消息开始对话</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-chat__message ai-chat__message--${msg.role}`}
              >
                <div className="ai-chat__avatar" aria-hidden="true">
                  {msg.role === 'user' ? '你' : 'AI'}
                </div>
                <div className="ai-chat__bubble">{msg.content}</div>
              </div>
            ))
          )}
          {loading && (
            <div className="ai-chat__message ai-chat__message--assistant" aria-hidden="true">
              <div className="ai-chat__avatar">AI</div>
              <div className="ai-chat__bubble ai-chat__status">
                <span className="ai-chat__dot" />
                <span className="ai-chat__dot" />
                <span className="ai-chat__dot" />
                <span className="ai-chat__status-text">思考中…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-chat__input-area">
          <div className="ai-chat__input-wrapper">
            <textarea
              className="ai-chat__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={loading ? '等待回复…' : '输入消息…'}
              rows={1}
              aria-label="消息输入框"
              disabled={loading}
            />
            <button
              type="button"
              className="ai-chat__send"
              onClick={handleSend}
              disabled={!canSend}
              aria-busy={loading}
              aria-label="发送消息"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.4 20.4l17.45-7.48c.81-.35.81-1.49 0-1.84L3.4 3.6c-.66-.29-1.39.2-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.89c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.9z" />
              </svg>
            </button>
          </div>
          <p className="ai-chat__hint">按 Enter 发送，Shift + Enter 换行</p>
        </div>
      </div>
    </main>
  )
}
