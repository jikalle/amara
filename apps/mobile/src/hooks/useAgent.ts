import { useCallback } from 'react'
import { useAgentStore, useWalletStore } from '../store'
import type { AgentActionCard, AgentMessage, TokenBalance, Transaction } from '@anara/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function useAgent() {
  const { sessionId, messages, isThinking, addMessage, updateMessage, setThinking, updateState } = useAgentStore()
  const { address, chainId, setPortfolio, setTransactions } = useWalletStore()

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isThinking) return

    const userMsg: AgentMessage = {
      id: generateId(), role: 'user', content, timestamp: Date.now(),
    }
    addMessage(userMsg)
    setThinking(true)

    try {
      const res = await fetch(`${API_URL}/api/agent/chat`, {
        method: 'POST',
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
        actionCard: data.actionCard ?? undefined,
        intent:     data.intent
          ? { type: data.intent, confidence: 1, params: {}, requiresConfirmation: data.requiresConfirmation }
          : undefined,
      }
      addMessage(agentMsg)
    } catch {
      addMessage({
        id:        generateId(),
        role:      'assistant',
        content:   "I'm having trouble connecting. Please check your internet and try again.",
        timestamp: Date.now(),
      })
    } finally {
      setThinking(false)
    }
  }, [sessionId, address, chainId, isThinking, addMessage, setThinking])

  const fetchBrief = useCallback(async () => {
    if (!address) return null
    try {
      const res = await fetch(`${API_URL}/api/agent/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      })
      return await res.json()
    } catch { return null }
  }, [address])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/agent/status`)
      if (!res.ok) return null
      const data = await res.json()
      updateState(data)
      return data
    } catch {
      return null
    }
  }, [updateState])

  const refreshWallet = useCallback(async () => {
    if (!address) return null
    const [portfolioRes, txRes] = await Promise.all([
      fetch(`${API_URL}/api/wallet/${address}/portfolio`),
      fetch(`${API_URL}/api/wallet/${address}/transactions?chainId=${chainId ?? 8453}`),
    ])

    if (portfolioRes.ok) {
      const portfolio = await portfolioRes.json()
      setPortfolio({
        totalUsd: portfolio.totalUsd ?? '$0.00',
        tokens: normalizeTokens(portfolio.tokens ?? []),
      })
    }

    if (txRes.ok) {
      const txData = await txRes.json()
      setTransactions((txData.transactions ?? []) as Transaction[])
    }
  }, [address, chainId, setPortfolio, setTransactions])

  const executeAction = useCallback(async (messageId: string, card: AgentActionCard) => {
    updateMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard ? { ...msg.actionCard, status: 'executing' } : msg.actionCard,
    }))

    try {
      const res = await fetch(`${API_URL}/api/tx/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address ?? '0x0000000000000000000000000000000000000000',
          chainId: chainId ?? 8453,
          actionCard: card,
        }),
      })
      if (!res.ok) throw new Error(`Execution failed: ${res.status}`)

      const data = await res.json()
      updateMessage(messageId, (msg) => ({
        ...msg,
        actionCard: data.actionCard ?? { ...card, status: 'confirmed' },
      }))
      await refreshWallet()
      return data
    } catch (err) {
      updateMessage(messageId, (msg) => ({
        ...msg,
        actionCard: msg.actionCard ? { ...msg.actionCard, status: 'failed' } : msg.actionCard,
      }))
      throw err
    }
  }, [address, chainId, refreshWallet, updateMessage])

  const executeStandaloneAction = useCallback(async (card: AgentActionCard, onCardChange?: (next: AgentActionCard) => void) => {
    const nextExecuting = { ...card, status: 'executing' as const }
    onCardChange?.(nextExecuting)

    try {
      const res = await fetch(`${API_URL}/api/tx/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: address ?? '0x0000000000000000000000000000000000000000',
          chainId: chainId ?? 8453,
          actionCard: card,
        }),
      })

      if (!res.ok) throw new Error(`Execution failed: ${res.status}`)

      const data = await res.json()
      const nextCard = data.actionCard ?? { ...card, status: 'confirmed' as const }
      onCardChange?.(nextCard)
      await refreshWallet()
      return data
    } catch (err) {
      onCardChange?.({ ...card, status: 'failed' })
      throw err
    }
  }, [address, chainId, refreshWallet])

  const cancelAction = useCallback((messageId: string) => {
    updateMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard ? { ...msg.actionCard, status: 'cancelled' } : msg.actionCard,
    }))
  }, [updateMessage])

  return { messages, isThinking, sendMessage, fetchBrief, fetchStatus, refreshWallet, executeAction, executeStandaloneAction, cancelAction }
}

function normalizeTokens(tokens: Array<Record<string, unknown>>): TokenBalance[] {
  return tokens.map((token, index) => ({
    address: (typeof token.contractAddress === 'string' ? token.contractAddress : 'native') as `0x${string}` | 'native',
    symbol: String(token.symbol ?? 'TOKEN'),
    name: String(token.name ?? token.symbol ?? `Token ${index + 1}`),
    decimals: Number(token.decimals ?? 18),
    balance: String(token.balance ?? token.balanceFormatted ?? '0'),
    balanceFormatted: String(token.balance ?? token.balanceFormatted ?? '0'),
    balanceUsd: String(token.balanceUsd ?? '$0.00'),
    priceUsd: String(token.priceUsd ?? '$0.00'),
    change24h: String(token.change24h ?? '0.00%'),
    logoUrl: typeof token.logo === 'string' ? token.logo : undefined,
    chainId: Number(token.chainId ?? 8453),
  }))
}
