# Sprint Genie — Project Diary

A running log of decisions, progress, and context as the project is built.

---

## 2026-03-21 — Project conception

**Status:** Design & Planning

Identified a recurring pain point: creating Jira epics and tickets for sprint planning takes 45+ minutes per feature, multiple times per sprint. The process is manual, repetitive, and largely formulaic.

Decided to build **Sprint Genie** — a local webapp that wraps an AI grooming session around the Jira creation workflow. The core loop: paste an idea → chat with Claude to refine requirements → review and edit generated tickets → submit to Jira in one click.

Wrote the full PRD covering:
- Four input modes: free text, markdown, file upload, CPD ticket from Jira
- Split-panel layout: chat on the left, ticket builder on the right
- Target: under 10 minutes from idea to Epic in Jira (from a 45-min baseline)

Settled on five architecture decisions (ADRs):
- **Tech stack:** React + Vite + Tailwind (frontend), Node + Express (backend), TypeScript full-stack
- **AI:** Anthropic Messages API with SSE streaming; backend proxies calls so keys stay local
- **Jira:** REST API v3 with API token auth; no OAuth for v1
- **Persistence:** Browser LocalStorage for session drafts; no database needed for v1
- **Code browsing** (added 2026-03-22): Backend reads local filesystem during grooming so Claude can reference actual function names, data models, and file structure when writing ticket descriptions

---

## 2026-03-22 — Repository + Phase 0 setup

**Status:** Active development — Phase 0 complete

### Git repo initialized

Created the git repository and linked it to the `sprint-genie/` folder.

### Monorepo scaffold (Phase 0)

Set up the full project structure as an npm workspaces monorepo:

```
sprint-genie/
├── frontend/     React 18 + Vite 6 + TypeScript + Tailwind CSS 3
├── backend/      Express 4 + TypeScript, tsx for dev
├── shared/       Shared TypeScript types used by both sides
├── .env.example  All required config keys documented
├── .gitignore
├── .prettierrc
└── package.json  Workspaces root + concurrently for parallel dev
```

Key setup details:
- Vite proxies `/api` → `localhost:3001` so frontend never needs hardcoded backend URLs
- `shared/` package exposes all data model types: `Session`, `Epic`, `Ticket`, `ChatMessage`, `JiraProject`, `JiraSprint`, and all API request/response shapes
- Backend loads `.env` from project root via dotenv
- `npm run dev` starts both servers in parallel via `concurrently`

### Settings UI (in-app config, no .env editing)

Decided not to require developers (or non-developers) to manually edit `.env`. Added a full settings UI instead.

**How it works:**
- Backend writes to `config.json` in the project root (gitignored)
- `config.json` values take precedence over `.env`; `.env` is still supported as a fallback
- API keys are masked (`••••••••`) in the GET response — the frontend shows whether a key is saved without ever exposing it
- Sending `••••••••` back in a POST is treated as "don't change this key"

**What's configurable in the UI:**
- Credentials tab: Anthropic API key, Jira email, Jira API token, Jira base URL
- Defaults tab: Default project key, ticket prefix, Claude model
- Code browsing tab: Local project root path for source-aware grooming

**Top bar:** Live Claude + Jira connection status dots. If either isn't configured, a banner prompts the user to open Settings.

---

## 2026-03-22 (continued) — Phase 1: Backend API layer

**Status:** Phase 1 complete

### Jira service (`jiraService.ts` + `routes/jira.ts`)

Implemented a full Jira API client using REST API v3 (issues) and Agile API v1 (boards/sprints). Auth is Basic with `base64(email:token)` — simple and sufficient for a local single-user tool.

Routes added:
- `GET /api/jira/projects` — lists all accessible projects
- `GET /api/jira/sprints?projectKey=` — auto-discovers the Scrum board for the project, then returns active + future sprints
- `GET /api/jira/issue/:key` — fetches a CPD ticket; parses Atlassian Document Format (ADF) to plain text
- `POST /api/jira/create` — creates Epic first, then child tickets in order (linked via `parent` field for modern Jira), then moves all to the selected sprint. Returns 207 on partial failure so the client can show what succeeded.

Ticket descriptions are converted from plain text to minimal ADF on the way out so they render properly in Jira.

### Claude service (`claudeService.ts` + `routes/chat.ts`)

Two distinct modes:

**Streaming chat** (`POST /api/chat/message`): Uses the Anthropic Messages SDK streaming API, forwarded to the client via SSE. The system prompt (`GROOMING_SYSTEM`) instructs Claude to adapt its questions based on work type (Feature / Bug / Refactor / Investigation), keep questions to ≤3 at a time, and use source code context when provided.

**Ticket generation** (`POST /api/chat/generate-tickets`): Non-streaming. A separate, strict system prompt (`TICKET_GENERATION_SYSTEM`) asks Claude for pure JSON only. The output is validated and parsed — if Claude wraps it in markdown fences despite instructions, those are stripped before parsing. Each ticket is generated with the Problem / Expected outcome / Suggested approach format.

### Code browsing service (`codeService.ts` + `routes/code.ts`)

Three endpoints for source-aware grooming:
- `GET /api/code/tree` — recursive directory listing, respects a hardcoded ignore list (node_modules, .git, dist, build, etc.), max 300 entries, max depth 6
- `GET /api/code/file?path=` — reads a file relative to `PROJECT_ROOT`, truncates at 64 KB
- `GET /api/code/search?q=&ext=` — regex search across all files, returns up to 30 matches with file path, line number, and matched text

Security: all file paths are validated against the configured `PROJECT_ROOT` — any traversal attempt (e.g. `../../etc/passwd`) is blocked with a hard error.

---

## 2026-03-22 (continued) — Phase 2: Frontend UI

**Status:** Phase 2 complete

### Hooks

Three focused hooks power the UI:

- **`useSession`** — all mutable session state (conversation, epic, tickets, settings, status). Exposes fine-grained updaters so components only touch what they need.
- **`useJira`** — `useJiraProjects` and `useJiraSprints` (reactive on project key change), plus a `fetchCpdIssue` utility. Only fires when Jira is configured.
- **`useChat`** — wraps the SSE streaming protocol. Reads chunks from `ReadableStream`, parses `data:` lines, and fires `onToken` / `onDone` / `onError` callbacks. Keeps streaming logic out of App.tsx.

### TopBar

Inline project dropdown (populated from Jira if connected, free-text fallback), prefix input, sprint dropdown (auto-loads when project changes), Claude + Jira status dots, ⚙ Settings button.

### ChatPanel

Three input tabs: Free text, Paste/.md (with file upload), CPD ticket (fetches from Jira and pre-fills). Message bubbles render user messages as plain pre-wrapped text and Claude messages as markdown via `react-markdown`. Animated pulsing dots during streaming. ⌘+Enter sends. "Done ›" appears once the conversation has at least one exchange.

### TicketBuilder

Placeholder until tickets are generated. Once populated: Epic card (amber border), child ticket cards in order. Every field is click-to-edit via `InlineEdit`. Issue type is a styled `<select>` that looks like a badge. Hover reveals ✕ remove. "+ Add ticket" appends a blank Story. Submit bar has "Save draft" (LocalStorage) and "Create in Jira →".

### SubmitResult

Replaces ticket builder after success. Shows Epic + all child tickets as clickable Jira links. "← Start new session" resets state while preserving settings.

### App.tsx

Orchestrates config, session, chat, generation, and submission. Yellow banner when credentials missing, red banner on runtime errors with dismiss.

---

## 2026-03-22 (continued) — Phase 3: Polish

**Status:** Phase 3 complete — v1 feature-complete

### Auto-save + session restore

Sessions auto-save to LocalStorage on a 3-second debounce via `useSession`. On page load, the active session is restored automatically. The hook manages its own session ID and all persistence internally. "Save draft" triggers an immediate save with a toast.

### Session list

A dedicated view lists all saved sessions sorted by last updated — each showing title (from epic title or first user message), status badge, and timestamp. Click to resume, hover to reveal delete. Empty state shows a branded welcome screen. Accessible from a "View saved sessions" link in the bottom bar.

### Toast notifications

`ToastProvider` wraps the app, exposes `useToast()`. Toasts auto-dismiss after 4 seconds with entrance animation. Three types: success (teal), error (coral), info (blue). Used on: ticket generation, Jira creation, draft save, session restore.

### Loading skeleton

While Claude generates tickets, the builder shows pulsing skeleton cards (one amber for Epic, three for child tickets). The `generating` prop flows from App → TicketBuilder.

### Keyboard shortcuts

Escape closes Settings modal. ⌘+Enter sends chat message.

---

---

## 2026-03-22 — Jira OAuth 2.0 (3LO) integration

**Status:** v1.1 — OAuth upgrade

Replaced manual Jira API token entry with proper OAuth 2.0 (3LO) authentication. This is a significant UX improvement — users no longer need to generate and paste API tokens; they just click "Connect to Jira" and authorise in a popup.

### What changed

**Shared types (`shared/src/index.ts`)**
- Added OAuth fields to `AppConfig`: `jiraOAuthClientId`, `jiraOAuthClientSecret`, `jiraOAuthAccessToken`, `jiraOAuthRefreshToken`, `jiraOAuthExpiresAt`, `jiraCloudId`
- Added `jiraAuthMode: 'oauth' | 'basic' | 'none'` to `ConfigStatus`

**New file: `backend/src/services/oauthService.ts`**
- Full Atlassian OAuth 2.0 (3LO) implementation
- `getAuthorizeUrl()` — builds consent screen URL with correct scopes (`read:jira-work`, `write:jira-work`, `read:sprint:jira-software`, `offline_access`)
- `exchangeCode()` — swaps auth code for tokens, resolves cloud ID via accessible-resources API, persists tokens + site URL to config.json
- `refreshAccessToken()` — auto-refreshes before expiry (60s buffer), handles token rotation
- `getValidAccessToken()` — single call that handles refresh transparently
- `disconnect()` — clears all OAuth state

**Backend routes (`backend/src/routes/jira.ts`)**
- `GET /api/jira/oauth/start` — returns the Atlassian consent URL
- `GET /api/jira/oauth/callback` — handles redirect, exchanges code, shows success/failure HTML that `postMessage`s back to the opener window
- `POST /api/jira/oauth/disconnect` — clears OAuth tokens

**jiraService updates**
- `jiraFetch()` now detects auth mode automatically: OAuth (Bearer token via cloud gateway `api.atlassian.com`) or Basic (email:token against instance URL)
- Browse URLs resolved from `self` link in API responses when `jiraBaseUrl` isn't set

**Settings UI (`SettingsModal.tsx`)**
- When OAuth Client ID is configured: shows a "Connect to Jira" button with Atlassian-blue styling that opens a popup
- When connected: shows green "Connected via OAuth" badge with Disconnect button
- When no Client ID: falls back to manual email/token/URL fields (backward compatible)
- Listens for `postMessage` from OAuth popup to auto-refresh config state

### Architecture decisions

- **Popup-based OAuth**: Opens Atlassian consent in a popup rather than full-page redirect. The callback HTML page `postMessage`s success back to the opener, which refreshes config. This keeps the user in context (Settings modal stays open).
- **Dual auth support**: OAuth is preferred when tokens exist; Basic auth remains as a fallback. `getAuthMode()` in jiraService checks for OAuth tokens first.
- **Cloud gateway**: OAuth requests route through `api.atlassian.com/ex/jira/{cloudId}` (Atlassian's API gateway), while Basic auth goes directly to the instance URL. This is per Atlassian's OAuth docs.
- **Token refresh**: Access tokens are auto-refreshed 60 seconds before expiry. Atlassian may rotate the refresh token, so we always persist the latest one.
- **Client credentials in config.json**: The OAuth Client ID and Secret are stored in config.json (gitignored), not in .env. This keeps the OAuth setup purely through config, which the Settings UI already manages.

### Credentials stored

- OAuth Client ID: `pc8DlgAL...` (stored in config.json)
- OAuth Client Secret: `ATOATvXg...` (stored in config.json, masked in API responses)
- Callback URL: `http://localhost:3001/api/jira/oauth/callback`

---

## 2026-03-22 (continued) — v1.2: Jira API v3 migration + Gemini + UX improvements

**Status:** v1.2 — API migration, free AI tier, UX polish

### Jira v2 → v3 search migration

Atlassian removed the `/rest/api/2/search` endpoint entirely (CHANGE-2046). The app was hitting a 410 error on all JQL searches.

**Discovery process:** The v3 replacement (`/rest/api/3/search/jql`) returns issue IDs only — no field values, regardless of whether GET or POST is used, and regardless of `fields` parameter. This was confirmed through iterative debugging with raw response logging.

**Solution:** Two-step approach for sprint discovery:
1. `GET /rest/api/3/search/jql` — find issue IDs via JQL (e.g. `sprint in openSprints()`)
2. `GET /rest/api/3/issue/{id}?fields=customfield_10007` — fetch sprint field from individual issues

**Key finding:** The sprint custom field on this Jira instance is `customfield_10007`, not the typical `customfield_10020`. Discovered by fetching a full issue and scanning all field keys.

**Constraint:** The Agile REST API (`/rest/agile/1.0/`) cannot be used because OAuth scopes only include `read:jira-work` and `write:jira-work` — Agile scopes were intentionally excluded due to unreliable behaviour through the Atlassian OAuth gateway.

### Issue URL handling

`getIssue()` now accepts full Jira browse URLs (e.g. `https://foo.atlassian.net/browse/CPD-1198`) in addition to plain keys. Extracts the key via regex.

### Google Gemini integration (free AI tier)

Anthropic API credits were exhausted. Added Google Gemini as a free alternative provider.

**What changed:**
- Installed `@google/generative-ai` SDK
- `claudeService.ts` now supports both providers, auto-detected by model name prefix (`gemini-` vs `claude-`)
- New `geminiApiKey` field in `AppConfig`, config service, and Settings UI
- Gemini API key field appears first in Settings (labelled "free"), Anthropic marked as "paid, optional"
- Model dropdown: Gemini 2.0 Flash, Gemini 2.5 Flash, Gemini 2.5 Pro (all free), then Claude Sonnet 4 and Haiku 4.5 (paid)
- Default model changed from `claude-sonnet-4-20250514` to `gemini-2.0-flash`
- Status dot renamed from "Claude" to "AI"; `claudeConfigured` now true if either key is present
- Active session model syncs when `config.defaultModel` changes (via useEffect in App.tsx)
- Restored sessions override stale model with current config default and clear old errors

### Ticket naming convention

Updated the ticket generation prompt so the AI includes source ticket numbers in titles:
- **Epic title:** `CPD-1198 Product hub improvements`
- **Ticket titles:** `[API-2] CPD-1198 Add filter criteria API`

### Automatic issue linking

When creating an epic from a CPD ticket, the epic is now automatically linked to the source CPD ticket using the **"Idea"** link type in Jira. The source ticket key is extracted from the conversation content via regex. Link failure is non-fatal.

### Ticket cloning

Added a "Clone" button on ticket cards in the builder. Hover reveals "Clone" and "Remove" text buttons. Cloning duplicates the ticket with "(copy)" appended to the title and inserts it immediately after the original.

### UX improvements

- **Enter to send:** Chat textarea now sends on Enter, with Shift/Cmd/Ctrl+Enter for newline (was the opposite)
- **Model in header:** Active model name displayed in the top bar for visibility
- **Text labels:** Action buttons use text ("Clone", "Remove") instead of icons for clarity

---

## Summary — v1.2 complete

All four phases delivered plus OAuth upgrade, API migration, and Gemini integration. The app is end-to-end functional:
1. Configure credentials in Settings UI (Gemini free key or Anthropic paid key, OAuth for Jira)
2. Start a grooming session via free text, markdown, or CPD ticket
3. Chat with AI to refine requirements (streaming, code-aware)
4. Click "Done" → AI generates Epic + tickets (with loading skeleton)
5. Edit everything inline in the ticket builder (with clone support)
6. "Create in Jira" → Epic + tickets created, linked to source CPD ticket, sprint-assigned
7. Sessions auto-save and can be resumed from the session list
8. Jira auth via OAuth 2.0 popup (no more manual API tokens)

---

## 2026-03-23 — v1.3: Layout alignment & inline edit fix

**Status:** UI polish

### Split-panel footer alignment

The ChatPanel footer (compose bar) and TicketBuilder footer (submit bar) were visually misaligned — the border-top lines didn't match horizontally across the split panel.

**Root cause:** Different padding (`p-3` vs `px-5 py-3`), gap (`gap-2` vs `gap-3`), button sizes (`py-2.5 rounded-xl` vs `py-2 rounded-lg`), and the ChatPanel textarea rendering taller than TicketBuilder buttons due to `lineHeight: 1.6` on the textarea.

**Fix:** Standardised both footers to `p-3`, `gap-2`, `py-2.5 rounded-xl` buttons with matching `lineHeight: 1.6`. Added explicit `minHeight: 68px` on both footer containers to guarantee pixel-level alignment regardless of content height differences.

### Split-panel header alignment

Same issue with the panel headers — ChatPanel tabs and TicketBuilder's `PanelHeader` had different heights.

**Fix:** Added `minHeight: 41px` to both header containers. ChatPanel header switched to `items-end` so tabs sit flush on the bottom border.

### InlineEdit layout shift fix

Clicking to edit a ticket title or description caused the text to stretch/shift, breaking the row layout.

**Root cause:** The `className` (including `flex-1`) was applied directly to the `<input>`/`<textarea>` element. Form elements handle flex properties differently than `<div>`s — an input with `flex-1` and `width: 100%` expands beyond its container.

**Fix:** Wrapped `<input>` and `<textarea>` in a `<div>` that receives the layout className (`flex-1`, etc.). The form element inside fills the wrapper with `width: 100%`. This keeps flex behaviour consistent between display and edit modes. Also replaced the `font: 'inherit'` shorthand (which can reset properties unexpectedly) with explicit `fontFamily`, `fontSize`, `fontWeight`, and `letterSpacing` inherits.

---

## 2026-03-23 (continued) — v1.4: UI/UX redesign

**Status:** UI/UX overhaul — in progress

Comprehensive redesign focused on making the interface more intuitive, interactive, and easy to use.

### Design system overhaul

**Typography:** Replaced Inter with **DM Sans** (body) and **Fraunces** (display/headings) — a warm, distinctive pairing with more character.

**Color palette:** Warmed up the dark theme from cool grays to rich brown-blacks (`#0c0b0a`, `#171615`). Refined accent colors and added `--glow-*` CSS variables for subtle colored backgrounds (e.g. `--glow-accent: rgba(106,173,235,0.08)`).

**Animations:** Added entrance animations (`fadeInUp`, `slideInLeft/Right`, `scaleIn`), skeleton shimmer for loading states, and smooth transitions throughout. Message bubbles animate in from left (AI) or right (user).

**Texture:** Added subtle noise overlay on the main container and a glowing divider between panels for depth.

### TopBar simplification

The original header was overly complex — tiny 10px text next to fat dropdowns and buttons, a workflow stepper that added visual noise without clear value.

**Changes:**
- Removed the workflow stepper entirely (user feedback: not needed)
- Unified all text/controls to consistent `text-xs` (12px) sizing
- Native `<select>` elements replaced with `appearance: none` + custom SVG chevron to avoid browser-default dropdown chrome clashing with dark theme
- Status display changed to: `Jira [dot] | AI: Gemini 2.5 Flash [dot]` — shows both connection status and active model in one line
- Field order changed to: Project | Sprint | Prefix (prefix moved last as it's least-frequently changed)
- Removed "View saved sessions" from bottom bar; sessions accessible via header button

### ChatPanel improvements

- **Auto-resizing textarea** that grows with content up to 160px, with hidden scrollbar (`no-scrollbar` CSS class)
- **AI avatar** on assistant messages — small icon to the left for clearer visual distinction
- **Message entrance animations** — slide in from left (AI) or right (user) with staggered delay
- **Better empty state** with contextual hints that change based on input mode (free text vs markdown vs CPD)
- **"Done, build tickets" button** repositioned inline next to Send at the same height, making it a prominent action rather than a hidden afterthought
- **Markdown prose styling** via `.prose-chat` CSS class for proper rendering of code, lists, headings, blockquotes in AI responses

### TicketBuilder redesign

Went through several iterations. Started with a card-based layout (too cluttered), settled on a clean row-based list.

**Current layout:** Each ticket is a flat row: `Type | Title | Sprint | Menu`. Epic row has a subtle warm background tint. All actions (show description, clone, remove) consolidated into a single three-dot menu that's always visible (not hidden on hover).

**Key decisions:**
- Card layout abandoned — looked fancy but crammed type badge, title, sprint dropdown, and hidden actions together in a confusing way
- Three-dot menu always visible with larger hit target (`w-7 h-7`)
- Menu items at `text-sm px-4 py-2` for comfortable clicking
- "Desc" button removed from row, moved into menu as "Show description" / "Hide description"
- Sprint selector uses same styled `appearance: none` treatment as header dropdowns
- Sprint selector returns `null` (not hidden) when no sprints available, to maintain column alignment

### Other component polish

- **SubmitResult:** Success icon with issue count badge, staggered card entrance animations, proper SVG external link icons
- **SessionList:** Staggered row animations, hover-revealed delete with red highlight, SVG close icon
- **SettingsModal:** Scale-in entrance animation with backdrop blur, refined tab design, SVG close button
- **Toast:** Glass morphism effect with backdrop blur, SVG icons per type, combined translate + scale entrance animation

---

## 2026-03-23 (continued) — v1.5: Per-ticket sprints, markdown import, UX refinements

**Status:** v1.5 — feature additions + UX polish

### Per-ticket sprint assignment

Sprint was previously a session-level setting — all tickets went to the same sprint. Now each ticket (and the epic) has its own sprint dropdown.

**What changed:**
- Added `sprintId` field to `Epic` and `Ticket` types in shared
- TicketBuilder table shows a sprint selector per row
- New tickets and generated tickets inherit the session sprint as default
- Clone preserves the source ticket's sprint
- Backend create route groups tickets by sprint ID and assigns them in batches
- Epic sprint assigned separately before child tickets

### Markdown import (Paste / .md tab)

Completely changed the purpose of the "Paste / .md" tab. Previously it sent pasted content to the AI for grooming. Now it **directly parses markdown into tickets** — no AI call needed.

**Workflow:**
1. Groom with any external AI tool (ChatGPT, Gemini web, etc.)
2. Click **"Copy export prompt"** — copies a ready-made prompt to clipboard
3. Paste the prompt into the external AI tool to get tickets in the right format
4. Copy the AI's output, paste into the textarea
5. Click **"Import as tickets"** → tickets appear in the builder immediately

**Parser supports:**
- `# Heading` or `## Heading` → epic title
- `### Ticket`, `1. **Ticket**`, `- **Ticket**` → child tickets
- Bullet points under tickets → description
- Auto-detects `[Bug]`, `[Task]`, `Fix ...` in titles for type assignment
- Default type: Story
- Inherits session sprint and prefix

**Tab reordered** to: Free text | CPD ticket | Paste / .md (moved to last since it's the least common flow)

### New session button

Added "+ New session" button in the top bar (next to Settings). Clears conversation, tickets, and starts fresh while preserving project/sprint settings.

### CPD input alignment fix

The CPD tab had misaligned inputs — the ticket key + Fetch row had different dimensions than the textarea + Send row below. Fixed by moving the CPD input into the same compose bar container with matching `height: 40px`, `rounded-xl`, and consistent padding on all elements.

### Default ticket type

Updated the AI generation prompt to default all sub-tickets to Story type. Only uses Task for purely technical work with no user-facing impact, and Bug for defect fixes.

### Sprint discovery improvement

Increased JQL search from 5 to 50 issues per query, then samples up to 20 evenly-spaced issues to fetch sprint data from. This discovers more sprints since each issue only contains its own sprint — previously only 2 sprints were found because the 5 fetched issues happened to be in the same sprints.

---

## Summary — v1.5 complete

The app now supports two distinct workflows:
1. **AI-assisted grooming** — chat with Gemini/Claude to refine requirements, then generate tickets
2. **External AI import** — groom with any AI tool, paste the output, import directly as tickets

Full feature set:
1. Configure credentials in Settings UI (Gemini free key or Anthropic paid key, OAuth for Jira)
2. Start a grooming session via free text, CPD ticket, or markdown import
3. Chat with AI to refine requirements (streaming, code-aware) — or skip AI entirely with Paste/.md
4. Click "Done" → AI generates Epic + tickets, or "Import as tickets" for pasted content
5. Edit everything inline: type, title, sprint (per-ticket), description (expandable)
6. "Create in Jira" → Epic + tickets created, linked to source CPD ticket, sprint-assigned per-ticket
7. Sessions auto-save and can be resumed; "+ New session" in header for quick reset
8. Jira auth via OAuth 2.0 popup

---

## 2026-03-23 (continued) — v1.6: Claude Code export

**Status:** v1.6 — Claude Code task export

### Feature: Export as Claude Code task file

Added the ability to export the generated epic and tickets as a `.md` task file formatted for Claude Code execution. This closes the loop between sprint planning (Sprint Genie) and code implementation (Claude Code).

### User workflow

1. Generate tickets via the normal AI grooming or markdown import flow
2. Click **Export** (in the ticket builder footer) to download a task file before pushing to Jira, _or_
3. Click **Export for Claude Code** (on the success screen) to download a task file that includes the real Jira ticket keys and links
4. Drop the `.md` file into your project and tell Claude Code: _"Work through the tasks in tasks-xxx.md"_

### File format

The exported file (`tasks-<epic-slug>.md`) contains:
- **Header** with epic title and generation date
- **Epic section** with description and Jira link (if already submitted)
- **Instructions for Claude Code** — numbered steps: read, implement, verify, check off
- **Task list** — each ticket as `### N. [ ] [Type] Title · [KEY](url)` followed by its description

Each task uses the `- [ ]` / `- [x]` convention so Claude Code can track progress inline.

### What changed

**New file: `frontend/src/lib/exportMarkdown.ts`**
- `buildClaudeCodeMarkdown()` — assembles the markdown string from epic, tickets, and optional Jira result
- `downloadMarkdown()` — triggers a browser file download as `tasks-<slug>.md`
- `exportForClaudeCode()` — convenience wrapper that builds and downloads in one call
- Jira keys are matched to tickets by title (from the `SubmissionResult`) and embedded as inline links when available

**`TicketBuilder.tsx`**
- New `onExport?: () => void` prop
- "Export" button (terminal icon) added to the submit bar between "Save draft" and "Create in Jira"
- Button is only rendered when `onExport` is provided (i.e. when tickets exist)

**`SubmitResult.tsx`**
- New `onExport?: () => void` prop
- "Export for Claude Code" button added alongside "Start new session" on the success screen
- Styled with the accent blue glow to make it a prominent post-submission action

**`App.tsx`**
- `handleExport` callback: calls `exportForClaudeCode` with current epic, tickets, settings, and result (includes Jira keys if submitted)
- `onExport` wired into both `TicketBuilder` and `SubmitResult`
- Shows a "Task file downloaded" toast on success

---

## 2026-04-01 — v1.7: Add tickets to existing Jira epic

**Status:** v1.7 — existing epic support

### Feature: Assign tickets to an existing epic

Previously, every submission created a new epic. Now users can choose to add generated tickets to an existing epic already in Jira, skipping epic creation entirely.

### New flow: Epic choice step

Introduced an intermediate step between ticket generation and the ticket builder. After tickets are generated (via AI grooming or markdown import), users see the **Epic Choice Panel** with two options:

1. **Create new epic** — uses the AI-generated epic as-is (previous behaviour)
2. **Add to existing epic** — opens a searchable list of project epics; user picks one, then proceeds to the ticket builder with that epic

This step applies to **all flows** — AI grooming and markdown import both go through the epic choice screen.

### Epic search

The epic search supports three query types:
- **Title search** — `product hub` finds epics with matching titles via JQL `summary ~ "..."`
- **Full key** — `LH-49192` does a direct issue lookup and verifies it's an Epic
- **Number only** — `49192` prepends the current project key → looks up `LH-49192`

If a key lookup finds nothing, it falls through to title search rather than returning empty.

### Flow optimisation

The AI is only called **once** during ticket generation. The epic choice is a pure data swap — "Create new" keeps the AI-generated epic, "Use existing" replaces it with the selected Jira epic. No redundant AI calls.

### What changed

**New file: `frontend/src/components/EpicChoicePanel.tsx`**
- Two-option choice screen ("Create new epic" / "Add to existing epic")
- Full-panel epic search view with back navigation, search input, and scrollable results list
- Debounced search (400ms) with loading spinner
- Auto-loads recent epics on mount

**`shared/src/index.ts`**
- Added `existingEpicKey?: string` to `Epic` interface — when set, backend skips epic creation

**`backend/src/services/jiraService.ts`**
- New `searchEpics(projectKey, query)` function
- Supports direct key lookup (full key or number-only), falls through to JQL title search

**`backend/src/routes/jira.ts`**
- New `GET /api/jira/epics?projectKey=LH&q=search` endpoint
- `POST /api/jira/create` updated: when `existingEpicKey` is set, skips epic creation, link to source ticket, and sprint assignment — goes straight to creating child tickets under the existing epic
- Response includes `existingEpic: boolean` flag so frontend can adjust messaging

**`frontend/src/App.tsx`**
- `handleDone` now generates tickets first, then shows `EpicChoicePanel` (instead of going straight to building)
- `handleCreateNewEpic` — dismisses choice panel, enters building with AI-generated epic
- `handleUseExistingEpic` — swaps epic to the selected one, enters building
- Markdown import also routes through epic choice panel
- `choosingEpic` state reset on new session

**`frontend/src/components/TicketBuilder.tsx`**
- Epic row shows read-only display (key + summary) when `existingEpicKey` is set
- Editable title/description/sprint only shown for new epics

**`frontend/src/hooks/useSession.ts`**
- Added `existingEpic?: boolean` to `SubmissionResult`

**`frontend/src/components/SubmitResult.tsx`**
- Heading changes to "Added to Epic" (instead of "Created in Jira") when using existing epic
- Count excludes the epic from total ("3 tickets added to LH-123" instead of "4 issues created")

---

## 2026-04-01 (continued) — Plain text ticket descriptions

**Status:** UX fix

### Removed markdown from ticket descriptions

Ticket descriptions were generated with markdown bold syntax (`**Problem:**`, `**Expected outcome:**`, `**Suggested approach:**`). This rendered as raw asterisks in Jira views, making descriptions harder to read.

**What changed:**

**`backend/src/services/claudeService.ts`**
- `TICKET_GENERATION_SYSTEM` prompt updated: description format changed from `**Problem:** ...` to `Problem: ...` (plain text, no bold markers)

**`frontend/src/hooks/useSession.ts`**
- `addTicket()` default description template updated to match: plain `Problem:` / `Expected outcome:` / `Suggested approach:` without markdown formatting
