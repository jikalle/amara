import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js'
import { getAgentSettings, upsertUser } from '../db/client.js'
import { isAuthorizationError, resolveAuthorizedWalletAddress } from '../lib/authz.js'

export const authRouter = Router()

const SyncUserSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
})

authRouter.post('/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = SyncUserSchema.parse(req.body ?? {})
    const walletAddress = resolveAuthorizedWalletAddress({
      authWalletAddress: req.walletAddress,
      requestedWalletAddress: body.walletAddress,
      allowRequestedWithoutSessionWallet: true,
    })

    const user = await upsertUser(req.userId!, walletAddress)
    if (!user) {
      return res.status(500).json({ error: 'Failed to sync user' })
    }

    const settings = await getAgentSettings(user.id)

    return res.json({
      user: {
        id: user.id,
        privyUserId: user.privy_user_id,
        walletAddress: user.wallet_address,
      },
      settings: {
        autoExecute: settings.auto_execute,
        requireApprovalAbove: settings.require_approval_above,
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid sync payload', details: err.errors })
    }
    if (err instanceof Error && isAuthorizationError(err)) {
      return res.status(403).json({ error: err.message })
    }

    console.error('[auth sync]', err)
    return res.status(500).json({ error: 'Unable to sync authenticated user' })
  }
})
