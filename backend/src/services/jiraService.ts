import { configService } from './configService'
import * as oauth from './oauthService'
import type { JiraProject, JiraSprint } from 'sprint-genie-shared'

// ─── Auth ─────────────────────────────────────────────────────────────────────
// Prefers OAuth 2.0 when tokens exist; falls back to Basic auth

type AuthMode = 'oauth' | 'basic'

function getAuthMode(): AuthMode {
  const cfg = configService.readConfig()
  if (cfg.jiraOAuthAccessToken && cfg.jiraCloudId) return 'oauth'
  if (cfg.jiraEmail && cfg.jiraApiToken && cfg.jiraBaseUrl) return 'basic'
  throw new Error('Jira not configured. Open Settings to connect via OAuth or enter API credentials.')
}

async function getAuthHeader(): Promise<string> {
  const mode = getAuthMode()
  if (mode === 'oauth') {
    const token = await oauth.getValidAccessToken()
    return `Bearer ${token}`
  }
  const cfg = configService.readConfig()
  const encoded = Buffer.from(`${cfg.jiraEmail}:${cfg.jiraApiToken}`).toString('base64')
  return `Basic ${encoded}`
}

function getBaseUrl(): string {
  const cfg = configService.readConfig()
  const mode = getAuthMode()

  if (mode === 'oauth') {
    // OAuth uses the Atlassian API gateway with cloudId
    return `https://api.atlassian.com/ex/jira/${cfg.jiraCloudId}`
  }

  if (!cfg.jiraBaseUrl) {
    throw new Error('Jira base URL not configured. Open Settings to add your Jira URL.')
  }
  return cfg.jiraBaseUrl.replace(/\/$/, '')
}

/** Public getter so routes can build browse URLs */
export function getJiraBaseUrl(): string {
  const cfg = configService.readConfig()
  if (cfg.jiraBaseUrl) return cfg.jiraBaseUrl.replace(/\/$/, '')
  // For OAuth we don't know the vanity URL; we'll resolve it lazily if needed
  return ''
}

async function jiraFetch<T>(
  path: string,
  options: RequestInit = {},
  useAgile = false,
): Promise<T> {
  const base = getBaseUrl()
  const apiBase = useAgile ? `${base}/rest/agile/1.0` : `${base}/rest/api/3`
  const url = `${apiBase}${path}`

  const authHeader = await getAuthHeader()

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Jira API error: ${res.status} ${url}`)
    console.error(`  Response: ${body}`)
    throw new Error(`Jira API ${res.status} on ${path}: ${body}`)
  }

  return res.json() as Promise<T>
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjects(): Promise<JiraProject[]> {
  const data = await jiraFetch<{ values?: unknown[]; [key: string]: unknown }>('/project/search?maxResults=50&orderBy=name')
  const items: unknown[] = data.values ?? (Array.isArray(data) ? data : [])
  return (items as { id: string; key: string; name: string }[]).map(p => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }))
}

// ─── Sprints (via JQL — avoids Agile API scope issues with OAuth) ────────────
// Instead of GET /rest/agile/1.0/board → GET /board/{id}/sprint,
// we search for issues with sprint data using the platform API (read:jira-work).

/** Search for issue keys via JQL (v3/search/jql no longer returns field values). */
async function jqlSearchKeys(jql: string, maxResults: number): Promise<string[]> {
  const base = getBaseUrl()
  const params = new URLSearchParams({
    jql,
    maxResults: String(maxResults),
  })
  const url = `${base}/rest/api/3/search/jql?${params.toString()}`
  const authHeader = await getAuthHeader()

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`JQL search error: ${res.status} ${url}`)
    console.error(`  Response: ${body}`)
    return []
  }

  const data = await res.json() as { issues?: { id: string }[] }
  return (data.issues ?? []).map(i => i.id).filter(Boolean)
}

export async function getSprints(projectKey: string): Promise<JiraSprint[]> {
  // v3/search/jql no longer returns field values, so we:
  // 1. Use JQL to find issue keys in open/future sprints
  // 2. Fetch a single issue via /rest/api/3/issue/{key} to read sprint fields
  // Fetch many issue IDs to maximize sprint discovery (each issue only knows its own sprint)
  const [activeIds, futureIds] = await Promise.all([
    jqlSearchKeys(`project = "${projectKey}" AND sprint in openSprints() ORDER BY created DESC`, 50),
    jqlSearchKeys(`project = "${projectKey}" AND sprint in futureSprints() ORDER BY created DESC`, 50),
  ])

  const allIds = [...new Set([...activeIds, ...futureIds])]
  if (allIds.length === 0) return []

  // Fetch sprint fields from individual issues — but limit API calls.
  // Pick one issue per "page" to spread across different sprints.
  // We fetch up to 20 issues to discover sprints without hammering the API.
  const sampled = allIds.length <= 20 ? allIds : allIds.filter((_, i) => i % Math.ceil(allIds.length / 20) === 0)

  const sprintMap = new Map<number, JiraSprint>()

  await Promise.all(sampled.map(async (issueId) => {
    try {
      const data = await jiraFetch<{ fields: Record<string, unknown> }>(
        `/issue/${issueId}?fields=customfield_10007`,
      )
      const sprintField = data.fields.customfield_10007
      const sprintArray = Array.isArray(sprintField) ? sprintField : sprintField ? [sprintField] : []
      for (const s of sprintArray) {
        if (s && typeof s === 'object' && 'id' in s) {
          const sprint = s as { id: number; name: string; state: string; startDate?: string; endDate?: string }
          if (!sprintMap.has(sprint.id)) {
            sprintMap.set(sprint.id, {
              id: sprint.id,
              name: sprint.name,
              state: sprint.state as JiraSprint['state'],
              startDate: sprint.startDate,
              endDate: sprint.endDate,
            })
          }
        }
      }
    } catch (err) {
      console.error(`Failed to fetch sprint data from issue ${issueId}:`, err)
    }
  }))

  // Sort: active sprints first, then future, by start date
  const stateOrder: Record<string, number> = { active: 0, future: 1, closed: 2 }
  return Array.from(sprintMap.values()).sort((a, b) => {
    const orderDiff = (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9)
    if (orderDiff !== 0) return orderDiff
    return (a.startDate ?? '').localeCompare(b.startDate ?? '')
  })
}

// ─── Fetch issue (for CPD input) ──────────────────────────────────────────────

export async function getIssue(rawKey: string): Promise<{ key: string; summary: string; description: string }> {
  // Accept full Jira URLs like https://foo.atlassian.net/browse/CPD-1198
  const match = rawKey.match(/\/browse\/([A-Z][\w]+-\d+)/i)
  const key = match ? match[1] : rawKey

  const data = await jiraFetch<{
    key: string
    fields: { summary: string; description?: { content?: unknown[] } }
  }>(`/issue/${key}?fields=summary,description`)

  // Extract plain text from Atlassian Document Format
  const description = extractAdfText(data.fields.description)
  return { key: data.key, summary: data.fields.summary, description }
}

function extractAdfText(doc: { content?: unknown[] } | null | undefined): string {
  if (!doc) return ''
  const lines: string[] = []
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: string; text?: string; content?: unknown[] }
    if (n.text) lines.push(n.text)
    if (Array.isArray(n.content)) n.content.forEach(walk)
  }
  walk(doc)
  return lines.join(' ').trim()
}

// ─── Create issues ────────────────────────────────────────────────────────────

interface CreateResult {
  id: string
  key: string
  self: string
}

export async function createEpic(
  projectKey: string,
  title: string,
  description: string,
): Promise<CreateResult> {
  const body = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: toAdf(description),
      issuetype: { name: 'Epic' },
      // Epic Name field — required in classic Jira projects
      ...(title ? { customfield_10011: title } : {}),
    },
  }
  return jiraFetch<CreateResult>('/issue', { method: 'POST', body: JSON.stringify(body) })
}

export async function createTicket(
  projectKey: string,
  type: string,
  title: string,
  description: string,
  epicKey: string,
): Promise<CreateResult> {
  const body = {
    fields: {
      project: { key: projectKey },
      summary: title,
      description: toAdf(description),
      issuetype: { name: type },
      // Modern Jira uses `parent` to link to epic; classic uses customfield_10014
      parent: { key: epicKey },
    },
  }
  return jiraFetch<CreateResult>('/issue', { method: 'POST', body: JSON.stringify(body) })
}

export async function moveToSprint(sprintId: number, issueKeys: string[]): Promise<void> {
  // Use the platform API to set the sprint field on each issue
  // (avoids Agile API scope issues with OAuth)
  // The sprint field is typically customfield_10007 in Jira Cloud
  for (const key of issueKeys) {
    await jiraFetch(`/issue/${key}`, {
      method: 'PUT',
      body: JSON.stringify({
        fields: {
          // Try the standard sprint custom field
          customfield_10007: sprintId,
        },
      }),
    })
  }
}

// ─── Issue linking ───────────────────────────────────────────────────────────

export async function linkIssues(
  fromKey: string,
  toKey: string,
  linkType = 'Relates',
): Promise<void> {
  await jiraFetch('/issueLink', {
    method: 'POST',
    body: JSON.stringify({
      type: { name: linkType },
      inwardIssue: { key: fromKey },
      outwardIssue: { key: toKey },
    }),
  })
}

// ─── ADF helpers ─────────────────────────────────────────────────────────────
// Converts plain markdown-ish text to minimal Atlassian Document Format

function toAdf(text: string): object {
  const paragraphs = text.split(/\n\n+/).filter(Boolean)
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map(para => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para.replace(/\n/g, ' ') }],
    })),
  }
}
