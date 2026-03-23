import { useState, useCallback, useEffect } from 'react'
import { useConfig } from './hooks/useConfig'
import { useSession } from './hooks/useSession'
import { useChat, generateTickets } from './hooks/useChat'
import { useJiraProjects, useJiraSprints } from './hooks/useJira'
import TopBar from './components/TopBar'
import ChatPanel from './components/ChatPanel'
import TicketBuilder from './components/TicketBuilder'
import SubmitResult from './components/SubmitResult'
import SettingsModal from './components/SettingsModal'
import SessionList from './components/SessionList'
import { ToastProvider, useToast } from './components/Toast'
import type { CreateJiraRequest, IssueType } from 'sprint-genie-shared'

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}

function AppInner() {
  const { config, status, loading: configLoading, saving, saveConfig, refetch: refetchConfig } = useConfig()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showSessionList, setShowSessionList] = useState(false)
  const { toast } = useToast()

  const session = useSession({
    project: config.defaultProject ?? '',
    prefix: config.defaultPrefix ?? '',
    model: config.defaultModel ?? 'gemini-2.0-flash',
  })

  const { state, setInputMode, addMessage, appendToLastAssistantMessage,
    setEpic, setTickets, updateEpic, updateTicket, addTicket, cloneTicket, removeTicket,
    updateSettings, setResult, setStatus, setError, reset, restoreSession, forceSave } = session

  // Sync session model when config.defaultModel changes (e.g. switching from Claude to Gemini)
  useEffect(() => {
    if (config.defaultModel && config.defaultModel !== state.settings.model) {
      updateSettings({ model: config.defaultModel })
    }
  }, [config.defaultModel])

  // Jira data
  const { projects } = useJiraProjects(status.jiraConfigured)
  const { sprints, loading: sprintsLoading, error: sprintsError } = useJiraSprints(state.settings.project)

  // Chat streaming
  const chat = useChat({
    onToken: useCallback((text: string) => {
      appendToLastAssistantMessage(text)
    }, [appendToLastAssistantMessage]),
    onDone: useCallback(() => {
      setStatus('grooming')
    }, [setStatus]),
    onError: useCallback((msg: string) => {
      setError(msg)
      setStatus('grooming')
    }, [setError, setStatus]),
  })

  // ── Send a chat message ──────────────────────────────────────────────────

  const handleSend = useCallback(async (message: string) => {
    addMessage({ role: 'user', content: message })
    setStatus('grooming')
    await chat.sendMessage(message, state.conversation, state.settings)
  }, [addMessage, chat, setStatus, state.conversation, state.settings])

  // ── Done: generate tickets ───────────────────────────────────────────────

  const handleDone = useCallback(async () => {
    setGenerating(true)
    try {
      const result = await generateTickets(state.conversation, state.settings)
      setEpic({ ...result.epic, sprintId: state.settings.sprintId })
      setTickets(result.tickets.map(t => ({ ...t, type: t.type as IssueType, sprintId: state.settings.sprintId })))
      setStatus('building')
      toast('Tickets generated', 'success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate tickets')
    } finally {
      setGenerating(false)
    }
  }, [state.conversation, state.settings, setEpic, setTickets, setStatus, setError, toast])

  // ── Import markdown as tickets (no AI) ──────────────────────────────────

  const handleImportMarkdown = useCallback((markdown: string) => {
    const lines = markdown.split('\n')
    let epicTitle = ''
    let epicDesc = ''
    const tickets: { id: string; type: IssueType; title: string; description: string; sprintId: number | null }[] = []
    let currentTicket: typeof tickets[0] | null = null

    for (const line of lines) {
      const trimmed = line.trim()

      // # or ## heading = epic title (first one found)
      const epicMatch = trimmed.match(/^#{1,2}\s+(.+)/)
      if (epicMatch && !epicTitle) {
        epicTitle = epicMatch[1].trim()
        continue
      }

      // ### heading or numbered item (1. Title) or bold item (**Title**) = ticket
      const ticketHeading = trimmed.match(/^#{3,}\s+(.+)/)
      const numberedItem = trimmed.match(/^\d+\.\s+(.+)/)
      const boldItem = trimmed.match(/^\*\*(.+?)\*\*(.*)/)
      const dashBoldItem = trimmed.match(/^[-*]\s+\*\*(.+?)\*\*(.*)/)

      const ticketTitle = ticketHeading?.[1] ?? numberedItem?.[1] ?? dashBoldItem?.[1] ?? boldItem?.[1]

      if (ticketTitle) {
        // Detect type from title
        let type: IssueType = 'Story'
        const lower = ticketTitle.toLowerCase()
        if (lower.includes('[bug]') || lower.includes('(bug)') || lower.startsWith('bug:') || lower.startsWith('fix ')) type = 'Bug'
        else if (lower.includes('[task]') || lower.includes('(task)') || lower.startsWith('task:')) type = 'Task'

        const cleanTitle = ticketTitle.replace(/\[(story|task|bug)\]/gi, '').replace(/\((story|task|bug)\)/gi, '').trim()
        const extra = (dashBoldItem?.[2] ?? boldItem?.[2] ?? '').replace(/^[:\s-]+/, '').trim()

        currentTicket = {
          id: `t${Date.now()}-${tickets.length}`,
          type,
          title: `${state.settings.prefix ? state.settings.prefix + ' ' : ''}${cleanTitle}`,
          description: extra || '',
          sprintId: state.settings.sprintId,
        }
        tickets.push(currentTicket)
        continue
      }

      // Continuation lines (- bullet or plain text) go to description
      if (currentTicket && trimmed) {
        const bullet = trimmed.replace(/^[-*]\s+/, '')
        currentTicket.description += (currentTicket.description ? '\n' : '') + bullet
      } else if (!currentTicket && trimmed && epicTitle) {
        // Lines after epic title but before first ticket = epic description
        epicDesc += (epicDesc ? '\n' : '') + trimmed
      }
    }

    if (!epicTitle && tickets.length === 0) {
      toast('Could not parse any tickets from the pasted content', 'error')
      return
    }

    setEpic({
      title: epicTitle || 'Imported Epic',
      description: epicDesc,
      sprintId: state.settings.sprintId,
    })
    setTickets(tickets)
    setStatus('building')
    toast(`Imported ${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`, 'success')
  }, [state.settings, setEpic, setTickets, setStatus, toast])

  // ── Submit to Jira ───────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!state.epic) return
    setSubmitting(true)
    setSubmitError(null)
    setStatus('submitting')

    // Extract source ticket key (e.g. CPD-1198) from conversation or epic title
    const sourceTicketKey = state.conversation
      .map(m => m.content)
      .join(' ')
      .match(/\b([A-Z]+-\d+)/)?.[1]
      ?? state.epic.title.match(/\b([A-Z]+-\d+)/)?.[1]

    const body: CreateJiraRequest = {
      epic: state.epic,
      tickets: state.tickets,
      settings: state.settings,
      sourceTicketKey,
    }

    try {
      const res = await fetch('/api/jira/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error && !data.epicKey) {
        throw new Error(data.error)
      }
      setResult({
        epicKey: data.epicKey,
        epicUrl: data.epicUrl,
        tickets: data.tickets ?? [],
      })
      toast('Created in Jira!', 'success')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submission failed')
      setStatus('building')
    } finally {
      setSubmitting(false)
    }
  }, [state, setResult, setStatus, toast])

  // ── Save draft ───────────────────────────────────────────────────────────

  const handleSaveDraft = useCallback(() => {
    forceSave()
    toast('Draft saved', 'success')
  }, [forceSave, toast])

  // ── Session list handlers ────────────────────────────────────────────────

  const handleResumeSession = useCallback((id: string) => {
    restoreSession(id)
    setShowSessionList(false)
    toast('Session restored', 'info')
  }, [restoreSession, toast])

  const handleNewSession = useCallback(() => {
    reset()
    setShowSessionList(false)
  }, [reset])

  // ─── Render ──────────────────────────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ color: 'var(--text3)', fontSize: '14px' }}>
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'transparent' }} />
          <span>Loading Sprint Genie...</span>
        </div>
      </div>
    )
  }

  // Session list view
  if (showSessionList) {
    return (
      <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
        <TopBar
          settings={state.settings}
          onSettingsChange={updateSettings}
          projects={projects}
          sprints={sprints}
          sprintsLoading={sprintsLoading}
          sprintsError={sprintsError}
          status={status}

          onOpenSettings={() => setSettingsOpen(true)}
          onNewSession={reset}
          onShowSessions={() => setShowSessionList(true)}
        />
        <div className="flex-1 overflow-hidden flex items-center justify-center">
          <div className="w-full max-w-lg h-full">
            <SessionList onResume={handleResumeSession} onNewSession={handleNewSession} />
          </div>
        </div>
        <SettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          config={config}
          saving={saving}
          onSave={saveConfig}
          onRefetch={refetchConfig}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen relative noise" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <TopBar
        settings={state.settings}
        onSettingsChange={updateSettings}
        projects={projects}
        sprints={sprints}
        status={status}
        onOpenSettings={() => setSettingsOpen(true)}
        onNewSession={reset}
        onShowSessions={() => setShowSessionList(true)}
      />

      {/* Setup banner */}
      {(!status.claudeConfigured || !status.jiraConfigured) && (
        <div
          className="px-5 py-2.5 text-xs flex items-center gap-2.5 animate-fade-in"
          style={{ background: 'var(--glow-warn)', borderBottom: '1px solid rgba(232,196,94,0.12)', color: 'var(--warn)' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--warn)', animation: 'glow-pulse 2s ease-in-out infinite' }} />
          <span>
            {!status.claudeConfigured && 'AI API key missing (Gemini or Anthropic). '}
            {!status.jiraConfigured && 'Jira credentials missing. '}
            <button
              onClick={() => setSettingsOpen(true)}
              style={{ color: 'var(--accent4)', textDecoration: 'underline', textUnderlineOffset: '2px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', padding: 0 }}
            >
              Open Settings
            </button>{' '}to configure.
          </span>
        </div>
      )}

      {/* Error banner */}
      {(state.error || submitError) && (
        <div
          className="px-5 py-2.5 text-xs flex items-center gap-2.5 animate-fade-in"
          style={{ background: 'var(--glow-coral)', borderBottom: '1px solid rgba(232,132,94,0.12)', color: 'var(--accent)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5.5" stroke="currentColor"/><path d="M6 3.5v3M6 8h.005" stroke="currentColor" strokeLinecap="round"/></svg>
          <span className="flex-1">{state.error ?? submitError}</span>
          <button
            onClick={() => { setError(null); setSubmitError(null) }}
            className="ml-auto shrink-0 px-2 py-0.5 rounded-md transition-colors"
            style={{ color: 'var(--text3)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '11px' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Main: split panel */}
      <div className="flex flex-1 overflow-hidden relative" style={{ zIndex: 1 }}>
        {/* Left - Chat */}
        <div className="flex flex-col overflow-hidden" style={{ width: '45%', minWidth: '360px' }}>
          <ChatPanel
            conversation={state.conversation}
            inputMode={state.inputMode}
            streaming={chat.streaming}
            generating={generating}
            onInputModeChange={setInputMode}
            onSend={handleSend}
            onDone={handleDone}
            onImportMarkdown={handleImportMarkdown}
          />
        </div>

        {/* Divider */}
        <div className="w-px shrink-0 relative" style={{ background: 'var(--border)' }}>
          <div className="absolute inset-y-0 -left-px w-[3px]" style={{ background: 'linear-gradient(to bottom, transparent, var(--glow-accent), transparent)' }} />
        </div>

        {/* Right - Ticket builder or result */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {state.status === 'submitted' && state.result ? (
            <SubmitResult result={state.result} onNewSession={reset} />
          ) : (
            <TicketBuilder
              epic={state.epic}
              tickets={state.tickets}
              sprints={sprints}
              submitting={submitting}
              generating={generating}
              onEpicChange={updateEpic}
              onTicketChange={updateTicket}
              onAddTicket={addTicket}
              onCloneTicket={cloneTicket}
              onRemoveTicket={removeTicket}
              onSubmit={handleSubmit}
              onSaveDraft={handleSaveDraft}
            />
          )}
        </div>
      </div>

      {/* Settings modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={config}
        saving={saving}
        onSave={saveConfig}
      />
    </div>
  )
}
