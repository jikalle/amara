import { defineChain } from 'viem'
import {
  base,
  mainnet,
  arbitrum,
  optimism,
  bsc,
  polygon,
  avalanche,
  zksync,
  linea,
} from 'viem/chains'

// Re-export with Anara config
export const ANARA_CHAINS = {
  base: {
    ...base,
    rpcUrls: {
      default: { http: [`https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`] },
    },
  },
  ethereum: {
    ...mainnet,
    rpcUrls: {
      default: { http: [`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`] },
    },
  },
  arbitrum: {
    ...arbitrum,
    rpcUrls: {
      default: { http: [`https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`] },
    },
  },
  optimism,
  bnb: bsc,
  polygon,
  avalanche,
  zksync,
  linea,
} as const

export const SUPPORTED_CHAIN_IDS = [8453, 1, 42161, 10, 56, 137, 43114, 324, 59144] as const

export const CHAIN_METADATA: Record<number, {
  shortName: string
  color: string
  layer: 'L1' | 'L2'
  explorerUrl: string
}> = {
  8453:  { shortName: 'BASE',  color: '#1C6EFF', layer: 'L2', explorerUrl: 'https://basescan.org' },
  1:     { shortName: 'ETH',   color: '#627EEA', layer: 'L1', explorerUrl: 'https://etherscan.io' },
  42161: { shortName: 'ARB',   color: '#28A0F0', layer: 'L2', explorerUrl: 'https://arbiscan.io' },
  10:    { shortName: 'OP',    color: '#FF0420', layer: 'L2', explorerUrl: 'https://optimistic.etherscan.io' },
  56:    { shortName: 'BNB',   color: '#F3BA2F', layer: 'L1', explorerUrl: 'https://bscscan.com' },
  137:   { shortName: 'MATIC', color: '#8247E5', layer: 'L2', explorerUrl: 'https://polygonscan.com' },
  43114: { shortName: 'AVAX',  color: '#E84142', layer: 'L1', explorerUrl: 'https://snowtrace.io' },
  324:   { shortName: 'ZK',    color: '#7B61FF', layer: 'L2', explorerUrl: 'https://explorer.zksync.io' },
  59144: { shortName: 'LINEA', color: '#61DAFB', layer: 'L2', explorerUrl: 'https://lineascan.build' },
}
