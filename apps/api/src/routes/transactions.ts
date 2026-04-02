import { Router } from 'express'
import { z } from 'zod'
import { erc20Abi, getAddress, isAddress, zeroAddress } from 'viem'
import { getAgentSettings, getUserByPrivyId, getUserByWalletAddress, logExecution, saveTransaction, updateTransactionStatus, upsertUser } from '../db/client'
import { getPublicClient } from '@anara/chain'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { getAuthorizedWalletAddress, isAuthorizationError } from '../lib/authz'
import { evaluateFeatureAccess } from '../lib/feature-flags'
import { evaluateGuardrails } from '../lib/guardrails'
import { logErrorEvent, logEvent, logWarn } from '../middleware/logger'

export const txRouter = Router()

txRouter.use(['/simulate', '/broadcast', '/execute'], requireAuth)

const ActionMetadataSchema = z.object({
  kind: z.enum(['swap', 'bridge', 'send']),
  routeId: z.string().optional(),
  tool: z.string().optional(),
  fromChainId: z.number().int().positive().optional(),
  toChainId: z.number().int().positive().optional(),
  fromTokenSymbol: z.string().optional(),
  toTokenSymbol: z.string().optional(),
  fromTokenAddress: z.string().optional(),
  toTokenAddress: z.string().optional(),
  fromTokenDecimals: z.number().int().nonnegative().optional(),
  toTokenDecimals: z.number().int().nonnegative().optional(),
  fromAmount: z.string().optional(),
  toAmount: z.string().optional(),
  toAmountMin: z.string().optional(),
  toAddress: z.string().optional(),
  estimatedGasUsd: z.number().nonnegative().optional(),
  estimatedFeeUsd: z.number().nonnegative().optional(),
  steps: z.number().int().nonnegative().optional(),
})

const ActionCardSchema = z.object({
  type: z.enum(['swap', 'send', 'bridge', 'query', 'strategy', 'settings', 'unknown']),
  title: z.string(),
  rows: z.array(z.object({
    label: z.string(),
    value: z.string(),
    highlight: z.boolean().optional(),
  })),
  status: z.enum(['pending', 'executing', 'submitted', 'confirmed', 'failed', 'cancelled']),
  txHash: z.string().optional(),
  metadata: ActionMetadataSchema.optional(),
})

const SimulateSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(8453),
  actionCard: ActionCardSchema.optional(),
})

const ExecuteSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(8453),
  signature: z.string().min(1).optional(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  explorerUrl: z.string().url().optional(),
  executionStatus: z.enum(['pending', 'confirmed']).optional(),
  actionCard: ActionCardSchema,
})

txRouter.post('/simulate', async (req: AuthenticatedRequest, res) => {
  try {
    const body = SimulateSchema.parse(req.body)
    const walletAddress = getAuthorizedWalletAddress(req.walletAddress, body.walletAddress)
    logEvent('tx_simulation_requested', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard?.type ?? null,
      actionKind: body.actionCard?.metadata?.kind ?? null,
    })
    const analysis = summarizeAction(body.actionCard)
    const featureAccess = evaluateFeatureAccess(body.actionCard?.type)
    const metadata = body.actionCard?.metadata
    const balanceCheck = await getBalanceCheck(walletAddress, metadata, body.chainId)
    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await getAgentSettings(user.id)
    const guardrailCheck = evaluateGuardrails(body.actionCard?.type, analysis.estimatedUsd, settings)
    const warnings = [
      ...(featureAccess.message ? [featureAccess.message] : []),
      ...analysis.warnings,
      ...(balanceCheck.warning ? [balanceCheck.warning] : []),
      ...(guardrailCheck.warning ? [guardrailCheck.warning] : []),
    ]

    res.json({
      success: true,
      chainId: body.chainId,
      willSucceed: featureAccess.allowed && canSimulate(body.actionCard) && balanceCheck.sufficient && guardrailCheck.allowed,
      gasEstimateUsd: analysis.gasEstimateUsd,
      estimatedRoute: analysis.route,
      warnings,
      executionMode: metadata?.routeId ? 'quote-backed' : 'preview-only',
      steps: metadata?.steps ?? null,
      estimatedFeeUsd: formatUsd(metadata?.estimatedFeeUsd),
      balance: balanceCheck.summary,
    })
    logEvent('tx_simulation_completed', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard?.type ?? null,
      willSucceed: featureAccess.allowed && canSimulate(body.actionCard) && balanceCheck.sufficient && guardrailCheck.allowed,
      warningCount: warnings.length,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('tx_simulation_invalid', {
        userId: req.userId,
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid simulation payload', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('tx_simulation_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }
    logErrorEvent('tx_simulation_failed', {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    return res.status(500).json({ error: 'Simulation unavailable' })
  }
})

txRouter.post('/broadcast', async (req: AuthenticatedRequest, res) => {
  try {
    const body = ExecuteSchema.parse(req.body)
    const walletAddress = getAuthorizedWalletAddress(req.walletAddress, body.walletAddress)
    const featureAccess = evaluateFeatureAccess(body.actionCard.type)
    if (!featureAccess.allowed) {
      logWarn('tx_broadcast_blocked_by_feature_flag', {
        userId: req.userId,
        walletAddress,
        chainId: body.chainId,
        actionType: body.actionCard.type,
      })
      return res.status(403).json({ error: featureAccess.message })
    }
    const txHash = (body.txHash as `0x${string}` | undefined) ?? makeTxHash(walletAddress, getExecutionSalt(body.actionCard))
    logEvent('tx_broadcast_requested', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard.type,
      txHash,
    })

    await persistExecution(walletAddress, req.userId!, body.chainId, body.actionCard, txHash, body.executionStatus ?? 'pending')

    res.json({
      hash: txHash,
      status: body.executionStatus ?? 'pending',
      explorerUrl: body.explorerUrl ?? getExplorerUrl(body.chainId, txHash),
    })
    logEvent('tx_broadcast_completed', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard.type,
      txHash,
      status: body.executionStatus ?? 'pending',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('tx_broadcast_invalid', {
        userId: req.userId,
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid broadcast payload', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('tx_broadcast_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }
    logErrorEvent('tx_broadcast_failed', {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    return res.status(500).json({ error: 'Broadcast unavailable' })
  }
})

txRouter.post('/execute', async (req: AuthenticatedRequest, res) => {
  try {
    const body = ExecuteSchema.parse(req.body)
    const walletAddress = getAuthorizedWalletAddress(req.walletAddress, body.walletAddress)
    const featureAccess = evaluateFeatureAccess(body.actionCard.type)
    if (!featureAccess.allowed) {
      logWarn('tx_execute_blocked_by_feature_flag', {
        userId: req.userId,
        walletAddress,
        chainId: body.chainId,
        actionType: body.actionCard.type,
      })
      return res.status(403).json({ error: featureAccess.message })
    }
    logEvent('tx_execute_requested', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard.type,
      routeId: body.actionCard.metadata?.routeId ?? null,
      providedTxHash: body.txHash ?? null,
    })
    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await getAgentSettings(user.id)
    const analysis = summarizeAction(body.actionCard)
    const guardrailCheck = evaluateGuardrails(body.actionCard?.type, analysis.estimatedUsd, settings)
    if (!guardrailCheck.allowed) {
      logWarn('tx_execute_blocked', {
        userId: req.userId,
        walletAddress,
        chainId: body.chainId,
        actionType: body.actionCard.type,
        reason: guardrailCheck.warning ?? 'blocked',
      })
      return res.status(403).json({ error: guardrailCheck.warning ?? 'This action is blocked by strategy settings.' })
    }
    const txHash = (body.txHash as `0x${string}` | undefined) ?? makeTxHash(walletAddress, getExecutionSalt(body.actionCard))
    const metadata = body.actionCard.metadata
    const status = body.executionStatus ?? 'pending'
    await persistExecution(walletAddress, req.userId!, body.chainId, body.actionCard, txHash, status)

    res.json({
      success: true,
      executionMode: body.txHash ? 'wallet-submitted' : metadata?.routeId ? 'quote-backed-preview' : 'preview-only',
      transaction: {
        hash: txHash,
        chainId: metadata?.fromChainId ?? body.chainId,
        status,
        type: body.actionCard.type,
        explorerUrl: body.explorerUrl ?? getExplorerUrl(body.chainId, txHash),
        routeId: metadata?.routeId ?? null,
        routeSteps: metadata?.steps ?? null,
        gasEstimateUsd: analysis.gasEstimateUsd,
      },
      actionCard: {
        ...body.actionCard,
        status: status === 'confirmed' ? 'confirmed' : 'submitted',
        txHash,
      },
    })
    logEvent('tx_execute_completed', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      actionType: body.actionCard.type,
      txHash,
      status,
      executionMode: body.txHash ? 'wallet-submitted' : metadata?.routeId ? 'quote-backed-preview' : 'preview-only',
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('tx_execute_invalid', {
        userId: req.userId,
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid execution payload', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('tx_execute_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }
    logErrorEvent('tx_execute_failed', {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    return res.status(500).json({ error: 'Execution unavailable' })
  }
})

txRouter.get('/status/:chainId/:txHash', async (req, res) => {
  try {
    const chainId = Number(req.params.chainId)
    const txHash = req.params.txHash as `0x${string}`
    if (!Number.isFinite(chainId) || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ error: 'Invalid transaction lookup' })
    }

    const client = getPublicClient(chainId)
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    const status = receipt.status === 'success' ? 'confirmed' : 'failed'
    await updateTransactionStatus(txHash, chainId, status)
    logEvent('tx_status_resolved', {
      chainId,
      txHash,
      status,
      blockNumber: Number(receipt.blockNumber),
    })

    return res.json({
      hash: txHash,
      chainId,
      status,
      blockNumber: Number(receipt.blockNumber),
      explorerUrl: getExplorerUrl(chainId, txHash),
    })
  } catch (err) {
    logWarn('tx_status_pending', {
      chainId: Number(req.params.chainId),
      txHash: req.params.txHash,
      message: err instanceof Error ? err.message : String(err),
    })
    return res.json({
      hash: req.params.txHash,
      chainId: Number(req.params.chainId),
      status: 'pending',
      explorerUrl: getExplorerUrl(Number(req.params.chainId), req.params.txHash),
    })
  }
})

async function persistExecution(
  walletAddress: string,
  privyUserId: string,
  chainId: number,
  actionCard: z.infer<typeof ActionCardSchema>,
  txHash: `0x${string}`,
  status: 'pending' | 'confirmed'
) {
  const user =
    await getUserByWalletAddress(walletAddress) ??
    await upsertUser(privyUserId, walletAddress)
  const type = normalizeType(actionCard.type)
  const summary = summarizeAction(actionCard)

  if (user) {
    await saveTransaction(user.id, {
      txHash,
      chainId: actionCard.metadata?.fromChainId ?? chainId,
      txType: type,
      status,
      fromAddress: walletAddress,
      toAddress: actionCard.metadata?.toAddress,
      valueFormatted: summary.amountLabel,
      bridgeProtocol: summary.route,
      fromChainId: actionCard.metadata?.fromChainId,
      toChainId: actionCard.metadata?.toChainId,
      tokenIn: actionCard.metadata?.fromTokenSymbol && actionCard.metadata?.fromAmount
        ? {
            symbol: actionCard.metadata.fromTokenSymbol,
            amount: actionCard.metadata.fromAmount,
          }
        : undefined,
      tokenOut: actionCard.metadata?.toTokenSymbol && actionCard.metadata?.toAmount
        ? {
            symbol: actionCard.metadata.toTokenSymbol,
            amount: actionCard.metadata.toAmount,
          }
        : undefined,
    })

    await logExecution({
      userId: user.id,
      strategyType: type,
      status: status === 'confirmed' ? 'success' : 'pending',
      description: actionCard.title,
      txHash,
      chainId,
      amountUsd: summary.estimatedUsd,
      metadata: {
        rows: actionCard.rows,
        actionMetadata: actionCard.metadata ?? null,
      },
    })
  }
}

async function getOrCreateAuthenticatedUser(req: AuthenticatedRequest) {
  const existing = req.userId ? await getUserByPrivyId(req.userId) : null
  if (existing) return existing

  const created = await upsertUser(req.userId!, req.walletAddress)
  if (!created) {
    throw new Error('Authenticated user could not be resolved')
  }
  return created
}

async function getBalanceCheck(
  walletAddress: string,
  metadata: z.infer<typeof ActionMetadataSchema> | undefined,
  fallbackChainId: number
) {
  if (!metadata?.fromAmount) {
    return { sufficient: true, warning: null, summary: null }
  }

  const chainId = metadata.fromChainId ?? fallbackChainId
  const client = getPublicClient(chainId)

  try {
    const isNative = !metadata.fromTokenAddress || metadata.fromTokenAddress === zeroAddress
    const tokenAddress = metadata.fromTokenAddress
    if (!isNative && !tokenAddress) {
      throw new Error('Route is missing token address.')
    }
    const requiredRaw = BigInt(metadata.fromAmount)
    let balanceRaw: bigint
    if (isNative) {
      balanceRaw = await client.getBalance({ address: getAddress(walletAddress) })
    } else {
      const erc20Address = tokenAddress!
      balanceRaw = await client.readContract({
        address: getAddress(erc20Address),
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [getAddress(walletAddress)],
      })
    }

    const sufficient = balanceRaw >= requiredRaw
    const decimals = metadata.fromTokenDecimals ?? (isNative ? 18 : 18)
    const symbol = metadata.fromTokenSymbol ?? 'token'

    return {
      sufficient,
      warning: sufficient ? null : `Insufficient ${symbol} balance for this action.`,
      summary: {
        token: symbol,
        available: formatTokenAmount(balanceRaw, decimals),
        required: formatTokenAmount(requiredRaw, decimals),
      },
    }
  } catch {
    return { sufficient: true, warning: null, summary: null }
  }
}

function normalizeType(type: string) {
  if (type === 'swap' || type === 'send' || type === 'bridge') return type
  return 'custom'
}

function summarizeAction(actionCard?: z.infer<typeof ActionCardSchema>) {
  const rows = actionCard?.rows ?? []
  const route = actionCard?.metadata?.tool
    ? `${actionCard.metadata.tool}${actionCard.metadata.fromChainId ? ` · ${chainName(actionCard.metadata.fromChainId)}` : ''}`
    : rows.find((row) => /route|protocol|network/i.test(row.label))?.value ?? 'Base'
  const gasEstimateUsd = formatUsd(actionCard?.metadata?.estimatedGasUsd) ?? rows.find((row) => /gas/i.test(row.label))?.value ?? '~$0.05'
  const amountLabel = rows.find((row) => /amount|you send|from/i.test(row.label))?.value ?? actionCard?.title ?? 'Execution'
  const estimatedUsd = parseUsd(rows.map((row) => row.value).join(' '))
  const warnings = actionCard?.type === 'bridge'
    ? ['Bridge settlement can take longer on destination chain finality.']
    : []

  return { route, gasEstimateUsd, amountLabel, estimatedUsd, warnings }
}

function canSimulate(actionCard?: z.infer<typeof ActionCardSchema>) {
  if (!actionCard) return false
  if (actionCard.type === 'send') return Boolean(actionCard.metadata?.toAddress && actionCard.metadata?.fromAmount)
  if (actionCard.type === 'swap' || actionCard.type === 'bridge') return Boolean(actionCard.metadata?.routeId)
  return false
}

function parseUsd(input: string) {
  const match = input.match(/\$([0-9,.]+)/)
  const raw = match?.[1]
  if (!raw) return undefined
  return Number.parseFloat(raw.replace(/,/g, ''))
}

function makeTxHash(walletAddress: string, salt: string) {
  const base = Buffer.from(`${walletAddress}:${salt}`).toString('hex').slice(0, 64)
  return `0x${base.padEnd(64, '0')}` as `0x${string}`
}

function getExecutionSalt(actionCard: z.infer<typeof ActionCardSchema>) {
  return actionCard.metadata?.routeId
    ?? actionCard.metadata?.toAddress
    ?? `${actionCard.type}:${Date.now()}`
}

function getExplorerUrl(chainId: number, txHash: string) {
  const host = chainId === 1 ? 'https://etherscan.io' : 'https://basescan.org'
  return `${host}/tx/${txHash}`
}

function formatUsd(value?: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 0.01) return '<$0.01'
  return `$${value.toFixed(2)}`
}

function chainName(chainId: number) {
  return chainId === 1 ? 'Ethereum' : chainId === 8453 ? 'Base' : `Chain ${chainId}`
}

function formatTokenAmount(value: bigint, decimals: number, precision = 6) {
  const padded = value.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}
