import { Router } from 'express'
import { streamChat, generateTickets } from '../services/claudeService'
import { configService } from '../services/configService'
import type { ChatMessageRequest, GenerateTicketsRequest } from 'sprint-genie-shared'

const router = Router()

// POST /api/chat/message — stream a grooming chat response via SSE
router.post('/message', async (req, res) => {
  const { message, settings, conversation, sourceContext } = req.body as ChatMessageRequest

  if (!message) {
    return res.status(400).json({ error: 'message is required' })
  }

  const cfg = configService.readConfig()
  const model = settings?.model || cfg.defaultModel || 'claude-sonnet-4-20250514'

  // Append the new user message to the conversation history
  const messages = [
    ...(conversation ?? []),
    { role: 'user' as const, content: message },
  ]

  try {
    await streamChat(messages, model, res, sourceContext)
  } catch (e) {
    // If headers not sent yet, send error JSON; otherwise end the stream
    if (!res.headersSent) {
      res.status(500).json({ error: (e as Error).message })
    } else {
      res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`)
      res.end()
    }
  }
})

// POST /api/chat/generate-tickets — generate structured Epic + tickets from conversation
router.post('/generate-tickets', async (req, res) => {
  const { conversation, settings } = req.body as GenerateTicketsRequest

  if (!conversation || conversation.length === 0) {
    return res.status(400).json({ error: 'conversation is required' })
  }

  const cfg = configService.readConfig()
  const model = settings?.model || cfg.defaultModel || 'claude-sonnet-4-20250514'
  const prefix = settings?.prefix || cfg.defaultPrefix || '[PROJ]'

  try {
    const result = await generateTickets(conversation, model, prefix)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router
