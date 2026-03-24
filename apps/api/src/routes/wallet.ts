import { Router } from 'express'
import { buildPortfolio } from '../services/portfolio'
import { getRecentTransactions } from '../services/transactions'
import { getUserByWalletAddress, savePortfolioSnapshot, saveTransaction } from '../db/client'

export const walletRouter = Router()

// GET /api/wallet/:address/portfolio
walletRouter.get('/:address/portfolio', async (req, res) => {
  const { address } = req.params
  try {
    const portfolio = await buildPortfolio(address)

    const user = await getUserByWalletAddress(address)
    if (user && typeof portfolio.totalUsdValue === 'number') {
      await savePortfolioSnapshot(user.id, portfolio.totalUsdValue, {
        chains: portfolio.chains,
        tokens: portfolio.tokens?.slice(0, 50) ?? [],
      })
    }

    res.json({
      address: portfolio.address,
      totalUsd: portfolio.totalUsd,
      change24h: portfolio.change24h,
      tokens: portfolio.tokens ?? [],
      nfts: portfolio.nfts ?? [],
      chains: portfolio.chains ?? [],
      lastUpdated: portfolio.lastUpdated,
    })
  } catch (err) {
    console.error('[portfolio]', err)
    res.status(500).json({ error: 'Failed to build portfolio' })
  }
})

// GET /api/wallet/:address/transactions
walletRouter.get('/:address/transactions', async (req, res) => {
  const { address } = req.params
  const { chainId, limit = '20', offset = '0' } = req.query
  try {
    const chain = chainId ? Number(chainId) : 8453
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50)

    const txs = await getRecentTransactions(address, chain, lim)
    const user = await getUserByWalletAddress(address)

    if (user) {
      await Promise.allSettled(txs.map((tx) => saveTransaction(user.id, {
        txHash:        tx.hash,
        chainId:       tx.chainId,
        txType:        tx.type,
        status:        tx.status,
        fromAddress:   tx.from,
        toAddress:     tx.to,
        valueFormatted: tx.valueFormatted,
        valueUsd:      tx.valueUsd ? Number(tx.valueUsd.replace('$', '')) : undefined,
        tokenIn:       tx.tokenIn,
        tokenOut:      tx.tokenOut,
        fromChainId:   tx.fromChainId,
        toChainId:     tx.toChainId,
        bridgeProtocol: tx.bridgeProtocol,
      })))
    }

    res.json({
      address,
      transactions: txs,
      total: txs.length,
      limit: lim,
      offset: Number(offset) || 0,
    })
  } catch (err) {
    console.error('[transactions]', err)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})
