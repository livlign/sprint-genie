import fs from 'fs'
import path from 'path'
import type { AppConfig } from 'sprint-genie-shared'

const CONFIG_PATH = path.resolve(__dirname, '../../../config.json')

// Placeholder values from .env.example that should not count as "configured"
const PLACEHOLDER_PATTERNS = [
  'sk-ant-...',
  'your-jira-api-token',
  'you@yourcompany.com',
  'https://yourcompany.atlassian.net',
]

const DEFAULTS: AppConfig = {
  anthropicApiKey: '',
  geminiApiKey: '',
  jiraEmail: '',
  jiraApiToken: '',
  jiraBaseUrl: '',
  jiraOAuthClientId: '',
  jiraOAuthClientSecret: '',
  jiraOAuthAccessToken: '',
  jiraOAuthRefreshToken: '',
  jiraOAuthExpiresAt: 0,
  jiraCloudId: '',
  defaultProject: '',
  defaultPrefix: '',
  defaultModel: 'gemini-2.0-flash',
  sourceCodePath: '',
}

// Read an env var, but reject known placeholder values from .env.example
function envOrEmpty(val: string | undefined): string {
  if (!val) return ''
  return PLACEHOLDER_PATTERNS.includes(val.trim()) ? '' : val
}

function readConfig(): AppConfig {
  // Layer: config.json on top of process.env fallbacks
  // Placeholder values from .env.example are filtered out
  const envBase: AppConfig = {
    anthropicApiKey: envOrEmpty(process.env.ANTHROPIC_API_KEY),
    geminiApiKey: envOrEmpty(process.env.GEMINI_API_KEY),
    jiraEmail: envOrEmpty(process.env.JIRA_EMAIL),
    jiraApiToken: envOrEmpty(process.env.JIRA_API_TOKEN),
    jiraBaseUrl: envOrEmpty(process.env.JIRA_BASE_URL),
    jiraOAuthClientId: envOrEmpty(process.env.JIRA_OAUTH_CLIENT_ID),
    jiraOAuthClientSecret: envOrEmpty(process.env.JIRA_OAUTH_CLIENT_SECRET),
    jiraOAuthAccessToken: '',
    jiraOAuthRefreshToken: '',
    jiraOAuthExpiresAt: 0,
    jiraCloudId: '',
    defaultProject: process.env.DEFAULT_PROJECT ?? '',
    defaultPrefix: process.env.DEFAULT_PREFIX ?? '',
    defaultModel: process.env.AI_MODEL ?? process.env.CLAUDE_MODEL ?? DEFAULTS.defaultModel,
    sourceCodePath: process.env.PROJECT_ROOT ?? '',
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    return envBase
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const saved: Partial<AppConfig> = JSON.parse(raw)
    // config.json wins over env, but empty strings fall back to env
    return {
      anthropicApiKey: saved.anthropicApiKey || envBase.anthropicApiKey,
      geminiApiKey: saved.geminiApiKey || envBase.geminiApiKey,
      jiraEmail: saved.jiraEmail || envBase.jiraEmail,
      jiraApiToken: saved.jiraApiToken || envBase.jiraApiToken,
      jiraBaseUrl: saved.jiraBaseUrl || envBase.jiraBaseUrl,
      jiraOAuthClientId: saved.jiraOAuthClientId || envBase.jiraOAuthClientId,
      jiraOAuthClientSecret: saved.jiraOAuthClientSecret || envBase.jiraOAuthClientSecret,
      jiraOAuthAccessToken: saved.jiraOAuthAccessToken || envBase.jiraOAuthAccessToken,
      jiraOAuthRefreshToken: saved.jiraOAuthRefreshToken || envBase.jiraOAuthRefreshToken,
      jiraOAuthExpiresAt: saved.jiraOAuthExpiresAt || envBase.jiraOAuthExpiresAt,
      jiraCloudId: saved.jiraCloudId || envBase.jiraCloudId,
      defaultProject: saved.defaultProject || envBase.defaultProject,
      defaultPrefix: saved.defaultPrefix || envBase.defaultPrefix,
      defaultModel: saved.defaultModel || envBase.defaultModel,
      sourceCodePath: saved.sourceCodePath || envBase.sourceCodePath,
    }
  } catch {
    return envBase
  }
}

function writeConfig(update: Partial<AppConfig>): AppConfig {
  // Read existing file (not env) so we don't wipe unsaved keys
  let existing: Partial<AppConfig> = {}
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    } catch {
      existing = {}
    }
  }

  const merged = { ...existing, ...update }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8')
  return readConfig()
}

function isRealValue(val: string): boolean {
  if (!val) return false
  const trimmed = val.trim()
  return trimmed.length > 0 && !PLACEHOLDER_PATTERNS.includes(trimmed)
}

function getStatus() {
  const cfg = readConfig()
  const hasOAuth = !!cfg.jiraOAuthAccessToken && !!cfg.jiraCloudId
  const hasBasic = isRealValue(cfg.jiraEmail) && isRealValue(cfg.jiraApiToken) && isRealValue(cfg.jiraBaseUrl)
  return {
    claudeConfigured: isRealValue(cfg.anthropicApiKey) || isRealValue(cfg.geminiApiKey),
    jiraConfigured: hasOAuth || hasBasic,
    jiraAuthMode: hasOAuth ? 'oauth' as const : hasBasic ? 'basic' as const : 'none' as const,
  }
}

export const configService = { readConfig, writeConfig, getStatus }
