export type AgentMessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type AgentIntentType = 'swap' | 'send' | 'bridge' | 'query' | 'strategy' | 'settings' | 'unknown'

export interface AgentMessage {
  id: string
  role: AgentMessageRole
  content: string
  timestamp: number
  intent?: ParsedIntent
  actionCard?: AgentActionCard
}

export interface ParsedIntent {
  type: AgentIntentType
  confidence: number
  params: Record<string, unknown>
  requiresConfirmation: boolean
}

export interface AgentActionCard {
  type: AgentIntentType
  title: string
  rows: { label: string; value: string; highlight?: boolean }[]
  status: 'pending' | 'executing' | 'confirmed' | 'failed' | 'cancelled'
  txHash?: `0x${string}`
  metadata?: AgentActionMetadata
}

export interface AgentActionMetadata {
  kind: 'swap' | 'bridge' | 'send'
  routeId?: string
  tool?: string
  fromChainId?: number
  toChainId?: number
  fromTokenSymbol?: string
  toTokenSymbol?: string
  fromTokenAddress?: string
  toTokenAddress?: string
  fromTokenDecimals?: number
  toTokenDecimals?: number
  fromAmount?: string
  toAmount?: string
  toAmountMin?: string
  toAddress?: string
  estimatedGasUsd?: number
  estimatedFeeUsd?: number
  steps?: number
}

export interface AgentState {
  isRunning: boolean
  lastActivity: number
  actionsToday: number
  errorsToday: number
  profitToday: string
  recentActions: AgentExecution[]
}

export interface AgentExecution {
  id: string
  type: AgentIntentType
  description: string
  status: 'success' | 'skipped' | 'failed'
  profitUsd?: string
  txHash?: `0x${string}`
  timestamp: number
}
