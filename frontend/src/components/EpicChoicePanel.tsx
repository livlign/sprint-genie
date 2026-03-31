import { useState, useEffect, useRef, useCallback } from 'react'

interface EpicChoiceProps {
  projectKey: string
  onCreateNew: () => void
  onUseExisting: (epicKey: string, epicSummary: string) => void
}

export default function EpicChoicePanel({ projectKey, onCreateNew, onUseExisting }: EpicChoiceProps) {
  const [mode, setMode] = useState<'choose' | 'search'>('choose')

  if (mode === 'search') {
    return <EpicSearchView projectKey={projectKey} onSelect={onUseExisting} onBack={() => setMode('choose')} />
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
      <div className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>
        Where should tickets go?
      </div>
      <div className="text-xs mb-8" style={{ color: 'var(--text3)' }}>
        Choose an epic for the generated tickets
      </div>

      <div className="flex flex-col gap-3 w-full max-w-[280px]">
        <button
          onClick={onCreateNew}
          className="w-full py-4 px-5 rounded-xl text-left transition-all"
          style={{
            background: 'var(--glow-warn)',
            border: '1px solid rgba(232,196,94,0.2)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(232,196,94,0.45)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,196,94,0.2)')}
        >
          <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--warn)' }}>
            Create new epic
          </div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Generate a new epic from the grooming session
          </div>
        </button>

        <button
          onClick={() => setMode('search')}
          className="w-full py-4 px-5 rounded-xl text-left transition-all"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        >
          <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text)' }}>
            Add to existing epic
          </div>
          <div className="text-xs" style={{ color: 'var(--text3)' }}>
            Search and pick an epic already in Jira
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Epic search view ────────────────────────────────────────────────────────

function EpicSearchView({ projectKey, onSelect, onBack }: {
  projectKey: string
  onSelect: (key: string, summary: string) => void
  onBack: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ key: string; summary: string }[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const search = useCallback(async (q: string) => {
    if (!projectKey) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ projectKey })
      if (q) params.set('q', q)
      const res = await fetch(`/api/jira/epics?${params}`)
      if (res.ok) {
        setResults(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [projectKey])

  // Initial load
  useEffect(() => {
    search('')
    inputRef.current?.focus()
  }, [search])

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-2.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)', minHeight: '41px' }}
      >
        <button
          onClick={onBack}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors"
          style={{ color: 'var(--text3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Pick an existing epic</span>
      </div>

      {/* Search input */}
      <div className="px-5 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search epics by title..."
            className="w-full text-sm py-2 pl-3 pr-8 rounded-lg"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              outline: 'none',
              color: 'var(--text)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />
          {loading && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--text3)', borderTopColor: 'transparent' }}
            />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="text-xs" style={{ color: 'var(--text3)' }}>
              {query ? 'No epics found' : 'No epics in this project'}
            </div>
          </div>
        )}
        {results.map(epic => (
          <button
            key={epic.key}
            onClick={() => onSelect(epic.key, epic.summary)}
            className="w-full text-left px-5 py-3 flex items-center gap-3 transition-colors"
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(232,196,94,0.12)', color: 'var(--warn)' }}
            >
              {epic.key}
            </span>
            <span className="text-sm truncate" style={{ color: 'var(--text2)' }}>{epic.summary}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
