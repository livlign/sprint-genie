import { useState, useEffect } from 'react'
import { listSessions, deleteSession } from '../lib/storage'
import type { SavedSession } from '../lib/storage'

interface SessionListProps {
  onResume: (id: string) => void
  onNewSession: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idle: { label: 'Not started', color: 'var(--text3)' },
  grooming: { label: 'Grooming', color: 'var(--accent3)' },
  building: { label: 'Building', color: 'var(--accent4)' },
  submitting: { label: 'Submitting', color: 'var(--warn)' },
  submitted: { label: 'Submitted', color: 'var(--accent2)' },
}

export default function SessionList({ onResume, onNewSession }: SessionListProps) {
  const [sessions, setSessions] = useState<SavedSession[]>([])

  useEffect(() => {
    setSessions(listSessions())
  }, [])

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteSession(id)
    setSessions(s => s.filter(x => x.id !== id))
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
        <div className="relative mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--glow-accent), var(--glow-coral))',
              border: '1px solid rgba(106,173,235,0.15)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent4)' }}>
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        <div className="font-display text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>
          Sprint <span style={{ color: 'var(--accent)' }}>Genie</span>
        </div>
        <div className="text-sm mb-8 leading-relaxed" style={{ color: 'var(--text2)', maxWidth: '340px' }}>
          Turn rough ideas into structured Jira epics and tickets through an interactive grooming session with AI.
        </div>
        <button
          onClick={onNewSession}
          className="px-6 py-3 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          style={{ background: 'var(--accent4)', color: '#0c0b0a' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          Start new session
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>Sessions</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {sessions.length} saved session{sessions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button
          onClick={onNewSession}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5"
          style={{ background: 'var(--accent4)', color: '#0c0b0a' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New session
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {sessions.map((s, i) => {
          const status = STATUS_LABELS[s.status] ?? STATUS_LABELS.idle
          const date = new Date(s.updatedAt)
          const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

          return (
            <button
              key={s.id}
              onClick={() => onResume(s.id)}
              className="w-full text-left p-4 rounded-xl flex items-start gap-4 transition-all group"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                animation: `fadeInUp 0.3s ease-out ${i * 0.04}s both`,
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {s.title}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${status.color}18`, color: status.color }}
                  >
                    {status.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
                    {timeStr}
                  </span>
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(s.id, e)}
                className="opacity-0 group-hover:opacity-100 transition-all shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--text3)', background: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(232,132,94,0.1)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </button>
          )
        })}
      </div>
    </div>
  )
}
