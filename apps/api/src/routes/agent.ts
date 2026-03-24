import { Router } from 'express'
import { z } from 'zod'
import { runAgent } from '@anara/agent'
import { logExecution, getRecentExecutions, getUserByWalletAddress } from '../db/client'

export const agentRouter = Router()

// ── POST /api/agent/chat ──
// Main agent chat endpoint
const ChatSchema = z.object({
  sessionId:     z.string().min(1).max(128),
  message:       z.string().min(1).max(2000),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId:       z.number().optional().default(8453),
})

agentRouter.post('/chat', async (req, res) => {
  try {
    const body = ChatSchema.parse(req.body)

    const result = await runAgent({
      sessionId:     body.sessionId,
      userMessage:   body.message,
      walletAddress: body.walletAddress,
      chainId:       body.chainId,
    })

    res.json({
      message:              result.message,
      actionCard:           result.actionCard ?? null,
      requiresConfirmation: result.requiresConfirmation,
      intent:               result.intent,
      timestamp:            Date.now(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors })
    }
    console.error('[Agent chat error]', err)
    res.status(500).json({ error: 'Agent unavailable, please try again' })
  }
})

// ── POST /api/agent/brief ──
// Morning brief — what happened while user was away
const BriefSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  since:         z.number().optional(), // unix timestamp
})

agentRouter.post('/brief', async (req, res) => {
  try {
    const body = BriefSchema.parse(req.body)

    const user = await getUserByWalletAddress(body.walletAddress)
    if (!user) {
      return res.json({
        summary:        'No recent agent activity for this wallet.',
        totalProfitUsd: '$0.00',
        actionsCount:   0,
        errorsCount:    0,
        events:         [],
        generatedAt:    Date.now(),
      })
    }

    const sinceHours = body.since
      ? Math.max(1, Math.ceil((Date.now() - body.since) / (1000 * 60 * 60)))
      : 14

    const executions = await getRecentExecutions(user.id, sinceHours)

    const actionsCount = executions.length
    const errorsCount  = executions.filter((e: any) => e.status === 'failed').length
    const totalProfit  = executions.reduce((sum: number, e: any) => {
      const val = typeof e.profit_usd === 'number' ? e.profit_usd : Number(e.profit_usd ?? 0)
      return sum + (Number.isFinite(val) ? val : 0)
    }, 0)

    const hoursLabel = sinceHours === 1 ? 'hour' : 'hours'
    const totalProfitUsd = totalProfit === 0
      ? '$0.00'
      : `${totalProfit >= 0 ? '+' : '-'}$${Math.abs(totalProfit).toFixed(2)}`

    const events = executions.slice(0, 6).map((e: any) => ({
      type:        e.strategy_type ?? 'custom',
      description: e.description ?? 'Agent execution',
      timeAgo:     formatTimeAgo(e.executed_at),
      profitUsd:   e.profit_usd == null ? null : `${e.profit_usd >= 0 ? '+' : '-'}$${Math.abs(Number(e.profit_usd)).toFixed(2)}`,
    }))

    res.json({
      summary:        actionsCount
        ? `Agent executed ${actionsCount} action${actionsCount === 1 ? '' : 's'} in the last ${sinceHours} ${hoursLabel}.`
        : `No agent actions executed in the last ${sinceHours} ${hoursLabel}.`,
      totalProfitUsd,
      actionsCount,
      errorsCount,
      events,
      generatedAt: Date.now(),
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request' })
    res.status(500).json({ error: 'Brief unavailable' })
  }
})

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

// ── GET /api/agent/status ──
agentRouter.get('/status', (_req, res) => {
  res.json({
    isRunning:    true,
    lastActivity: Date.now() - 1000 * 60 * 2, // 2 min ago
    actionsToday: 23,
    errorsToday:  0,
    profitToday:  '+$70.50',
    uptime:       '99.9%',
  })
})
