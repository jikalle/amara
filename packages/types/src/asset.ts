export interface Asset {
  id: string
  symbol: string
  name: string
  address: `0x${string}` | 'native'
  decimals: number
  chainId: number
  logoUrl?: string
  coingeckoId?: string
  priceUsd: string
  change24h: string
  change24hPositive: boolean
  marketCap?: string
  volume24h?: string
}

export interface NFT {
  tokenId: string
  contractAddress: `0x${string}`
  chainId: number
  name: string
  description?: string
  imageUrl?: string
  collectionName: string
  floorPrice?: string
  floorPriceCurrency?: string
  attributes?: NFTAttribute[]
  owner: `0x${string}`
  tokenStandard: 'ERC721' | 'ERC1155'
}

export interface NFTAttribute {
  traitType: string
  value: string
  rarity?: number
}
