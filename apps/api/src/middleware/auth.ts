import type { Request, Response, NextFunction } from 'express'
import { PrivyClient } from '@privy-io/server-auth'

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID ?? '',
  process.env.PRIVY_SECRET ?? ''
)

export interface AuthenticatedRequest extends Request {
  userId?:        string
  walletAddress?: string
}

/**
 * Verifies the Privy JWT in the Authorization header.
 * Attaches userId and walletAddress to the request.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' })
    }

    const claims = await privy.verifyAuthToken(token)
    req.userId = claims.userId

    // Fetch the user's wallet address from Privy
    const user = await privy.getUser(claims.userId)
    const embeddedWallet = user.linkedAccounts.find(
      (a) => a.type === 'wallet' && a.walletClientType === 'privy'
    )
    req.walletAddress = embeddedWallet?.address

    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

/**
 * Optional auth — attaches user if token present, continues anyway.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (token) {
      const claims = await privy.verifyAuthToken(token)
      req.userId = claims.userId
    }
  } catch {
    // Not authenticated — that's fine for optional routes
  }
  next()
}
