'use client'

import { useCallback } from 'react'
import { useAgentStore, useWalletStore } from '../store'
import type { AgentMessage } from '@anara/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function useAgent() {
  const { sessionId, messages, isThinking, addMessage, setThinking } = useAgentStore()
  const { address, chainId } = useWalletStore()

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isThinking) return

    // Add user message immediately
    const userMsg: AgentMessage = {
      id:        generateId(),
      role:      'user',
      content,
      timestamp: Date.now(),
    }
    addMessage(userMsg)
    setThinking(true)

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message:       content,
          walletAddress: address ?? '0x0000000000000000000000000000000000000000',
          chainId:       chainId ?? 8453,
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data = await res.json()

      const agentMsg: AgentMessage = {
        id:         generateId(),
        role:       'assistant',
        content:    data.message,
        timestamp:  Date.now(),
        intent:     data.intent ? { type: data.intent, confidence: 1, params: {}, requiresConfirmation: data.requiresConfirmation } : undefined,
        actionCard: data.actionCard ?? undefined,
      }
      addMessage(agentMsg)
    } catch (err) {
      const errMsg: AgentMessage = {
        id:        generateId(),
        role:      'assistant',
        content:   "I'm having trouble connecting right now. Please check your connection and try again.",
        timestamp: Date.now(),
      }
      addMessage(errMsg)
      console.error('[useAgent] Error:', err)
    } finally {
      setThinking(false)
    }
  }, [sessionId, address, chainId, isThinking, addMessage, setThinking])

  const fetchBrief = useCallback(async () => {
    if (!address) return null
    try {
      const res = await fetch(`${API_URL}/api/agent/brief`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      return await res.json()
    } catch {
      return null
    }
  }, [address])

  return {
    messages,
    isThinking,
    sendMessage,
    fetchBrief,
  }
}
