import { createConfig, EVM, getQuote, executeRoute, type Route } from '@lifi/sdk'
import type { WalletClient } from 'viem'

// Initialize LI.FI SDK
createConfig({
  integrator: 'anara-wallet',
  providers: [EVM()],
})

export interface SwapParams {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  fromAddress: string
  slippage?: number
}

export interface BridgeParams extends SwapParams {
  toAddress?: string
}

export async function getSwapQuote(params: SwapParams) {
  const quote = await getQuote({
    fromChain: params.fromChainId,
    toChain: params.toChainId,
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    slippage: params.slippage ?? 0.005,
    integrator: 'anara-wallet',
  })
  return quote
}

export async function executeSwap(route: Route, walletClient: WalletClient) {
  return await executeRoute(route, {
    executionSettings: {
      updateRouteHook(updatedRoute) {
        console.log('[LI.FI] Route updated:', updatedRoute.id)
      },
    },
  })
}

// Token addresses for major assets on Base
export const BASE_TOKENS = {
  USDC:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  USDT:  '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  ETH:   '0x4200000000000000000000000000000000000006', // WETH on Base
  NATIVE:'0x0000000000000000000000000000000000000000',
  DAI:   '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  AERO:  '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
} as const
