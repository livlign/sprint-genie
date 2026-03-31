import { Router } from 'express'
import * as jira from '../services/jiraService'
import * as oauth from '../services/oauthService'
import type { CreateJiraRequest } from 'sprint-genie-shared'

const router = Router()

// ─── OAuth 2.0 (3LO) ────────────────────────────────────────────────────────

// GET /api/jira/oauth/start — redirect to Atlassian consent screen
router.get('/oauth/start', (_req, res) => {
  try {
    const url = oauth.getAuthorizeUrl()
    res.json({ url })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/jira/oauth/callback — exchange code for tokens
router.get('/oauth/callback', async (req, res) => {
  const { code, error: oauthError } = req.query

  if (oauthError) {
    // User denied consent or something went wrong
    return res.send(callbackHtml(false, `OAuth error: ${oauthError}`))
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).send(callbackHtml(false, 'Missing authorization code'))
  }

  try {
    await oauth.exchangeCode(code)
    res.send(callbackHtml(true))
  } catch (e) {
    res.status(400).send(callbackHtml(false, (e as Error).message))
  }
})

// POST /api/jira/oauth/disconnect — clear OAuth tokens
router.post('/oauth/disconnect', (_req, res) => {
  oauth.disconnect()
  res.json({ ok: true })
})

// Small HTML page that closes the popup and notifies the opener
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function callbackHtml(success: boolean, error?: string): string {
  const safeError = escapeHtml(error ?? 'Unknown error')
  return `<!DOCTYPE html>
<html>
<head><title>Sprint Genie – Jira Connection</title>
<style>
  body { font-family: system-ui, sans-serif; background: #1a1a1a; color: #e0e0e0;
         display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
  .card { text-align: center; padding: 32px; border-radius: 16px; background: #242424;
          border: 1px solid #333; max-width: 360px; }
  h2 { margin: 0 0 8px; font-size: 18px; }
  p  { font-size: 13px; color: #999; margin: 0; }
  .ok  { color: #4ade80; }
  .err { color: #f09b7b; }
</style></head>
<body>
<div class="card">
  ${success
    ? '<h2 class="ok">Connected to Jira!</h2><p>You can close this window.</p>'
    : `<h2 class="err">Connection failed</h2><p>${safeError}</p>`
  }
</div>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'sprint-genie:oauth', success: ${success} }, 'http://localhost:5173');
    setTimeout(() => window.close(), ${success ? 1500 : 5000});
  }
</script>
</body></html>`
}

// GET /api/jira/oauth/debug — show token scopes (dev only)
if (process.env.NODE_ENV !== 'production') {
  router.get('/oauth/debug', (_req, res) => {
    try {
      const cfg = (require('../services/configService') as { configService: { readConfig: () => Record<string, unknown> } }).configService.readConfig()
      const token = cfg.jiraOAuthAccessToken as string
      if (!token) return res.json({ error: 'No access token' })
      // Decode JWT payload (no verification — just for debugging)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
      res.json({
        scope: payload.scope,
        scopes: (payload.scope as string)?.split(' ') ?? [],
        exp: new Date((payload.exp as number) * 1000).toISOString(),
        cloudId: cfg.jiraCloudId,
        jiraBaseUrl: cfg.jiraBaseUrl,
      })
    } catch (e) {
      res.status(500).json({ error: (e as Error).message })
    }
  })
}

// GET /api/jira/projects
router.get('/projects', async (_req, res) => {
  try {
    const projects = await jira.getProjects()
    res.json(projects)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/jira/sprints?projectKey=LH
router.get('/sprints', async (req, res) => {
  const { projectKey } = req.query
  if (!projectKey || typeof projectKey !== 'string') {
    return res.status(400).json({ error: 'projectKey query param required' })
  }
  try {
    const sprints = await jira.getSprints(projectKey)
    res.json(sprints)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/jira/epics?projectKey=LH&q=search+term
router.get('/epics', async (req, res) => {
  const { projectKey, q } = req.query
  if (!projectKey || typeof projectKey !== 'string') {
    return res.status(400).json({ error: 'projectKey query param required' })
  }
  try {
    const epics = await jira.searchEpics(projectKey, (q as string) ?? '')
    res.json(epics)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// GET /api/jira/issue/:key — fetch a CPD ticket
router.get('/issue/:key', async (req, res) => {
  try {
    const issue = await jira.getIssue(req.params.key)
    res.json(issue)
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// POST /api/jira/create — create Epic + all child tickets + assign to sprint
router.post('/create', async (req, res) => {
  const { epic, tickets, settings, sourceTicketKey } = req.body as CreateJiraRequest

  if (!epic || !tickets || !settings?.project) {
    return res.status(400).json({ error: 'epic, tickets and settings.project are required' })
  }

  const results: { key: string; url: string; summary: string }[] = []
  const baseUrl = settings.project // will use jiraBaseUrl from config
  let epicKey = ''

  try {
    let jiraBase = jira.getJiraBaseUrl()
    const useExistingEpic = !!epic.existingEpicKey

    if (useExistingEpic) {
      // Use existing epic — skip creation
      epicKey = epic.existingEpicKey!

      // Resolve jiraBase from a lightweight API call
      if (!jiraBase) {
        try {
          const info = await jira.getIssue(epicKey)
          // getIssue doesn't return self, so jiraBase might still be empty
          void info
        } catch { /* non-fatal */ }
      }
    } else {
      // 1. Create Epic
      const epicResult = await jira.createEpic(settings.project, epic.title, epic.description)
      epicKey = epicResult.key

      // Resolve the Jira browse base URL
      // For Basic auth: use jiraBaseUrl from config
      // For OAuth: extract from the `self` URL returned by the API
      if (!jiraBase && epicResult.self) {
        // self looks like: https://yourcompany.atlassian.net/rest/api/3/issue/12345
        const m = epicResult.self.match(/^(https:\/\/[^/]+)/)
        if (m) jiraBase = m[1]
      }

      results.push({
        key: epicKey,
        url: `${jiraBase}/browse/${epicKey}`,
        summary: epic.title,
      })

      // 1b. Link epic to source ticket (e.g. CPD-1198) if provided
      if (sourceTicketKey) {
        try {
          await jira.linkIssues(epicKey, sourceTicketKey, 'Idea')
        } catch (linkErr) {
          console.warn('Issue link failed (non-fatal):', (linkErr as Error).message)
        }
      }

      // 2. Move epic to its sprint (if set)
      const epicSprintId = epic.sprintId ?? settings.sprintId
      if (epicSprintId) {
        try {
          await jira.moveToSprint(epicSprintId, [epicKey])
        } catch (sprintErr) {
          console.warn('Epic sprint assignment failed (non-fatal):', (sprintErr as Error).message)
        }
      }
    }

    // 3. Create child tickets sequentially (preserves order, avoids rate limits)
    const sprintGroups = new Map<number, string[]>()
    for (const ticket of tickets) {
      const ticketResult = await jira.createTicket(
        settings.project,
        ticket.type,
        ticket.title,
        ticket.description,
        epicKey,
      )
      results.push({
        key: ticketResult.key,
        url: `${jiraBase}/browse/${ticketResult.key}`,
        summary: ticket.title,
      })

      // Group by sprint for batch assignment
      const sid = ticket.sprintId ?? settings.sprintId
      if (sid) {
        const group = sprintGroups.get(sid) ?? []
        group.push(ticketResult.key)
        sprintGroups.set(sid, group)
      }
    }

    // 4. Move tickets to their sprints
    for (const [sprintId, keys] of sprintGroups) {
      try {
        await jira.moveToSprint(sprintId, keys)
      } catch (sprintErr) {
        console.warn(`Sprint ${sprintId} assignment failed (non-fatal):`, (sprintErr as Error).message)
      }
    }

    res.json({
      epicKey,
      epicUrl: `${jiraBase}/browse/${epicKey}`,
      tickets: useExistingEpic ? results : results.slice(1), // exclude epic from tickets list only when we created it
      existingEpic: useExistingEpic,
    })
  } catch (e) {
    // Partial failure: return what succeeded + the error
    res.status(207).json({
      error: (e as Error).message,
      partial: results,
      epicKey,
    })
  }
})

export default router
