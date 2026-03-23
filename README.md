# Sprint Genie

AI-powered sprint planning assistant. Turn rough ideas into structured Jira epics and tickets through an interactive grooming session.

## What it does

1. **Input** -- Paste text, upload markdown, or pull a discovery ticket from Jira
2. **AI Grooming** -- Chat with an AI to break down requirements interactively
3. **Ticket Builder** -- Review and edit the generated Epic + tickets in a form editor
4. **Submit to Jira** -- One click creates everything in Jira with proper linking and sprint assignment

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **AI:** Google Gemini (free) or Anthropic Claude (paid)
- **Integrations:** Jira Cloud (OAuth 2.0 or API token), local filesystem code browsing

## Prerequisites

- Node.js 18+
- npm 9+
- A Jira Cloud instance
- At least one AI API key (Gemini is free)

## Setup

1. **Clone and install:**

```bash
git clone https://github.com/your-username/sprint-genie.git
cd sprint-genie
npm install
```

2. **Configure credentials:**

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Or skip the `.env` and configure everything through the in-app Settings modal -- credentials are saved to a local `config.json` (gitignored).

3. **Start the dev server:**

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173).

4. **Open the app:**

Visit [http://localhost:5173](http://localhost:5173) in your browser.

## Configuration

All settings are configurable through the in-app Settings modal:

| Setting | Description |
|---------|-------------|
| Gemini API key | Free -- get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Anthropic API key | Optional, paid -- get one at [console.anthropic.com](https://console.anthropic.com) |
| Jira connection | OAuth 2.0 (recommended) or API token + email |
| Default project | Jira project key (e.g. `LH`) |
| Ticket prefix | Prefix for generated ticket titles (e.g. `[API-2]`) |
| AI model | Choose between Gemini Flash/Pro or Claude Sonnet/Haiku |
| Source code path | Local repo path for code-aware grooming |

### Jira Authentication

**Option A -- OAuth 2.0 (recommended):**

Add your OAuth app's `jiraOAuthClientId` and `jiraOAuthClientSecret` to `config.json`, then click "Connect to Jira" in Settings. The app will open a popup for Atlassian consent.

**Option B -- API token:**

1. Generate a token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Enter your email, token, and Jira base URL in Settings

## Project Structure

```
sprint-genie/
  backend/          Express API server
    src/
      routes/       API route handlers (chat, jira, config, code)
      services/     Business logic (claude, jira, oauth, config, code)
  frontend/         React SPA
    src/
      components/   UI components (ChatPanel, TicketBuilder, etc.)
      hooks/        Custom hooks (useChat, useJira, useSession, etc.)
  shared/           TypeScript types shared between frontend and backend
```

## Features

- **Dual AI support** -- Gemini (free) and Claude (paid) with streaming responses
- **Code-aware grooming** -- AI can browse your local source code to ground suggestions in your actual codebase
- **Session management** -- Auto-save to localStorage, resume previous sessions
- **Markdown import** -- Paste structured markdown to skip the AI chat and go straight to ticket editing
- **Flexible Jira auth** -- OAuth 2.0 or API token, your choice
- **Sprint assignment** -- Assign the epic and tickets to a sprint during creation
- **Issue linking** -- Automatically links the created epic to a source discovery ticket

## License

MIT
