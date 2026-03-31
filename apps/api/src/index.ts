import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { agentRouter }    from './routes/agent'
import { authRouter }     from './routes/auth'
import { walletRouter }   from './routes/wallet'
import { strategyRouter } from './routes/strategy'
import { txRouter }       from './routes/transactions'
import { requestLogger, errorHandler, notFound } from './middleware/logger'

const app  = express()
const PORT = process.env.PORT ?? 4000

// ── Security middleware ──
app.use(helmet())
app.use(cors({
  origin: [
    'http://localhost:3000',   // web
    'http://localhost:5173',   // extension dev
    'exp://localhost:8081',    // Expo mobile
  ],
  credentials: true,
}))

// ── Rate limiting ──
app.use('/api/agent', rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,             // 30 agent requests/min
  message: { error: 'Too many requests, slow down.' },
}))

app.use(express.json({ limit: '1mb' }))
app.use(requestLogger)

// ── Health check ──
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

// ── API routes ──
app.use('/api/auth',     authRouter)
app.use('/api/agent',    agentRouter)
app.use('/api/wallet',   walletRouter)
app.use('/api/strategy', strategyRouter)
app.use('/api/tx',       txRouter)

// ── 404 + Error handlers ──
app.use(notFound)
app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════╗
║   Anara API  ·  port ${PORT}         ║
║   Agent: Claude claude-sonnet-4-5      ║
║   Chains: Base + 9 more          ║
╚═══════════════════════════════════╝
  `)
})

export default app
