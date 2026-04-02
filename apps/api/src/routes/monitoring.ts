import { Router } from 'express'
import { z } from 'zod'
import { logErrorEvent, logWarn } from '../middleware/logger'

const ClientErrorSchema = z.object({
  type: z.enum(['window_error', 'unhandled_rejection']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  source: z.string().max(2000).optional(),
  pathname: z.string().max(1000).optional(),
  userAgent: z.string().max(1000).optional(),
  timestamp: z.number().optional(),
})

export const monitoringRouter = Router()

monitoringRouter.post('/client-error', (req, res) => {
  try {
    const body = ClientErrorSchema.parse(req.body)

    logErrorEvent('web_client_error', {
      errorType: body.type,
      message: body.message,
      stack: body.stack ?? null,
      source: body.source ?? null,
      pathname: body.pathname ?? null,
      userAgent: body.userAgent ?? null,
      clientTimestamp: body.timestamp ?? null,
    })

    res.status(202).json({ accepted: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      logWarn('web_client_error_invalid', {
        details: err.errors,
      })
      return res.status(400).json({ error: 'Invalid monitoring payload', details: err.errors })
    }

    logErrorEvent('web_client_error_failed', {
      message: err instanceof Error ? err.message : 'Unknown monitoring route failure',
    })
    return res.status(500).json({ error: 'Failed to record client error' })
  }
})
