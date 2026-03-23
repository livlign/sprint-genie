import type { SessionSettings } from 'sprint-genie-shared'
import type { JiraProject, JiraSprint } from 'sprint-genie-shared'
import type { ConfigStatus } from 'sprint-genie-shared'

interface TopBarProps {
  settings: SessionSettings
  onSettingsChange: (changes: Partial<SessionSettings>) => void
  projects: JiraProject[]
  sprints: JiraSprint[]
  sprintsLoading?: boolean
  sprintsError?: string | null
  status: ConfigStatus
  onOpenSettings: () => void
  onNewSession: () => void
  onShowSessions?: () => void
}

export default function TopBar({
  settings,
  onSettingsChange,
  projects,
  sprints,
  sprintsLoading = false,
  sprintsError = null,
  status,
  onOpenSettings,
  onNewSession,
  onShowSessions,
}: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-5 py-2.5 shrink-0 gap-6"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', zIndex: 2 }}
    >
      {/* Left: brand + status */}
      <div className="flex items-center gap-4 shrink-0">
        <span className="font-display font-semibold text-base tracking-tight" style={{ color: 'var(--text)' }}>
          Sprint <span style={{ color: 'var(--accent)' }}>Genie</span>
        </span>
        <div className="flex items-center gap-2">
          <StatusChip label="Jira" ok={status.jiraConfigured} />
          <span className="text-xs" style={{ color: 'var(--border)' }}>|</span>
          <StatusChip label={`AI: ${formatModel(settings.model)}`} ok={status.claudeConfigured} />
        </div>
      </div>

      {/* Center: project / sprint / prefix */}
      <div className="flex items-center gap-4">
        <FieldRow label="Project">
          {projects.length > 0 ? (
            <InlineSelect
              value={settings.project}
              onChange={v => onSettingsChange({ project: v, sprintId: null })}
              options={[
                { value: '', label: 'Select...' },
                ...projects.map(p => ({ value: p.key, label: p.key })),
              ]}
            />
          ) : (
            <InlineInput
              value={settings.project}
              onChange={v => onSettingsChange({ project: v })}
              placeholder="e.g. LH"
              width="64px"
            />
          )}
        </FieldRow>

        <FieldRow label="Sprint">
          {sprints.length > 0 ? (
            <InlineSelect
              value={String(settings.sprintId ?? '')}
              onChange={v => onSettingsChange({ sprintId: v ? Number(v) : null })}
              options={[
                { value: '', label: 'None' },
                ...sprints.map(s => ({ value: String(s.id), label: s.name })),
              ]}
              maxWidth="180px"
            />
          ) : (
            <span className="text-xs" style={{ color: sprintsError ? 'var(--warn)' : 'var(--text3)' }}
              title={sprintsError ?? undefined}
            >
              {!settings.project ? 'Select project first' : sprintsLoading ? 'Loading...' : sprintsError ? 'No board found' : 'None'}
            </span>
          )}
        </FieldRow>

        <FieldRow label="Prefix">
          <InlineInput
            value={settings.prefix}
            onChange={v => onSettingsChange({ prefix: v })}
            placeholder="[API-2]"
            width="72px"
          />
        </FieldRow>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {onShowSessions && (
          <HeaderButton onClick={onShowSessions}>Sessions</HeaderButton>
        )}
        <HeaderButton onClick={onNewSession} accent>New session</HeaderButton>
        <HeaderButton onClick={onOpenSettings}>Settings</HeaderButton>
      </div>
    </header>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text3)' }}>{label}</span>
      {children}
    </div>
  )
}

function InlineSelect({ value, onChange, options, maxWidth }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  maxWidth?: string
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs pl-2 pr-5 py-1 rounded-md cursor-pointer"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: value ? 'var(--text)' : 'var(--text3)',
          outline: 'none',
          maxWidth: maxWidth ?? '120px',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        width="8" height="8" viewBox="0 0 8 8" fill="none"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text3)' }}
      >
        <path d="M2 3L4 5.5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

function InlineInput({ value, onChange, placeholder, width }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  width: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="text-xs px-2 py-1 rounded-md"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        outline: 'none',
        width,
      }}
    />
  )
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-1.5" title={ok ? 'Connected' : 'Not configured'}>
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: ok ? 'var(--accent2)' : 'var(--text3)',
          boxShadow: ok ? '0 0 5px rgba(89,201,155,0.4)' : 'none',
        }}
      />
      <span className="text-xs" style={{ color: ok ? 'var(--text2)' : 'var(--text3)' }}>{label}</span>
    </div>
  )
}

function formatModel(model: string): string {
  if (model.startsWith('gemini-')) {
    return model.replace('gemini-', 'Gemini ').replace(/-/g, ' ')
  }
  if (model.startsWith('claude-')) {
    const parts = model.replace('claude-', '').split('-')
    const name = parts.filter(p => !/^\d{8}$/.test(p)).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    return `Claude ${name}`
  }
  return model
}

function HeaderButton({ onClick, children, accent }: { onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
      style={{
        color: accent ? 'var(--accent4)' : 'var(--text2)',
        border: accent ? '1px solid rgba(106,173,235,0.25)' : '1px solid var(--border)',
        background: accent ? 'var(--glow-accent)' : 'transparent',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = accent ? 'rgba(106,173,235,0.15)' : 'var(--surface2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = accent ? 'var(--glow-accent)' : 'transparent' }}
    >
      {children}
    </button>
  )
}
