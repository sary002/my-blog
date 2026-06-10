import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await response.json()
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '请求失败，请稍后重试',
      }
      setMessages((prev) => [...prev, errorMessage])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <main className="ai-chat">
      <div className="ai-chat__container">
        <header className="ai-chat__header">
          <h1 className="ai-chat__title">AI 助手</h1>
          <p className="ai-chat__subtitle">有什么可以帮你的？</p>
        </header>

        <div className="ai-chat__messages" role="log" aria-live="polite">
          {messages.length === 0 ? (
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
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-chat__input-area">
          <div className="ai-chat__input-wrapper">
            <textarea
              className="ai-chat__input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              aria-label="消息输入框"
            />
            <button
              type="button"
              className="ai-chat__send"
              onClick={handleSend}
              disabled={!input.trim()}
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
