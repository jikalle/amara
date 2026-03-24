import { Router } from 'express'
import { z } from 'zod'
import { toggleStrategy, getStrategyStatus } from '@anara/agent'

export const strategyRouter = Router()

strategyRouter.get('/', (_req, res) => {
  res.json({
    strategies: [
      { id: 'arb',       name: 'Arb Bot',        status: 'active',   pnl: '+$847.32', type: 'arb'   },
      { id: 'yield',     name: 'Yield Optimizer', status: 'active',   pnl: '+$312.10', type: 'yield' },
      { id: 'rebalance', name: 'Auto-Rebalance',  status: 'watching', pnl: 'In Range', type: 'reb'   },
      { id: 'brickt',    name: 'Brickt Pools',    status: 'active',   pnl: '+$64.00',  type: 'brickt'},
    ],
  })
})

strategyRouter.get('/:id', async (req, res) => {
  const status = await getStrategyStatus(req.params.id)
  if (!status) return res.status(404).json({ error: 'Strategy not found' })
  res.json(status)
})

const ToggleSchema = z.object({ action: z.enum(['pause', 'resume']) })

strategyRouter.post('/:id/toggle', async (req, res) => {
  try {
    const { action } = ToggleSchema.parse(req.body)
    const result = await toggleStrategy(req.params.id, action)
    res.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: 'Invalid action' })
    res.status(500).json({ error: 'Failed to toggle strategy' })
  }
})
