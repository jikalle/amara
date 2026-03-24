export async function getPortfolioSummary(address: string) {
  // TODO: Replace with Alchemy + The Graph
  return {
    totalUsd: '$24,847.32',
    change24h: '+$312.48',
    change24hPercent: '+1.27%',
    chains: [
      { name: 'Base',     valueUsd: '$15,420', percent: '62%' },
      { name: 'Ethereum', valueUsd: '$9,427',  percent: '38%' },
    ],
    topAssets: [
      { symbol: 'ETH',  value: '$9,427', change: '+2.14%' },
      { symbol: 'USDC', value: '$8,420', change: '+0.01%' },
    ],
  }
}

export async function getAssetPrice(symbol: string): Promise<string> {
  // TODO: CoinGecko API / Chainlink
  const prices: Record<string, string> = {
    ETH: '$3,291.50', BTC: '$97,400', USDC: '$1.00', USDT: '$1.00', SOL: '$182.30',
  }
  return prices[symbol.toUpperCase()] ?? 'Price unavailable'
}
