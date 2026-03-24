import type { AgentActionCard } from '@anara/types'

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, ETH: 3291.50, WETH: 3291.50, AERO: 0.52,
}

export async function getSendPreview(input: {
  token: string; amount: string; toAddress: string; fromAddress: string; chainId?: number; contactLabel?: string
}) {
  const price   = TOKEN_PRICES[input.token.toUpperCase()] ?? 1
  const usdVal  = (parseFloat(input.amount) * price).toFixed(2)
  const addrShort = input.toAddress.length > 12
    ? `${input.toAddress.slice(0,10)}…${input.toAddress.slice(-6)}`
    : input.toAddress

  const actionCard: AgentActionCard = {
    type: 'send', title: 'Send Preview',
    rows: [
      { label: 'Token',    value: input.token.toUpperCase() },
      { label: 'Amount',   value: `${input.amount} ${input.token.toUpperCase()}`, highlight: true },
      { label: 'USD',      value: `~$${usdVal}` },
      { label: 'To',       value: input.contactLabel ? `${input.contactLabel} (${addrShort})` : addrShort },
      { label: 'Network',  value: input.chainId === 1 ? 'Ethereum' : 'Base' },
      { label: 'Est. gas', value: '~$0.04' },
    ],
    status: 'pending',
  }
  return { success: true, actionCard }
}
