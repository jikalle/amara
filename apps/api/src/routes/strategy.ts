import { Router } from 'express'
import { z } from 'zod'
import {
  getAgentSettings,
  getStrategyExecutions,
  getUserByPrivyId,
  setStrategyEnabled,
  updateAgentSettings,
  upsertUser,
} from '../db/client.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { buildRebalancePreview, buildRebalanceStrategyView } from '../services/strategy-rebalance.js'
import { buildYieldPreview, buildYieldStrategyView } from '../services/strategy-yield.js'

export const strategyRouter = Router()

strategyRouter.use(requireAuth)

const strategyCatalog = [
  { id: 'arb', name: 'Arb Bot', defaultStatus: 'active', pnl: '+$847.32', type: 'arb' },
  { id: 'yield', name: 'Yield Optimizer', defaultStatus: 'active', pnl: '+$312.10', type: 'yield' },
  { id: 'rebalance', name: 'Auto-Rebalance', defaultStatus: 'watching', pnl: 'In Range', type: 'rebalance' },
  { id: 'brickt', name: 'Brickt Pools', defaultStatus: 'active', pnl: '+$64.00', type: 'brickt' },
] as const

type StrategyId = typeof strategyCatalog[number]['id']

const strategyFieldMap = {
  arb: 'arb_enabled',
  yield: 'yield_enabled',
  rebalance: 'rebalance_enabled',
  brickt: 'brickt_enabled',
} as const

const strategyDetailCopy: Record<string, Record<string, string | number | boolean>> = {
  arb: {
    mode: 'Cross-venue spread capture',
    markets: 'Base + Ethereum',
    approvalsRequired: true,
  },
  yield: {
    mode: 'Yield monitoring',
    markets: 'Base + Ethereum',
    approvalsRequired: true,
  },
  rebalance: {
    mode: 'Portfolio drift control',
    markets: 'Base + Ethereum',
    approvalsRequired: true,
  },
  brickt: {
    mode: 'Brickt pool monitoring',
    markets: 'Base only',
    approvalsRequired: true,
  },
}

const ToggleSchema = z.object({
  action: z.enum(['pause', 'resume']),
})

const SettingsSchema = z.object({
  autoExecute: z.boolean().optional(),
  requireApprovalAbove: z.number().finite().nonnegative().max(1_000_000).optional(),
  allowSwaps: z.boolean().optional(),
  allowBridges: z.boolean().optional(),
  allowSends: z.boolean().optional(),
})

strategyRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await getAgentSettings(user.id)
    const rebalanceView = user.wallet_address
      ? await buildRebalanceStrategyView(user.wallet_address)
      : null
    const yieldView = user.wallet_address
      ? await buildYieldStrategyView(user.wallet_address)
      : null

    res.json({
      strategies: strategyCatalog.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        status: settings[strategyFieldMap[strategy.id]] === false
          ? 'paused'
          : strategy.id === 'rebalance' && rebalanceView
            ? rebalanceView.status
            : strategy.id === 'yield' && yieldView
              ? yieldView.status
            : strategy.defaultStatus,
        pnl: strategy.id === 'rebalance' && rebalanceView
          ? rebalanceView.pnl
          : strategy.id === 'yield' && yieldView
            ? yieldView.pnl
            : strategy.pnl,
        type: strategy.type,
      })),
      settings: serializeSettings(settings),
    })
  } catch (err) {
    console.error('[strategy list]', err)
    res.status(500).json({ error: 'Failed to load strategies' })
  }
})

strategyRouter.get('/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const strategyId = normalizeStrategyId(req.params.id)
    if (!strategyId) {
      return res.status(404).json({ error: 'Strategy not found' })
    }
    const strategy = strategyCatalog.find((entry) => entry.id === strategyId)
    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' })
    }

    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await getAgentSettings(user.id)
    const rebalanceView = strategy.id === 'rebalance' && user.wallet_address
      ? await buildRebalanceStrategyView(user.wallet_address)
      : null
    const yieldView = strategy.id === 'yield' && user.wallet_address
      ? await buildYieldStrategyView(user.wallet_address)
      : null
    const history = await getStrategyExecutions(user.id, strategy.id, 10)
    const status = settings[strategyFieldMap[strategy.id]] === false
      ? 'paused'
      : rebalanceView?.status ?? yieldView?.status ?? strategy.defaultStatus

    res.json({
      id: strategy.id,
      name: strategy.name,
      status,
      type: strategy.type,
      pnl: rebalanceView?.pnl ?? yieldView?.pnl ?? strategy.pnl,
      settings: serializeSettings(settings),
      details: rebalanceView?.details ?? yieldView?.details ?? strategyDetailCopy[strategy.id] ?? {},
      history: history.map((entry) => ({
        id: entry.id,
        status: entry.status,
        description: entry.description,
        txHash: entry.tx_hash,
        chainId: entry.chain_id,
        executedAt: entry.executed_at,
        amountUsd: entry.amount_usd,
        profitUsd: entry.profit_usd,
        gasCostUsd: entry.gas_cost_usd,
        errorMessage: entry.error_message,
      })),
    })
  } catch (err) {
    console.error('[strategy detail]', err)
    res.status(500).json({ error: 'Failed to load strategy' })
  }
})

strategyRouter.post('/:id/toggle', async (req: AuthenticatedRequest, res) => {
  try {
    const strategyId = normalizeStrategyId(req.params.id)
    if (!strategyId || !strategyCatalog.some((entry) => entry.id === strategyId)) {
      return res.status(404).json({ error: 'Strategy not found' })
    }

    const { action } = ToggleSchema.parse(req.body)
    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await setStrategyEnabled(user.id, strategyId, action === 'resume')
    const strategy = strategyCatalog.find((entry) => entry.id === strategyId)!

    res.json({
      success: true,
      strategyId,
      newStatus: settings?.[strategyFieldMap[strategyId]] === false ? 'paused' : strategy.defaultStatus,
      settings: settings ? serializeSettings(settings) : null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid action' })
    console.error('[strategy toggle]', err)
    res.status(500).json({ error: 'Failed to toggle strategy' })
  }
})

strategyRouter.post('/settings', async (req: AuthenticatedRequest, res) => {
  try {
    const body = SettingsSchema.parse(req.body ?? {})
    const user = await getOrCreateAuthenticatedUser(req)
    const settings = await updateAgentSettings(user.id, {
      auto_execute: body.autoExecute,
      require_approval_above: body.requireApprovalAbove,
      allow_swaps: body.allowSwaps,
      allow_bridges: body.allowBridges,
      allow_sends: body.allowSends,
    })

    res.json({
      success: true,
      settings: serializeSettings(settings),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid settings payload', details: err.errors })
    }
    console.error('[strategy settings]', err)
    res.status(500).json({ error: 'Failed to update strategy settings' })
  }
})

strategyRouter.post('/:id/preview', async (req: AuthenticatedRequest, res) => {
  try {
    const strategyId = normalizeStrategyId(req.params.id)
    if (strategyId !== 'rebalance' && strategyId !== 'yield') {
      return res.status(400).json({ error: 'Preview generation is only implemented for rebalance and yield right now.' })
    }

    const user = await getOrCreateAuthenticatedUser(req)
    if (!user.wallet_address) {
      return res.status(400).json({ error: 'A linked wallet is required before generating a strategy preview.' })
    }

    const preview = strategyId === 'rebalance'
      ? await buildRebalancePreview(user.wallet_address)
      : await buildYieldPreview(user.wallet_address)
    return res.json(preview)
  } catch (err) {
    console.error('[strategy preview]', err)
    return res.status(500).json({ error: 'Failed to generate strategy preview' })
  }
})

async function getOrCreateAuthenticatedUser(req: AuthenticatedRequest) {
  const existing = req.userId ? await getUserByPrivyId(req.userId) : null
  if (existing) return existing

  const created = await upsertUser(req.userId!, req.walletAddress)
  if (!created) {
    throw new Error('Authenticated user could not be resolved')
  }
  return created
}

function normalizeStrategyId(value?: string): StrategyId | null {
  if (!value) return null
  if (value === 'reb') return 'rebalance'
  return strategyCatalog.some((entry) => entry.id === value) ? (value as StrategyId) : null
}

function serializeSettings(settings: Awaited<ReturnType<typeof getAgentSettings>>) {
  return {
    autoExecute: settings.auto_execute,
    executionCapUsd: Number(settings.require_approval_above),
    allowSwaps: settings.allow_swaps ?? true,
    allowBridges: settings.allow_bridges ?? true,
    allowSends: settings.allow_sends ?? true,
    arbEnabled: settings.arb_enabled,
    yieldEnabled: settings.yield_enabled,
    rebalanceEnabled: settings.rebalance_enabled,
    bricktEnabled: settings.brickt_enabled,
    updatedAt: settings.updated_at,
  }
}
