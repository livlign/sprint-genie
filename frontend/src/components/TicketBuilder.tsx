import { useState } from 'react'
import type { Epic, Ticket, JiraSprint } from 'sprint-genie-shared'

type IssueType = 'Story' | 'Task' | 'Bug'

interface TicketBuilderProps {
  epic: Epic | null
  tickets: Ticket[]
  sprints: JiraSprint[]
  submitting: boolean
  generating?: boolean
  onEpicChange: (changes: Partial<Epic>) => void
  onTicketChange: (id: string, changes: Partial<Ticket>) => void
  onAddTicket: () => void
  onCloneTicket: (id: string) => void
  onRemoveTicket: (id: string) => void
  onSubmit: () => void
  onSaveDraft: () => void
  onExport?: () => void
}

export default function TicketBuilder({
  epic,
  tickets,
  sprints,
  submitting,
  generating,
  onEpicChange,
  onTicketChange,
  onAddTicket,
  onCloneTicket,
  onRemoveTicket,
  onSubmit,
  onSaveDraft,
  onExport,
}: TicketBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (generating) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader title="Generating tickets..." count={0} />
        <div className="flex-1 overflow-y-auto">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="h-5 w-14 rounded skeleton shrink-0" />
              <div className="h-4 flex-1 rounded skeleton" />
              <div className="h-4 w-24 rounded skeleton shrink-0" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!epic) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
        <div className="text-sm font-medium mb-2" style={{ color: 'var(--text2)' }}>
          Ticket builder
        </div>
        <div className="text-xs leading-relaxed max-w-[260px]" style={{ color: 'var(--text3)' }}>
          Once you finish grooming, click{' '}
          <span className="font-medium" style={{ color: 'var(--accent2)' }}>Done, build tickets</span>{' '}
          to generate your Epic and stories here.
        </div>
      </div>
    )
  }

  const toggle = (id: string) => setExpandedId(expandedId === id ? null : id)

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="Epic & tickets" count={tickets.length} />

      <div className="flex-1 overflow-y-auto">
        {/* Epic row */}
        <div style={{ background: 'rgba(232,196,94,0.04)' }}>
          {epic.existingEpicKey ? (
            /* Existing epic — read-only display */
            <div
              className="flex items-center gap-3 px-5 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <TypeBadge type="Epic" />
              <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--warn)' }}>{epic.existingEpicKey}</span>
              <span className="text-sm truncate" style={{ color: 'var(--text2)' }}>{epic.title}</span>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-3 px-5 py-3 cursor-pointer"
                style={{ borderBottom: '1px solid var(--border)' }}
                onClick={() => toggle('epic')}
              >
                <TypeBadge type="Epic" />
                <InlineEdit
                  value={epic.title}
                  onChange={v => onEpicChange({ title: v })}
                  placeholder="Epic title..."
                  className="flex-1 text-sm font-semibold"
                />
                <SprintSelect value={epic.sprintId} sprints={sprints} onChange={id => onEpicChange({ sprintId: id })} />
                <RowMenu
                  expanded={expandedId === 'epic'}
                  onToggleDesc={() => toggle('epic')}
                />
              </div>
              {expandedId === 'epic' && (
                <div className="px-5 py-3 animate-fade-in" style={{ borderBottom: '1px solid var(--border)', paddingLeft: '80px' }}>
                  <InlineEdit
                    value={epic.description}
                    onChange={v => onEpicChange({ description: v })}
                    placeholder="Epic description..."
                    multiline
                    className="text-xs"
                    style={{ color: 'var(--text2)' }}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Ticket rows */}
        {tickets.map(ticket => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            sprints={sprints}
            expanded={expandedId === ticket.id}
            onToggle={() => toggle(ticket.id)}
            onChange={changes => onTicketChange(ticket.id, changes)}
            onClone={() => onCloneTicket(ticket.id)}
            onRemove={() => onRemoveTicket(ticket.id)}
          />
        ))}

        {/* Add ticket */}
        <button
          onClick={onAddTicket}
          className="w-full py-3 text-xs transition-colors flex items-center justify-center gap-1.5"
          style={{ color: 'var(--text3)', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--text2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text3)' }}
        >
          + Add ticket
        </button>
      </div>

      {/* Submit bar */}
      <div
        className="flex items-center gap-2 p-3 shrink-0"
        style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)', minHeight: '68px' }}
      >
        <button
          onClick={onSaveDraft}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0"
          style={{ border: '1px solid var(--border)', color: 'var(--text2)', background: 'transparent', lineHeight: 1.6 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Save draft
        </button>
        {onExport && (
          <button
            onClick={onExport}
            title="Export as Claude Code task file (.md)"
            className="px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 flex items-center gap-1.5"
            style={{ border: '1px solid var(--border)', color: 'var(--accent4)', background: 'transparent', lineHeight: 1.6 }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--glow-accent)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Claude Code icon — simple terminal-ish mark */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 5l2 2-2 2M7.5 9h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Export
          </button>
        )}
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: submitting ? 'var(--surface2)' : 'var(--accent4)',
            color: submitting ? 'var(--text3)' : '#0c0b0a',
            lineHeight: 1.6,
          }}
        >
          {submitting ? (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text3)', borderTopColor: 'transparent' }} />
              Creating in Jira...
            </>
          ) : (
            'Create in Jira'
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border)', minHeight: '41px' }}>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</span>
      {count > 0 && (
        <span className="text-xs" style={{ color: 'var(--text3)' }}>
          {count} ticket{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ─── Ticket row ───────────────────────────────────────────────────────────────

function TicketRow({
  ticket, sprints, expanded, onToggle, onChange, onClone, onRemove,
}: {
  ticket: Ticket
  sprints: JiraSprint[]
  expanded: boolean
  onToggle: () => void
  onChange: (c: Partial<Ticket>) => void
  onClone: () => void
  onRemove: () => void
}) {
  return (
    <div>
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: expanded ? 'none' : '1px solid var(--border)' }}
      >
        <TypeSelector value={ticket.type as IssueType} onChange={v => onChange({ type: v })} />
        <InlineEdit
          value={ticket.title}
          onChange={v => onChange({ title: v })}
          placeholder="Ticket title..."
          className="flex-1 text-sm font-medium"
        />
        <SprintSelect value={ticket.sprintId} sprints={sprints} onChange={id => onChange({ sprintId: id })} />
        <RowMenu
          expanded={expanded}
          onToggleDesc={onToggle}
          onClone={onClone}
          onRemove={onRemove}
        />
      </div>
      {expanded && (
        <div className="px-5 py-3 animate-fade-in" style={{ borderBottom: '1px solid var(--border)', paddingLeft: '80px' }}>
          <InlineEdit
            value={ticket.description}
            onChange={v => onChange({ description: v })}
            placeholder="Description..."
            multiline
            className="text-xs"
            style={{ color: 'var(--text2)' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Row menu (three dots) ────────────────────────────────────────────────────

function RowMenu({ expanded, onToggleDesc, onClone, onRemove }: {
  expanded: boolean
  onToggleDesc: () => void
  onClone?: () => void
  onRemove?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative shrink-0">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
        style={{ color: 'var(--text3)', background: open ? 'var(--surface2)' : 'transparent' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="3" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="7" cy="11" r="1.2"/>
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 10 }} onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 rounded-lg py-1.5 shadow-lg animate-fade-in"
            style={{ zIndex: 11, background: 'var(--surface)', border: '1px solid var(--border)', minWidth: '160px' }}
          >
            <MenuItem
              label={expanded ? 'Hide description' : 'Show description'}
              onClick={() => { onToggleDesc(); setOpen(false) }}
            />
            {onClone && <MenuItem label="Clone ticket" onClick={() => { onClone(); setOpen(false) }} />}
            {onRemove && (
              <>
                <div className="my-1 mx-2" style={{ borderTop: '1px solid var(--border)' }} />
                <MenuItem label="Remove" onClick={() => { onRemove(); setOpen(false) }} danger />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left text-sm px-4 py-2 transition-colors block"
      style={{ color: danger ? 'var(--accent)' : 'var(--text2)', background: 'transparent', border: 'none', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </button>
  )
}

// ─── Sprint selector ──────────────────────────────────────────────────────────

function SprintSelect({ value, sprints, onChange }: {
  value: number | null | undefined
  sprints: JiraSprint[]
  onChange: (id: number | null) => void
}) {
  if (sprints.length === 0) return null
  return (
    <div className="relative shrink-0">
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="text-xs pl-2 pr-5 py-1 rounded-md cursor-pointer"
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text2)',
          outline: 'none',
          maxWidth: '150px',
        }}
      >
        <option value="">No sprint</option>
        {sprints.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: 'var(--text3)' }}
      >
        <path d="M2 3L4 5.5L6 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ─── Type badge / selector ────────────────────────────────────────────────────

const TYPE_COLORS: Record<IssueType, { bg: string; color: string }> = {
  Story: { bg: 'rgba(106,173,235,0.12)', color: 'var(--accent4)' },
  Task:  { bg: 'rgba(176,164,240,0.12)', color: 'var(--accent3)' },
  Bug:   { bg: 'rgba(232,132,94,0.12)', color: 'var(--accent)' },
}
const EPIC_COLOR = { bg: 'rgba(232,196,94,0.12)', color: 'var(--warn)' }

function TypeBadge({ type }: { type: string }) {
  const c = type === 'Epic' ? EPIC_COLOR : (TYPE_COLORS[type as IssueType] ?? TYPE_COLORS.Story)
  return (
    <span
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0"
      style={{ background: c.bg, color: c.color }}
    >
      {type}
    </span>
  )
}

function TypeSelector({ value, onChange }: { value: IssueType; onChange: (v: IssueType) => void }) {
  const c = TYPE_COLORS[value] ?? TYPE_COLORS.Story
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as IssueType)}
      className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 cursor-pointer"
      style={{
        appearance: 'none',
        WebkitAppearance: 'none',
        background: c.bg,
        color: c.color,
        border: 'none',
        outline: 'none',
        paddingRight: '18px',
      }}
    >
      <option value="Story">Story</option>
      <option value="Task">Task</option>
      <option value="Bug">Bug</option>
    </select>
  )
}

// ─── Inline edit ──────────────────────────────────────────────────────────────

interface InlineEditProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  style?: React.CSSProperties
}

function InlineEdit({ value, onChange, placeholder, multiline, className = '', style }: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: 0,
    margin: 0,
    fontFamily: 'inherit',
    fontSize: 'inherit',
    fontWeight: 'inherit',
    lineHeight: 'inherit',
    letterSpacing: 'inherit',
    color: 'var(--text)',
    boxSizing: 'border-box',
    ...style,
  }

  if (editing || !value) {
    return (
      <div className={`${className}`} style={{ minWidth: 0, minHeight: multiline ? '48px' : undefined }}>
        {multiline ? (
          <textarea
            autoFocus={editing}
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            placeholder={placeholder}
            rows={3}
            className="resize-none"
            style={{ ...inputStyle, lineHeight: 1.6 }}
          />
        ) : (
          <input
            autoFocus={editing}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            placeholder={placeholder}
            style={inputStyle}
          />
        )}
      </div>
    )
  }

  return (
    <div
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      className={`cursor-text ${className}`}
      style={{ ...style, color: value ? 'var(--text)' : 'var(--text3)', lineHeight: multiline ? 1.6 : undefined, whiteSpace: 'pre-wrap', minHeight: multiline ? '48px' : undefined }}
    >
      {value || placeholder}
    </div>
  )
}
