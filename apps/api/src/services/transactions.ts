// ─────────────────────────────────────────────────────────────────
// Transactions Service
// Fetches recent transfers via Alchemy JSON-RPC
// ─────────────────────────────────────────────────────────────────

const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const ALCHEMY_ETH_URL  = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

type TransferDirection = 'from' | 'to'

export interface TransferRecord {
  uniqueId?: string
  hash: string
  from: string
  to?: string
  value: string
  asset?: string
  category?: string
  rawContract?: { value?: string; address?: string; decimal?: string }
  metadata?: { blockTimestamp?: string }
  blockNum?: string
}

export interface TransactionSummary {
  hash: `0x${string}`
  chainId: number
  type: 'send' | 'receive'
  status: 'confirmed'
  from: `0x${string}`
  to?: `0x${string}`
  value: string
  valueFormatted: string
  valueUsd?: string
  timestamp: number
  blockNumber?: number
  nonce: number
  tokenIn?: { symbol: string; amount: string; amountUsd?: string }
  tokenOut?: { symbol: string; amount: string; amountUsd?: string }
  fromChainId?: number
  toChainId?: number
  bridgeProtocol?: string
}

function getAlchemyUrl(chainId: number) {
  return chainId === 8453 ? ALCHEMY_BASE_URL : ALCHEMY_ETH_URL
}

function toHexCount(n: number) {
  const clamped = Math.max(1, Math.min(n, 200))
  return `0x${clamped.toString(16)}`
}

function normalizeAddress(addr?: string) {
  return addr ? addr.toLowerCase() : addr
}

async function fetchTransfers(address: string, chainId: number, direction: TransferDirection, limit: number) {
  const url = getAlchemyUrl(chainId)
  const addr = normalizeAddress(address)

  const params: Record<string, unknown> = {
    fromBlock: '0x0',
    toBlock: 'latest',
    category: ['external', 'internal', 'erc20'],
    withMetadata: true,
    excludeZeroValue: true,
    maxCount: toHexCount(limit),
    order: 'desc',
  }

  if (direction === 'from') params.fromAddress = addr
  else params.toAddress = addr

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getAssetTransfers',
      params: [params],
    }),
  })

  const data = await res.json()
  return (data.result?.transfers ?? []) as TransferRecord[]
}

export async function getRecentTransactions(address: string, chainId: number, limit = 20): Promise<TransactionSummary[]> {
  const [outgoing, incoming] = await Promise.allSettled([
    fetchTransfers(address, chainId, 'from', limit),
    fetchTransfers(address, chainId, 'to', limit),
  ])

  const merged = [
    ...(outgoing.status === 'fulfilled' ? outgoing.value : []),
    ...(incoming.status === 'fulfilled' ? incoming.value : []),
  ]

  const seen = new Set<string>()
  const records = merged.filter((t) => {
    const key = t.uniqueId ?? `${t.hash}:${t.blockNum ?? ''}:${t.from}:${t.to}:${t.asset ?? ''}:${t.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const addr = normalizeAddress(address)

  const txs = records.map((t): TransactionSummary => {
    const isOutgoing = normalizeAddress(t.from) === addr
    const timestamp = t.metadata?.blockTimestamp
      ? new Date(t.metadata.blockTimestamp).getTime()
      : 0
    const blockNumber = t.blockNum ? Number.parseInt(t.blockNum, 16) : undefined
    const value = t.value ?? '0'
    const asset = t.asset ?? ''
    const valueFormatted = asset ? `${value} ${asset}` : value
    const valueUsd = asset === 'USDC' || asset === 'USDT'
      ? `$${Number.parseFloat(value).toFixed(2)}`
      : undefined

    return {
      hash: t.hash as `0x${string}`,
      chainId,
      type: isOutgoing ? 'send' : 'receive',
      status: 'confirmed',
      from: t.from as `0x${string}`,
      to: t.to as `0x${string}` | undefined,
      value,
      valueFormatted,
      valueUsd,
      timestamp,
      blockNumber,
      nonce: 0,
      tokenIn: !isOutgoing && asset ? { symbol: asset, amount: value, amountUsd: valueUsd } : undefined,
      tokenOut: isOutgoing && asset ? { symbol: asset, amount: value, amountUsd: valueUsd } : undefined,
    }
  })

  return txs
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, limit)
}
