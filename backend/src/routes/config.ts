import { Router } from 'express'
import { configService } from '../services/configService'
import type { AppConfigUpdate } from 'sprint-genie-shared'

const router = Router()

// GET /api/config — returns current config (masks secrets partially)
router.get('/', (_req, res) => {
  const cfg = configService.readConfig()
  const status = configService.getStatus()

  // Mask secrets: only expose whether they are set, not the actual value
  res.json({
    ...cfg,
    anthropicApiKey: cfg.anthropicApiKey ? '••••••••' : '',
    geminiApiKey: cfg.geminiApiKey ? '••••••••' : '',
    jiraApiToken: cfg.jiraApiToken ? '••••••••' : '',
    jiraOAuthClientSecret: cfg.jiraOAuthClientSecret ? '••••••••' : '',
    jiraOAuthAccessToken: cfg.jiraOAuthAccessToken ? '••••••••' : '',
    jiraOAuthRefreshToken: cfg.jiraOAuthRefreshToken ? '••••••••' : '',
    _status: status,
    _hasAnthropicKey: !!cfg.anthropicApiKey,
    _hasGeminiKey: !!cfg.geminiApiKey,
    _hasJiraToken: !!cfg.jiraApiToken,
    _hasOAuthTokens: !!cfg.jiraOAuthAccessToken && !!cfg.jiraCloudId,
  })
})

// POST /api/config — save config fields (only updates keys that are sent)
// Sending "••••••••" for a secret means "don't change it"
router.post('/', (req, res) => {
  const body: AppConfigUpdate = req.body
  const MASK = '••••••••'

  // Strip masked placeholder values so we don't overwrite real secrets
  const update: AppConfigUpdate = { ...body }
  if (update.anthropicApiKey === MASK) delete update.anthropicApiKey
  if (update.geminiApiKey === MASK) delete update.geminiApiKey
  if (update.jiraApiToken === MASK) delete update.jiraApiToken
  if (update.jiraOAuthClientSecret === MASK) delete update.jiraOAuthClientSecret
  if (update.jiraOAuthAccessToken === MASK) delete update.jiraOAuthAccessToken
  if (update.jiraOAuthRefreshToken === MASK) delete update.jiraOAuthRefreshToken

  const updated = configService.writeConfig(update)
  const status = configService.getStatus()

  res.json({
    ok: true,
    _status: status,
    _hasAnthropicKey: !!updated.anthropicApiKey,
    _hasJiraToken: !!updated.jiraApiToken,
    _hasOAuthTokens: !!updated.jiraOAuthAccessToken && !!updated.jiraCloudId,
  })
})

// GET /api/config/status — lightweight connection status for top bar
router.get('/status', (_req, res) => {
  res.json(configService.getStatus())
})

export default router
