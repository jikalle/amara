import { Router } from 'express'
export const txRouter = Router()

// POST /api/tx/simulate — dry-run a transaction before signing
txRouter.post('/simulate', async (req, res) => {
  // TODO: Tenderly simulation API
  res.json({ success: true, gasEstimate: '0.04', willSucceed: true })
})

// POST /api/tx/broadcast — submit signed tx to network
txRouter.post('/broadcast', async (req, res) => {
  // TODO: Alchemy send raw transaction
  res.json({ hash: '0x' + Math.random().toString(16).slice(2, 66), status: 'pending' })
})
