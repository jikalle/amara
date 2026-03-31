import { Router } from 'express'
import { buildPortfolio } from '../services/portfolio'
import { getRecentTransactions } from '../services/transactions'
import { getStoredTransactions, getUserByWalletAddress, savePortfolioSnapshot, saveTransaction } from '../db/client'
import type { Transaction } from '@anara/types'

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
    let mergedTxs = txs

    if (user) {
      const stored = await getStoredTransactions(user.id, chain, lim)
      await Promise.allSettled(txs.map((tx: Transaction) => saveTransaction(user.id, {
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

      mergedTxs = mergeTransactions(
        txs,
        stored.map((tx) => ({
          hash: tx.tx_hash as `0x${string}`,
          chainId: tx.chain_id,
          type: tx.tx_type as Transaction['type'],
          status: tx.status as Transaction['status'],
          from: tx.from_address as `0x${string}`,
          to: tx.to_address as `0x${string}` | undefined,
          value: '0',
          valueFormatted: tx.value_formatted ?? tx.tx_type,
          valueUsd: typeof tx.value_usd === 'number' ? `$${tx.value_usd.toFixed(2)}` : undefined,
          timestamp: tx.updated_at ? new Date(tx.updated_at).getTime() : Date.now(),
          nonce: 0,
          tokenIn: tx.token_in as Transaction['tokenIn'],
          tokenOut: tx.token_out as Transaction['tokenOut'],
          fromChainId: tx.from_chain_id ?? undefined,
          toChainId: tx.to_chain_id ?? undefined,
          bridgeProtocol: tx.bridge_protocol ?? undefined,
        }))
      ).slice(0, lim)
    }

    res.json({
      address,
      transactions: mergedTxs,
      total: mergedTxs.length,
      limit: lim,
      offset: Number(offset) || 0,
    })
  } catch (err) {
    console.error('[transactions]', err)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

function mergeTransactions(chainTxs: Transaction[], storedTxs: Transaction[]) {
  const byHash = new Map<string, Transaction>()

  for (const tx of storedTxs) {
    byHash.set(`${tx.chainId}:${tx.hash.toLowerCase()}`, tx)
  }

  for (const tx of chainTxs) {
    byHash.set(`${tx.chainId}:${tx.hash.toLowerCase()}`, tx)
  }

  return Array.from(byHash.values()).sort((left, right) => right.timestamp - left.timestamp)
}
