// Conversation memory using Redis (short-term) + PostgreSQL (long-term)
// In development, falls back to in-memory store

interface MemoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const memoryStore = new Map<string, MemoryEntry[]>()
const MAX_CONTEXT_MESSAGES = 12

export async function getConversationHistory(sessionId: string): Promise<MemoryEntry[]> {
  // TODO: Replace with Upstash Redis in production:
  // const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN })
  // const raw = await redis.lrange(`chat:${sessionId}`, 0, MAX_CONTEXT_MESSAGES - 1)
  // return raw.map(r => JSON.parse(r))
  return memoryStore.get(sessionId) ?? []
}

export async function appendMessage(sessionId: string, entry: MemoryEntry): Promise<void> {
  const history = memoryStore.get(sessionId) ?? []
  history.push(entry)
  if (history.length > MAX_CONTEXT_MESSAGES) {
    history.splice(0, history.length - MAX_CONTEXT_MESSAGES)
  }
  memoryStore.set(sessionId, history)
}

export async function clearConversation(sessionId: string): Promise<void> {
  memoryStore.delete(sessionId)
}

export async function getSessionIds(): Promise<string[]> {
  return Array.from(memoryStore.keys())
}
