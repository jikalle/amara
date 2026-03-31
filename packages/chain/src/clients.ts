import { createPublicClient, createWalletClient, http } from 'viem'
import { ANARA_CHAINS } from './chains'

// Public clients for reading on-chain data
export const publicClients = {
  base:      createPublicClient({ chain: ANARA_CHAINS.base,      transport: http() }),
  ethereum:  createPublicClient({ chain: ANARA_CHAINS.ethereum,  transport: http() }),
  arbitrum:  createPublicClient({ chain: ANARA_CHAINS.arbitrum,  transport: http() }),
  optimism:  createPublicClient({ chain: ANARA_CHAINS.optimism,  transport: http() }),
  bnb:       createPublicClient({ chain: ANARA_CHAINS.bnb,       transport: http() }),
  polygon:   createPublicClient({ chain: ANARA_CHAINS.polygon,   transport: http() }),
  avalanche: createPublicClient({ chain: ANARA_CHAINS.avalanche, transport: http() }),
  zksync:    createPublicClient({ chain: ANARA_CHAINS.zksync,    transport: http() }),
  linea:     createPublicClient({ chain: ANARA_CHAINS.linea,     transport: http() }),
}

export function getPublicClient(chainId: number) {
  switch (chainId) {
    case 8453:
      return publicClients.base
    case 1:
      return publicClients.ethereum
    case 42161:
      return publicClients.arbitrum
    case 10:
      return publicClients.optimism
    case 56:
      return publicClients.bnb
    case 137:
      return publicClients.polygon
    case 43114:
      return publicClients.avalanche
    case 324:
      return publicClients.zksync
    case 59144:
      return publicClients.linea
    default:
      throw new Error(`Unsupported chain: ${chainId}`)
  }
}
