export type ChainId =
  | 8453    // Base
  | 1       // Ethereum
  | 42161   // Arbitrum
  | 10      // Optimism
  | 56      // BNB Chain
  | 137     // Polygon
  | 43114   // Avalanche
  | 324     // zkSync Era
  | 59144   // Linea

export interface Chain {
  id: ChainId
  name: string
  shortName: string
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  color: string
  layer: 'L1' | 'L2'
  isTestnet: boolean
}

export type SupportedChain = 'base' | 'ethereum' | 'arbitrum' | 'optimism' | 'bnb' | 'polygon' | 'avalanche' | 'zksync' | 'linea'
