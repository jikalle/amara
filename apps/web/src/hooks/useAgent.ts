'use client'

import { useCallback } from 'react'
import { useActiveWallet, usePrivy, useWallets, type ConnectedWallet } from '@privy-io/react-auth'
import { executeSwap, getSwapQuote } from '@anara/chain'
import { useAgentStore, useWalletStore } from '../store'
import { track } from '../lib/analytics'
import type {
  AgentActionCard,
  AgentActionMetadata,
  AgentMessage,
  TokenBalance,
  Transaction,
  WalletChainSummary,
  WalletNftSummary,
} from '@anara/types'
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

type ActiveWalletConnectResult = {
  wallet?: unknown
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
    track('chat_submitted', {
      sessionId,
      walletAddress: address,
      chainId: chainId ?? 8453,
      messageLength: content.trim().length,
    })
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
      if (data.actionCard) {
        track('preview_generated', {
          sessionId,
          walletAddress: address,
          chainId: chainId ?? 8453,
          actionType: data.actionCard.metadata?.kind ?? data.intent ?? 'unknown',
          requiresConfirmation: Boolean(data.requiresConfirmation),
        })
      }
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
      const brief = normalizeBrief(data)
      setBrief(brief)
      return brief
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
          cache: 'no-store',
        }),
        fetch(`${API_URL}/api/wallet/${address}/transactions`, {
          headers: buildHeaders(identityToken, false),
          cache: 'no-store',
        }),
      ])

      const nextErrors: string[] = []

      if (portfolioRes.ok) {
        const portfolio = await portfolioRes.json()
        setPortfolio({
          totalUsd: portfolio.totalUsd ?? '$0.00',
          tokens: normalizeTokens(portfolio.tokens ?? []),
          nfts: normalizeNfts(portfolio.nfts ?? []),
          chains: normalizeChains(portfolio.chains ?? []),
          lastUpdated: typeof portfolio.lastUpdated === 'number' ? portfolio.lastUpdated : Date.now(),
        })
        if (Array.isArray(portfolio.warnings) && portfolio.warnings.length) {
          nextErrors.push(String(portfolio.warnings[0]))
        }
      } else {
        nextErrors.push('Failed to load portfolio')
      }

      if (txRes.ok) {
        const txData = await txRes.json()
        setTransactions((txData.transactions ?? []) as Transaction[])
        if (Array.isArray(txData.warnings) && txData.warnings.length) {
          nextErrors.push(String(txData.warnings[0]))
        }
      } else {
        nextErrors.push('Failed to load wallet activity')
      }

      if (nextErrors.length) {
        setError(nextErrors.join('. '))
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
      if (!simulation?.willSucceed) {
        const reason = simulation?.warnings?.[0] || 'This action is not executable right now.'
        throw new Error(reason)
      }

      const submitted = await submitAction(
        card,
        address,
        chainId ?? 8453,
        wallets,
        isExecutionWallet(activeWallet) ? activeWallet : undefined,
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
        actionCard: data.actionCard ?? { ...card, status: 'submitted', txHash: submitted.txHash },
      }))
      track('tx_submitted', {
        walletAddress: address,
        chainId: submitted.chainId,
        txHash: submitted.txHash,
        actionType: card.metadata?.kind ?? 'unknown',
      })
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
      void monitorTransaction(messageId, submitted.txHash, submitted.chainId, refreshWallet)
      await refreshWallet()
      return data
    } catch (err) {
      updateMessage(messageId, (msg) => ({
        ...msg,
        actionCard: msg.actionCard ? { ...msg.actionCard, status: 'failed' } : msg.actionCard,
      }))
      const errorMessage = getUserFacingExecutionError(err)
      addMessage({
        id: generateId(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
      })
      track('tx_failed', {
        walletAddress: address,
        chainId: chainId ?? 8453,
        actionType: card.metadata?.kind ?? 'unknown',
        reason: errorMessage,
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
  const parts = ['Execution submitted and awaiting confirmation.']
  if (route) parts.push(`Route: ${route}`)
  if (gasEstimateUsd) parts.push(`Estimated gas: ${gasEstimateUsd}`)
  if (txHash) parts.push(`Tx: ${txHash.slice(0, 10)}…${txHash.slice(-4)}`)
  if (explorerUrl) parts.push(`Explorer: ${explorerUrl}`)
  return parts.join('\n')
}

function normalizeBrief(data: unknown) {
  const brief = (data && typeof data === 'object') ? (data as Record<string, unknown>) : {}
  return {
    summary: typeof brief.summary === 'string' ? brief.summary : 'No recent agent summary is available yet.',
    totalProfitUsd: typeof brief.totalProfitUsd === 'string' ? brief.totalProfitUsd : '$0.00',
    actionsCount: typeof brief.actionsCount === 'number' ? brief.actionsCount : 0,
    errorsCount: typeof brief.errorsCount === 'number' ? brief.errorsCount : 0,
    events: Array.isArray(brief.events) ? brief.events : [],
    generatedAt: typeof brief.generatedAt === 'number' ? brief.generatedAt : Date.now(),
  }
}

async function monitorTransaction(
  messageId: string,
  txHash: `0x${string}`,
  chainId: number,
  onConfirmed?: () => Promise<unknown>,
) {
  let announcedPending = false
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await delay(attempt === 0 ? 1000 : 2000)

    try {
      const res = await fetch(`${API_URL}/api/tx/status/${chainId}/${txHash}`)
      if (!res.ok) continue
      const data = await res.json()

      if (data.status === 'confirmed' || data.status === 'failed') {
        useAgentStore.getState().updateMessage(messageId, (msg) => ({
          ...msg,
          actionCard: msg.actionCard
            ? {
                ...msg.actionCard,
                status: data.status === 'confirmed' ? 'confirmed' : 'failed',
                txHash,
              }
            : msg.actionCard,
        }))
        if (data.status === 'confirmed') {
          track('tx_confirmed', {
            chainId,
            txHash,
          })
          await onConfirmed?.()
          useAgentStore.getState().addMessage({
            id: `msg_confirmed_${txHash}_${Date.now()}`,
            role: 'assistant',
            content: `Transaction confirmed onchain.\nTx: ${txHash.slice(0, 10)}…${txHash.slice(-4)}\nExplorer: ${data.explorerUrl}`,
            timestamp: Date.now(),
          })
        } else {
          track('tx_failed', {
            chainId,
            txHash,
            reason: 'onchain_failed',
          })
          useAgentStore.getState().addMessage({
            id: `msg_failed_${txHash}_${Date.now()}`,
            role: 'assistant',
            content: `Transaction failed onchain.\nTx: ${txHash.slice(0, 10)}…${txHash.slice(-4)}\nExplorer: ${data.explorerUrl}`,
            timestamp: Date.now(),
          })
        }
        return
      }

      useAgentStore.getState().updateMessage(messageId, (msg) => ({
        ...msg,
        actionCard: msg.actionCard
          ? {
              ...msg.actionCard,
              status: 'submitted',
              txHash,
            }
          : msg.actionCard,
      }))
      if (!announcedPending) {
        announcedPending = true
      }
    } catch {
      // Keep polling quietly while the tx is propagating.
    }
  }
}

function getUserFacingExecutionError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : 'Execution failed.'
  const message = rawMessage.toLowerCase()

  if (message.includes('balanceerror') || message.includes('balance is too low') || message.includes('insufficient balance')) {
    return 'Insufficient balance for this action. Reduce the amount or fund the wallet, then try again.'
  }
  if (message.includes('insufficient') && message.includes('balance')) {
    return 'Insufficient balance for this action. Reduce the amount or fund the wallet, then try again.'
  }

  if (message.includes('user rejected') || message.includes('rejected the request') || message.includes('denied')) {
    return 'Transaction was cancelled in the wallet before submission.'
  }

  if (message.includes('wallet connectivity is still initializing')) {
    return 'Wallet connectivity is still initializing. Try again in a moment.'
  }

  if (message.includes('destination address is invalid')) {
    return 'The destination address is invalid. Check the address and try again.'
  }

  if (message.includes('client is not provided')) {
    return 'The wallet session could not be attached to the route executor. Refresh the page and try again.'
  }

  if (message.includes('route execution')) {
    return 'Transaction could not be completed. Review the route or try again.'
  }

  if (error instanceof Error) {
    return `Execution failed: ${error.message}. Review the action card details and try again.`
  }

  return 'Execution failed. Review the action card details and try again.'
}

async function submitAction(
  card: AgentActionCard,
  address: string,
  activeChainId: number,
  wallets: ConnectedWallet[],
  activeWallet: ConnectedWallet | undefined,
  connectActiveWallet: (opts?: { reset?: boolean }) => Promise<ActiveWalletConnectResult>,
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

  const fromChainId = metadata.fromChainId
  const toChainId = metadata.toChainId
  const fromTokenAddress = metadata.fromTokenAddress
  const toTokenAddress = metadata.toTokenAddress
  const fromAmount = metadata.fromAmount

  const quote = await withStepError('quote refresh', async () => await getSwapQuote({
    fromChainId,
    toChainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromAddress: address,
    slippage: 0.005,
  })) as unknown as Parameters<typeof executeSwap>[0]

  let latestRouteHash: `0x${string}` | null = null
  let latestRouteChainId = fromChainId

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
  connectActiveWallet: (opts?: { reset?: boolean }) => Promise<ActiveWalletConnectResult>,
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
    if (isExecutionWallet(connected.wallet)) {
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getWalletClientForChain(wallet: ExecutionWallet, chainId: number) {
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

function isExecutionWallet(wallet: unknown): wallet is ExecutionWallet {
  return Boolean(
    wallet &&
    typeof wallet === 'object' &&
    'address' in wallet &&
    'switchChain' in wallet &&
    'getEthereumProvider' in wallet
  )
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

function normalizeNfts(nfts: Array<Record<string, unknown>>): WalletNftSummary[] {
  return nfts.map((nft, index) => ({
    tokenId: String(nft.tokenId ?? index),
    collection: String(nft.collection ?? 'Unknown Collection'),
    name: typeof nft.name === 'string' ? nft.name : undefined,
    chain: String(nft.chain ?? 'base'),
    imageUrl: typeof nft.imageUrl === 'string' ? nft.imageUrl : undefined,
  }))
}

function normalizeChains(chains: Array<Record<string, unknown>>): WalletChainSummary[] {
  return chains
    .map((chain) => ({
      chainId: Number(chain.chainId ?? 0),
      nativeBalance: String(chain.nativeBalance ?? '0'),
      totalUsd: String(chain.totalUsd ?? '$0.00'),
    }))
    .filter((chain) => Number.isFinite(chain.chainId) && chain.chainId > 0)
}
