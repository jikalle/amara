export type StrategyType = 'arb' | 'yield' | 'rebalance' | 'brickt' | 'custom'
export type StrategyStatus = 'active' | 'paused' | 'watching' | 'error'

export interface Strategy {
  id: string
  type: StrategyType
  name: string
  description: string
  status: StrategyStatus
  chainId: number
  pnlUsd: string
  pnlPercent: string
  config: StrategyConfig
  executions: StrategyExecution[]
  createdAt: number
  updatedAt: number
}

export interface StrategyConfig {
  maxTradeSize?: string
  minSpread?: number
  slippage?: number
  targetAllocation?: Record<string, number>
  compoundInterval?: number
  gasBudget?: string
  autoExecute: boolean
  requireApprovalAbove?: string
}

export interface StrategyExecution {
  id: string
  strategyId: string
  status: 'success' | 'skipped' | 'failed'
  reason?: string
  profitUsd?: string
  txHash?: `0x${string}`
  timestamp: number
  gasUsed?: string
}
