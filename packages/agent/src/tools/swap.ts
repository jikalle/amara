import type { AgentActionCard } from '@anara/types'

// Token address registry
const TOKEN_ADDRESSES: Record<string, Record<number, string>> = {
  USDC: { 8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  USDT: { 8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  ETH:  { 8453: '0x0000000000000000000000000000000000000000', 1: '0x0000000000000000000000000000000000000000' },
  WETH: { 8453: '0x4200000000000000000000000000000000000006', 1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
}

const TOKEN_PRICES: Record<string, number> = {
  USDC: 1, USDT: 1, ETH: 3291.50, WETH: 3291.50
}

export async function getSwapPreview(input: {
  fromToken: string; toToken: string; amount: string
  fromAddress: string; fromChainId?: number; toChainId?: number; slippage?: number
}) {
  try {
    const fromPrice = TOKEN_PRICES[input.fromToken.toUpperCase()] ?? 1
    const toPrice   = TOKEN_PRICES[input.toToken.toUpperCase()]   ?? 1
    const toAmt     = (parseFloat(input.amount) * fromPrice / toPrice)
    const impact    = parseFloat(input.amount) * fromPrice > 10000 ? '1.20%' : parseFloat(input.amount) * fromPrice > 2000 ? '0.40%' : '< 0.1%'
    const slip      = input.slippage ?? 0.005
    const minRecv   = toAmt * (1 - slip)

    // TODO: Replace simulation with real LI.FI quote:
    // const quote = await getQuote({ fromChain, toChain, fromToken, toToken, fromAmount, fromAddress })

    const actionCard: AgentActionCard = {
      type: 'swap', title: 'Swap Preview',
      rows: [
        { label: 'You send',     value: `${input.amount} ${input.fromToken.toUpperCase()}` },
        { label: 'You receive',  value: `~${toAmt.toFixed(6)} ${input.toToken.toUpperCase()}`, highlight: true },
        { label: 'Rate',         value: `1 ${input.fromToken} = ${(fromPrice/toPrice).toFixed(6)} ${input.toToken}` },
        { label: 'Price impact', value: impact },
        { label: 'Min received', value: `${minRecv.toFixed(6)} ${input.toToken}` },
        { label: 'Route',        value: 'Uniswap V3 · Base' },
        { label: 'Est. gas',     value: '~$0.06' },
      ],
      status: 'pending',
    }
    return { success: true, actionCard }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Quote failed' }
  }
}
