import type { AgentActionCard } from '@anara/types'

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, ETH: 3291.50, WETH: 3291.50, AERO: 0.52,
}

const TOKEN_REGISTRY: Record<string, { decimals: number; addresses: Record<number, string> }> = {
  ETH: {
    decimals: 18,
    addresses: {
      1: '0x0000000000000000000000000000000000000000',
      8453: '0x0000000000000000000000000000000000000000',
    },
  },
  WETH: {
    decimals: 18,
    addresses: {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      8453: '0x4200000000000000000000000000000000000006',
    },
  },
  USDC: {
    decimals: 6,
    addresses: {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
  USDT: {
    decimals: 6,
    addresses: {
      1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    },
  },
  AERO: {
    decimals: 18,
    addresses: {
      8453: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    },
  },
}

export async function getSendPreview(input: {
  token: string; amount: string; toAddress: string; fromAddress: string; chainId?: number; contactLabel?: string
}) {
  const token = input.token.toUpperCase()
  const chainId = input.chainId === 1 ? 1 : 8453
  const tokenConfig = TOKEN_REGISTRY[token]
  const price   = TOKEN_PRICES[token] ?? 1
  const usdVal  = (parseFloat(input.amount) * price).toFixed(2)
  const addrShort = input.toAddress.length > 12
    ? `${input.toAddress.slice(0,10)}…${input.toAddress.slice(-6)}`
    : input.toAddress

  const actionCard: AgentActionCard = {
    type: 'send', title: 'Send Preview',
    rows: [
      { label: 'Token',    value: token },
      { label: 'Amount',   value: `${input.amount} ${token}`, highlight: true },
      { label: 'USD',      value: `~$${usdVal}` },
      { label: 'To',       value: input.contactLabel ? `${input.contactLabel} (${addrShort})` : addrShort },
      { label: 'Network',  value: chainId === 1 ? 'Ethereum' : 'Base' },
      { label: 'Est. gas', value: '~$0.04' },
    ],
    status: 'pending',
    metadata: {
      kind: 'send',
      fromChainId: chainId,
      fromTokenSymbol: token,
      fromTokenAddress: tokenConfig?.addresses[chainId],
      fromTokenDecimals: tokenConfig?.decimals,
      fromAmount: input.amount,
      toAddress: input.toAddress,
      estimatedGasUsd: 0.04,
    },
  }
  return { success: true, actionCard }
}
