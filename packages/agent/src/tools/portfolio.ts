const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY
const ALCHEMY_BASE_URL = ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  : null
const ALCHEMY_ETH_URL = ALCHEMY_API_KEY
  ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  : null
const COINGECKO_URL = 'https://api.coingecko.com/api/v3'

type SupportedChain = 8453 | 1

interface TokenBalance {
  contractAddress: string
  tokenBalance: string
}

interface TokenMetadata {
  symbol?: string
  name?: string
  decimals?: number
}

interface PortfolioAssetSummary {
  symbol: string
  value: string
  chainId: SupportedChain
}

export async function getPortfolioSummary(address: string) {
  if (!ALCHEMY_BASE_URL || !ALCHEMY_ETH_URL) {
    return {
      totalUsd: '$0.00',
      change24h: 'Unavailable',
      change24hPercent: 'Unavailable',
      chains: [],
      topAssets: [],
      note: 'Missing ALCHEMY_API_KEY for live portfolio reads.',
    }
  }

  const [baseNative, ethNative, baseTokens, ethTokens] = await Promise.allSettled([
    getNativeBalance(address, 8453),
    getNativeBalance(address, 1),
    getTokenBalances(address, 8453),
    getTokenBalances(address, 1),
  ])

  const tokenEntries = [
    ...(baseTokens.status === 'fulfilled' ? baseTokens.value : []).filter((token) => isNonZero(token.tokenBalance)).map((token) => ({ ...token, chainId: 8453 as const })),
    ...(ethTokens.status === 'fulfilled' ? ethTokens.value : []).filter((token) => isNonZero(token.tokenBalance)).map((token) => ({ ...token, chainId: 1 as const })),
  ].slice(0, 40)

  const metadata = await Promise.all(tokenEntries.map(async (token) => ({
    ...token,
    metadata: await getTokenMetadata(token.contractAddress, token.chainId).catch(() => null),
  })))

  const symbols = Array.from(new Set([
    'ETH',
    ...metadata.map((token) => token.metadata?.symbol?.toUpperCase()).filter(Boolean) as string[],
  ]))

  const priceMap = await getTokenPrices(symbols)
  const chainTotals: Record<SupportedChain, number> = { 8453: 0, 1: 0 }
  const assets: PortfolioAssetSummary[] = []

  const baseNativeBalance = baseNative.status === 'fulfilled' ? baseNative.value : 0
  const ethNativeBalance = ethNative.status === 'fulfilled' ? ethNative.value : 0
  const ethPrice = priceMap.ETH ?? 0

  if (baseNativeBalance > 0) {
    const usd = baseNativeBalance * ethPrice
    chainTotals[8453] += usd
    assets.push({ symbol: 'ETH', value: `$${usd.toFixed(2)}`, chainId: 8453 })
  }

  if (ethNativeBalance > 0) {
    const usd = ethNativeBalance * ethPrice
    chainTotals[1] += usd
    assets.push({ symbol: 'ETH', value: `$${usd.toFixed(2)}`, chainId: 1 })
  }

  for (const token of metadata) {
    if (!token.metadata?.symbol || typeof token.metadata.decimals !== 'number') continue

    const normalizedBalance = formatUnits(BigInt(token.tokenBalance), token.metadata.decimals)
    const price = priceMap[token.metadata.symbol.toUpperCase()] ?? 0
    const usd = Number.parseFloat(normalizedBalance) * price

    if (!Number.isFinite(usd) || usd <= 0) continue

    chainTotals[token.chainId] += usd
    assets.push({
      symbol: token.metadata.symbol.toUpperCase(),
      value: `$${usd.toFixed(2)}`,
      chainId: token.chainId,
    })
  }

  const totalUsdValue = chainTotals[8453] + chainTotals[1]
  const chains = [
    { name: 'Base', valueUsd: `$${chainTotals[8453].toFixed(2)}`, percent: toPercent(chainTotals[8453], totalUsdValue) },
    { name: 'Ethereum', valueUsd: `$${chainTotals[1].toFixed(2)}`, percent: toPercent(chainTotals[1], totalUsdValue) },
  ].filter((chain) => chain.valueUsd !== '$0.00')

  const topAssets = assets
    .sort((a, b) => toUsdNumber(b.value) - toUsdNumber(a.value))
    .slice(0, 4)
    .map((asset) => ({
      symbol: asset.symbol,
      value: asset.value,
      change: 'Live price',
    }))

  return {
    totalUsd: `$${totalUsdValue.toFixed(2)}`,
    change24h: 'Live pricing',
    change24hPercent: 'Unavailable',
    chains,
    topAssets,
  }
}

export async function getAssetPrice(symbol: string): Promise<string> {
  const prices = await getTokenPrices([symbol.toUpperCase()])
  const price = prices[symbol.toUpperCase()]
  return typeof price === 'number' ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : 'Price unavailable'
}

async function getTokenBalances(address: string, chainId: SupportedChain): Promise<TokenBalance[]> {
  const url = getAlchemyUrl(chainId)
  if (!url) return []

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getTokenBalances',
      params: [address, 'erc20'],
    }),
  })

  const data = await response.json() as { result?: { tokenBalances?: TokenBalance[] } }
  return data.result?.tokenBalances ?? []
}

async function getTokenMetadata(contractAddress: string, chainId: SupportedChain): Promise<TokenMetadata | null> {
  const url = getAlchemyUrl(chainId)
  if (!url) return null

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'alchemy_getTokenMetadata',
      params: [contractAddress],
    }),
  })

  const data = await response.json() as { result?: TokenMetadata }
  return data.result ?? null
}

async function getNativeBalance(address: string, chainId: SupportedChain): Promise<number> {
  const url = getAlchemyUrl(chainId)
  if (!url) return 0

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  })

  const data = await response.json() as { result?: string }
  const wei = BigInt(data.result ?? '0x0')
  return Number(wei) / 1e18
}

async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(symbols.map((symbol) => COINGECKO_IDS[symbol.toUpperCase()]).filter(Boolean)))
  if (!ids.length) return {}

  const response = await fetch(`${COINGECKO_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
  const data = await response.json() as Record<string, { usd?: number }>

  const prices: Record<string, number> = {}
  for (const symbol of symbols) {
    const id = COINGECKO_IDS[symbol.toUpperCase()]
    const usd = id ? data[id]?.usd : undefined
    if (typeof usd === 'number') {
      prices[symbol.toUpperCase()] = usd
    }
  }

  return prices
}

function getAlchemyUrl(chainId: SupportedChain) {
  return chainId === 8453 ? ALCHEMY_BASE_URL : ALCHEMY_ETH_URL
}

function isNonZero(balanceHex: string) {
  try {
    return BigInt(balanceHex) > 0n
  } catch {
    return false
  }
}

function formatUnits(value: bigint, decimals: number, precision = 6) {
  if (decimals <= 0) return value.toString()
  const padded = value.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}

function toPercent(value: number, total: number) {
  if (total <= 0 || value <= 0) return '0%'
  return `${Math.round((value / total) * 100)}%`
}

function toUsdNumber(input: string) {
  return Number.parseFloat(input.replace(/[$,]/g, '')) || 0
}

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  ARB: 'arbitrum',
  OP: 'optimism',
  AERO: 'aerodrome-finance',
}
