import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ChatMessage } from 'sprint-genie-shared'
import type { InputMode } from '../hooks/useSession'
import { fetchCpdIssue } from '../hooks/useJira'
import { useToast } from './Toast'

const EXPORT_PROMPT = `Now generate the final ticket list in this exact markdown format. Do not include any other text, explanation, or commentary — only the markdown below:

# Epic Title Here

Brief epic description (1-2 sentences).

1. **Ticket title here**
   - **Problem:** What's broken or missing
   - **Expected outcome:** What done looks like
   - **Suggested approach:** Technical direction

2. **Another ticket title**
   - **Problem:** ...
   - **Expected outcome:** ...
   - **Suggested approach:** ...

Rules:
- The first # heading is the epic title
- Each numbered item with a bold title is a ticket
- Default all tickets to Story type
- Prefix ticket titles with the source ticket number (e.g. CPD-1198) if discussed
- Keep it to 3-7 tickets
- Use verb-first titles: "Add ...", "Migrate ...", "Fix ..."
- If a ticket is a bug fix, prefix with [Bug]. If purely technical, prefix with [Task]. Otherwise leave as Story.`

interface ChatPanelProps {
  conversation: ChatMessage[]
  inputMode: InputMode
  streaming: boolean
  generating: boolean
  onInputModeChange: (mode: InputMode) => void
  onSend: (message: string) => void
  onDone: () => void
  onImportMarkdown: (markdown: string) => void
}

const TABS: { id: InputMode; label: string; desc: string }[] = [
  { id: 'text', label: 'Free text', desc: 'Describe a feature, bug, or idea' },
  { id: 'cpd', label: 'CPD ticket', desc: 'Fetch a CPD ticket from Jira' },
  { id: 'markdown', label: 'Paste / .md', desc: 'Paste ticket list from external AI tool' },
]

export default function ChatPanel({
  conversation,
  inputMode,
  streaming,
  generating,
  onInputModeChange,
  onSend,
  onDone,
  onImportMarkdown,
}: ChatPanelProps) {
  const { toast } = useToast()
  const [input, setInput] = useState('')
  const [cpdKey, setCpdKey] = useState('')
  const [cpdLoading, setCpdLoading] = useState(false)
  const [cpdError, setCpdError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  const handleSend = useCallback(() => {
    const msg = input.trim()
    if (!msg || streaming) return
    setInput('')
    onSend(msg)
  }, [input, streaming, onSend])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && inputMode !== 'markdown') {
      if (e.shiftKey || e.metaKey || e.ctrlKey) return
      e.preventDefault()
      handleSend()
    }
  }, [handleSend, inputMode])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setInput(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }, [])

  const handleFetchCpd = useCallback(async () => {
    const key = cpdKey.trim().toUpperCase()
    if (!key) return
    setCpdLoading(true)
    setCpdError(null)
    try {
      const issue = await fetchCpdIssue(key)
      const msg = `CPD ticket ${issue.key}: ${issue.summary}\n\n${issue.description}`
      setInput(msg)
    } catch (e) {
      setCpdError(e instanceof Error ? e.message : 'Failed to fetch ticket')
    } finally {
      setCpdLoading(false)
    }
  }, [cpdKey])

  const hasConversation = conversation.length > 0
  const canDone = hasConversation && !streaming && !generating

  return (
    <div className="flex flex-col h-full">
      {/* Panel header with tabs */}
      <div className="shrink-0 flex items-end" style={{ borderBottom: '1px solid var(--border)', minHeight: '41px' }}>
        <div className="flex items-center gap-0.5 px-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { onInputModeChange(tab.id); setInput(''); setCpdError(null) }}
              className="relative px-3 py-2 text-xs font-medium transition-colors rounded-t-lg"
              style={{
                color: inputMode === tab.id ? 'var(--text)' : 'var(--text3)',
                background: inputMode === tab.id ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => { if (inputMode !== tab.id) e.currentTarget.style.color = 'var(--text2)' }}
              onMouseLeave={e => { if (inputMode !== tab.id) e.currentTarget.style.color = 'var(--text3)' }}
            >
              {tab.label}
              {inputMode === tab.id && (
                <div
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: 'var(--accent4)' }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {conversation.length === 0 && (
          <EmptyState inputMode={inputMode} />
        )}
        {conversation.map((msg, i) => (
          <MessageBubble key={i} msg={msg} index={i} />
        ))}
        {streaming && (
          <div className="flex justify-start animate-fade-in">
            <ThinkingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        {/* CPD error */}
        {inputMode === 'cpd' && cpdError && (
          <div className="px-3 pt-2 text-xs" style={{ color: 'var(--accent)' }}>{cpdError}</div>
        )}

        {/* Markdown mode toolbar */}
        {inputMode === 'markdown' && (
          <div className="px-4 pt-3 flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text2)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Upload .md file
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(EXPORT_PROMPT); toast('Prompt copied to clipboard', 'success') }}
              className="px-3 py-1.5 rounded-lg text-xs transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--text2)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Copy export prompt
            </button>
            <span className="text-xs" style={{ color: 'var(--text3)' }}>paste the prompt into your AI tool, then paste the result below</span>
            <input ref={fileInputRef} type="file" accept=".md,.txt" className="hidden" onChange={handleFileUpload} />
          </div>
        )}

        {/* Compose bar */}
        <div className="p-3 flex flex-col gap-2" style={{ minHeight: '68px' }}>
          {/* CPD: ticket key input + Fetch */}
          {inputMode === 'cpd' && (
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={cpdKey}
                onChange={e => setCpdKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFetchCpd()}
                placeholder="e.g. CPD-1234 or full Jira URL"
                className="flex-1 text-sm px-4 rounded-xl"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', height: '40px' }}
              />
              <button
                onClick={handleFetchCpd}
                disabled={cpdLoading || !cpdKey.trim()}
                className="px-4 rounded-xl text-sm font-semibold transition-all shrink-0"
                style={{
                  background: !cpdKey.trim() || cpdLoading ? 'var(--surface2)' : 'var(--accent4)',
                  color: !cpdKey.trim() || cpdLoading ? 'var(--text3)' : '#0c0b0a',
                  border: '1px solid transparent',
                  height: '40px',
                }}
              >
                {cpdLoading ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
          )}
          {/* Textarea + action buttons */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                inputMode === 'cpd'
                  ? 'Fetched ticket content will appear here. Add context or send directly...'
                  : inputMode === 'markdown'
                  ? 'Paste ticket list from external AI tool...'
                  : 'Describe a feature, bug, or idea...'
              }
              rows={1}
              className="flex-1 text-sm px-4 rounded-xl resize-none transition-colors no-scrollbar"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
                lineHeight: 1.6,
                minHeight: '40px',
                paddingTop: '8px',
                paddingBottom: '8px',
                maxHeight: '160px',
              }}
            />
            {inputMode === 'markdown' ? (
              <button
                onClick={() => onImportMarkdown(input)}
                disabled={!input.trim()}
                className="px-4 rounded-xl text-sm font-semibold transition-all shrink-0 whitespace-nowrap"
                style={{
                  background: !input.trim() ? 'var(--surface2)' : 'var(--accent2)',
                  color: !input.trim() ? 'var(--text3)' : '#0c0b0a',
                  border: '1px solid transparent',
                  height: '40px',
                }}
              >
                Import as tickets
              </button>
            ) : (
              <>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || streaming}
                  className="px-4 rounded-xl text-sm font-semibold transition-all shrink-0"
                  style={{
                    background: !input.trim() || streaming ? 'var(--surface2)' : 'var(--accent4)',
                    color: !input.trim() || streaming ? 'var(--text3)' : '#0c0b0a',
                    border: '1px solid transparent',
                    height: '40px',
                  }}
                >
                  Send
                </button>
                {canDone && (
                  <button
                    onClick={onDone}
                    disabled={generating}
                    className="px-4 rounded-xl text-sm font-semibold transition-all whitespace-nowrap shrink-0 animate-fade-in"
                    style={{
                      background: 'var(--glow-teal)',
                      color: 'var(--accent2)',
                      opacity: generating ? 0.6 : 1,
                      border: '1px solid rgba(89,201,155,0.2)',
                      height: '40px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(89,201,155,0.15)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--glow-teal)')}
                  >
                    {generating ? 'Generating...' : 'Done, build tickets'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ inputMode }: { inputMode: InputMode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in" style={{ paddingTop: '20%' }}>
      {/* Decorative element */}
      <div className="relative mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--glow-accent), var(--glow-teal))',
            border: '1px solid rgba(106,173,235,0.15)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent4)' }}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent2)', color: '#0c0b0a' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      <div className="font-display text-lg font-medium mb-2" style={{ color: 'var(--text)' }}>
        Start a grooming session
      </div>
      <div className="text-sm leading-relaxed max-w-[280px]" style={{ color: 'var(--text3)' }}>
        {inputMode === 'cpd'
          ? 'Fetch a CPD ticket above, then send it to start breaking it down into epics and stories.'
          : inputMode === 'markdown'
          ? 'Paste a ticket list from an external AI tool. Supports markdown with headings for epic/tickets and bullet points for descriptions.'
          : 'Describe a feature, bug, or idea. The AI will ask clarifying questions to help break it down.'}
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, index }: { msg: ChatMessage; index: number }) {
  const isUser = msg.role === 'user'
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{
        animation: `${isUser ? 'slideInRight' : 'slideInLeft'} 0.3s ease-out both`,
        animationDelay: `${Math.min(index * 0.05, 0.3)}s`,
      }}
    >
      {!isUser && (
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-1 mr-2"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--accent4)' }}>
            <path d="M6 1L1.5 3.5 6 6l4.5-2.5L6 1zM1.5 8.5L6 11l4.5-2.5M1.5 6L6 8.5 10.5 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
      <div
        className="max-w-[80%] px-4 py-3 text-sm leading-relaxed"
        style={
          isUser
            ? {
                background: 'var(--glow-accent)',
                color: 'var(--text)',
                borderRadius: '16px 16px 4px 16px',
                border: '1px solid rgba(106,173,235,0.12)',
              }
            : {
                background: 'var(--surface2)',
                color: 'var(--text)',
                borderRadius: '4px 16px 16px 16px',
                border: '1px solid var(--border)',
              }
        }
      >
        {isUser ? (
          <pre className="whitespace-pre-wrap font-sans m-0">{msg.content}</pre>
        ) : (
          <div className="prose-chat">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-2 ml-8">
      <div
        className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px 16px 16px 16px' }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--accent4)',
              animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
