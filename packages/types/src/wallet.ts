export interface WalletAccount {
  address: `0x${string}`
  type: 'embedded' | 'injected' | 'walletconnect' | 'safe'
  label?: string
  chainId?: number
}

export interface WalletBalance {
  address: `0x${string}`
  chainId: number
  tokens: TokenBalance[]
  totalUsd: string
  lastUpdated: number
}

export interface TokenBalance {
  address: `0x${string}` | 'native'
  symbol: string
  name: string
  decimals: number
  balance: string       // raw BigInt as string
  balanceFormatted: string
  balanceUsd: string
  priceUsd: string
  change24h: string
  logoUrl?: string
  chainId: number
}
