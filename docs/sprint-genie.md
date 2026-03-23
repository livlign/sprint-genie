# Sprint Genie — Complete Project Documentation

> AI-powered sprint planning assistant — Turn rough ideas into structured Jira epics and tickets through an interactive grooming session with Claude.

**Version:** 1.0
**Date:** 2026-03-21
**Status:** Design & Planning

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Product Requirements (PRD)](#2-product-requirements)
3. [Architecture Decision Records](#3-architecture-decision-records)
   - ADR-001: Tech Stack
   - ADR-002: AI Integration
   - ADR-003: Jira Integration
   - ADR-004: Data Persistence
   - ADR-005: Code Browsing
4. [UI Design](#4-ui-design)
5. [Implementation Task List](#5-implementation-task-list)

---

## 1. Project Overview

### Problem

As a Technical Lead, preparing epics and tickets for sprints is a significant time drain. The process involves taking a raw idea, PRD, or conversation summary, breaking it down into requirements and use cases, structuring it as an Epic with child tickets in Jira, and manually creating each ticket with proper descriptions, prefixes, and sprint assignments. This repetitive workflow can take 30-60 minutes per feature, multiple times per sprint.

### Solution

Sprint Genie is a local webapp that automates this workflow end-to-end:

1. **Input** — Paste text, upload a .md file, or pull a CPD discovery ticket from Jira
2. **AI Grooming** — Chat with Claude to break down requirements interactively
3. **Ticket Builder** — Review and edit the generated Epic + tickets in a form-based editor
4. **Submit to Jira** — One click creates everything in Jira with proper linking

### Target Users

- Technical Leads managing sprint planning
- Engineering Managers preparing backlogs
- Anyone who creates Jira epics/tickets regularly

### Success Metrics

- Time to create a full Epic + tickets: under 10 minutes (from 45+ min baseline)
- Ticket quality: descriptions consistently include problem, expectation, and approach
- Adoption: shareable with team members via simple setup instructions

---

## 2. Product Requirements

### 2.1 User Flow

#### Input Stage

The user provides context for the feature/bug/task through one of these input methods:

| Method | Description | Priority |
|--------|-------------|----------|
| Free text | Type or paste a rough idea directly | v1 |
| Paste / .md file | Paste formatted text or upload a markdown file | v1 |
| CPD ticket | Enter a CPD discovery ticket ID; app fetches description from Jira | v1 |
| Google Docs link | Fetch content from a Google Docs URL | v2 (stretch) |

#### AI Grooming Stage

- A chat interface (left panel) where the user and Claude have a back-and-forth grooming session
- **Code-aware grooming**: Claude can browse the local source code during the grooming session to understand current implementations, data models, and architecture — making solution design more grounded and ticket descriptions more precise
- Claude adapts its questioning based on the type of work:
  - **Feature**: Requirements, use cases, scope boundaries, user stories — references existing code patterns
  - **Bug**: Reproduction steps, expected vs actual behavior, impact — can inspect the relevant code paths
  - **Refactoring**: Current pain points, desired state, migration strategy — understands what exists today
  - **Investigation/Spike**: Questions to answer, success criteria, time-box
- The grooming output structure is flexible, not a rigid template — Claude adapts to the context
- The user signals completion with an explicit "Done, generate tickets" action
- Claude then auto-generates a first draft of the Epic + child tickets

#### Ticket Builder Stage

- A form-based editor (right panel) appears on the same screen as the chat
- The Epic card is displayed at the top, child tickets below
- Every field is inline-editable:
  - Epic name and description
  - Ticket title, description, and issue type (Story/Task/Bug)
  - Prefix (defaults to configurable value, e.g., [API-2])
  - Target sprint (dropdown populated from Jira)
  - Target project (defaults to configurable value, e.g., LH)
- Users can add new tickets, remove tickets, and reorder tickets
- Claude suggests breakdown based on best practices, but the human decides the final structure

#### Jira Submission Stage

- User clicks "Create in Jira"
- The app creates the Epic first, then all child tickets linked to the Epic as children, all assigned to the selected sprint
- On success: clickable links to the Epic and each child ticket
- On failure: clear error messages with retry option

### 2.2 UI/UX Requirements

**Layout:**
- Split panel: Chat on the left, Ticket Builder on the right
- Top bar: Project, prefix, sprint settings + Jira connection status
- Responsive: Works well on standard laptop screens (1280px+)

**Input Source Tabs:**
- Tabs at the top of the chat panel: "Free text", "Paste / .md", "CPD ticket"
- Tab selection changes the input area accordingly

**Chat Interface:**
- Message bubbles: user on right, Claude on left
- Markdown rendering in Claude's messages
- Auto-scroll to latest message
- Input field at bottom with send button

**Ticket Builder:**
- Clean, card-based layout
- Epic card visually distinct (amber badge)
- Child tickets as individual cards with type badges
- Inline editing — click to edit any field
- "+" button to add new tickets, "x" to remove, reorder via drag or arrows

**Design Principles:**
- Highly intuitive — a new user should understand the flow without instructions
- Interactive — inline editing, real-time feedback, smooth transitions
- Clean form-based — no unnecessary chrome or visual clutter

### 2.3 Technical Requirements

**Deployment:** Runs locally, single command to start, no cloud infrastructure required.

**Integrations:**

| Service | Method | Purpose |
|---------|--------|---------|
| Claude API | Anthropic Messages API | AI grooming chat |
| Jira API | Atlassian REST API v3 | Create epics, tickets, fetch sprints, fetch CPD tickets |
| Local Filesystem | Node.js fs API | Browse and read source code during grooming (v1) |
| Bitbucket API | Atlassian REST API | Browse repos, branches, PRs (v2 stretch) |

**Authentication:**
- Claude: API key stored in local .env file
- Jira: API token + email stored in local .env file
- Local code: No auth needed — configured project root path in .env

### 2.4 Configuration

| Setting | Default | Editable |
|---------|---------|----------|
| Jira Project | LH | Yes, dropdown from available projects |
| Ticket Prefix | [API-2] | Yes, free text |
| Target Sprint | (next future sprint) | Yes, dropdown from Jira |
| Claude Model | claude-sonnet-4-20250514 | Yes, in settings |
| Source Code Path | (none) | Yes, local directory path to project root |

### 2.5 Non-Functional Requirements

- **Performance**: Chat responses stream in real-time (SSE/streaming)
- **Error handling**: Clear error messages for Jira API failures, rate limits, auth issues
- **Security**: API keys never leave the local machine; no telemetry
- **Accessibility**: Keyboard navigation for core flows

### 2.6 Out of Scope (v1)

- Google Docs integration (v2 stretch goal)
- Bitbucket source code browsing (v2 — local filesystem for v1)
- Multi-user collaboration
- Assignee selection at creation time
- Bulk editing across multiple epics
- Sprint velocity or capacity planning

### 2.7 Open Questions

1. Should the app support editing existing Jira tickets, or is it create-only for v1?
2. Do we need a "template" system for recurring ticket structures?
3. Should the CPD ticket link be bidirectional (Epic links back to CPD)?

---

## 3. Architecture Decision Records

### ADR-001: Technology Stack

**Date:** 2026-03-21 | **Status:** Proposed

**Context:** Sprint Genie is a locally-hosted webapp. We need a stack that is quick to develop, runs locally with minimal setup, supports real-time streaming, and produces a polished interactive UI.

**Decision:**

- **Frontend:** React + Vite + Tailwind CSS
  - React: Component-based UI fits the split-panel layout. Rich ecosystem for chat interfaces and form builders.
  - Vite: Fast dev server with HMR. Zero-config for React + TypeScript.
  - Tailwind CSS: Rapid styling without custom CSS files.
- **Backend:** Node.js + Express
  - Same language as frontend. Native SSE support for streaming responses.
  - Express: Lightweight, minimal boilerplate. Perfect for a local tool.
- **Language:** TypeScript (full stack)
  - Type safety, better IDE support, shared types between frontend and backend.
- **Data:** Browser LocalStorage + JSON files
  - No database needed for v1.

**Alternatives Considered:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Python (FastAPI) backend | Familiar to some teams | Two languages, SSE less ergonomic | Rejected |
| Next.js (full stack) | SSR, API routes built in | Overkill for a local tool | Rejected |
| Static HTML + vanilla JS | Simplest possible | No component model, hard to maintain | Rejected |
| Svelte/SvelteKit | Less boilerplate | Smaller ecosystem, less team familiarity | Considered for v2 |

**Consequences:**
- Single language (TypeScript) reduces cognitive overhead
- LocalStorage is sufficient for v1 but may need migration to SQLite if session data grows
- Team members need basic React/TS knowledge to contribute

---

### ADR-002: AI Integration Architecture

**Date:** 2026-03-21 | **Status:** Proposed

**Context:** The core value is the AI grooming session. We need to integrate Claude for interactive chat and structured ticket generation.

**Decision: Anthropic Messages API with streaming**

- API: POST /v1/messages with stream: true
- Model: claude-sonnet-4-20250514 (balance of speed and quality)
- Streaming: Server-Sent Events (SSE) from backend to frontend

**Conversation Architecture:**

```
Frontend (React) <--SSE--> Backend (Express) <--HTTP--> Claude API
```

- Frontend sends user messages to Express backend
- Backend maintains full conversation history in memory (per session)
- Backend streams Claude responses back via SSE

**System Prompt Strategy:**
1. Role definition: Technical grooming assistant
2. Ticket format guidance: Problem, Expected Outcome, Suggested Approach
3. Adaptive behavior: Adjusts to work type (feature, bug, refactor, investigation)
4. Structured output mode: When user signals "done", Claude outputs JSON for the ticket builder

**Ticket Generation JSON Schema:**

```json
{
  "epic": {
    "title": "[API-2] Feature Name",
    "description": "Epic description..."
  },
  "tickets": [
    {
      "type": "Story",
      "title": "[API-2] Ticket title",
      "description": "**Problem:** ...\n**Expected:** ..."
    }
  ]
}
```

**Consequences:**
- Backend proxy keeps API key secure
- JSON output mode requires careful prompt engineering
- Conversation history grows per message — may need truncation for long sessions
- Model configurable in settings (Opus available for complex features)

---

### ADR-003: Jira Integration

**Date:** 2026-03-21 | **Status:** Proposed

**Context:** The app needs to fetch CPD tickets, list projects/sprints, and create Epics with linked child tickets.

**Decision: Atlassian REST API v3 with API Token auth**

- Auth: Basic auth with email + API token (stored in .env)
- No OAuth for v1: API token is simpler for a local single-user tool

**API Operations Required:**

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| List projects | GET /rest/api/3/project | Project dropdown |
| List sprints | GET /rest/agile/1.0/board/{boardId}/sprint | Sprint dropdown |
| Get issue | GET /rest/api/3/issue/{key} | Fetch CPD ticket content |
| Create issue | POST /rest/api/3/issue | Create Epic and child tickets |
| Link issues | POST /rest/api/3/issueLink | Link children to Epic |
| Move to sprint | POST /rest/agile/1.0/sprint/{sprintId}/issue | Assign to sprint |

**Creation Flow:**
1. Create the Epic first
2. For each child ticket: create issue, set Epic link
3. Move all created issues to the target sprint
4. Return created issue keys and URLs

**Error Handling:**
- Auth failure: Prompt user to check .env credentials
- Permission error: Show which operation failed
- Rate limiting: Exponential backoff with max 3 retries
- Partial failure: Show partial results with retry for failed tickets

**Consequences:**
- Each user needs their own API token
- .env file must not be committed to git
- Board ID needs discovery or configuration (sprints are board-specific)
- Epic linking varies by Jira config (Epic Link field vs parent)

---

### ADR-004: Data Persistence

**Date:** 2026-03-21 | **Status:** Proposed

**Context:** Users may need to save mid-session, recover from browser close, or keep records.

**Decision: Browser LocalStorage for session drafts**

- Auto-saved every 5 seconds (debounced) on any significant action
- Session data includes: conversation history, ticket builder state, settings

**Session Data Structure:**

```json
{
  "sessionId": "uuid",
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime",
  "status": "grooming | building | submitted",
  "settings": {
    "project": "LH",
    "prefix": "[API-2]",
    "sprintId": "200",
    "model": "claude-sonnet-4-20250514"
  },
  "conversation": [],
  "epic": {},
  "tickets": [],
  "result": {
    "epicKey": "LH-XXXXX",
    "ticketKeys": [],
    "submittedAt": "ISO datetime"
  }
}
```

**Session Management:**
- Session list on landing page with status badges
- Resume any session by clicking it
- Manual delete for cleanup
- Optional JSON export for backup

**Consequences:**
- LocalStorage ~5MB limit — sufficient for many sessions
- Clearing browser data wipes sessions (warn users)
- No cross-device sync
- Migration path to SQLite is straightforward if needed

---

### ADR-005: Code Browsing During Grooming

**Date:** 2026-03-22 | **Status:** Proposed

**Context:** During grooming sessions, understanding the current codebase leads to better solution design and more accurate ticket descriptions. Rather than the user manually copying code snippets into the chat, the app should be able to browse source code directly.

**Decision: Local filesystem access for v1, Bitbucket API for v2**

**v1 — Local Filesystem:**
- Backend reads files from a configured project root directory (PROJECT_ROOT in .env)
- Three endpoints: directory tree, file read, and code search (grep)
- .gitignore-aware filtering to skip node_modules, build artifacts, etc.
- Path validation to prevent directory traversal attacks
- During grooming, Claude can request to view specific files or search for patterns
- File contents are included in the conversation context sent to Claude API

**v2 — Bitbucket API (stretch):**
- Browse any repo/branch without needing it cloned locally
- Access PR history and commit messages for context
- Requires Bitbucket API token auth (additional .env config)

**API Endpoints (v1):**

| Endpoint | Purpose |
|----------|---------|
| GET /api/code/tree | Directory listing from project root, respects .gitignore |
| GET /api/code/file?path=src/... | Read a single file, with truncation for large files |
| GET /api/code/search?q=filterCriteria | Grep-style search across codebase |

**How it integrates with grooming:**
- Claude's system prompt includes awareness that source code browsing is available
- During chat, Claude can suggest: "Let me look at how the data source sync currently works"
- The backend fetches the relevant code and includes it in the next Claude API call
- This makes ticket descriptions more precise — referencing actual function names, data models, and patterns

**Alternatives Considered:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Bitbucket only | Access any branch/PR | Extra auth, API latency, overkill for v1 | v2 stretch |
| GitHub integration | Popular platform | Team uses Bitbucket | Not applicable |
| User copy-pastes code | Zero implementation | Breaks flow, easy to miss context | Current pain point |
| IDE plugin instead | Deep integration | Separate tool, not integrated with grooming | Different product |

**Consequences:**
- Requires the user to have the repo cloned locally (typical for a tech lead)
- PROJECT_ROOT config must be set correctly in .env
- Large files need truncation to avoid blowing up Claude's context window
- Security: path validation is critical — must prevent reading files outside project root
- Adds significant value to grooming quality with minimal implementation effort

---

## 4. UI Design

### Layout: Split Panel

```
+------------------------------------------------------------------+
| Sprint Genie  [v1]        Project: LH | Prefix: [API-2] | Sprint: 200 | Jira: Connected |
+------------------------------------------------------------------+
| [Free text] [Paste/.md] [CPD ticket]  |  Epic & tickets (3)      |
|                                        |                          |
| User: We need to build a data source   | [Epic] [API-2] CPD-1198  |
| attribute-based filtering feature...   | Product Hub: DS Filtering |
|                                        |                          |
| Claude: Let me break this down.        | [Story #1] CRUD criteria |
| 1. Should filters apply per-DS?        | Problem: No way to...    |
| 2. When filters change, resync?        | Expected: API endpoints  |
| 3. Standard or custom attributes?      |                          |
|                                        | [Story #2] Include       |
| User: Per data source. Resync on       | filter in DS request     |
| update. Both standard and custom.      |                          |
|                                        | [Story #3] Resync on     |
| Claude: Here's what I have:            | filter update            |
| Requirements: ...                      |                          |
| Use cases: ...                         | [+ Add ticket]           |
| Shall I generate tickets?              |                          |
|                                        |                          |
| [Type your response...] [Done >>>]     | [Save draft] [Create >>] |
+------------------------------------------------------------------+
```

### Key UI Components

- **Top bar**: Settings (project, prefix, sprint) + connection status. All inline-editable.
- **Left panel (Chat)**: Input source tabs, message bubbles, streaming text, "Done, generate tickets" button.
- **Right panel (Ticket Builder)**: Epic card (amber), ticket cards (blue), inline editing, add/remove/reorder, type selector per ticket.
- **Submit bar**: "Save draft" (LocalStorage) and "Create in Jira" (primary action).
- **Result view**: After submission, shows clickable Jira links for Epic and all tickets.

---

## 5. Implementation Task List

### Phase 0: Project Setup (2-3 hours)

- [ ] Initialize monorepo: Vite + React + TypeScript (frontend)
- [ ] Initialize Express + TypeScript (backend)
- [ ] Configure Tailwind CSS
- [ ] Set up .env file structure (Claude + Jira API keys)
- [ ] Create shared TypeScript types (session, ticket, epic, settings)
- [ ] Add .env.example with placeholder values
- [ ] Set up ESLint + Prettier

### Phase 1: Backend — Core API Layer (1-2 days)

**Jira Integration:**
- [ ] Implement Jira API client with Basic auth
- [ ] GET /api/jira/projects — List available projects with issue types
- [ ] GET /api/jira/sprints?projectKey=LH — List sprints for a project
- [ ] GET /api/jira/issue/:key — Fetch a single issue (for CPD ticket input)
- [ ] POST /api/jira/create-epic — Create an Epic
- [ ] POST /api/jira/create-tickets — Create child tickets linked to Epic, assign to sprint
- [ ] Error handling: auth failures, permissions, rate limiting with retry

**Claude Integration:**
- [ ] Implement Claude API client with streaming (SSE)
- [ ] POST /api/chat/message — Send message, stream response via SSE
- [ ] POST /api/chat/generate-tickets — Trigger structured ticket generation
- [ ] System prompt management
- [ ] Conversation history management (in-memory per session)

**Code Browsing (Local Filesystem):**
- [ ] GET /api/code/tree — Directory listing of configured project root (with .gitignore-aware filtering)
- [ ] GET /api/code/file?path=... — Read a single file with syntax-aware truncation for large files
- [ ] GET /api/code/search?q=... — Grep-style search across the codebase
- [ ] Security: Validate all paths are within configured root (prevent directory traversal)
- [ ] Config: PROJECT_ROOT in .env, validation on startup

### Phase 2: Frontend — UI Shell (2-3 days)

**Layout:**
- [ ] App shell with top bar
- [ ] Split panel layout (resizable)
- [ ] Settings modal/drawer

**Input Stage:**
- [ ] Tab bar: "Free text", "Paste / .md", "CPD ticket"
- [ ] Free text tab: textarea with send
- [ ] Paste / .md tab: textarea + file upload
- [ ] CPD ticket tab: input field + fetch button

**Chat Interface:**
- [ ] Message list with bubbles
- [ ] Markdown rendering in Claude messages
- [ ] Auto-scroll, streaming display
- [ ] "Done, generate tickets" button
- [ ] Loading/thinking indicator

**Ticket Builder:**
- [ ] Epic card (inline-editable)
- [ ] Ticket card (inline-editable title, description, type)
- [ ] Type badge, add/remove buttons
- [ ] Prefix auto-prepend

**Submission:**
- [ ] "Create in Jira" button with confirmation
- [ ] Progress indicator during creation
- [ ] Success view with Jira links
- [ ] Error view with retry

### Phase 3: Polish & Session Management (1 day)

- [ ] Auto-save to LocalStorage (debounced)
- [ ] Session list / landing page
- [ ] "Save draft" button
- [ ] Session export as JSON
- [ ] Empty states and onboarding hints
- [ ] Keyboard shortcuts
- [ ] Error toasts/notifications
- [ ] Loading states and skeleton screens

### Phase 4: Stretch Goals (v2)

- [ ] Bitbucket integration for remote source code browsing (repos, branches, PRs)
- [ ] Google Docs link fetching (OAuth + Docs API)
- [ ] Template system for recurring structures
- [ ] Bidirectional CPD ticket linking
- [ ] Dark mode support
- [ ] Export grooming session as markdown
- [ ] Multiple prefix support
- [ ] Ticket description preview (rendered markdown)

### Estimated Effort

| Phase | Time |
|-------|------|
| Phase 0: Setup | 2-3 hours |
| Phase 1: Backend | 1-2 days |
| Phase 2: Frontend | 2-3 days |
| Phase 3: Polish | 1 day |
| **Total v1** | **5-7 days** |

---

*This document was produced through an AI-assisted grooming session and captures the shared understanding between the Technical Lead and Claude.*
