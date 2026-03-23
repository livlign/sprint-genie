import { useState, useEffect, useCallback } from 'react'
import type { AppConfig } from 'sprint-genie-shared'
import type { ConfigState } from '../hooks/useConfig'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  config: ConfigState
  saving: boolean
  onSave: (update: Partial<AppConfig>) => Promise<unknown>
  onRefetch?: () => void
}

type Tab = 'credentials' | 'defaults' | 'code'

const MODELS = [
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (free)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (free, latest)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (free, most capable)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (paid)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (paid)' },
]

const MASK = '--------'

export default function SettingsModal({ open, onClose, config, saving, onSave, onRefetch }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('credentials')
  const [form, setForm] = useState<Partial<AppConfig>>({})
  const [saved, setSaved] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [oauthConnected, setOauthConnected] = useState<boolean | null>(null)

  const hasOAuth = oauthConnected ?? (config._hasOAuthTokens ?? false)
  const hasClientId = !!config.jiraOAuthClientId

  // Populate form from config whenever modal opens
  useEffect(() => {
    if (open) {
      setForm({
        anthropicApiKey: config._hasAnthropicKey ? MASK : '',
        jiraEmail: config.jiraEmail ?? '',
        jiraApiToken: config._hasJiraToken ? MASK : '',
        jiraBaseUrl: config.jiraBaseUrl ?? '',
        defaultProject: config.defaultProject ?? '',
        defaultPrefix: config.defaultPrefix ?? '',
        geminiApiKey: config._hasGeminiKey ? MASK : '',
        defaultModel: config.defaultModel ?? 'gemini-2.0-flash',
        sourceCodePath: config.sourceCodePath ?? '',
      })
      setSaved(false)
      setOauthConnected(null)
    }
  }, [open, config])

  // Listen for OAuth popup callback
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'sprint-genie:oauth') {
        setOauthLoading(false)
        if (e.data.success) {
          setOauthConnected(true)
        }
        onRefetch?.()
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onRefetch])

  // Escape to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) onClose()
  }, [open, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!open) return null

  function set(key: keyof AppConfig, value: string) {
    setForm(f => ({ ...f, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    const toSave = { ...form }
    if (hasOAuth || hasClientId) {
      delete toSave.jiraEmail
      delete toSave.jiraApiToken
      delete toSave.jiraBaseUrl
    }
    await onSave(toSave)
    setSaved(true)
    setTimeout(() => onClose(), 600)
  }

  async function handleConnectJira() {
    setOauthLoading(true)
    try {
      const res = await fetch('/api/jira/oauth/start')
      const data = await res.json()
      if (data.url) {
        const w = 600, h = 700
        const left = window.screenX + (window.innerWidth - w) / 2
        const top = window.screenY + (window.innerHeight - h) / 2
        window.open(data.url, 'jira-oauth', `width=${w},height=${h},left=${left},top=${top}`)
      } else {
        throw new Error(data.error ?? 'Failed to start OAuth')
      }
    } catch {
      setOauthLoading(false)
    }
  }

  async function handleDisconnectJira() {
    setDisconnecting(true)
    try {
      await fetch('/api/jira/oauth/disconnect', { method: 'POST' })
      setOauthConnected(false)
      onRefetch?.()
    } finally {
      setDisconnecting(false)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'credentials', label: 'Credentials' },
    { id: 'defaults', label: 'Defaults' },
    { id: 'code', label: 'Code browsing' },
  ]

  const jiraAuthMode = config._status?.jiraAuthMode ?? 'none'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-scale-in"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-display font-semibold text-lg" style={{ color: 'var(--text)' }}>Settings</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Saved to config.json in your project root</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: 'var(--text3)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-2 pt-1" style={{ borderBottom: '1px solid var(--border)' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg"
              style={{
                color: tab === t.id ? 'var(--text)' : 'var(--text3)',
                background: tab === t.id ? 'var(--surface2)' : 'transparent',
              }}
            >
              {t.label}
              {tab === t.id && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full" style={{ background: 'var(--accent4)' }} />
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {tab === 'credentials' && (
            <>
              {/* Gemini */}
              <Field
                label="Gemini API key (free)"
                hint={<>Get yours at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent4)' }}>aistudio.google.com/apikey</a></>}
                type="password"
                placeholder="AIza..."
                value={form.geminiApiKey ?? ''}
                onChange={v => set('geminiApiKey', v)}
                isMasked={form.geminiApiKey === MASK}
              />

              {/* Anthropic */}
              <Field
                label="Anthropic API key (paid, optional)"
                hint={<>Get yours at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent4)' }}>console.anthropic.com</a></>}
                type="password"
                placeholder="sk-ant-..."
                value={form.anthropicApiKey ?? ''}
                onChange={v => set('anthropicApiKey', v)}
                isMasked={form.anthropicApiKey === MASK}
              />

              <div style={{ borderTop: '1px solid var(--border)' }} />

              {/* Jira OAuth */}
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  Jira connection
                </label>

                {hasOAuth ? (
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: 'var(--glow-teal)', border: '1px solid rgba(89,201,155,0.2)' }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent2)', boxShadow: '0 0 6px rgba(89,201,155,0.4)' }} />
                      <span className="text-sm font-medium" style={{ color: 'var(--accent2)' }}>Connected via OAuth</span>
                    </div>
                    <button
                      onClick={handleDisconnectJira}
                      disabled={disconnecting}
                      className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--text3)', border: '1px solid var(--border)', background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                ) : hasClientId ? (
                  <div className="flex flex-col gap-2">
                    <div
                      className="rounded-xl p-4 text-sm leading-relaxed"
                      style={{ background: 'var(--surface2)', color: 'var(--text2)' }}
                    >
                      Click below to connect your Jira account via OAuth. A popup will open for you to grant access.
                    </div>
                    <button
                      onClick={handleConnectJira}
                      disabled={oauthLoading}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity"
                      style={{
                        background: 'linear-gradient(135deg, #2684FF, #0052CC)',
                        color: '#fff',
                        border: 'none',
                        opacity: oauthLoading ? 0.6 : 1,
                        cursor: oauthLoading ? 'wait' : 'pointer',
                      }}
                    >
                      {oauthLoading ? 'Waiting for Jira...' : 'Connect to Jira'}
                    </button>
                  </div>
                ) : (
                  <div
                    className="rounded-xl p-4 text-sm leading-relaxed"
                    style={{ background: 'var(--surface2)', color: 'var(--text2)' }}
                  >
                    No OAuth app configured. Enter your Jira credentials manually below, or add <code style={{ color: 'var(--accent4)', fontSize: '12px' }}>jiraOAuthClientId</code> and <code style={{ color: 'var(--accent4)', fontSize: '12px' }}>jiraOAuthClientSecret</code> to config.json to enable OAuth.
                  </div>
                )}
              </div>

              {/* Manual Jira fields */}
              {!hasOAuth && !hasClientId && (
                <>
                  <Field
                    label="Jira email"
                    placeholder="you@yourcompany.com"
                    value={form.jiraEmail ?? ''}
                    onChange={v => set('jiraEmail', v)}
                  />
                  <Field
                    label="Jira API token"
                    hint={<>Generate at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" style={{ color: 'var(--accent4)' }}>Atlassian account settings</a></>}
                    type="password"
                    placeholder="Your Jira API token"
                    value={form.jiraApiToken ?? ''}
                    onChange={v => set('jiraApiToken', v)}
                    isMasked={form.jiraApiToken === MASK}
                  />
                  <Field
                    label="Jira base URL"
                    placeholder="https://yourcompany.atlassian.net"
                    value={form.jiraBaseUrl ?? ''}
                    onChange={v => set('jiraBaseUrl', v)}
                  />
                </>
              )}

              {/* Auth mode badge */}
              {jiraAuthMode === 'basic' && !hasOAuth && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text3)' }}>
                  <div className="w-2 h-2 rounded-full" style={{ background: 'var(--warn)' }} />
                  Using API token (Basic auth)
                </div>
              )}
            </>
          )}

          {tab === 'defaults' && (
            <>
              <Field
                label="Default Jira project key"
                placeholder="e.g. LH"
                value={form.defaultProject ?? ''}
                onChange={v => set('defaultProject', v)}
              />
              <Field
                label="Default ticket prefix"
                placeholder="e.g. [API-2]"
                value={form.defaultPrefix ?? ''}
                onChange={v => set('defaultPrefix', v)}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                  AI model
                </label>
                <select
                  value={form.defaultModel ?? 'gemini-2.0-flash'}
                  onChange={e => set('defaultModel', e.target.value)}
                  className="rounded-xl px-3 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                >
                  {MODELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {tab === 'code' && (
            <>
              <div className="rounded-xl p-4 text-sm leading-relaxed" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                When set, AI can browse your local source code during grooming sessions -- reading files and searching for patterns to make ticket descriptions more accurate and grounded.
              </div>
              <Field
                label="Project root path"
                placeholder="/Users/you/code/my-project"
                value={form.sourceCodePath ?? ''}
                onChange={v => set('sourceCodePath', v)}
                hint="Absolute path to the repo AI should browse. Leave blank to disable."
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {saved ? (
            <span className="text-sm font-medium flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 7.5L5.5 9.5L10.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Saved
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text3)' }}>
              Changes take effect immediately
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm transition-colors"
              style={{ color: 'var(--text2)', background: 'transparent', border: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: saving ? 'var(--surface2)' : 'var(--accent4)',
                color: saving ? 'var(--text3)' : '#0c0b0a',
              }}
            >
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Field helper ─────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: React.ReactNode
  type?: 'text' | 'password'
  isMasked?: boolean
}

function Field({ label, value, onChange, placeholder, hint, type = 'text', isMasked }: FieldProps) {
  const [revealed, setRevealed] = useState(false)
  const inputType = type === 'password' && !revealed ? 'password' : 'text'

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          type={inputType}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (isMasked) onChange('') }}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none pr-10 transition-colors"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setRevealed(r => !r)}
            className="absolute right-2.5 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
            style={{ color: 'var(--text3)' }}
            tabIndex={-1}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          >
            {revealed ? 'hide' : 'show'}
          </button>
        )}
      </div>
      {hint && <p className="text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>{hint}</p>}
    </div>
  )
}
