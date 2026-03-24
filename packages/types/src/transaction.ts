export type TransactionType = 'send' | 'receive' | 'swap' | 'bridge' | 'approve' | 'contract' | 'mint' | 'stake'
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled'

export interface Transaction {
  hash: `0x${string}`
  chainId: number
  type: TransactionType
  status: TransactionStatus
  from: `0x${string}`
  to?: `0x${string}`
  value: string
  valueFormatted: string
  valueUsd?: string
  gasUsed?: string
  gasCost?: string
  gasCostUsd?: string
  timestamp: number
  blockNumber?: number
  nonce: number
  // swap specific
  tokenIn?: { symbol: string; amount: string; amountUsd?: string }
  tokenOut?: { symbol: string; amount: string; amountUsd?: string }
  // bridge specific
  fromChainId?: number
  toChainId?: number
  bridgeProtocol?: string
}
