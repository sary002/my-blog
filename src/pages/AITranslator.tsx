import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'
import { API_BASE } from '../lib/apiBase'

// Mermaid must be initialised exactly once per page. `strict` blocks any
// `<script>` the model might (deliberately or by accident) put in a diagram,
// so an untrusted AI can never get JS execution through a diagram.
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'strict',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif',
})

let mermaidIdCounter = 0

interface Profession {
  id: string
  label: string
}

// Hardcoded fallback used only when the professions endpoint is unreachable
// (e.g. local dev with the backend stopped). The backend is the source of
// truth; this list should mirror the IDs in backend/professions.js.
const FALLBACK_PROFESSIONS: Profession[] = [
  { id: 'backend-dev', label: '后端开发' },
  { id: 'frontend-dev', label: '前端开发' },
  { id: 'product-manager', label: '产品经理' },
  { id: 'teacher', label: '老师' },
  { id: 'chef', label: '厨师' },
  { id: 'sales', label: '销售' },
  { id: 'founder', label: '创业者' },
]

const CONCEPT_CHIPS = ['MCP', 'Agent', 'RAG', 'Memory', 'Prompt', 'Workflow']

interface Result {
  oneLine: string
  mapping: string
  ascii: string
  mermaid: string
  case: string
  advice: string
}

interface ConceptMeta {
  name: string
  english?: string
  phonetic?: string
}

function parseResult(raw: string): Result {
  const sections: Record<string, string> = {}
  let currentKey = ''
  let buffer: string[] = []
  const flush = () => {
    if (currentKey) sections[currentKey] = buffer.join('\n').trim()
    buffer = []
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^##\s+(.+?)\s*$/)
    if (m) {
      flush()
      currentKey = m[1].trim()
    } else {
      buffer.push(line)
    }
  }
  flush()
  const get = (key: string) => sections[key] || ''
  return {
    oneLine: get('一句话理解'),
    mapping: get('职业映射'),
    ascii: get('ASCII图解'),
    mermaid: get('Mermaid图'),
    case: get('真实案例'),
    advice: get('学习建议'),
  }
}

// Strip a leading ```mermaid ... ``` or ``` ... ``` fence that the model
// sometimes wraps the diagram in. We don't want the literal fence text to
// feed into Mermaid.parse.
function stripCodeFence(source: string): string {
  const s = source.trim()
  const m = s.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n?```\s*$/)
  return m ? m[1].trim() : s
}

function MermaidDiagram({ source }: { source: string }) {
  type State =
    | { kind: 'loading' }
    | { kind: 'ok'; svg: string }
    | { kind: 'error'; message: string }
  // Component is remounted via `key={source}` from the parent when the
  // diagram changes, so initial state is always "loading" for a fresh source.
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${++mermaidIdCounter}`
    const code = stripCodeFence(source)

    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (cancelled) return
        setState({ kind: 'ok', svg })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        setState({ kind: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [source])

  if (state.kind === 'loading') {
    return <div className="ai-translator__mermaid-loading">Mermaid 渲染中…</div>
  }
  if (state.kind === 'error') {
    return (
      <div>
        <div className="ai-translator__mermaid-error">
          Mermaid 渲染失败：{state.message}
        </div>
        <pre className="ai-translator__code">
          <code>{source}</code>
        </pre>
      </div>
    )
  }
  return (
    <div
      className="ai-translator__mermaid"
      dangerouslySetInnerHTML={{ __html: state.svg }}
    />
  )
}

interface SectionProps {
  title: string
  body: string
  variant?: 'default' | 'highlight'
  meta?: ConceptMeta | null
}

function Section({ title, body, variant = 'default', meta = null }: SectionProps) {
  if (!body && !meta) return null
  const cls = `ai-translator__card${
    variant === 'highlight' ? ' ai-translator__card--highlight' : ''
  }`
  return (
    <section className={cls}>
      <h3 className="ai-translator__card-title">{title}</h3>
      {meta && (
        <div className="ai-translator__concept-meta">
          <span className="ai-translator__concept-name">{meta.name}</span>
          {meta.phonetic && (
            <span className="ai-translator__concept-phonetic">{meta.phonetic}</span>
          )}
          {meta.english && (
            <span className="ai-translator__concept-english">{meta.english}</span>
          )}
        </div>
      )}
      {body && <div className="ai-translator__card-body">{body}</div>}
    </section>
  )
}

interface CodeProps {
  title: string
  body: string
}

function CodeBlock({ title, body }: CodeProps) {
  const [copied, setCopied] = useState(false)
  if (!body) return null
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }
  return (
    <section className="ai-translator__card">
      <div className="ai-translator__code-header">
        <h3 className="ai-translator__card-title">{title}</h3>
        <button
          type="button"
          className="ai-translator__copy"
          onClick={handleCopy}
          aria-label="复制代码"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="ai-translator__code">
        <code>{body}</code>
      </pre>
    </section>
  )
}

export default function AITranslator() {
  const [professions, setProfessions] = useState<Profession[]>(FALLBACK_PROFESSIONS)
  const [professionsSource, setProfessionsSource] = useState<'fallback' | 'server'>(
    'fallback',
  )
  const [profession, setProfession] = useState<string>(FALLBACK_PROFESSIONS[0].id)
  const [concept, setConcept] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [raw, setRaw] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [meta, setMeta] = useState<ConceptMeta | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Fetch profession list on mount. Backend is the source of truth; the
  // fallback list only kicks in if the request fails.
  useEffect(() => {
    const ac = new AbortController()
    fetch(`${API_BASE}/professions`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { professions?: Profession[] }) => {
        if (Array.isArray(data.professions) && data.professions.length > 0) {
          setProfessions(data.professions)
          setProfessionsSource('server')
          setProfession(data.professions[0].id)
        }
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return
        // Stay on fallback silently; the dropdown still works.
        console.warn('Failed to load professions, using fallback:', e)
      })
    return () => ac.abort()
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const canSubmit = !!concept.trim() && !loading

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!canSubmit) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setResult(null)
    setRaw(null)
    setMeta(null)

    const trimmed = concept.trim()

    try {
      const r = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'translator',
          profession,
          concept: trimmed,
          stream: true,
        }),
        signal: controller.signal,
      })

      // Translate HTTP-level errors into a friendly message
      if (!r.ok) {
        const data = (await r.json().catch(() => ({}))) as { error?: string }
        if (r.status === 429) {
          setError('请求过于频繁，请稍后再试')
        } else if (r.status >= 500) {
          setError('服务暂时不可用，请稍后重试')
        } else {
          setError(
            data.error ? `请求失败：${data.error}` : '请求失败，请检查输入',
          )
        }
        return
      }

      if (!r.body) {
        setError('服务器没有返回内容')
        return
      }

      // Consume the SSE stream. Each `data: {...}\n\n` event is either
      //   { content: "..." }  — a delta from the model
      //   { error:  "..." }   — terminal error from upstream
      //   [DONE]              — terminator
      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullAnswer = ''
      let streamError: string | null = null
      let streamMeta: ConceptMeta | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let idx
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const line = rawEvent.replace(/^data:\s*/, '').trim()
          if (!line || line === '[DONE]') continue
          try {
            const evt = JSON.parse(line) as {
              content?: string
              error?: string
              meta?: ConceptMeta
            }
            if (evt.meta) streamMeta = evt.meta
            else if (typeof evt.error === 'string') streamError = evt.error
            else if (typeof evt.content === 'string') fullAnswer += evt.content
          } catch {
            // partial / malformed chunk — skip
          }
        }
      }

      if (streamError) {
        setError(
          streamError === 'upstream_timeout'
            ? '响应超时（模型思考时间过长），可稍后重试'
            : streamError === 'upstream_rate_limited'
            ? '上游限流，请稍后再试'
            : '生成失败，请稍后重试',
        )
        return
      }

      if (!fullAnswer) {
        setError('未收到有效回答，请重试')
        return
      }

      setRaw(fullAnswer)
      setMeta(streamMeta)
      const parsed = parseResult(fullAnswer)
      const anySection = Object.values(parsed).some((v) => v.length > 0)
      setResult(anySection ? parsed : null)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('网络异常，请检查连接后重试')
    } finally {
      if (abortRef.current === controller) {
        setLoading(false)
        abortRef.current = null
      }
    }
  }

  return (
    <main className="ai-translator">
      <div className="ai-translator__container">
        <header className="ai-translator__header">
          <h1 className="ai-translator__title">AI 职业翻译官</h1>
          <p className="ai-translator__subtitle">用你熟悉的职业语言理解AI</p>
        </header>

        <form className="ai-translator__form" onSubmit={handleSubmit}>
          <div className="ai-translator__field">
            <label htmlFor="profession" className="ai-translator__label">
              你的职业
              {professionsSource === 'fallback' && (
                <span className="ai-translator__hint-inline">
                  （后端未连接，使用本地列表）
                </span>
              )}
            </label>
            <div className="ai-translator__select-wrapper">
              <select
                id="profession"
                className="ai-translator__select"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                disabled={loading}
              >
                {professions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="ai-translator__select-chevron" aria-hidden="true">
                ▾
              </span>
            </div>
          </div>

          <div className="ai-translator__field">
            <label htmlFor="concept" className="ai-translator__label">
              想理解的 AI 概念
            </label>
            <input
              id="concept"
              type="text"
              className="ai-translator__input"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="例如：MCP / Agent / RAG / Memory / Prompt / Workflow"
              maxLength={100}
              disabled={loading}
              autoComplete="off"
            />
            <div className="ai-translator__hints" role="group" aria-label="常用概念">
              {CONCEPT_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="ai-translator__chip"
                  onClick={() => setConcept(c)}
                  disabled={loading}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="ai-translator__submit"
            disabled={!canSubmit}
            aria-busy={loading}
          >
            {loading ? '翻译中…' : '开始解释'}
          </button>
        </form>

        {error && (
          <div className="ai-translator__error" role="alert">
            {error}
          </div>
        )}

        {loading && (
          <div className="ai-translator__loading" aria-live="polite">
            <span className="ai-translator__dot" />
            <span className="ai-translator__dot" />
            <span className="ai-translator__dot" />
            <span>
              正在把「{concept}」翻译给{' '}
              {professions.find((p) => p.id === profession)?.label || profession}…
            </span>
          </div>
        )}

        {result && !loading && (
          <article className="ai-translator__result">
            <Section
              title="一句话理解"
              body={result.oneLine}
              meta={meta}
              variant="highlight"
            />
            <Section title="职业映射" body={result.mapping} />
            <CodeBlock title="ASCII 图解" body={result.ascii} />
            {result.mermaid && (
              <section className="ai-translator__card">
                <h3 className="ai-translator__card-title">Mermaid 图</h3>
                <MermaidDiagram
                  key={stripCodeFence(result.mermaid)}
                  source={result.mermaid}
                />
                <details className="ai-translator__mermaid-source">
                  <summary>查看 Mermaid 源码</summary>
                  <pre className="ai-translator__code">
                    <code>{stripCodeFence(result.mermaid)}</code>
                  </pre>
                </details>
              </section>
            )}
            <Section title="真实案例" body={result.case} />
            <Section title="学习建议" body={result.advice} />
          </article>
        )}

        {raw && !result && !loading && (
          <section className="ai-translator__card">
            <h3 className="ai-translator__card-title">回答</h3>
            <pre className="ai-translator__code">
              <code>{raw}</code>
            </pre>
          </section>
        )}
      </div>
    </main>
  )
}
