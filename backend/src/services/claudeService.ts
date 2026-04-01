import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { configService } from './configService'
import type { ChatMessage, Epic, Ticket } from 'sprint-genie-shared'
import type { Response } from 'express'

// ─── Provider detection ──────────────────────────────────────────────────────

function isGeminiModel(model: string): boolean {
  return model.startsWith('gemini-')
}

// ─── Client factories ────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const cfg = configService.readConfig()
  if (!cfg.anthropicApiKey) {
    throw new Error('Anthropic API key not configured. Open Settings to add your key.')
  }
  return new Anthropic({ apiKey: cfg.anthropicApiKey })
}

function getGeminiModel(model: string) {
  const cfg = configService.readConfig()
  if (!cfg.geminiApiKey) {
    throw new Error('Gemini API key not configured. Open Settings to add your key.')
  }
  const genAI = new GoogleGenerativeAI(cfg.geminiApiKey)
  return genAI.getGenerativeModel({ model })
}

// ─── System prompts ──────────────────────────────────────────────────────────

const GROOMING_SYSTEM = `You are Sprint Genie, an expert technical grooming assistant embedded in a sprint planning tool.

Your role is to help engineers turn rough ideas into well-structured Jira epics and tickets. You ask the right questions, challenge vague scope, and produce precise, actionable ticket descriptions.

## How you work

When the user shares an idea, requirement, or CPD ticket:
1. Identify the type of work: Feature, Bug, Refactor, or Investigation/Spike
2. Ask targeted questions to clarify scope — adapt them to the work type:
   - **Feature**: Who are the users? What's the edge case behaviour? What's explicitly out of scope?
   - **Bug**: What's the exact symptom? What's the expected behaviour? What's the blast radius?
   - **Refactor**: What's the pain today? What does "done" look like? Any migration concerns?
   - **Investigation**: What decisions will this inform? What's the time-box? What are the success criteria?
3. Keep questions concise — no more than 3 at a time
4. When you have enough context, summarise what you've understood and ask: "Ready to generate tickets?"

## Ticket format

Each ticket description must include:
- **Problem:** What's broken or missing, and why it matters
- **Expected outcome:** What the world looks like when this ticket is done
- **Suggested approach:** A concrete technical direction (reference actual code paths, models, or patterns when source code is available)

## Source code awareness

If source code context is provided in the conversation, use it actively:
- Reference specific file paths, function names, and data models in your suggestions
- Point out integration risks you can see in the code
- Make the suggested approach grounded in the actual codebase, not generic advice

## Tone

- Direct and technical — you're talking to engineers
- Challenge ambiguity, but don't be pedantic
- Short messages are better than long ones when possible`

const TICKET_GENERATION_SYSTEM = `You are Sprint Genie. Based on the grooming conversation provided, generate a structured Epic and child tickets.

Output ONLY valid JSON — no markdown fences, no explanation, just the JSON object.

Schema:
{
  "epic": {
    "title": "string — start with the source ticket number (e.g. CPD-1198) if one was mentioned in the conversation, then a short descriptive name. Example: CPD-1198 Product hub improvements",
    "description": "string — 2-3 sentences describing the epic goal"
  },
  "tickets": [
    {
      "id": "string — generate a short UUID like t1, t2, t3",
      "type": "Story | Task | Bug — default to Story unless clearly a technical task or bug fix",
      "title": "string — format: [PREFIX] SOURCE_TICKET descriptive title. Example: [API-2] CPD-1198 Add filter criteria API. Always include the source ticket number (e.g. CPD-1198) if one was mentioned in the conversation.",
      "description": "string — use this exact format:\\nProblem: ...\\nExpected outcome: ...\\nSuggested approach: ..."
    }
  ]
}

Rules:
- Break work into 3-7 tickets. Fewer is better — don't over-granularise
- Each ticket should be independently completable
- Default all tickets to Story. Only use Task for purely technical work with no user-facing impact, and Bug for defect fixes
- Titles should be verb-first: "Add filter criteria API", "Migrate session table", "Fix null pointer in sync job"
- Keep descriptions factual and implementation-specific where possible`

// ─── Gemini helpers ──────────────────────────────────────────────────────────

function toGeminiHistory(messages: ChatMessage[]) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))
}

// ─── Streaming chat ──────────────────────────────────────────────────────────

export async function streamChat(
  messages: ChatMessage[],
  model: string,
  res: Response,
  sourceContext?: string,
): Promise<void> {
  const systemPrompt = sourceContext
    ? `${GROOMING_SYSTEM}\n\n## Source code context\n\nThe following source code was retrieved from the user's local repository:\n\n${sourceContext}`
    : GROOMING_SYSTEM

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  if (isGeminiModel(model)) {
    const gemini = getGeminiModel(model)
    const history = toGeminiHistory(messages.slice(0, -1))
    const lastMessage = messages[messages.length - 1]?.content ?? ''

    const chat = gemini.startChat({
      history,
      systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
    })

    const result = await chat.sendMessageStream(lastMessage)
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`)
      }
    }
  } else {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    for await (const chunk of stream) {
      if (
        chunk.type === 'content_block_delta' &&
        chunk.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

// ─── Ticket generation (non-streaming, structured JSON) ──────────────────────

export async function generateTickets(
  conversation: ChatMessage[],
  model: string,
  prefix: string,
): Promise<{ epic: Epic; tickets: Ticket[] }> {
  const generatePrompt = `Generate the Epic and tickets now. Use the prefix "${prefix || '[PROJ]'}" in all titles.`
  let raw: string

  if (isGeminiModel(model)) {
    const gemini = getGeminiModel(model)
    const history = toGeminiHistory(conversation)
    const chat = gemini.startChat({
      history,
      systemInstruction: { role: 'user', parts: [{ text: TICKET_GENERATION_SYSTEM }] },
    })
    const result = await chat.sendMessage(generatePrompt)
    raw = result.response.text()
  } else {
    const client = getAnthropicClient()
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: TICKET_GENERATION_SYSTEM,
      messages: [
        ...conversation.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: generatePrompt },
      ],
    })
    raw = response.content[0].type === 'text' ? response.content[0].text : ''
  }

  // Strip markdown fences if the model wrapped the JSON
  const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  let parsed: { epic: Epic; tickets: Ticket[] }
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Failed to parse ticket JSON from model response: ${cleaned.slice(0, 200)}`)
  }

  return parsed
}
