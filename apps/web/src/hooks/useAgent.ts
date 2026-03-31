'use client'

import { useCallback } from 'react'
import { useAgentStore, useWalletStore } from '../store'
import type { AgentActionCard, AgentMessage, TokenBalance, Transaction } from '@anara/types'
import { useAuth } from '../lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function useAgent() {
  const { identityToken } = useAuth()
  const { sessionId, messages, isThinking, addMessage, updateMessage, setThinking, updateState, setBrief } = useAgentStore()
  const { address, chainId, setPortfolio, setTransactions, setLoading, setError } = useWalletStore()

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isThinking || !address) return

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
        headers: buildHeaders(identityToken),
        body: JSON.stringify({
          sessionId,
          message:       content,
          walletAddress: address,
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
  }, [sessionId, address, chainId, identityToken, isThinking, addMessage, setThinking, setBrief])

  const fetchBrief = useCallback(async () => {
    if (!address) return null
    try {
      const res = await fetch(`${API_URL}/api/agent/brief`, {
        method:  'POST',
        headers: buildHeaders(identityToken),
        body: JSON.stringify({ walletAddress: address }),
      })
      const data = await res.json()
      setBrief(data)
      return data
    } catch {
      setBrief(null)
      return null
    }
  }, [address, identityToken, setBrief])

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
    setLoading(true)
    setError(null)
    try {
      const [portfolioRes, txRes] = await Promise.all([
        fetch(`${API_URL}/api/wallet/${address}/portfolio`, {
          headers: buildHeaders(identityToken, false),
        }),
        fetch(`${API_URL}/api/wallet/${address}/transactions?chainId=${chainId ?? 8453}`, {
          headers: buildHeaders(identityToken, false),
        }),
      ])

      if (portfolioRes.ok) {
        const portfolio = await portfolioRes.json()
        setPortfolio({
          totalUsd: portfolio.totalUsd ?? '$0.00',
          tokens: normalizeTokens(portfolio.tokens ?? []),
          lastUpdated: typeof portfolio.lastUpdated === 'number' ? portfolio.lastUpdated : Date.now(),
        })
      } else {
        setError('Failed to load portfolio')
      }

      if (txRes.ok) {
        const txData = await txRes.json()
        setTransactions((txData.transactions ?? []) as Transaction[])
      } else if (!portfolioRes.ok) {
        setError('Failed to load wallet activity')
      }
    } finally {
      setLoading(false)
    }
  }, [address, chainId, identityToken, setError, setLoading, setPortfolio, setTransactions])

  const executeAction = useCallback(async (messageId: string, card: AgentActionCard) => {
    if (!address) {
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: 'A linked wallet is required before this action can be executed.',
        timestamp: Date.now(),
      })
      return null
    }

    updateMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard ? { ...msg.actionCard, status: 'executing' } : msg.actionCard,
    }))

    try {
      const simulationRes = await fetch(`${API_URL}/api/tx/simulate`, {
        method: 'POST',
        headers: buildHeaders(identityToken),
        body: JSON.stringify({
          walletAddress: address,
          chainId: chainId ?? 8453,
          actionCard: card,
        }),
      })

      if (!simulationRes.ok) throw new Error(`Simulation failed: ${simulationRes.status}`)
      const simulation = await simulationRes.json()

      const res = await fetch(`${API_URL}/api/tx/execute`, {
        method: 'POST',
        headers: buildHeaders(identityToken),
        body: JSON.stringify({
          walletAddress: address,
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
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: buildExecutionSuccessMessage(data.transaction?.hash, simulation?.estimatedRoute, simulation?.gasEstimateUsd),
        timestamp: Date.now(),
      })
      await refreshWallet()
      return data
    } catch (err) {
      updateMessage(messageId, (msg) => ({
        ...msg,
        actionCard: msg.actionCard ? { ...msg.actionCard, status: 'failed' } : msg.actionCard,
      }))
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: err instanceof Error
          ? `Execution failed: ${err.message}. Review the action card details and try again.`
          : 'Execution failed. Review the action card details and try again.',
        timestamp: Date.now(),
      })
      throw err
    }
  }, [address, chainId, identityToken, refreshWallet, updateMessage, addMessage])

  const cancelAction = useCallback((messageId: string) => {
    updateMessage(messageId, (msg) => ({
      ...msg,
      actionCard: msg.actionCard ? { ...msg.actionCard, status: 'cancelled' } : msg.actionCard,
    }))
  }, [updateMessage])

  return {
    messages,
    isThinking,
    sendMessage,
    fetchBrief,
    fetchStatus,
    refreshWallet,
    executeAction,
    cancelAction,
  }
}

function buildHeaders(identityToken: string | null, includeJson = true) {
  const headers: Record<string, string> = {}
  if (includeJson) headers['Content-Type'] = 'application/json'
  if (identityToken) headers.Authorization = `Bearer ${identityToken}`
  return headers
}

function buildExecutionSuccessMessage(txHash?: string, route?: string, gasEstimateUsd?: string) {
  const parts = ['Execution submitted successfully.']
  if (route) parts.push(`Route: ${route}.`)
  if (gasEstimateUsd) parts.push(`Estimated gas: ${gasEstimateUsd}.`)
  if (txHash) parts.push(`Tx: ${txHash.slice(0, 10)}…${txHash.slice(-4)}.`)
  return parts.join(' ')
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
