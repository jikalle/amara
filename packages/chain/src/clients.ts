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
  const map: Record<number, typeof publicClients.base> = {
    8453:  publicClients.base,
    1:     publicClients.ethereum,
    42161: publicClients.arbitrum,
    10:    publicClients.optimism,
    56:    publicClients.bnb,
    137:   publicClients.polygon,
    43114: publicClients.avalanche,
    324:   publicClients.zksync,
    59144: publicClients.linea,
  }
  const client = map[chainId]
  if (!client) throw new Error(`Unsupported chain: ${chainId}`)
  return client
}
