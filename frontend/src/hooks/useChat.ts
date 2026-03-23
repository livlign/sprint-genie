import { useCallback, useState } from 'react'
import type { ChatMessage, SessionSettings } from 'sprint-genie-shared'

interface UseChatOptions {
  onToken: (text: string) => void
  onDone: () => void
  onError: (msg: string) => void
}

export function useChat({ onToken, onDone, onError }: UseChatOptions) {
  const [streaming, setStreaming] = useState(false)

  const sendMessage = useCallback(async (
    message: string,
    conversation: ChatMessage[],
    settings: SessionSettings,
  ) => {
    setStreaming(true)
    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, conversation, settings }),
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Network error' }))
        onError(err.error ?? 'Request failed')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { onDone(); return }
          try {
            const parsed = JSON.parse(payload)
            if (parsed.text) onToken(parsed.text)
            if (parsed.error) { onError(parsed.error); return }
          } catch {
            // skip malformed chunks
          }
        }
      }
      onDone()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }, [onToken, onDone, onError])

  return { streaming, sendMessage }
}

export async function generateTickets(
  conversation: ChatMessage[],
  settings: SessionSettings,
) {
  const res = await fetch('/api/chat/generate-tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation, settings }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data as { epic: { title: string; description: string }; tickets: { id: string; type: string; title: string; description: string }[] }
}
