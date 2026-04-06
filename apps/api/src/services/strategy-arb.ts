import { getSwapQuote } from '@anara/chain'
import type { AgentActionCard } from '@anara/types'
import { buildPortfolio } from './portfolio.js'

type ArbStrategyView = {
  status: 'active' | 'watching'
  pnl: string
  details: Record<string, string | number | boolean>
}

type ArbPreviewResult =
  | { actionable: true; actionCard: AgentActionCard; summary: string }
  | { actionable: false; reason: string; summary: string }

type MarketConfig = {
  chainId: 8453 | 1 | 56
  chainLabel: string
  baseSymbol: 'ETH' | 'BNB'
  stableSymbol: 'USDC' | 'USDT'
  baseTokenAddress: string
  stableTokenAddress: string
  baseDecimals: number
  stableDecimals: number
  priceId: 'ethereum' | 'binancecoin'
}

type ReferencePrices = Record<'ETH' | 'BNB', number>

type Opportunity = {
  chainId: number
  chainLabel: string
  direction: 'sell_base' | 'buy_base'
  baseSymbol: string
  stableSymbol: string
  baseTokenAddress: string
  stableTokenAddress: string
  fromTokenAddress: string
  toTokenAddress: string
  fromAmountRaw: string
  referencePriceUsd: number
  impliedPriceUsd: number
  grossEdgePct: number
  estimatedNetUsd: number
  summary: string
}

const MIN_TRADE_USD = 35
const MAX_TRADE_USD = 200
const MIN_EDGE_PCT = 1.25

const MARKETS: MarketConfig[] = [
  {
    chainId: 8453,
    chainLabel: 'Base',
    baseSymbol: 'ETH',
    stableSymbol: 'USDC',
    baseTokenAddress: '0x0000000000000000000000000000000000000000',
    stableTokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    baseDecimals: 18,
    stableDecimals: 6,
    priceId: 'ethereum',
  },
  {
    chainId: 1,
    chainLabel: 'Ethereum',
    baseSymbol: 'ETH',
    stableSymbol: 'USDC',
    baseTokenAddress: '0x0000000000000000000000000000000000000000',
    stableTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    baseDecimals: 18,
    stableDecimals: 6,
    priceId: 'ethereum',
  },
  {
    chainId: 56,
    chainLabel: 'BNB Chain',
    baseSymbol: 'BNB',
    stableSymbol: 'USDT',
    baseTokenAddress: '0x0000000000000000000000000000000000000000',
    stableTokenAddress: '0x55d398326f99059fF775485246999027B3197955',
    baseDecimals: 18,
    stableDecimals: 18,
    priceId: 'binancecoin',
  },
]

let cachedReferencePrices:
  | {
      value: ReferencePrices
      expiresAt: number
    }
  | null = null

export async function buildArbStrategyView(walletAddress: string): Promise<ArbStrategyView> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = await analyzeArbPortfolio(walletAddress, portfolio)

  if (!analysis) {
    return {
      status: 'watching',
      pnl: 'No market edge',
      details: {
        mode: 'Same-chain dislocation scan',
        universe: 'ETH/USDC on Base + Ethereum · BNB/USDT on BNB Chain',
        minTrade: formatUsd(MIN_TRADE_USD),
        trigger: `>${MIN_EDGE_PCT.toFixed(2)}% estimated edge`,
        recommendation: 'Fund one of the supported majors or stablecoins to activate arbitrage monitoring.',
        approvalsRequired: true,
      },
    }
  }

  if (!analysis.bestOpportunity) {
    return {
      status: 'watching',
      pnl: 'Watching spreads',
      details: {
        mode: 'Same-chain dislocation scan',
        universe: 'ETH/USDC on Base + Ethereum · BNB/USDT on BNB Chain',
        minTrade: formatUsd(MIN_TRADE_USD),
        trigger: `>${MIN_EDGE_PCT.toFixed(2)}% estimated edge`,
        strongestMarket: analysis.bestObservedMarket,
        strongestEdge: `${analysis.bestObservedEdgePct.toFixed(2)}%`,
        recommendation: 'No quoted opportunity currently clears the minimum net edge threshold.',
        approvalsRequired: true,
      },
    }
  }

  return {
    status: 'active',
    pnl: `${analysis.bestOpportunity.grossEdgePct.toFixed(2)}% edge`,
    details: {
      mode: 'Same-chain dislocation scan',
      universe: 'ETH/USDC on Base + Ethereum · BNB/USDT on BNB Chain',
      strongestMarket: `${analysis.bestOpportunity.baseSymbol}/${analysis.bestOpportunity.stableSymbol} on ${analysis.bestOpportunity.chainLabel}`,
      strongestEdge: `${analysis.bestOpportunity.grossEdgePct.toFixed(2)}%`,
      estimatedNet: formatUsd(analysis.bestOpportunity.estimatedNetUsd),
      recommendation: analysis.bestOpportunity.summary,
      approvalsRequired: true,
    },
  }
}

export async function buildArbPreview(walletAddress: string): Promise<ArbPreviewResult> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = await analyzeArbPortfolio(walletAddress, portfolio)

  if (!analysis) {
    return {
      actionable: false,
      summary: 'Wallet balance data is not sufficient to scan arbitrage opportunities yet.',
      reason: 'No supported major or stable balance is available for the arbitrage scan.',
    }
  }

  if (!analysis.bestOpportunity) {
    return {
      actionable: false,
      summary: 'No quoted same-chain dislocation currently clears the minimum net edge threshold.',
      reason: `Best observed edge was ${analysis.bestObservedEdgePct.toFixed(2)}% on ${analysis.bestObservedMarket}.`,
    }
  }

  try {
    const quote = await getSwapQuote({
      fromChainId: analysis.bestOpportunity.chainId,
      toChainId: analysis.bestOpportunity.chainId,
      fromTokenAddress: analysis.bestOpportunity.fromTokenAddress,
      toTokenAddress: analysis.bestOpportunity.toTokenAddress,
      fromAmount: analysis.bestOpportunity.fromAmountRaw,
      fromAddress: walletAddress,
      slippage: 0.005,
    })

    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsdNumber = quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? 0
    const feeUsdNumber = quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? 0
    const routeName = quote.toolDetails?.name ?? analysis.bestOpportunity.chainLabel
    const rate = computeRate(fromAmount, toAmount)

    return {
      actionable: true,
      summary: analysis.bestOpportunity.summary,
      actionCard: {
        type: 'swap',
        title: 'Arbitrage Preview',
        status: 'pending',
        rows: [
          { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
          { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
          { label: 'Market', value: `${analysis.bestOpportunity.baseSymbol}/${analysis.bestOpportunity.stableSymbol} on ${analysis.bestOpportunity.chainLabel}` },
          { label: 'Reference price', value: formatUsd(analysis.bestOpportunity.referencePriceUsd) },
          { label: 'Quoted price', value: formatUsd(analysis.bestOpportunity.impliedPriceUsd) },
          { label: 'Estimated edge', value: `${analysis.bestOpportunity.grossEdgePct.toFixed(2)}%` },
          { label: 'Est. net edge', value: formatUsd(analysis.bestOpportunity.estimatedNetUsd) },
          { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
          { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
          { label: 'Route', value: `${routeName} · ${analysis.bestOpportunity.chainLabel}` },
          { label: 'Bridge fee', value: formatUsdValue(feeUsdNumber) },
          { label: 'Est. gas', value: formatUsdValue(gasUsdNumber) },
        ],
        metadata: {
          kind: 'swap',
          routeId: quote.id,
          tool: quote.toolDetails?.name,
          fromChainId: analysis.bestOpportunity.chainId,
          toChainId: analysis.bestOpportunity.chainId,
          fromTokenSymbol: quote.action.fromToken.symbol,
          toTokenSymbol: quote.action.toToken.symbol,
          fromTokenAddress: analysis.bestOpportunity.fromTokenAddress,
          toTokenAddress: analysis.bestOpportunity.toTokenAddress,
          fromTokenDecimals: quote.action.fromToken.decimals,
          toTokenDecimals: quote.action.toToken.decimals,
          fromAmount: quote.action.fromAmount,
          toAmount: quote.estimate?.toAmount,
          toAmountMin: quote.estimate?.toAmountMin,
          estimatedGasUsd: gasUsdNumber || undefined,
          estimatedFeeUsd: feeUsdNumber || undefined,
          steps: quote.includedSteps?.length,
        },
      },
    }
  } catch (error) {
    return {
      actionable: false,
      summary: analysis.bestOpportunity.summary,
      reason: error instanceof Error ? error.message : 'Arbitrage quote failed.',
    }
  }
}

async function analyzeArbPortfolio(walletAddress: string, portfolio: Awaited<ReturnType<typeof buildPortfolio>>) {
  const prices = await getReferencePrices().catch(() => null)
  if (!prices) return null

  const opportunities = (
    await Promise.all(
      MARKETS.map((market) => evaluateMarket(walletAddress, portfolio, market, prices))
    )
  ).flatMap((result) => result ?? [])

  if (!opportunities.length) {
    return null
  }

  const bestObserved = opportunities.reduce((best, next) =>
    next.grossEdgePct > best.grossEdgePct ? next : best
  )

  const actionable = opportunities
    .filter((entry) => entry.grossEdgePct >= MIN_EDGE_PCT && entry.estimatedNetUsd > 0)
    .sort((left, right) => right.estimatedNetUsd - left.estimatedNetUsd)[0] ?? null

  return {
    bestOpportunity: actionable,
    bestObservedMarket: `${bestObserved.baseSymbol}/${bestObserved.stableSymbol} on ${bestObserved.chainLabel}`,
    bestObservedEdgePct: bestObserved.grossEdgePct,
  }
}

async function evaluateMarket(
  walletAddress: string,
  portfolio: Awaited<ReturnType<typeof buildPortfolio>>,
  market: MarketConfig,
  prices: ReferencePrices,
) {
  const baseToken = portfolio.tokens.find(
    (token) => token.chainId === market.chainId && token.symbol.toUpperCase() === market.baseSymbol
  )
  const stableToken = portfolio.tokens.find(
    (token) => token.chainId === market.chainId && token.symbol.toUpperCase() === market.stableSymbol
  )
  const referencePriceUsd = prices[market.baseSymbol]
  if (!referencePriceUsd || referencePriceUsd <= 0) return null

  const opportunities: Opportunity[] = []

  const baseUsd = parseUsd(baseToken?.balanceUsd)
  if (baseToken && baseUsd >= MIN_TRADE_USD) {
    const tradeUsd = Math.min(Math.max(MIN_TRADE_USD, baseUsd * 0.2), Math.min(baseUsd, MAX_TRADE_USD))
    const fromAmountRaw = sizeTokenAmount(baseToken.balance, baseToken.symbol, tradeUsd, referencePriceUsd, market.baseDecimals)
    if (fromAmountRaw) {
      try {
        const quote = await getSwapQuote({
          fromChainId: market.chainId,
          toChainId: market.chainId,
          fromTokenAddress: market.baseTokenAddress,
          toTokenAddress: market.stableTokenAddress,
          fromAmount: fromAmountRaw,
          fromAddress: walletAddress,
          slippage: 0.005,
        })
        const fromAmount = parseTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
        const toAmount = parseTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
        const impliedPriceUsd = fromAmount > 0 ? toAmount / fromAmount : 0
        const grossEdgePct = referencePriceUsd > 0 ? ((impliedPriceUsd - referencePriceUsd) / referencePriceUsd) * 100 : 0
        const fees = estimateFeesUsd(quote)
        const estimatedNetUsd = ((impliedPriceUsd - referencePriceUsd) * fromAmount) - fees
        opportunities.push({
          chainId: market.chainId,
          chainLabel: market.chainLabel,
          direction: 'sell_base',
          baseSymbol: market.baseSymbol,
          stableSymbol: market.stableSymbol,
          baseTokenAddress: market.baseTokenAddress,
          stableTokenAddress: market.stableTokenAddress,
          fromTokenAddress: market.baseTokenAddress,
          toTokenAddress: market.stableTokenAddress,
          fromAmountRaw,
          referencePriceUsd,
          impliedPriceUsd,
          grossEdgePct,
          estimatedNetUsd,
          summary: `${market.baseSymbol} is quoting rich against ${market.stableSymbol} on ${market.chainLabel}. A sell into stable may capture the current dislocation if it reverts.`,
        })
      } catch {
        // Ignore individual market quote failure
      }
    }
  }

  const stableUsd = parseUsd(stableToken?.balanceUsd)
  if (stableToken && stableUsd >= MIN_TRADE_USD) {
    const tradeUsd = Math.min(Math.max(MIN_TRADE_USD, stableUsd * 0.2), Math.min(stableUsd, MAX_TRADE_USD))
    const fromAmountRaw = sizeStableAmount(tradeUsd, market.stableDecimals)
    if (fromAmountRaw) {
      try {
        const quote = await getSwapQuote({
          fromChainId: market.chainId,
          toChainId: market.chainId,
          fromTokenAddress: market.stableTokenAddress,
          toTokenAddress: market.baseTokenAddress,
          fromAmount: fromAmountRaw,
          fromAddress: walletAddress,
          slippage: 0.005,
        })
        const fromAmount = parseTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
        const toAmount = parseTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
        const impliedPriceUsd = toAmount > 0 ? fromAmount / toAmount : 0
        const grossEdgePct = referencePriceUsd > 0 ? ((referencePriceUsd - impliedPriceUsd) / referencePriceUsd) * 100 : 0
        const fees = estimateFeesUsd(quote)
        const estimatedNetUsd = ((referencePriceUsd - impliedPriceUsd) * toAmount) - fees
        opportunities.push({
          chainId: market.chainId,
          chainLabel: market.chainLabel,
          direction: 'buy_base',
          baseSymbol: market.baseSymbol,
          stableSymbol: market.stableSymbol,
          baseTokenAddress: market.baseTokenAddress,
          stableTokenAddress: market.stableTokenAddress,
          fromTokenAddress: market.stableTokenAddress,
          toTokenAddress: market.baseTokenAddress,
          fromAmountRaw,
          referencePriceUsd,
          impliedPriceUsd,
          grossEdgePct,
          estimatedNetUsd,
          summary: `${market.baseSymbol} is quoting cheap against ${market.stableSymbol} on ${market.chainLabel}. A buy from stable may capture the current dislocation if spot reverts.`,
        })
      } catch {
        // Ignore individual market quote failure
      }
    }
  }

  return opportunities
}

async function getReferencePrices(): Promise<ReferencePrices> {
  if (cachedReferencePrices && cachedReferencePrices.expiresAt > Date.now()) {
    return cachedReferencePrices.value
  }

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin&vs_currencies=usd',
    { headers: { Accept: 'application/json' } },
  )

  if (!res.ok) {
    throw new Error(`Reference price API HTTP ${res.status}`)
  }

  const data = await res.json() as Record<string, { usd?: number }>
  const value: ReferencePrices = {
    ETH: Number(data.ethereum?.usd ?? 0),
    BNB: Number(data.binancecoin?.usd ?? 0),
  }

  cachedReferencePrices = {
    value,
    expiresAt: Date.now() + 60_000,
  }

  return value
}

function parseUsd(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

function estimateFeesUsd(quote: Awaited<ReturnType<typeof getSwapQuote>>) {
  const gas = quote.estimate?.gasCosts?.reduce((sum, item) => sum + Number(item.amountUSD ?? 0), 0) ?? 0
  const fee = quote.estimate?.feeCosts?.reduce((sum, item) => sum + Number(item.amountUSD ?? 0), 0) ?? 0
  return gas + fee
}

function sizeTokenAmount(balance: string, symbol: string, tradeUsd: number, referencePriceUsd: number, decimals: number) {
  const available = Number.parseFloat(balance || '0')
  if (!Number.isFinite(available) || available <= 0 || referencePriceUsd <= 0) return null
  const sized = Math.min(available, tradeUsd / referencePriceUsd)
  if (sized <= 0) return null
  return toRawAmount(sized, decimals)
}

function sizeStableAmount(tradeUsd: number, decimals: number) {
  if (!Number.isFinite(tradeUsd) || tradeUsd <= 0) return null
  return toRawAmount(tradeUsd, decimals)
}

function toRawAmount(amount: number, decimals: number) {
  const fixed = amount.toFixed(Math.min(6, decimals))
  const [whole, fraction = ''] = fixed.split('.')
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals)
  const normalized = `${whole}${paddedFraction}`.replace(/^0+/, '') || '0'
  return normalized
}

function parseTokenAmount(rawAmount: string | undefined, decimals: number) {
  if (!rawAmount) return 0
  const sanitized = rawAmount.replace(/^0+/, '') || '0'
  const padded = sanitized.padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '')
  return Number.parseFloat(fraction ? `${whole}.${fraction}` : whole) || 0
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
}

function formatUsdValue(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  return `$${value.toFixed(2)}`
}

function formatTokenAmount(rawAmount: string | undefined, decimals: number) {
  if (!rawAmount) return '0'
  const parsed = parseTokenAmount(rawAmount, decimals)
  return parsed.toFixed(parsed >= 1 ? 4 : 6).replace(/0+$/, '').replace(/\.$/, '')
}

function computeRate(fromAmount: string, toAmount: string) {
  const from = Number.parseFloat(fromAmount)
  const to = Number.parseFloat(toAmount)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  return (to / from).toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
}
