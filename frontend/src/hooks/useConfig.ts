import { useState, useEffect, useCallback } from 'react'
import type { AppConfig, ConfigStatus } from 'sprint-genie-shared'

export interface ConfigState extends Partial<AppConfig> {
  _hasAnthropicKey?: boolean
  _hasGeminiKey?: boolean
  _hasJiraToken?: boolean
  _hasOAuthTokens?: boolean
  _status?: ConfigStatus
}

export function useConfig() {
  const [config, setConfig] = useState<ConfigState>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error('Failed to load config')
      const data = await res.json()
      setConfig(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const saveConfig = useCallback(async (update: Partial<AppConfig>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      if (!res.ok) throw new Error('Failed to save config')
      const data = await res.json()
      // Refresh full config after save
      await fetchConfig()
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      throw e
    } finally {
      setSaving(false)
    }
  }, [fetchConfig])

  const status: ConfigStatus = config._status ?? {
    claudeConfigured: (config._hasAnthropicKey || config._hasGeminiKey) ?? false,
    jiraConfigured: false,
    jiraAuthMode: 'none',
  }

  return { config, status, loading, saving, error, saveConfig, refetch: fetchConfig }
}
