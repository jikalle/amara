import { getSwapQuote } from '@anara/chain'
import type { AgentActionCard } from '@anara/types'
import { buildPortfolio } from './portfolio'

type RebalanceStrategyView = {
  status: 'active' | 'watching'
  pnl: string
  details: Record<string, string | number | boolean>
}

type RebalancePreviewResult =
  | { actionable: true; actionCard: AgentActionCard; summary: string }
  | { actionable: false; reason: string; summary: string }

const TARGET_ALLOCATION = {
  core: 50,
  stable: 30,
  growth: 20,
} as const

const DRIFT_THRESHOLD_PCT = 5

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI'])
const CORE_SYMBOLS = new Set(['ETH', 'WETH'])

export async function buildRebalanceStrategyView(walletAddress: string): Promise<RebalanceStrategyView> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = analyzePortfolio(portfolio)

  if (!analysis) {
    return {
      status: 'watching',
      pnl: 'No balance data',
      details: {
        mode: 'Live allocation monitoring',
        threshold: `±${DRIFT_THRESHOLD_PCT}%`,
        walletValue: portfolio.totalUsd,
        recommendation: 'Fund the wallet to activate live allocation drift monitoring.',
        approvalsRequired: true,
      },
    }
  }

  return {
    status: analysis.maxDrift > DRIFT_THRESHOLD_PCT ? 'active' : 'watching',
    pnl: analysis.maxDrift > DRIFT_THRESHOLD_PCT ? `Drift ${analysis.maxDrift.toFixed(1)}%` : 'In Range',
    details: {
      mode: 'Live allocation monitoring',
      targetMix: `Core ${TARGET_ALLOCATION.core}% · Stable ${TARGET_ALLOCATION.stable}% · Growth ${TARGET_ALLOCATION.growth}%`,
      threshold: `±${DRIFT_THRESHOLD_PCT}%`,
      walletValue: portfolio.totalUsd,
      coreAllocation: formatAllocation(analysis.currentAllocation.core, TARGET_ALLOCATION.core),
      stableAllocation: formatAllocation(analysis.currentAllocation.stable, TARGET_ALLOCATION.stable),
      growthAllocation: formatAllocation(analysis.currentAllocation.growth, TARGET_ALLOCATION.growth),
      dominantChain: `${analysis.dominantChain} (${analysis.dominantChainPct.toFixed(1)}%)`,
      topHolding: analysis.topHolding ?? 'No dominant holding',
      recommendation: analysis.recommendation,
      approvalsRequired: true,
    },
  }
}

export async function buildRebalancePreview(walletAddress: string): Promise<RebalancePreviewResult> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = analyzePortfolio(portfolio)

  if (!analysis) {
    return {
      actionable: false,
      summary: 'Wallet balance data is not sufficient for rebalance generation yet.',
      reason: 'No balance data is available yet.',
    }
  }

  if (analysis.maxDrift <= DRIFT_THRESHOLD_PCT) {
    return {
      actionable: false,
      summary: 'Allocation is within drift threshold. No rebalance action is needed right now.',
      reason: 'Portfolio drift is already within the configured threshold.',
    }
  }

  const pair = getActionablePair(analysis.overweight.bucket, analysis.underweight.bucket)
  if (!pair) {
    return {
      actionable: false,
      summary: analysis.recommendation,
      reason: 'This drift pattern still needs a more advanced rebalance engine.',
    }
  }

  const sourceToken = getSourceToken(portfolio.tokens, pair.fromBucket)
  if (!sourceToken) {
    return {
      actionable: false,
      summary: analysis.recommendation,
      reason: `No ${bucketLabel(pair.fromBucket)} token with spendable balance is available for a rebalance route.`,
    }
  }

  const sourceAmount = getTokenAmountForUsd(sourceToken, analysis.rebalanceUsd)
  if (!sourceAmount) {
    return {
      actionable: false,
      summary: analysis.recommendation,
      reason: 'Could not size a safe rebalance amount from current holdings.',
    }
  }

  const targetToken = getTargetToken(pair.toBucket, sourceToken.chainId)
  if (!targetToken) {
    return {
      actionable: false,
      summary: analysis.recommendation,
      reason: 'A supported destination asset is not configured for this rebalance route.',
    }
  }

  try {
    const quote = await getSwapQuote({
      fromChainId: sourceToken.chainId,
      toChainId: sourceToken.chainId,
      fromTokenAddress: sourceAmount.address,
      toTokenAddress: targetToken.address,
      fromAmount: sourceAmount.rawAmount,
      fromAddress: walletAddress,
      slippage: 0.005,
    })

    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const route = quote.toolDetails?.name
      ? `${quote.toolDetails.name} · ${sourceToken.chainId === 1 ? 'Ethereum' : 'Base'}`
      : (sourceToken.chainId === 1 ? 'Ethereum' : 'Base')
    const rate = computeRate(fromAmount, toAmount)

    return {
      actionable: true,
      summary: `Rebalance signal detected: trim ${bucketLabel(pair.fromBucket)} and rebuild ${bucketLabel(pair.toBucket)} on ${sourceToken.chainId === 1 ? 'Ethereum' : 'Base'}.`,
      actionCard: {
        type: 'swap',
        title: 'Rebalance Preview',
        status: 'pending',
        rows: [
          { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
          { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
          { label: 'Target shift', value: `${bucketLabel(pair.fromBucket)} → ${bucketLabel(pair.toBucket)}` },
          { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
          { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
          { label: 'Route', value: route },
          { label: 'Bridge fee', value: feeUsd },
          { label: 'Est. gas', value: gasUsd },
        ],
        metadata: {
          kind: 'swap',
          routeId: quote.id,
          tool: quote.toolDetails?.name,
          fromChainId: sourceToken.chainId,
          toChainId: sourceToken.chainId,
          fromTokenSymbol: quote.action.fromToken.symbol,
          toTokenSymbol: quote.action.toToken.symbol,
          fromTokenAddress: sourceAmount.address,
          toTokenAddress: targetToken.address,
          fromTokenDecimals: quote.action.fromToken.decimals,
          toTokenDecimals: quote.action.toToken.decimals,
          fromAmount: quote.action.fromAmount,
          toAmount: quote.estimate?.toAmount,
          toAmountMin: quote.estimate?.toAmountMin,
          estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
          estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
          steps: quote.includedSteps?.length,
        },
      },
    }
  } catch (error) {
    return {
      actionable: false,
      summary: analysis.recommendation,
      reason: error instanceof Error ? error.message : 'Rebalance quote failed.',
    }
  }
}

function analyzePortfolio(portfolio: Awaited<ReturnType<typeof buildPortfolio>>) {
  const totalUsd = portfolio.totalUsdValue
  if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
    return null
  }

  let coreUsd = 0
  let stableUsd = 0
  let growthUsd = 0

  for (const token of portfolio.tokens) {
    const usd = parseUsd(token.balanceUsd)
    if (usd <= 0) continue

    const symbol = token.symbol.toUpperCase()
    if (STABLE_SYMBOLS.has(symbol)) {
      stableUsd += usd
    } else if (CORE_SYMBOLS.has(symbol)) {
      coreUsd += usd
    } else {
      growthUsd += usd
    }
  }

  const chainTotals = {
    base: parseUsd(portfolio.chains.find((chain) => chain.chainId === 8453)?.totalUsd),
    ethereum: parseUsd(portfolio.chains.find((chain) => chain.chainId === 1)?.totalUsd),
  }

  const currentAllocation = {
    core: percent(coreUsd, totalUsd),
    stable: percent(stableUsd, totalUsd),
    growth: percent(growthUsd, totalUsd),
  }

  const drifts = {
    core: currentAllocation.core - TARGET_ALLOCATION.core,
    stable: currentAllocation.stable - TARGET_ALLOCATION.stable,
    growth: currentAllocation.growth - TARGET_ALLOCATION.growth,
  }

  const driftEntries = Object.entries(drifts) as Array<[keyof typeof drifts, number]>
  const maxDrift = driftEntries.reduce((max, [, value]) => Math.max(max, Math.abs(value)), 0)
  const overweight = driftEntries.reduce((current, next) => next[1] > current[1] ? next : current)
  const underweight = driftEntries.reduce((current, next) => next[1] < current[1] ? next : current)
  const topHolding = getTopHolding(portfolio.tokens)
  const dominantChain = chainTotals.base >= chainTotals.ethereum ? 'Base' : 'Ethereum'
  const dominantChainPct = percent(Math.max(chainTotals.base, chainTotals.ethereum), totalUsd)
  const recommendation = maxDrift > DRIFT_THRESHOLD_PCT
    ? `Reduce ${bucketLabel(overweight[0])} exposure and rebuild ${bucketLabel(underweight[0])} toward the target mix.`
    : 'Allocation is within drift threshold. No rebalance signal right now.'

  return {
    totalUsd,
    currentAllocation,
    drifts,
    maxDrift,
    overweight: { bucket: overweight[0], drift: overweight[1] },
    underweight: { bucket: underweight[0], drift: underweight[1] },
    topHolding,
    dominantChain,
    dominantChainPct,
    recommendation,
    rebalanceUsd: totalUsd * (Math.min(Math.abs(overweight[1]), Math.abs(underweight[1])) / 100),
  }
}

function parseUsd(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

function percent(value: number, total: number) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return (value / total) * 100
}

function formatAllocation(current: number, target: number) {
  const drift = current - target
  const driftLabel = `${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%`
  return `${current.toFixed(1)}% vs target ${target}% (${driftLabel})`
}

function bucketLabel(bucket: 'core' | 'stable' | 'growth') {
  if (bucket === 'core') return 'core'
  if (bucket === 'stable') return 'stablecoin'
  return 'growth-token'
}

function getTopHolding(tokens: Array<{ symbol: string; balanceUsd: string }>) {
  const sorted = [...tokens]
    .map((token) => ({ ...token, usd: parseUsd(token.balanceUsd) }))
    .filter((token) => token.usd > 0)
    .sort((left, right) => right.usd - left.usd)

  const top = sorted[0]
  if (!top) return null
  return `${top.symbol} (${top.balanceUsd})`
}

function getActionablePair(
  overweight: 'core' | 'stable' | 'growth',
  underweight: 'core' | 'stable' | 'growth'
) {
  if (overweight === 'stable' && underweight === 'core') {
    return { fromBucket: 'stable' as const, toBucket: 'core' as const }
  }
  if (overweight === 'core' && underweight === 'stable') {
    return { fromBucket: 'core' as const, toBucket: 'stable' as const }
  }
  return null
}

function getSourceToken(tokens: Array<{ symbol: string; balanceUsd: string; balance: string; chainId: number; contractAddress?: string }>, bucket: 'core' | 'stable') {
  return [...tokens]
    .filter((token) => {
      const symbol = token.symbol.toUpperCase()
      return bucket === 'stable' ? STABLE_SYMBOLS.has(symbol) : CORE_SYMBOLS.has(symbol)
    })
    .map((token) => ({ ...token, usd: parseUsd(token.balanceUsd) }))
    .filter((token) => token.usd > 0)
    .sort((left, right) => right.usd - left.usd)[0] ?? null
}

function getTargetToken(bucket: 'core' | 'stable', chainId: number) {
  if (bucket === 'core') {
    return {
      symbol: 'ETH',
      address: '0x0000000000000000000000000000000000000000',
      decimals: 18,
      chainId,
    }
  }

  return {
    symbol: 'USDC',
    address: chainId === 1
      ? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
    chainId,
  }
}

function getTokenAmountForUsd(token: { symbol: string; balanceUsd: string; balance: string; chainId: number; contractAddress?: string }, targetUsd: number) {
  const balance = Number.parseFloat(token.balance || '0')
  const balanceUsd = parseUsd(token.balanceUsd)
  if (!Number.isFinite(balance) || balance <= 0 || balanceUsd <= 0 || targetUsd <= 0) return null

  const amountFloat = Math.min(balance, (targetUsd / balanceUsd) * balance)
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) return null

  const decimals = token.symbol.toUpperCase() === 'USDC' || token.symbol.toUpperCase() === 'USDT' ? 6 : 18
  const address = token.symbol.toUpperCase() === 'ETH'
    ? '0x0000000000000000000000000000000000000000'
    : token.contractAddress
  if (!address) return null

  const displayAmount = amountFloat.toFixed(decimals === 6 ? 4 : 6).replace(/0+$/, '').replace(/\.$/, '')
  const rawAmount = toRawAmount(displayAmount, decimals)

  return {
    address,
    decimals,
    chainId: token.chainId,
    rawAmount,
    displayAmount,
  }
}

function toRawAmount(amount: string, decimals: number) {
  const [wholePart, fractionPart = ''] = amount.trim().split('.')
  const normalizedWhole = wholePart === '' ? '0' : wholePart
  const normalizedFraction = fractionPart.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0')
  const raw = `${normalizedWhole}${normalizedFraction}`.replace(/^0+(?=\d)/, '')
  return raw || '0'
}

function formatTokenAmount(value: string | undefined | null, decimals: number, precision = 6) {
  if (!value) return '0'
  const bigintValue = BigInt(value)
  const padded = bigintValue.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}

function formatUsdValue(value: number | null) {
  if (!value || !Number.isFinite(value)) return 'Unavailable'
  if (value < 0.01) return '<$0.01'
  return `$${value.toFixed(2)}`
}

function computeRate(fromAmount: string, toAmount: string) {
  const from = Number.parseFloat(fromAmount)
  const to = Number.parseFloat(toAmount)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  return (to / from).toFixed(6)
}
