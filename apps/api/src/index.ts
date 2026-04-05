import { getAllowedOrigins, getRuntimeSummary } from './env.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { agentRouter }    from './routes/agent.js'
import { authRouter }     from './routes/auth.js'
import { walletRouter }   from './routes/wallet.js'
import { strategyRouter } from './routes/strategy.js'
import { txRouter }       from './routes/transactions.js'
import { monitoringRouter } from './routes/monitoring.js'
import { onrampRouter } from './routes/onramp.js'
import { cngnRouter } from './routes/cngn.js'
import { requestLogger, errorHandler, notFound } from './middleware/logger.js'
import { getDbHealth } from './db/client.js'

export function createApp() {
  const app = express()
  const allowedOrigins = getAllowedOrigins()

  app.use(helmet())
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }))

  app.use('/api/agent', rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many requests, slow down.' },
  }))

  app.use('/api/tx', rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many transaction requests, slow down.' },
  }))

  app.use('/api/monitoring', rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many monitoring events, slow down.' },
  }))

  app.use('/api/onramp', rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    message: { error: 'Too many on-ramp requests, slow down.' },
  }))

  app.use('/api/cngn', rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many cNGN funding requests, slow down.' },
  }))

  app.use(express.json({ limit: '1mb' }))
  app.use(requestLogger)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/ready', async (_req, res) => {
    const runtime = getRuntimeSummary()
    const db = await getDbHealth()
    const checks = {
      database: db,
      providers: {
        anthropic: runtime.providers.anthropic,
        alchemy: runtime.providers.alchemy,
        lifi: runtime.providers.lifi,
      },
      funding: {
        transak: runtime.providers.transak,
        cngn: runtime.providers.cngn,
      },
    }

    const ready =
      checks.database.ok &&
      checks.providers.alchemy &&
      checks.providers.lifi

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      runtime: {
        nodeEnv: runtime.nodeEnv,
        allowedOrigins: runtime.allowedOrigins,
        featureFlags: runtime.featureFlags,
      },
      checks,
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/agent', agentRouter)
  app.use('/api/wallet', walletRouter)
  app.use('/api/strategy', strategyRouter)
  app.use('/api/tx', txRouter)
  app.use('/api/monitoring', monitoringRouter)
  app.use('/api/onramp', onrampRouter)
  app.use('/api/cngn', cngnRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

const app = createApp()
const PORT = process.env.PORT ?? 4000

if (process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    const runtime = getRuntimeSummary()
    console.log(`
╔═══════════════════════════════════╗
║   Amara API  ·  port ${PORT}         ║
║   Agent: Claude claude-sonnet-4-5      ║
║   Chains: Base + 9 more          ║
╚═══════════════════════════════════╝
  `)
    console.log('[runtime]', JSON.stringify({
      env: runtime.nodeEnv,
      origins: runtime.allowedOrigins,
      features: runtime.featureFlags,
      providers: runtime.providers,
    }))
  })
}

export default app
