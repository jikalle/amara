import { getSwapQuote } from '@anara/chain'
import type { AgentActionCard } from '@anara/types'

type SupportedChainId = 8453 | 1
type SupportedChainName = 'base' | 'ethereum'

const CHAIN_NAME_TO_ID: Record<SupportedChainName, SupportedChainId> = {
  base: 8453,
  ethereum: 1,
}

const TOKEN_REGISTRY: Record<string, { decimals: number; addresses: Partial<Record<SupportedChainId, string>> }> = {
  ETH: {
    decimals: 18,
    addresses: {
      8453: '0x0000000000000000000000000000000000000000',
      1: '0x0000000000000000000000000000000000000000',
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
} as const

export async function getBridgePreview(params: {
  token: string
  amount: string
  fromChain: string
  toChain: string
}) {
  try {
    const token = params.token.toUpperCase()
    const fromChain = normalizeChain(params.fromChain)
    const toChain = normalizeChain(params.toChain)

    if (!fromChain || !toChain) {
      return { success: false, error: 'Only Base and Ethereum bridge previews are supported right now.' }
    }

    const tokenConfig = TOKEN_REGISTRY[token]
    if (!tokenConfig) {
      return { success: false, error: `Unsupported bridge token: ${token}` }
    }

    const fromTokenAddress = tokenConfig.addresses[CHAIN_NAME_TO_ID[fromChain]]
    const toTokenAddress = tokenConfig.addresses[CHAIN_NAME_TO_ID[toChain]]
    if (!fromTokenAddress || !toTokenAddress) {
      return { success: false, error: `${token} bridge route is not available for ${fromChain} to ${toChain}.` }
    }

    const quote = await getSwapQuote({
      fromChainId: CHAIN_NAME_TO_ID[fromChain],
      toChainId: CHAIN_NAME_TO_ID[toChain],
      fromTokenAddress,
      toTokenAddress,
      fromAmount: toRawAmount(params.amount, tokenConfig.decimals),
      fromAddress: '0x0000000000000000000000000000000000000001',
      slippage: 0.005,
    })

    const fromAmount = formatAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsd(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsd(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const bridgeName = quote.toolDetails?.name ?? 'Bridge route'
    const steps = quote.includedSteps?.length ? `${quote.includedSteps.length} step${quote.includedSteps.length === 1 ? '' : 's'}` : 'Live route'

    const actionCard: AgentActionCard = {
      type: 'bridge',
      title: 'Bridge Preview',
      rows: [
        { label: 'From', value: `${fromAmount} ${quote.action.fromToken.symbol} on ${chainLabel(CHAIN_NAME_TO_ID[fromChain])}` },
        { label: 'To', value: `~${toAmount} ${quote.action.toToken.symbol} on ${chainLabel(CHAIN_NAME_TO_ID[toChain])}`, highlight: true },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Protocol', value: bridgeName },
        { label: 'Route', value: steps },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      status: 'pending',
      metadata: {
        kind: 'bridge',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId: CHAIN_NAME_TO_ID[fromChain],
        toChainId: CHAIN_NAME_TO_ID[toChain],
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
      error: err instanceof Error ? err.message : 'Bridge quote failed',
    }
  }
}

function normalizeChain(value: string): SupportedChainName | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'base') return 'base'
  if (normalized === 'ethereum' || normalized === 'eth' || normalized === 'mainnet') return 'ethereum'
  return null
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

function chainLabel(chainId: SupportedChainId) {
  return chainId === 1 ? 'Ethereum' : 'Base'
}
