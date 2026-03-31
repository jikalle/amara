import { getSwapQuote } from '@anara/chain'
import type { AgentActionCard } from '@anara/types'

type SupportedChainId = 8453 | 1

const TOKEN_REGISTRY: Record<string, { decimals: number; addresses: Partial<Record<SupportedChainId, string>> }> = {
  ETH: {
    decimals: 18,
    addresses: {
      8453: '0x0000000000000000000000000000000000000000',
      1: '0x0000000000000000000000000000000000000000',
    },
  },
  WETH: {
    decimals: 18,
    addresses: {
      8453: '0x4200000000000000000000000000000000000006',
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
  USDC: {
    decimals: 6,
    addresses: {
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  USDT: {
    decimals: 6,
    addresses: {
      8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    },
  },
  DAI: {
    decimals: 18,
    addresses: {
      8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    },
  },
  AERO: {
    decimals: 18,
    addresses: {
      8453: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    },
  },
} as const

export async function getSwapPreview(input: {
  fromToken: string
  toToken: string
  amount: string
  fromAddress: string
  fromChainId?: number
  toChainId?: number
  slippage?: number
}) {
  try {
    const fromChainId = normalizeChainId(input.fromChainId)
    const toChainId = normalizeChainId(input.toChainId ?? input.fromChainId)
    const fromToken = input.fromToken.toUpperCase()
    const toToken = input.toToken.toUpperCase()

    const fromTokenConfig = TOKEN_REGISTRY[fromToken]
    const toTokenConfig = TOKEN_REGISTRY[toToken]

    if (!fromTokenConfig) {
      return { success: false, error: `Unsupported source token: ${fromToken}` }
    }
    if (!toTokenConfig) {
      return { success: false, error: `Unsupported destination token: ${toToken}` }
    }

    const fromTokenAddress = fromTokenConfig.addresses[fromChainId]
    const toTokenAddress = toTokenConfig.addresses[toChainId]

    if (!fromTokenAddress) {
      return { success: false, error: `${fromToken} is not supported on ${chainLabel(fromChainId)} yet.` }
    }
    if (!toTokenAddress) {
      return { success: false, error: `${toToken} is not supported on ${chainLabel(toChainId)} yet.` }
    }

    const quote = await getSwapQuote({
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      fromAmount: toRawAmount(input.amount, fromTokenConfig.decimals),
      fromAddress: input.fromAddress,
      slippage: input.slippage ?? 0.005,
    })

    const toAmount = formatAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const fromAmount = formatAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const gasUsd = formatUsd(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsd(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const rate = computeRate(fromAmount, toAmount)
    const route = quote.toolDetails?.name
      ? `${quote.toolDetails.name} · ${chainLabel(fromChainId)}`
      : chainLabel(fromChainId)

    const actionCard: AgentActionCard = {
      type: 'swap',
      title: 'Swap Preview',
      rows: [
        { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
        { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
        { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Route', value: route },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      status: 'pending',
      metadata: {
        kind: 'swap',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId,
        toChainId,
        fromTokenSymbol: quote.action.fromToken.symbol,
        toTokenSymbol: quote.action.toToken.symbol,
        fromTokenAddress,
        toTokenAddress,
        fromTokenDecimals: quote.action.fromToken.decimals,
        toTokenDecimals: quote.action.toToken.decimals,
        fromAmount: quote.action.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
        estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
        steps: quote.includedSteps?.length,
      },
    }

    return { success: true, actionCard, quote }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Quote failed',
    }
  }
}

function normalizeChainId(chainId?: number): SupportedChainId {
  return chainId === 1 ? 1 : 8453
}

function toRawAmount(amount: string, decimals: number) {
  const [wholePart, fractionPart = ''] = amount.trim().split('.')
  const normalizedWhole = wholePart === '' ? '0' : wholePart
  const normalizedFraction = fractionPart.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0')
  const raw = `${normalizedWhole}${normalizedFraction}`.replace(/^0+(?=\d)/, '')
  return raw || '0'
}

function formatAmount(value: string | undefined | null, decimals: number, precision = 6) {
  if (!value) return '0'
  const bigintValue = BigInt(value)
  const padded = bigintValue.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}

function formatUsd(value: number | null) {
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

function chainLabel(chainId: SupportedChainId) {
  return chainId === 1 ? 'Ethereum' : 'Base'
}
