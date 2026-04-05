import { Router } from 'express'
import { buildPortfolio } from '../services/portfolio.js'
import { getRecentTransactionsWithDebug } from '../services/transactions.js'
import { getStoredTransactions, getUserByWalletAddress, savePortfolioSnapshot, saveTransaction } from '../db/client.js'
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
      warnings: portfolio.warnings ?? [],
    })
  } catch (err) {
    console.error('[portfolio]', err)
    res.status(200).json({
      address,
      totalUsd: '$0.00',
      change24h: '+$0.00',
      tokens: [],
      nfts: [],
      chains: [
        { chainId: 8453, nativeBalance: '0', totalUsd: '$0.00' },
        { chainId: 1, nativeBalance: '0', totalUsd: '$0.00' },
        { chainId: 56, nativeBalance: '0', totalUsd: '$0.00' },
      ],
      lastUpdated: Date.now(),
      warnings: [
        err instanceof Error ? err.message : 'Failed to build portfolio',
      ],
    })
  }
})

// GET /api/wallet/:address/transactions
walletRouter.get('/:address/transactions', async (req, res) => {
  const { address } = req.params
  const { chainId, limit = '20', offset = '0', debug } = req.query
  try {
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 50)
    const requestedChainId = typeof chainId === 'string' ? Number(chainId) : undefined
    const chainIds = typeof requestedChainId === 'number' && Number.isFinite(requestedChainId)
      ? [requestedChainId]
      : [8453, 1, 56]
    const chainTxResults = await Promise.allSettled(
      chainIds.map((currentChainId) => getRecentTransactionsWithDebug(address, currentChainId, lim))
    )
    const txs = chainTxResults
      .flatMap((result) => (result.status === 'fulfilled' ? result.value.transactions : []))
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, lim)
    const debugSummary = chainTxResults
      .flatMap((result, index) => {
        if (result.status === 'fulfilled') return [result.value.debug]
        return [{
          chainId: chainIds[index] ?? 0,
          alchemyOutgoing: 'rejected',
          alchemyIncoming: 'rejected',
          alchemyMerged: 0,
          explorerNormal: 'rejected',
          explorerToken: 'rejected',
          finalCount: 0,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }]
      })
    const chainWarnings = chainTxResults
      .flatMap((result, index) =>
        result.status === 'rejected'
          ? [`chain ${chainIds[index]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
          : []
      )
    const user = await getUserByWalletAddress(address)
    let mergedTxs = mergeTransactions(txs, []).slice(0, lim)

    if (user) {
      const stored = await getStoredTransactions(user.id, chainIds.length === 1 ? chainIds[0] : undefined, lim)
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
      warnings: chainWarnings,
      debug: debug === '1' ? debugSummary : undefined,
    })
  } catch (err) {
    console.error('[transactions]', err)
    res.status(200).json({
      address,
      transactions: [],
      total: 0,
      limit: Math.min(Math.max(Number(limit) || 20, 1), 50),
      offset: Number(offset) || 0,
      warnings: [
        err instanceof Error ? err.message : 'Failed to fetch transactions',
      ],
    })
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
