import './env'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { agentRouter }    from './routes/agent'
import { authRouter }     from './routes/auth'
import { walletRouter }   from './routes/wallet'
import { strategyRouter } from './routes/strategy'
import { txRouter }       from './routes/transactions'
import { monitoringRouter } from './routes/monitoring'
import { requestLogger, errorHandler, notFound } from './middleware/logger'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'exp://localhost:8081',
    ],
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

  app.use(express.json({ limit: '1mb' }))
  app.use(requestLogger)

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/agent', agentRouter)
  app.use('/api/wallet', walletRouter)
  app.use('/api/strategy', strategyRouter)
  app.use('/api/tx', txRouter)
  app.use('/api/monitoring', monitoringRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}

const app = createApp()
const PORT = process.env.PORT ?? 4000

if (process.env.VITEST !== 'true' && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════╗
║   Anara API  ·  port ${PORT}         ║
║   Agent: Claude claude-sonnet-4-5      ║
║   Chains: Base + 9 more          ║
╚═══════════════════════════════════╝
  `)
  })
}

export default app
