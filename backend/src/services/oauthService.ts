import { configService } from './configService'

// ─── Atlassian OAuth 2.0 (3LO) ──────────────────────────────────────────────
// Docs: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/

const AUTH_URL = 'https://auth.atlassian.com/authorize'
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
const RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'
const CALLBACK_PATH = '/api/jira/oauth/callback'

// Classic scopes only — we avoid the Agile REST API entirely because its
// granular scopes (read:board-scope:jira-software) don't work reliably
// through the OAuth API gateway. Sprint discovery uses JQL search instead.
const SCOPES = [
  'read:jira-work',
  'write:jira-work',
  'offline_access',
].join(' ')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRedirectUri(): string {
  const port = process.env.PORT || 3001
  return `http://localhost:${port}${CALLBACK_PATH}`
}

// ─── Build authorisation URL ─────────────────────────────────────────────────

export function getAuthorizeUrl(state?: string): string {
  const cfg = configService.readConfig()
  if (!cfg.jiraOAuthClientId) {
    throw new Error('OAuth Client ID not configured. Add it in Settings first.')
  }

  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: cfg.jiraOAuthClientId,
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    prompt: 'consent',
    ...(state ? { state } : {}),
  })

  return `${AUTH_URL}?${params.toString()}`
}

// ─── Exchange authorisation code for tokens ──────────────────────────────────

export async function exchangeCode(code: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: number
  cloudId: string
}> {
  const cfg = configService.readConfig()

  // 1. Exchange code for tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: cfg.jiraOAuthClientId,
      client_secret: cfg.jiraOAuthClientSecret,
      code,
      redirect_uri: getRedirectUri(),
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Token exchange failed (${tokenRes.status}): ${body}`)
  }

  const tokenData = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }

  const expiresAt = Date.now() + tokenData.expires_in * 1000

  // 2. Resolve the cloud ID (which Jira site the user authorised)
  const resourcesRes = await fetch(RESOURCES_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
  })

  if (!resourcesRes.ok) {
    throw new Error(`Failed to fetch accessible resources (${resourcesRes.status})`)
  }

  const resources = await resourcesRes.json() as { id: string; name: string; url: string }[]

  if (resources.length === 0) {
    throw new Error('No accessible Atlassian sites found. Make sure you granted access to at least one site.')
  }

  // Use the first site (most common case — single Jira instance)
  const cloudId = resources[0].id

  // 3. Persist tokens + cloudId + site URL to config.json
  const siteUrl = resources[0].url?.replace(/\/$/, '') ?? ''
  configService.writeConfig({
    jiraOAuthAccessToken: tokenData.access_token,
    jiraOAuthRefreshToken: tokenData.refresh_token,
    jiraOAuthExpiresAt: expiresAt,
    jiraCloudId: cloudId,
    // Save the vanity URL so we can build browse links (e.g. https://foo.atlassian.net)
    ...(siteUrl ? { jiraBaseUrl: siteUrl } : {}),
  })

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt,
    cloudId,
  }
}

// ─── Refresh access token ────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<string> {
  const cfg = configService.readConfig()

  if (!cfg.jiraOAuthRefreshToken) {
    throw new Error('No refresh token available. Please re-connect to Jira via OAuth.')
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: cfg.jiraOAuthClientId,
      client_secret: cfg.jiraOAuthClientSecret,
      refresh_token: cfg.jiraOAuthRefreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    // If refresh token is expired/revoked, clear OAuth state
    if (res.status === 401 || res.status === 403) {
      configService.writeConfig({
        jiraOAuthAccessToken: '',
        jiraOAuthRefreshToken: '',
        jiraOAuthExpiresAt: 0,
        jiraCloudId: '',
      })
    }
    throw new Error(`Token refresh failed (${res.status}): ${body}`)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  const expiresAt = Date.now() + data.expires_in * 1000

  configService.writeConfig({
    jiraOAuthAccessToken: data.access_token,
    // Atlassian sometimes rotates the refresh token
    ...(data.refresh_token ? { jiraOAuthRefreshToken: data.refresh_token } : {}),
    jiraOAuthExpiresAt: expiresAt,
  })

  return data.access_token
}

// ─── Get a valid access token (refresh if needed) ────────────────────────────

export async function getValidAccessToken(): Promise<string> {
  const cfg = configService.readConfig()

  if (!cfg.jiraOAuthAccessToken) {
    throw new Error('Not connected to Jira via OAuth. Open Settings and click "Connect to Jira".')
  }

  // Refresh if token expires within the next 60 seconds
  if (cfg.jiraOAuthExpiresAt && cfg.jiraOAuthExpiresAt < Date.now() + 60_000) {
    return refreshAccessToken()
  }

  return cfg.jiraOAuthAccessToken
}

// ─── Disconnect (clear OAuth tokens) ─────────────────────────────────────────

export function disconnect(): void {
  configService.writeConfig({
    jiraOAuthAccessToken: '',
    jiraOAuthRefreshToken: '',
    jiraOAuthExpiresAt: 0,
    jiraCloudId: '',
  })
}
