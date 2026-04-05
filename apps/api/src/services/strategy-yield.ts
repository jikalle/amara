import { getSwapQuote } from '@anara/chain'
import type { AgentActionCard } from '@anara/types'
import { buildPortfolio } from './portfolio.js'

type YieldStrategyView = {
  status: 'active' | 'watching'
  pnl: string
  details: Record<string, string | number | boolean>
}

type YieldPreviewResult =
  | { actionable: true; actionCard: AgentActionCard; summary: string }
  | { actionable: false; reason: string; summary: string }

const MIN_DEPLOYABLE_USD = 25
const TARGET_BASE_STABLE_USD = 100
const ETH_SWAP_TO_STABLE_SHARE = 0.2

const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI'])
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18,
  USDC: 6,
  USDT: 6,
  DAI: 18,
}

const BASE_TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
}

const ETH_TOKEN_ADDRESSES: Record<string, string> = {
  ETH: '0x0000000000000000000000000000000000000000',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
}

export async function buildYieldStrategyView(walletAddress: string): Promise<YieldStrategyView> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = analyzeYieldPortfolio(portfolio)

  if (!analysis) {
    return {
      status: 'watching',
      pnl: 'No capital',
      details: {
        mode: 'Live capital routing',
        preferredVenue: 'Base',
        deployableCapital: '$0.00',
        triggerThreshold: `$${MIN_DEPLOYABLE_USD.toFixed(2)}`,
        recommendation: 'Fund the wallet to activate live yield routing.',
        approvalsRequired: true,
      },
    }
  }

  return {
    status: analysis.actionable ? 'active' : 'watching',
    pnl: analysis.baseStableUsd >= TARGET_BASE_STABLE_USD
      ? `Deployable ${formatUsd(analysis.baseStableUsd)}`
      : `Idle ${formatUsd(analysis.idleCapitalUsd)}`,
    details: {
      mode: 'Live capital routing',
      preferredVenue: 'Base',
      deployableCapital: formatUsd(analysis.baseStableUsd),
      triggerThreshold: `$${MIN_DEPLOYABLE_USD.toFixed(2)}`,
      stableOnBase: formatUsd(analysis.baseStableUsd),
      stableOnEthereum: formatUsd(analysis.ethStableUsd),
      ethOnBase: formatUsd(analysis.baseEthUsd),
      idleCapital: formatUsd(analysis.idleCapitalUsd),
      nextAction: analysis.summary,
      approvalsRequired: true,
    },
  }
}

export async function buildYieldPreview(walletAddress: string): Promise<YieldPreviewResult> {
  const portfolio = await buildPortfolio(walletAddress)
  const analysis = analyzeYieldPortfolio(portfolio)

  if (!analysis) {
    return {
      actionable: false,
      summary: 'Wallet balance data is not sufficient for a yield routing preview yet.',
      reason: 'No capital is available for deployment.',
    }
  }

  if (!analysis.actionable || !analysis.route) {
    return {
      actionable: false,
      summary: analysis.summary,
      reason: analysis.reason ?? 'No immediate yield routing action is needed right now.',
    }
  }

  try {
    const quote = await getSwapQuote({
      fromChainId: analysis.route.fromChainId,
      toChainId: analysis.route.toChainId,
      fromTokenAddress: analysis.route.fromTokenAddress,
      toTokenAddress: analysis.route.toTokenAddress,
      fromAmount: analysis.route.fromAmountRaw,
      fromAddress: walletAddress,
      slippage: 0.005,
    })

    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const routeName = quote.toolDetails?.name ?? (analysis.route.kind === 'bridge' ? 'Bridge route' : 'Swap route')
    const networkLabel = analysis.route.fromChainId === analysis.route.toChainId
      ? (analysis.route.fromChainId === 1 ? 'Ethereum' : 'Base')
      : `${analysis.route.fromChainId === 1 ? 'Ethereum' : 'Base'} → ${analysis.route.toChainId === 1 ? 'Ethereum' : 'Base'}`

    if (analysis.route.kind === 'bridge') {
      return {
        actionable: true,
        summary: analysis.summary,
        actionCard: {
          type: 'bridge',
          title: 'Yield Routing Preview',
          status: 'pending',
          rows: [
            { label: 'From', value: `${fromAmount} ${quote.action.fromToken.symbol} on ${analysis.route.fromChainId === 1 ? 'Ethereum' : 'Base'}` },
            { label: 'To', value: `~${toAmount} ${quote.action.toToken.symbol} on ${analysis.route.toChainId === 1 ? 'Ethereum' : 'Base'}`, highlight: true },
            { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
            { label: 'Protocol', value: routeName },
            { label: 'Route', value: networkLabel },
            { label: 'Bridge fee', value: feeUsd },
            { label: 'Est. gas', value: gasUsd },
          ],
          metadata: {
            kind: 'bridge',
            routeId: quote.id,
            tool: quote.toolDetails?.name,
            fromChainId: analysis.route.fromChainId,
            toChainId: analysis.route.toChainId,
            fromTokenSymbol: quote.action.fromToken.symbol,
            toTokenSymbol: quote.action.toToken.symbol,
            fromTokenAddress: analysis.route.fromTokenAddress,
            toTokenAddress: analysis.route.toTokenAddress,
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
    }

    const rate = computeRate(fromAmount, toAmount)
    return {
      actionable: true,
      summary: analysis.summary,
      actionCard: {
        type: 'swap',
        title: 'Yield Routing Preview',
        status: 'pending',
        rows: [
          { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
          { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
          { label: 'Target venue', value: 'Base stable reserve' },
          { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
          { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
          { label: 'Route', value: `${routeName} · ${networkLabel}` },
          { label: 'Bridge fee', value: feeUsd },
          { label: 'Est. gas', value: gasUsd },
        ],
        metadata: {
          kind: 'swap',
          routeId: quote.id,
          tool: quote.toolDetails?.name,
          fromChainId: analysis.route.fromChainId,
          toChainId: analysis.route.toChainId,
          fromTokenSymbol: quote.action.fromToken.symbol,
          toTokenSymbol: quote.action.toToken.symbol,
          fromTokenAddress: analysis.route.fromTokenAddress,
          toTokenAddress: analysis.route.toTokenAddress,
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
      summary: analysis.summary,
      reason: error instanceof Error ? error.message : 'Yield route quote failed.',
    }
  }
}

function analyzeYieldPortfolio(portfolio: Awaited<ReturnType<typeof buildPortfolio>>) {
  const baseStableTokens = portfolio.tokens.filter((token) => token.chainId === 8453 && STABLE_SYMBOLS.has(token.symbol.toUpperCase()))
  const ethStableTokens = portfolio.tokens.filter((token) => token.chainId === 1 && STABLE_SYMBOLS.has(token.symbol.toUpperCase()))
  const baseEthToken = portfolio.tokens.find((token) => token.chainId === 8453 && token.symbol.toUpperCase() === 'ETH')

  const baseStableUsd = sumUsd(baseStableTokens)
  const ethStableUsd = sumUsd(ethStableTokens)
  const baseEthUsd = baseEthToken ? parseUsd(baseEthToken.balanceUsd) : 0
  const idleCapitalUsd = Math.max(baseStableUsd, ethStableUsd, baseEthUsd)

  if (idleCapitalUsd <= 0) {
    return null
  }

  if (baseStableUsd >= TARGET_BASE_STABLE_USD) {
    return {
      actionable: false,
      baseStableUsd,
      ethStableUsd,
      baseEthUsd,
      idleCapitalUsd: baseStableUsd,
      summary: `Base already holds ${formatUsd(baseStableUsd)} of stable liquidity that can be deployed into yield venues when protocol integrations are enabled.`,
      reason: 'Stable liquidity is already staged on Base.',
      route: null,
    }
  }

  const ethStableToken = getLargestStableToken(ethStableTokens)
  if (ethStableToken && ethStableUsd >= MIN_DEPLOYABLE_USD) {
    const deployUsd = Math.min(ethStableUsd, Math.max(MIN_DEPLOYABLE_USD, TARGET_BASE_STABLE_USD - baseStableUsd))
    const sized = sizeTokenForUsd(ethStableToken, deployUsd)
    const baseStableAddress = getTokenAddress(ethStableToken.symbol, 8453)
    if (sized && baseStableAddress) {
      return {
        actionable: true,
        baseStableUsd,
        ethStableUsd,
        baseEthUsd,
        idleCapitalUsd: ethStableUsd,
        summary: `Route ${formatUsd(deployUsd)} of idle ${ethStableToken.symbol} from Ethereum to Base so it is ready for lower-cost yield deployment.`,
        route: {
          kind: 'bridge' as const,
          fromChainId: 1,
          toChainId: 8453,
          fromTokenAddress: sized.address,
          toTokenAddress: baseStableAddress,
          fromAmountRaw: sized.rawAmount,
        },
      }
    }
  }

  if (baseEthToken && baseEthUsd >= MIN_DEPLOYABLE_USD) {
    const deployUsd = Math.min(baseEthUsd * ETH_SWAP_TO_STABLE_SHARE, Math.max(MIN_DEPLOYABLE_USD, TARGET_BASE_STABLE_USD - baseStableUsd))
    const sized = sizeTokenForUsd(baseEthToken, deployUsd)
    const usdcAddress = getTokenAddress('USDC', 8453)
    if (sized && usdcAddress) {
      return {
        actionable: true,
        baseStableUsd,
        ethStableUsd,
        baseEthUsd,
        idleCapitalUsd: baseEthUsd,
        summary: `Swap ${formatUsd(deployUsd)} of idle ETH on Base into USDC to stage stable capital for yield deployment.`,
        route: {
          kind: 'swap' as const,
          fromChainId: 8453,
          toChainId: 8453,
          fromTokenAddress: sized.address,
          toTokenAddress: usdcAddress,
          fromAmountRaw: sized.rawAmount,
        },
      }
    }
  }

  return {
    actionable: false,
    baseStableUsd,
    ethStableUsd,
    baseEthUsd,
    idleCapitalUsd,
    summary: `Yield routing is monitoring the wallet, but only ${formatUsd(idleCapitalUsd)} of idle stable or ETH capital is currently available. The action threshold is ${formatUsd(MIN_DEPLOYABLE_USD)}.`,
    reason: 'Increase idle capital or move more stable liquidity onto Ethereum/Base before this strategy can stage funds for yield.',
    route: null,
  }
}

function getLargestStableToken(tokens: Array<{ symbol: string; balanceUsd: string; balance: string; chainId: number; contractAddress?: string }>) {
  return [...tokens]
    .map((token) => ({ ...token, usd: parseUsd(token.balanceUsd) }))
    .filter((token) => token.usd > 0)
    .sort((left, right) => right.usd - left.usd)[0] ?? null
}

function sizeTokenForUsd(token: { symbol: string; balanceUsd: string; balance: string; chainId: number; contractAddress?: string }, targetUsd: number) {
  const balance = Number.parseFloat(token.balance || '0')
  const balanceUsd = parseUsd(token.balanceUsd)
  if (!Number.isFinite(balance) || balance <= 0 || balanceUsd <= 0 || targetUsd <= 0) return null

  const amountFloat = Math.min(balance, (targetUsd / balanceUsd) * balance)
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) return null

  const symbol = token.symbol.toUpperCase()
  const decimals = TOKEN_DECIMALS[symbol] ?? 18
  const address = symbol === 'ETH'
    ? getTokenAddress('ETH', token.chainId)
    : token.contractAddress ?? getTokenAddress(symbol, token.chainId)
  if (!address) return null

  const displayAmount = amountFloat.toFixed(decimals === 6 ? 4 : 6).replace(/0+$/, '').replace(/\.$/, '')
  return {
    address,
    rawAmount: toRawAmount(displayAmount, decimals),
  }
}

function getTokenAddress(symbol: string, chainId: number) {
  const normalized = symbol.toUpperCase()
  if (chainId === 1) return ETH_TOKEN_ADDRESSES[normalized]
  return BASE_TOKEN_ADDRESSES[normalized]
}

function sumUsd(tokens: Array<{ balanceUsd: string }>) {
  return tokens.reduce((sum, token) => sum + parseUsd(token.balanceUsd), 0)
}

function parseUsd(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`
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
