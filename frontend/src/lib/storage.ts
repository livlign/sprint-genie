import type { SessionState } from '../hooks/useSession'

const SESSIONS_KEY = 'sprint-genie-sessions'
const ACTIVE_KEY = 'sprint-genie-active-id'

export interface SavedSession {
  id: string
  title: string          // derived from epic title or first message
  updatedAt: string
  status: SessionState['status']
  data: SessionState
}

// ─── Read / write helpers ─────────────────────────────────────────────────────

function readAll(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(sessions: SavedSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listSessions(): SavedSession[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSession(id: string, state: SessionState): void {
  const sessions = readAll()
  const title = deriveTitle(state)
  const entry: SavedSession = {
    id,
    title,
    updatedAt: new Date().toISOString(),
    status: state.status,
    data: state,
  }
  const idx = sessions.findIndex(s => s.id === id)
  if (idx >= 0) {
    sessions[idx] = entry
  } else {
    sessions.unshift(entry)
  }
  writeAll(sessions)
}

export function loadSession(id: string): SessionState | null {
  const sessions = readAll()
  const found = sessions.find(s => s.id === id)
  return found?.data ?? null
}

export function deleteSession(id: string): void {
  const sessions = readAll().filter(s => s.id !== id)
  writeAll(sessions)
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function generateId(): string {
  return `sg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveTitle(state: SessionState): string {
  if (state.epic?.title) return state.epic.title
  const firstMsg = state.conversation.find(m => m.role === 'user')
  if (firstMsg) return firstMsg.content.slice(0, 60) + (firstMsg.content.length > 60 ? '…' : '')
  return 'Untitled session'
}
