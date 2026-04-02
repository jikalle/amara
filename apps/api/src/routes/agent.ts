import { Router } from 'express'
import { z } from 'zod'
import { runAgent } from '@anara/agent'
import { getRecentExecutions, getUserByPrivyId, getUserByWalletAddress, upsertUser } from '../db/client'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { getAuthorizedWalletAddress, isAuthorizationError } from '../lib/authz'
import { evaluateFeatureAccess, getFeatureFlags } from '../lib/feature-flags'
import { logErrorEvent, logEvent, logWarn } from '../middleware/logger'

export const agentRouter = Router()

const ChatSchema = z.object({
  sessionId: z.string().min(1).max(128),
  message: z.string().min(1).max(2000),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  chainId: z.number().optional().default(8453),
})

const BriefSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  since: z.number().optional(),
})

agentRouter.post('/chat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = ChatSchema.parse(req.body)
    const walletAddress = getAuthorizedWalletAddress(req.walletAddress, body.walletAddress)
    logEvent('agent_chat_requested', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      sessionId: body.sessionId,
      messageLength: body.message.length,
    })

    const result = await runAgent({
      sessionId: body.sessionId,
      userMessage: body.message,
      walletAddress,
      chainId: body.chainId,
    })

    const gatedActionType = result.actionCard?.type ?? result.intent ?? null
    const featureAccess = evaluateFeatureAccess(gatedActionType)
    if (!featureAccess.allowed) {
      logWarn('agent_chat_blocked_by_feature_flag', {
        userId: req.userId,
        walletAddress,
        chainId: body.chainId,
        actionType: gatedActionType,
      })
      return res.json({
        message: featureAccess.message,
        actionCard: null,
        requiresConfirmation: false,
        intent: result.intent,
        timestamp: Date.now(),
      })
    }

    res.json({
      message: result.message,
      actionCard: result.actionCard ?? null,
      requiresConfirmation: result.requiresConfirmation,
      intent: result.intent,
      timestamp: Date.now(),
    })
    logEvent('agent_chat_completed', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      sessionId: body.sessionId,
      requiresConfirmation: result.requiresConfirmation,
      hasActionCard: Boolean(result.actionCard),
      intent: result.intent ?? null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('agent_chat_invalid', {
        userId: req.userId,
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('agent_chat_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }
    logErrorEvent('agent_chat_failed', {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    res.status(500).json({ error: 'Agent unavailable, please try again' })
  }
})

agentRouter.post('/brief', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = BriefSchema.parse(req.body)
    const walletAddress = getAuthorizedWalletAddress(req.walletAddress, body.walletAddress)
    logEvent('agent_brief_requested', {
      userId: req.userId,
      walletAddress,
      since: body.since ?? null,
    })
    const user =
      (req.userId ? await getUserByPrivyId(req.userId) : null) ??
      await getUserByWalletAddress(walletAddress) ??
      await upsertUser(req.userId!, walletAddress)

    if (!user) {
      return res.json(emptyBrief())
    }

    const sinceHours = body.since
      ? Math.max(1, Math.ceil((Date.now() - body.since) / (1000 * 60 * 60)))
      : 14

    const executions = await getRecentExecutions(user.id, sinceHours)
    const actionsCount = executions.length
    const errorsCount = executions.filter((execution) => execution.status === 'failed').length
    const totalProfit = executions.reduce((sum, execution) => {
      const val = typeof execution.profit_usd === 'number' ? execution.profit_usd : Number(execution.profit_usd ?? 0)
      return sum + (Number.isFinite(val) ? val : 0)
    }, 0)

    const hoursLabel = sinceHours === 1 ? 'hour' : 'hours'
    const totalProfitUsd = totalProfit === 0
      ? '$0.00'
      : `${totalProfit >= 0 ? '+' : '-'}$${Math.abs(totalProfit).toFixed(2)}`

    const events = executions.slice(0, 6).map((execution) => ({
      type: execution.strategy_type ?? 'custom',
      description: execution.description ?? 'Agent execution',
      timeAgo: formatTimeAgo(execution.executed_at),
      profitUsd:
        execution.profit_usd == null
          ? null
          : `${Number(execution.profit_usd) >= 0 ? '+' : '-'}$${Math.abs(Number(execution.profit_usd)).toFixed(2)}`,
    }))

    res.json({
      summary: actionsCount
        ? `Agent executed ${actionsCount} action${actionsCount === 1 ? '' : 's'} in the last ${sinceHours} ${hoursLabel}.`
        : `No agent actions executed in the last ${sinceHours} ${hoursLabel}.`,
      totalProfitUsd,
      actionsCount,
      errorsCount,
      events,
      generatedAt: Date.now(),
    })
    logEvent('agent_brief_completed', {
      userId: req.userId,
      walletAddress,
      actionsCount,
      errorsCount,
      sinceHours,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('agent_brief_invalid', {
        userId: req.userId,
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('agent_brief_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }
    logErrorEvent('agent_brief_failed', {
      userId: req.userId,
      message: err instanceof Error ? err.message : String(err),
    })
    res.status(500).json({ error: 'Brief unavailable' })
  }
})

agentRouter.get('/status', (_req, res) => {
  res.json({
    isRunning: true,
    lastActivity: Date.now() - 1000 * 60 * 2,
    actionsToday: 23,
    errorsToday: 0,
    profitToday: '+$70.50',
    uptime: '99.9%',
    featureFlags: getFeatureFlags(),
  })
})

function emptyBrief() {
  return {
    summary: 'No recent agent activity for this wallet.',
    totalProfitUsd: '$0.00',
    actionsCount: 0,
    errorsCount: 0,
    events: [],
    generatedAt: Date.now(),
  }
}

function formatTimeAgo(dateInput?: string) {
  if (!dateInput) return 'just now'
  const deltaMs = Date.now() - new Date(dateInput).getTime()
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'just now'
  const minutes = Math.floor(deltaMs / (1000 * 60))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
