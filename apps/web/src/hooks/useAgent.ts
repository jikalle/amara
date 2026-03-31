'use client'

import { useCallback } from 'react'
import { useActiveWallet, usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth'
import { executeSwap, getSwapQuote } from '@anara/chain'
import { useAgentStore, useWalletStore } from '../store'
import type { AgentActionCard, AgentActionMetadata, AgentMessage, TokenBalance, Transaction } from '@anara/types'
import { useAuth } from '../lib/auth'
import { base, mainnet } from 'viem/chains'
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  isAddress,
  parseUnits,
  type Address,
} from 'viem'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type ExecutionWallet = {
  address: string
  switchChain: (targetChainId: `0x${string}` | number) => Promise<void>
  getEthereumProvider: () => Promise<Eip1193Provider>
}

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function useAgent() {
  const { identityToken } = useAuth()
  const { getEthereumProvider } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()
  const { wallet: activeWallet, connect: connectActiveWallet } = useActiveWallet()
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
    if (!walletsReady) {
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: 'Wallet connectivity is still initializing. Try again in a moment.',
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

      const submitted = await submitAction(
        card,
        address,
        chainId ?? 8453,
        wallets,
        activeWallet,
        connectActiveWallet,
        getEthereumProvider
      )

      const res = await fetch(`${API_URL}/api/tx/execute`, {
        method: 'POST',
        headers: buildHeaders(identityToken),
        body: JSON.stringify({
          walletAddress: address,
          chainId: submitted.chainId,
          txHash: submitted.txHash,
          explorerUrl: submitted.explorerUrl,
          executionStatus: 'pending',
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
        content: buildExecutionSuccessMessage(
          submitted.txHash,
          simulation?.estimatedRoute,
          simulation?.gasEstimateUsd,
          submitted.explorerUrl
        ),
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
  }, [address, chainId, identityToken, refreshWallet, updateMessage, addMessage, wallets, walletsReady, activeWallet, connectActiveWallet, getEthereumProvider])

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

function buildExecutionSuccessMessage(txHash?: string, route?: string, gasEstimateUsd?: string, explorerUrl?: string) {
  const parts = ['Execution submitted successfully.']
  if (route) parts.push(`Route: ${route}.`)
  if (gasEstimateUsd) parts.push(`Estimated gas: ${gasEstimateUsd}.`)
  if (txHash) parts.push(`Tx: ${txHash.slice(0, 10)}…${txHash.slice(-4)}.`)
  if (explorerUrl) parts.push(`Explorer: ${explorerUrl}.`)
  return parts.join(' ')
}

async function submitAction(
  card: AgentActionCard,
  address: string,
  activeChainId: number,
  wallets: ConnectedWallet[],
  activeWallet: ConnectedWallet | undefined,
  connectActiveWallet: (opts?: { reset?: boolean }) => Promise<{ wallet?: ConnectedWallet }>,
  getEthereumProvider: () => unknown
) {
  const metadata = card.metadata
  if (!metadata) {
    throw new Error('This action is missing execution metadata.')
  }

  const wallet = await getExecutionWallet(wallets, address, activeWallet, connectActiveWallet, getEthereumProvider)
  if (!wallet) {
    throw new Error('The connected Privy wallet could not be found for this account.')
  }

  switch (metadata.kind) {
    case 'send':
      return await withStepError('send submission', async () => await submitSend(card, metadata, wallet, activeChainId))
    case 'swap':
    case 'bridge':
      return await withStepError(`${metadata.kind} route execution`, async () => await submitQuotedRoute(metadata, wallet, address, activeChainId))
    default:
      throw new Error(`Unsupported action kind: ${metadata.kind}`)
  }
}

async function submitSend(
  card: AgentActionCard,
  metadata: AgentActionMetadata,
  wallet: ExecutionWallet,
  activeChainId: number
) {
  const targetChainId = metadata.fromChainId ?? activeChainId
  const walletClient = await withStepError('wallet client setup', async () => await getWalletClientForChain(wallet, targetChainId))
  const token = resolveTokenConfig(metadata)
  const toAddress = metadata.toAddress

  if (!toAddress || !isAddress(toAddress)) {
    throw new Error('The destination address is invalid.')
  }
  if (!metadata.fromAmount) {
    throw new Error('The amount to send is missing.')
  }

  const amount = parseUnits(metadata.fromAmount, token.decimals)

  const txHash = token.isNative
    ? await walletClient.sendTransaction({
        account: wallet.address as Address,
        chain: getChain(targetChainId),
        to: toAddress as Address,
        value: amount,
      })
    : await walletClient.sendTransaction({
        account: wallet.address as Address,
        chain: getChain(targetChainId),
        to: token.address as Address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [toAddress as Address, amount],
        }),
      })

  return {
    txHash,
    chainId: targetChainId,
    explorerUrl: buildExplorerUrl(targetChainId, txHash),
    title: card.title,
  }
}

async function submitQuotedRoute(
  metadata: AgentActionMetadata,
  wallet: ExecutionWallet,
  address: string,
  activeChainId: number
) {
  if (!metadata.fromChainId || !metadata.toChainId || !metadata.fromTokenAddress || !metadata.toTokenAddress || !metadata.fromAmount) {
    throw new Error('This route is missing quote parameters.')
  }

  const quote = await withStepError('quote refresh', async () => await getSwapQuote({
    fromChainId: metadata.fromChainId,
    toChainId: metadata.toChainId,
    fromTokenAddress: metadata.fromTokenAddress,
    toTokenAddress: metadata.toTokenAddress,
    fromAmount: metadata.fromAmount,
    fromAddress: address,
    slippage: 0.005,
  })) as unknown as Parameters<typeof executeSwap>[0]

  let latestRouteHash: `0x${string}` | null = null
  let latestRouteChainId = metadata.fromChainId

  const executedRoute = await withStepError('route execution engine', async () => await executeSwap(
    quote,
    async (targetChainId) => await getWalletClientForChain(wallet, targetChainId),
    (updatedRoute) => {
      const latest = extractLatestProcess(updatedRoute)
      if (latest?.txHash) latestRouteHash = latest.txHash as `0x${string}`
      if (latest?.chainId) latestRouteChainId = latest.chainId
    }
  ))

  const latestProcess = extractLatestProcess(executedRoute)
  const txHash = (latestProcess?.txHash as `0x${string}` | undefined) ?? latestRouteHash
  const executedChainId = latestProcess?.chainId ?? latestRouteChainId ?? activeChainId

  if (!txHash) {
    throw new Error('The route executed without returning a transaction hash.')
  }

  return {
    txHash,
    chainId: executedChainId,
    explorerUrl: latestProcess?.txLink ?? buildExplorerUrl(executedChainId, txHash),
    title: metadata.tool ?? 'Execution',
  }
}

function getConnectedWallet(wallets: ConnectedWallet[], address: string) {
  return wallets.find((wallet) => wallet.address.toLowerCase() === address.toLowerCase()) ?? wallets[0] ?? null
}

async function getExecutionWallet(
  wallets: ConnectedWallet[],
  address: string,
  activeWallet: ConnectedWallet | undefined,
  connectActiveWallet: (opts?: { reset?: boolean }) => Promise<{ wallet?: ConnectedWallet }>,
  getEthereumProvider: () => unknown
): Promise<ExecutionWallet | null> {
  if (activeWallet?.address) {
    return activeWallet
  }

  const matchedWallet = getConnectedWallet(wallets, address)
  if (matchedWallet) {
    return matchedWallet
  }

  try {
    const connected = await connectActiveWallet()
    if (connected.wallet?.address) {
      return connected.wallet
    }
  } catch (error) {
    console.warn('[execution wallet] active wallet connect failed, falling back to provider', error)
  }

  const provider = getEthereumProvider()
  if (provider && typeof provider === 'object' && 'request' in provider) {
    return {
      address,
      switchChain: async (targetChainId: `0x${string}` | number) => {
        const normalizedChainId = typeof targetChainId === 'number'
          ? `0x${targetChainId.toString(16)}`
          : targetChainId
        await (provider as { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> }).request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: normalizedChainId }],
        })
      },
      getEthereumProvider: async () => provider as {
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      },
    }
  }

  return null
}

async function withStepError<T>(label: string, work: () => Promise<T>) {
  try {
    return await work()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label}: ${message}`)
  }
}

async function getWalletClientForChain(wallet: ConnectedWallet, chainId: number) {
  await wallet.switchChain(chainId)
  const provider = await wallet.getEthereumProvider()
  return createWalletClient({
    account: wallet.address as Address,
    chain: getChain(chainId),
    transport: custom(provider),
  })
}

function getChain(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet
    case 8453:
      return base
    default:
      throw new Error(`Unsupported execution chain: ${chainId}`)
  }
}

function resolveTokenConfig(metadata: AgentActionMetadata) {
  const symbol = metadata.fromTokenSymbol?.toUpperCase()
  const chainId = metadata.fromChainId ?? 8453

  if (symbol === 'ETH') {
    return {
      address: zeroAddress,
      decimals: metadata.fromTokenDecimals ?? 18,
      isNative: true,
    }
  }

  if (!metadata.fromTokenAddress || !isAddress(metadata.fromTokenAddress)) {
    throw new Error(`Unsupported token for chain ${chainId}.`)
  }

  return {
    address: metadata.fromTokenAddress as Address,
    decimals: metadata.fromTokenDecimals ?? 18,
    isNative: isNativeTokenAddress(metadata.fromTokenAddress),
  }
}

function isNativeTokenAddress(address?: string) {
  return address?.toLowerCase() === zeroAddress
}

function buildExplorerUrl(chainId: number, txHash: string) {
  const host = chainId === 1 ? 'https://etherscan.io' : 'https://basescan.org'
  return `${host}/tx/${txHash}`
}

function extractLatestProcess(route: {
  steps?: Array<{
    execution?: {
      process?: Array<{
        txHash?: string
        txLink?: string
        chainId?: number
        startedAt?: number
      }>
    }
  }>
}) {
  return route.steps
    ?.flatMap((step) => step.execution?.process ?? [])
    .sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0))[0]
}

const zeroAddress = '0x0000000000000000000000000000000000000000'

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
