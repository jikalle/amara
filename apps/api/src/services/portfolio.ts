// ─────────────────────────────────────────────────────────────────
// Portfolio Service
// Fetches real token balances + prices via Alchemy SDK
// ─────────────────────────────────────────────────────────────────

const ALCHEMY_BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const ALCHEMY_ETH_URL  = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const COINGECKO_URL    = 'https://api.coingecko.com/api/v3'

export interface TokenBalance {
  contractAddress: string
  tokenBalance:    string  // hex
}

export interface TokenSummary {
  symbol: string
  name?: string
  balance: string
  balanceUsd: string
  chainId: number
  change24h?: string
  logo?: string
  contractAddress?: string
}

export interface NftSummary {
  tokenId: string
  collection: string
  name?: string
  chain: string
  imageUrl?: string
}

const MAX_TOKENS_PER_CHAIN = 30

// ── Get token balances (Alchemy) ──────────────────────────────────
export async function getTokenBalances(address: string, chainId: number) {
  const url = chainId === 8453 ? ALCHEMY_BASE_URL : ALCHEMY_ETH_URL

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:      1,
      jsonrpc: '2.0',
      method:  'alchemy_getTokenBalances',
      params:  [address, 'erc20'],
    }),
  })

  const data = await res.json()
  return (data.result?.tokenBalances ?? []) as TokenBalance[]
}

function isNonZero(balanceHex: string) {
  try { return BigInt(balanceHex) > 0n } catch { return false }
}

function formatUnits(value: bigint, decimals: number, precision = 6) {
  if (decimals <= 0) return value.toString()
  const s = value.toString().padStart(decimals + 1, '0')
  const whole = s.slice(0, -decimals)
  const fracRaw = s.slice(-decimals).replace(/0+$/, '')
  const frac = fracRaw.slice(0, precision)
  return frac ? `${whole}.${frac}` : whole
}

// ── Get token metadata ─────────────────────────────────────────────
export async function getTokenMetadata(contractAddress: string, chainId: number) {
  const url = chainId === 8453 ? ALCHEMY_BASE_URL : ALCHEMY_ETH_URL

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:      1,
      jsonrpc: '2.0',
      method:  'alchemy_getTokenMetadata',
      params:  [contractAddress],
    }),
  })

  const data = await res.json()
  return data.result
}

// ── Get native ETH balance ─────────────────────────────────────────
export async function getNativeBalance(address: string, chainId: number): Promise<string> {
  const url = chainId === 8453 ? ALCHEMY_BASE_URL : ALCHEMY_ETH_URL

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:      1,
      jsonrpc: '2.0',
      method:  'eth_getBalance',
      params:  [address, 'latest'],
    }),
  })

  const data = await res.json()
  // Convert hex wei to ETH string
  const wei    = BigInt(data.result ?? '0x0')
  const ethVal = Number(wei) / 1e18
  return ethVal.toFixed(6)
}

// ── Get token prices (CoinGecko) ───────────────────────────────────
export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = symbols
    .map(s => COINGECKO_IDS[s.toUpperCase()])
    .filter(Boolean)
    .join(',')

  if (!ids) return {}

  const res  = await fetch(`${COINGECKO_URL}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`)
  const data = await res.json()

  const prices: Record<string, number> = {}
  for (const sym of symbols) {
    const id = COINGECKO_IDS[sym.toUpperCase()]
    if (id && data[id]) {
      prices[sym.toUpperCase()] = data[id].usd
    }
  }
  return prices
}

// ── NFT balances (Alchemy NFT API) ────────────────────────────────
export async function getNFTs(address: string, chainId: number) {
  const url = chainId === 8453
    ? `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}`
    : `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}`

  const res  = await fetch(`${url}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=20`)
  const data = await res.json()
  return data.ownedNfts ?? []
}

// ── Full portfolio summary ─────────────────────────────────────────
export async function buildPortfolio(address: string) {
  // Fetch in parallel
  const [baseTokens, ethTokens, nativeBase, nativeEth, nftsBase, nftsEth] = await Promise.allSettled([
    getTokenBalances(address, 8453),
    getTokenBalances(address, 1),
    getNativeBalance(address, 8453),
    getNativeBalance(address, 1),
    getNFTs(address, 8453),
    getNFTs(address, 1),
  ])

  const baseTokenList = (baseTokens.status === 'fulfilled' ? baseTokens.value : [])
    .filter(t => isNonZero(t.tokenBalance))
    .slice(0, MAX_TOKENS_PER_CHAIN)

  const ethTokenList = (ethTokens.status === 'fulfilled' ? ethTokens.value : [])
    .filter(t => isNonZero(t.tokenBalance))
    .slice(0, MAX_TOKENS_PER_CHAIN)

  const tokenEntries = [
    ...baseTokenList.map(t => ({ ...t, chainId: 8453 })),
    ...ethTokenList.map(t => ({ ...t, chainId: 1 })),
  ]

  const metadataList = await Promise.all(
    tokenEntries.map(async t => {
      try {
        const meta = await getTokenMetadata(t.contractAddress, t.chainId)
        return { ...t, meta }
      } catch {
        return { ...t, meta: null }
      }
    })
  )

  const symbols = Array.from(new Set(metadataList.map(t => t.meta?.symbol).filter(Boolean))) as string[]
  const priceMap = await getTokenPrices(['ETH', ...symbols])

  let totalUsdValue = 0
  const chainTotals: Record<number, number> = { 8453: 0, 1: 0 }

  const tokens: TokenSummary[] = metadataList
    .map(entry => {
      const meta = entry.meta
      if (!meta?.symbol || typeof meta.decimals !== 'number') return null
      const balanceBig = BigInt(entry.tokenBalance)
      const balanceStr = formatUnits(balanceBig, meta.decimals)
      const price = priceMap[meta.symbol.toUpperCase()] ?? 0
      const usd = parseFloat(balanceStr || '0') * price
      if (usd > 0) {
        totalUsdValue += usd
        chainTotals[entry.chainId] = (chainTotals[entry.chainId] ?? 0) + usd
      }
      return {
        symbol: meta.symbol.toUpperCase(),
        name: meta.name,
        balance: balanceStr,
        balanceUsd: `$${usd.toFixed(2)}`,
        chainId: entry.chainId,
        change24h: undefined,
        logo: meta.logo,
        contractAddress: entry.contractAddress,
      }
    })
    .filter(Boolean) as TokenSummary[]

  // Add native ETH balances
  const nativeBaseVal = nativeBase.status === 'fulfilled' ? nativeBase.value : '0'
  const nativeEthVal  = nativeEth.status === 'fulfilled'  ? nativeEth.value  : '0'
  const ethPrice      = priceMap.ETH ?? 0

  const nativeBaseUsd = parseFloat(nativeBaseVal) * ethPrice
  const nativeEthUsd  = parseFloat(nativeEthVal)  * ethPrice
  if (nativeBaseUsd > 0) chainTotals[8453] += nativeBaseUsd
  if (nativeEthUsd > 0)  chainTotals[1]    += nativeEthUsd
  totalUsdValue += nativeBaseUsd + nativeEthUsd

  if (parseFloat(nativeBaseVal) > 0) {
    tokens.unshift({
      symbol: 'ETH',
      name: 'Ether',
      balance: nativeBaseVal,
      balanceUsd: `$${nativeBaseUsd.toFixed(2)}`,
      chainId: 8453,
    })
  }
  if (parseFloat(nativeEthVal) > 0) {
    tokens.unshift({
      symbol: 'ETH',
      name: 'Ether',
      balance: nativeEthVal,
      balanceUsd: `$${nativeEthUsd.toFixed(2)}`,
      chainId: 1,
    })
  }

  const nfts: NftSummary[] = [
    ...(nftsBase.status === 'fulfilled' ? nftsBase.value : []).slice(0, 10).map((n: any) => ({
      tokenId:    n.tokenId ?? '',
      collection: n.contract?.name ?? 'Unknown Collection',
      name:       n.title ?? n.tokenId ?? 'NFT',
      chain:      'base',
      imageUrl:   n.media?.[0]?.gateway ?? n.media?.[0]?.raw ?? undefined,
    })),
    ...(nftsEth.status === 'fulfilled' ? nftsEth.value : []).slice(0, 10).map((n: any) => ({
      tokenId:    n.tokenId ?? '',
      collection: n.contract?.name ?? 'Unknown Collection',
      name:       n.title ?? n.tokenId ?? 'NFT',
      chain:      'ethereum',
      imageUrl:   n.media?.[0]?.gateway ?? n.media?.[0]?.raw ?? undefined,
    })),
  ]

  const change24h = '+$0.00'

  return {
    address,
    chains: [
      { chainId: 8453, nativeBalance: nativeBaseVal, totalUsd: `$${(chainTotals[8453] ?? 0).toFixed(2)}` },
      { chainId: 1,    nativeBalance: nativeEthVal,  totalUsd: `$${(chainTotals[1] ?? 0).toFixed(2)}` },
    ],
    tokens,
    nfts,
    totalUsdValue,
    totalUsd:   `$${totalUsdValue.toFixed(2)}`,
    change24h,
    lastUpdated: Date.now(),
  }
}

// ── CoinGecko ID map ──────────────────────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  ETH:   'ethereum',
  WETH:  'weth',
  BTC:   'bitcoin',
  WBTC:  'wrapped-bitcoin',
  USDC:  'usd-coin',
  USDT:  'tether',
  DAI:   'dai',
  MATIC: 'matic-network',
  BNB:   'binancecoin',
  AVAX:  'avalanche-2',
  SOL:   'solana',
  ARB:   'arbitrum',
  OP:    'optimism',
  AERO:  'aerodrome-finance',
}
