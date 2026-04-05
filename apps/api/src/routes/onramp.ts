import { Router } from 'express'
import { z } from 'zod'
import { getUserByPrivyId } from '../db/client.js'
import { resolveAuthorizedWalletAddress, isAuthorizationError } from '../lib/authz.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logErrorEvent, logEvent, logWarn } from '../middleware/logger.js'

const SUPPORTED_CHAIN_IDS = [1, 56, 8453] as const

const CreateOnrampSessionSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  chainId: z.union([
    z.literal(1),
    z.literal(56),
    z.literal(8453),
  ]).default(8453),
  asset: z.enum(['ETH', 'USDC', 'BNB', 'USDT']).default('USDC'),
  fiatCurrency: z.enum(['NGN', 'USD']).default('NGN'),
  fiatAmount: z.number().positive().max(1_000_000).default(50_000),
})

const SUPPORTED_ASSETS_BY_CHAIN: Record<number, readonly string[]> = {
  1: ['ETH', 'USDC'],
  56: ['BNB', 'USDT', 'USDC'],
  8453: ['ETH', 'USDC'],
}

type PartnerAccessTokenCache = {
  accessToken: string
  expiresAtMs: number
}

let tokenCache: PartnerAccessTokenCache | null = null

export const onrampRouter = Router()

onrampRouter.post('/session', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = CreateOnrampSessionSchema.parse(req.body ?? {})
    const user = await getUserByPrivyId(req.userId!)

    const walletAddress = resolveAuthorizedWalletAddress({
      authWalletAddress: req.walletAddress,
      persistedWalletAddress: user?.wallet_address,
      requestedWalletAddress: body.walletAddress,
    })

    const supportedAssets = SUPPORTED_ASSETS_BY_CHAIN[body.chainId] ?? []
    if (!supportedAssets.includes(body.asset)) {
      return res.status(400).json({
        error: `${body.asset} is not supported for on-ramp on chain ${body.chainId}.`,
      })
    }

    const widgetUrl = await createTransakWidgetUrl({
      walletAddress,
      userId: req.userId!,
      chainId: body.chainId,
      asset: body.asset,
      fiatCurrency: body.fiatCurrency,
      fiatAmount: body.fiatAmount,
    })

    logEvent('onramp_session_created', {
      userId: req.userId,
      walletAddress,
      chainId: body.chainId,
      asset: body.asset,
      fiatCurrency: body.fiatCurrency,
      fiatAmount: body.fiatAmount,
      provider: 'transak',
    })

    return res.json({
      provider: 'transak',
      widgetUrl,
      chainId: body.chainId,
      asset: body.asset,
      fiatCurrency: body.fiatCurrency,
      fiatAmount: body.fiatAmount,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('onramp_session_invalid', {
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid on-ramp request', details: err.errors })
    }

    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('onramp_session_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }

    const message = err instanceof Error ? err.message : 'Failed to create on-ramp session'
    logErrorEvent('onramp_session_failed', {
      userId: req.userId,
      message,
    })
    return res.status(500).json({ error: message })
  }
})

async function createTransakWidgetUrl(input: {
  walletAddress: string
  userId: string
  chainId: (typeof SUPPORTED_CHAIN_IDS)[number]
  asset: string
  fiatCurrency: 'NGN' | 'USD'
  fiatAmount: number
}) {
  const apiKey = readRequiredEnv('TRANSAK_API_KEY')
  const apiSecret = readRequiredEnv('TRANSAK_API_SECRET')
  const referrerDomain = process.env.TRANSAK_REFERRER_DOMAIN?.trim() || 'localhost:3000'
  const accessToken = await getPartnerAccessToken(apiKey, apiSecret)
  const widgetBaseUrl = getTransakWidgetApiBaseUrl()

  const response = await fetch(`${widgetBaseUrl}/api/v2/auth/session`, {
    method: 'POST',
    headers: {
      'access-token': accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      widgetParams: {
        apiKey,
        referrerDomain,
        productsAvailed: 'BUY',
        exchangeScreenTitle: 'Fund your Amara wallet',
        colorMode: 'DARK',
        themeColor: '#D4920A',
        network: getTransakNetwork(input.chainId),
        cryptoCurrencyCode: input.asset,
        walletAddress: input.walletAddress,
        disableWalletAddressForm: true,
        fiatCurrency: input.fiatCurrency,
        defaultFiatAmount: input.fiatAmount,
        partnerCustomerId: input.userId,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Transak widget session failed with status ${response.status}`)
  }

  const payload = await response.json() as {
    data?: {
      widgetUrl?: string
    }
  }

  const widgetUrl = payload.data?.widgetUrl
  if (!widgetUrl) {
    throw new Error('Transak did not return a widget URL.')
  }

  return widgetUrl
}

async function getPartnerAccessToken(apiKey: string, apiSecret: string) {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAtMs - now > 5 * 60 * 1000) {
    return tokenCache.accessToken
  }

  const authBaseUrl = getTransakPartnerApiBaseUrl()
  const response = await fetch(`${authBaseUrl}/partners/api/v2/refresh-token`, {
    method: 'POST',
    headers: {
      'api-secret': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey,
    }),
  })

  if (!response.ok) {
    throw new Error(`Transak partner authentication failed with status ${response.status}`)
  }

  const payload = await response.json() as {
    data?: {
      accessToken?: string
      expiresAt?: number
    }
  }

  const accessToken = payload.data?.accessToken
  const expiresAt = payload.data?.expiresAt
  if (!accessToken || !expiresAt) {
    throw new Error('Transak partner authentication returned an invalid response.')
  }

  tokenCache = {
    accessToken,
    expiresAtMs: expiresAt * 1000,
  }

  return accessToken
}

function getTransakWidgetApiBaseUrl() {
  return process.env.TRANSAK_ENVIRONMENT === 'STAGING'
    ? 'https://api-gateway-stg.transak.com'
    : 'https://api-gateway.transak.com'
}

function getTransakPartnerApiBaseUrl() {
  return process.env.TRANSAK_ENVIRONMENT === 'STAGING'
    ? 'https://api-stg.transak.com'
    : 'https://api.transak.com'
}

function getTransakNetwork(chainId: number) {
  switch (chainId) {
    case 1:
      return 'ethereum'
    case 56:
      return 'bsc'
    case 8453:
      return 'base'
    default:
      throw new Error(`Unsupported on-ramp chain: ${chainId}`)
  }
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured.`)
  }
  return value
}
