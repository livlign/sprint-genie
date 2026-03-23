import { useState, useEffect } from 'react'
import type { JiraProject, JiraSprint } from 'sprint-genie-shared'

export function useJiraProjects(enabled: boolean) {
  const [projects, setProjects] = useState<JiraProject[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    fetch('/api/jira/projects')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setProjects(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [enabled])

  return { projects, loading, error }
}

export function useJiraSprints(projectKey: string) {
  const [sprints, setSprints] = useState<JiraSprint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectKey) { setSprints([]); setError(null); return }
    setLoading(true)
    setError(null)
    fetch(`/api/jira/sprints?projectKey=${encodeURIComponent(projectKey)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          console.warn('Sprint fetch error:', data.error)
          setError(data.error)
          setSprints([])
        } else {
          setSprints(data)
        }
      })
      .catch(e => {
        console.warn('Sprint fetch failed:', e)
        setError(e.message ?? 'Failed to load sprints')
      })
      .finally(() => setLoading(false))
  }, [projectKey])

  return { sprints, loading, error }
}

export async function fetchCpdIssue(key: string) {
  const res = await fetch(`/api/jira/issue/${encodeURIComponent(key)}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data as { key: string; summary: string; description: string }
}
