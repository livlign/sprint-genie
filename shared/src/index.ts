// ─── App Config ──────────────────────────────────────────────────────────────

export interface AppConfig {
  // Credentials
  anthropicApiKey: string
  geminiApiKey: string
  jiraEmail: string
  jiraApiToken: string
  jiraBaseUrl: string
  // OAuth 2.0 (3LO) — used when available, falls back to Basic auth
  jiraOAuthClientId: string
  jiraOAuthClientSecret: string
  jiraOAuthAccessToken: string
  jiraOAuthRefreshToken: string
  jiraOAuthExpiresAt: number        // Unix ms timestamp
  jiraCloudId: string               // Atlassian cloud site ID (resolved during OAuth)
  // Defaults shown in the session top bar
  defaultProject: string
  defaultPrefix: string
  defaultModel: string
  // Code browsing
  sourceCodePath: string
}

export type AppConfigUpdate = Partial<AppConfig>

export interface ConfigStatus {
  claudeConfigured: boolean
  jiraConfigured: boolean
  jiraAuthMode: 'oauth' | 'basic' | 'none'
}

// ─── Jira ────────────────────────────────────────────────────────────────────

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraSprint {
  id: number
  name: string
  state: 'active' | 'future' | 'closed'
  startDate?: string
  endDate?: string
}

export interface JiraIssueResult {
  key: string
  url: string
  summary: string
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export type IssueType = 'Story' | 'Task' | 'Bug' | 'Epic'

export interface Epic {
  title: string
  description: string
  sprintId?: number | null
}

export interface Ticket {
  id: string          // local UUID for UI keying
  type: IssueType
  title: string
  description: string
  sprintId?: number | null
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  role: MessageRole
  content: string
}

// ─── Session ─────────────────────────────────────────────────────────────────

export type SessionStatus = 'grooming' | 'building' | 'submitted'

export type InputMode = 'text' | 'markdown' | 'cpd'

export interface SessionSettings {
  project: string
  prefix: string
  sprintId: number | null
  model: string
  sourceCodePath: string
}

export interface SessionResult {
  epicKey: string
  ticketKeys: string[]
  submittedAt: string
}

export interface Session {
  id: string
  createdAt: string
  updatedAt: string
  status: SessionStatus
  inputMode: InputMode
  settings: SessionSettings
  conversation: ChatMessage[]
  epic: Epic | null
  tickets: Ticket[]
  result: SessionResult | null
}

// ─── API request/response shapes ─────────────────────────────────────────────

export interface ChatMessageRequest {
  sessionId: string
  message: string
  settings: SessionSettings
  conversation: ChatMessage[]
  sourceContext?: string
}

export interface GenerateTicketsRequest {
  sessionId: string
  conversation: ChatMessage[]
  settings: SessionSettings
}

export interface GenerateTicketsResponse {
  epic: Epic
  tickets: Ticket[]
}

export interface CreateJiraRequest {
  epic: Epic
  tickets: Ticket[]
  settings: SessionSettings
  sourceTicketKey?: string
}

export interface CreateJiraResponse {
  epicKey: string
  epicUrl: string
  tickets: JiraIssueResult[]
}
