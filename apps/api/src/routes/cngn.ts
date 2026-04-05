import { Router } from 'express'
import { z } from 'zod'
import { getUserByPrivyId } from '../db/client.js'
import { resolveAuthorizedWalletAddress, isAuthorizationError } from '../lib/authz.js'
import { createCngnVirtualAccount, getCngnTransactions } from '../lib/cngn.js'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { logErrorEvent, logEvent, logWarn } from '../middleware/logger.js'

const CreateVirtualAccountSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
})

const TransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const cngnRouter = Router()

cngnRouter.post('/virtual-account', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = CreateVirtualAccountSchema.parse(req.body ?? {})
    const user = await getUserByPrivyId(req.userId!)

    const walletAddress = resolveAuthorizedWalletAddress({
      authWalletAddress: req.walletAddress,
      persistedWalletAddress: user?.wallet_address,
      requestedWalletAddress: body.walletAddress,
    })

    const account = await createCngnVirtualAccount()

    logEvent('cngn_virtual_account_created', {
      userId: req.userId,
      walletAddress,
      provider: 'cngn',
      accountReference: account.accountReference,
    })

    return res.json({
      provider: 'cngn',
      walletAddress,
      account,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('cngn_virtual_account_invalid', {
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid cNGN funding request', details: err.errors })
    }

    if (err instanceof Error && isAuthorizationError(err)) {
      logWarn('cngn_virtual_account_forbidden', {
        userId: req.userId,
        message: err.message,
      })
      return res.status(403).json({ error: err.message })
    }

    const message = err instanceof Error ? err.message : 'Unable to create cNGN virtual account'
    logErrorEvent('cngn_virtual_account_failed', {
      userId: req.userId,
      message,
    })
    return res.status(500).json({ error: message })
  }
})

cngnRouter.get('/transactions', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const query = TransactionsQuerySchema.parse(req.query ?? {})
    const transactions = await getCngnTransactions(query.page, query.limit)

    logEvent('cngn_transactions_fetched', {
      userId: req.userId,
      page: query.page,
      limit: query.limit,
      count: Array.isArray(transactions.data) ? transactions.data.length : 0,
    })

    return res.json(transactions)
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('cngn_transactions_invalid', {
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid cNGN transaction request', details: err.errors })
    }

    const message = err instanceof Error ? err.message : 'Unable to fetch cNGN transactions'
    logErrorEvent('cngn_transactions_failed', {
      userId: req.userId,
      message,
    })
    return res.status(500).json({ error: message })
  }
})
