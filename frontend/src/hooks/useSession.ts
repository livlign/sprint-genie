import { useState, useCallback, useRef, useEffect } from 'react'
import type { ChatMessage, Epic, Ticket, SessionSettings } from 'sprint-genie-shared'
import { saveSession, loadSession, setActiveId, generateId, getActiveId } from '../lib/storage'

export type SessionStatus = 'idle' | 'grooming' | 'building' | 'submitting' | 'submitted'
export type InputMode = 'text' | 'markdown' | 'cpd'

export interface SubmissionResult {
  epicKey: string
  epicUrl: string
  tickets: { key: string; url: string; summary: string }[]
  existingEpic?: boolean
}

export interface SessionState {
  status: SessionStatus
  inputMode: InputMode
  conversation: ChatMessage[]
  epic: Epic | null
  tickets: Ticket[]
  settings: SessionSettings
  result: SubmissionResult | null
  error: string | null
}

const DEFAULT_SETTINGS: SessionSettings = {
  project: '',
  prefix: '',
  sprintId: null,
  model: 'gemini-2.0-flash',
  sourceCodePath: '',
}

export function useSession(initialSettings?: Partial<SessionSettings>) {
  // Try to restore active session from LocalStorage
  const restoredId = getActiveId()
  const restoredState = restoredId ? loadSession(restoredId) : null

  const [sessionId, setSessionId] = useState<string>(restoredId ?? generateId())
  const [state, setState] = useState<SessionState>(() => {
    if (restoredState) {
      // Override model from current config so stale sessions don't use a provider the user hasn't configured
      // Clear stale errors on restore
      return {
        ...restoredState,
        error: null,
        settings: { ...restoredState.settings, ...initialSettings },
      }
    }
    return {
      status: 'idle',
      inputMode: 'text',
      conversation: [],
      epic: null,
      tickets: [],
      settings: { ...DEFAULT_SETTINGS, ...initialSettings },
      result: null,
      error: null,
    }
  })

  // ── Debounced auto-save ──────────────────────────────────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Only auto-save when there's meaningful data
    if (state.status === 'idle' && state.conversation.length === 0) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveSession(sessionId, state)
      setActiveId(sessionId)
    }, 3000) // 3 second debounce

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [sessionId, state])

  // ── State updaters ───────────────────────────────────────────────────────

  const setStatus = useCallback((status: SessionStatus) =>
    setState(s => ({ ...s, status })), [])

  const setInputMode = useCallback((inputMode: InputMode) =>
    setState(s => ({ ...s, inputMode })), [])

  const addMessage = useCallback((msg: ChatMessage) =>
    setState(s => ({ ...s, conversation: [...s.conversation, msg] })), [])

  const appendToLastAssistantMessage = useCallback((text: string) =>
    setState(s => {
      const conv = [...s.conversation]
      const last = conv[conv.length - 1]
      if (last?.role === 'assistant') {
        conv[conv.length - 1] = { ...last, content: last.content + text }
      } else {
        conv.push({ role: 'assistant', content: text })
      }
      return { ...s, conversation: conv }
    }), [])

  const setEpic = useCallback((epic: Epic) =>
    setState(s => ({ ...s, epic })), [])

  const setTickets = useCallback((tickets: Ticket[]) =>
    setState(s => ({ ...s, tickets })), [])

  const updateTicket = useCallback((id: string, changes: Partial<Ticket>) =>
    setState(s => ({
      ...s,
      tickets: s.tickets.map(t => t.id === id ? { ...t, ...changes } : t),
    })), [])

  const addTicket = useCallback(() =>
    setState(s => ({
      ...s,
      tickets: [
        ...s.tickets,
        {
          id: `t${Date.now()}`,
          type: 'Story' as const,
          title: `${s.settings.prefix} New ticket`,
          description: 'Problem: \nExpected outcome: \nSuggested approach: ',
          sprintId: s.settings.sprintId,
        },
      ],
    })), [])

  const cloneTicket = useCallback((id: string) =>
    setState(s => {
      const source = s.tickets.find(t => t.id === id)
      if (!source) return s
      const idx = s.tickets.indexOf(source)
      const clone = { ...source, id: `t${Date.now()}`, title: `${source.title} (copy)` }
      const tickets = [...s.tickets]
      tickets.splice(idx + 1, 0, clone)
      return { ...s, tickets }
    }), [])

  const removeTicket = useCallback((id: string) =>
    setState(s => ({ ...s, tickets: s.tickets.filter(t => t.id !== id) })), [])

  const updateSettings = useCallback((changes: Partial<SessionSettings>) =>
    setState(s => ({ ...s, settings: { ...s.settings, ...changes } })), [])

  const updateEpic = useCallback((changes: Partial<Epic>) =>
    setState(s => s.epic ? { ...s, epic: { ...s.epic, ...changes } } : s), [])

  const setResult = useCallback((result: SubmissionResult) =>
    setState(s => ({ ...s, result, status: 'submitted' })), [])

  const setError = useCallback((error: string | null) =>
    setState(s => ({ ...s, error })), [])

  const reset = useCallback(() => {
    const newId = generateId()
    setSessionId(newId)
    setActiveId(newId)
    setState(s => ({
      status: 'idle',
      inputMode: 'text',
      conversation: [],
      epic: null,
      tickets: [],
      settings: s.settings,
      result: null,
      error: null,
    }))
  }, [])

  // ── Restore a specific session by id ─────────────────────────────────────

  const restoreSession = useCallback((id: string) => {
    const loaded = loadSession(id)
    if (loaded) {
      setSessionId(id)
      setActiveId(id)
      setState(loaded)
    }
  }, [])

  // ── Force save now (for "Save draft" button) ────────────────────────────

  const forceSave = useCallback(() => {
    saveSession(sessionId, state)
    setActiveId(sessionId)
  }, [sessionId, state])

  return {
    sessionId,
    state,
    setStatus,
    setInputMode,
    addMessage,
    appendToLastAssistantMessage,
    setEpic,
    setTickets,
    updateTicket,
    addTicket,
    cloneTicket,
    removeTicket,
    updateSettings,
    updateEpic,
    setResult,
    setError,
    reset,
    restoreSession,
    forceSave,
  }
}
