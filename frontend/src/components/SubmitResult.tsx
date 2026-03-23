import type { SubmissionResult } from '../hooks/useSession'

interface SubmitResultProps {
  result: SubmissionResult
  onNewSession: () => void
}

export default function SubmitResult({ result, onNewSession }: SubmitResultProps) {
  const totalIssues = result.tickets.length + 1

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center animate-fade-in">
      {/* Success icon */}
      <div className="relative mb-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{
            background: 'var(--glow-teal)',
            border: '1px solid rgba(89,201,155,0.2)',
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ color: 'var(--accent2)' }}>
            <path d="M10 18.5L15.5 24L26 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div
          className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={{ background: 'var(--accent2)', color: '#0c0b0a' }}
        >
          {totalIssues}
        </div>
      </div>

      <div className="font-display text-xl font-semibold mb-1" style={{ color: 'var(--text)' }}>
        Created in Jira
      </div>
      <div className="text-sm mb-8" style={{ color: 'var(--text2)' }}>
        {totalIssues} issue{totalIssues !== 1 ? 's' : ''} created successfully
      </div>

      {/* Epic link */}
      <div className="w-full max-w-sm mb-3">
        <a
          href={result.epicUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 p-4 rounded-xl w-full text-left transition-all"
          style={{
            background: 'var(--glow-warn)',
            border: '1px solid rgba(232,196,94,0.2)',
            textDecoration: 'none',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,196,94,0.4)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,196,94,0.2)')}
        >
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg shrink-0"
            style={{ background: 'rgba(232,196,94,0.15)', color: 'var(--warn)', border: '1px solid rgba(232,196,94,0.2)' }}
          >
            Epic
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{result.epicKey}</span>
          <svg className="ml-auto shrink-0" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text3)' }}>
            <path d="M4 10L10 4M10 4H5M10 4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>

      {/* Child ticket links */}
      <div className="w-full max-w-sm flex flex-col gap-2 mb-8">
        {result.tickets.map((t, i) => (
          <a
            key={t.key}
            href={t.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl w-full text-left transition-all"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              textDecoration: 'none',
              animation: `fadeInUp 0.3s ease-out ${(i + 1) * 0.06}s both`,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--accent4)' }}>{t.key}</span>
            <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>{t.summary}</span>
            <svg className="ml-auto shrink-0" width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--text3)' }}>
              <path d="M4 10L10 4M10 4H5M10 4v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </div>

      <button
        onClick={onNewSession}
        className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
        style={{ border: '1px solid var(--border)', color: 'var(--text2)', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border-hover)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M11 7H3M6 4L3 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Start new session
      </button>
    </div>
  )
}
