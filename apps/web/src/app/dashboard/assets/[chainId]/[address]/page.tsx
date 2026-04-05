'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge, Card, KenteStrip, ChainLogo, TokenLogo } from '../../../../../components/ui'
import { useWalletStore } from '../../../../../store'
import { chainMeta } from '../../../../../lib/ui-tokens'

const VERIFIED_ASSETS: Record<number, Array<{
  address: `0x${string}` | 'native'
  symbol: string
  name: string
  decimals: number
  priceUsd: string
  change24h: string
}>> = {
  8453: [
    { address: 'native', symbol: 'ETH', name: 'Ether', decimals: 18, priceUsd: '$0.00', change24h: '+0.00%' },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6, priceUsd: '$1.00', change24h: '+0.00%' },
  ],
  1: [
    { address: 'native', symbol: 'ETH', name: 'Ether', decimals: 18, priceUsd: '$0.00', change24h: '+0.00%' },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, priceUsd: '$1.00', change24h: '+0.00%' },
  ],
  56: [
    { address: 'native', symbol: 'BNB', name: 'BNB', decimals: 18, priceUsd: '$0.00', change24h: '+0.00%' },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18, priceUsd: '$1.00', change24h: '+0.00%' },
  ],
}

export default function AssetDetailPage() {
  const router = useRouter()
  const params = useParams<{ chainId: string; address: string }>()
  const tokens = useWalletStore((state) => state.tokens)

  const asset = useMemo(() => {
    const chainId = Number(params.chainId)
    const address = decodeURIComponent(params.address)
    const liveToken = tokens.find((token) => token.chainId === chainId && token.address === address)
    if (liveToken) return liveToken
    const fallback = (VERIFIED_ASSETS[chainId] ?? []).find((token) => normalizeAssetAddress(token.address) === normalizeAssetAddress(address as `0x${string}` | 'native'))
    if (!fallback) return null
    return {
      ...fallback,
      balance: '0',
      balanceFormatted: '0',
      balanceUsd: '$0.00',
      logoUrl: undefined,
      chainId,
    }
  }, [params.address, params.chainId, tokens])
  const transactions = useWalletStore((state) => state.transactions)

  if (!asset) {
    return (
      <div className="min-h-screen bg-earth text-cream">
        <KenteStrip height={4} />
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <Card kente>
            <div className="p-6">
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted font-bold mb-3">Asset Not Found</div>
              <div className="text-sm text-muted leading-6">
                This asset is not available in the current wallet state. Refresh the dashboard and try again.
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => router.push('/dashboard')} className="bg-gold text-earth px-4 py-2 text-xs font-bold uppercase tracking-wide">
                  Back To Dashboard
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const chain = chainMeta[asset.chainId]
  const explorerUrl = asset.address === 'native' ? null : `${chain?.explorerUrl}/token/${asset.address}`
  const relatedTransactions = transactions
    .filter((entry) =>
      entry.chainId === asset.chainId &&
      (
        entry.tokenIn?.symbol === asset.symbol ||
        entry.tokenOut?.symbol === asset.symbol
      )
    )
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-earth text-cream">
      <KenteStrip height={4} />
      <header className="sticky top-0 z-20 border-b border-border bg-soil/95 px-4 py-3 backdrop-blur md:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <button onClick={() => router.back()} className="rounded-full border border-border bg-clay/55 px-3 py-1.5 text-xs text-muted hover:text-cream">Back</button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold">Asset Detail</div>
            <div className="mt-1 text-xs text-text2">{asset.symbol} · {chain?.name ?? `Chain ${asset.chainId}`}</div>
          </div>
          <Link href="/dashboard" className="rounded-full text-xs border border-border bg-clay/70 px-3 py-1.5 hover:border-border2">Close</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] xl:items-start">
          <Card kente>
            <div className="overflow-hidden rounded-[1.35rem]">
              <div className="relative border-b border-border bg-soil px-6 py-8 text-center">
                <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: chain?.color ?? '#627EEA' }} />
                <div className="flex items-center justify-center gap-3">
                  <TokenLogo symbol={asset.symbol} name={asset.name} logoUrl={asset.logoUrl} chainId={asset.chainId} size={48} />
                  {chain ? (
                    <Badge variant="chain" color={chain.color} className="inline-flex items-center gap-1">
                      <ChainLogo chainId={asset.chainId} size={12} />
                      {chain.name}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-5 font-display text-[2.2rem] font-black leading-none md:text-[2.6rem]">{asset.balanceFormatted}</div>
                <div className="mt-2 font-mono text-sm text-text2">{asset.balanceUsd}</div>
                <div className={`mt-3 inline-flex border px-3 py-1 text-[11px] font-mono font-bold ${asset.change24h.startsWith('-') ? 'border-kola/25 bg-kola/10 text-kola' : 'border-green/25 bg-green/10 text-green'}`}>
                  {asset.change24h}
                </div>
              </div>

              <div className="grid grid-cols-3 border-b border-border">
                <MetricCard label="Price" value={asset.priceUsd} />
                <MetricCard label="Chain" value={chain?.name ?? String(asset.chainId)} />
                <MetricCard label="Decimals" value={String(asset.decimals)} />
              </div>

              <div className="grid grid-cols-3 gap-2 p-4">
                <Link
                  href={`/dashboard/chat?action=send`}
                  className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center"
                >
                  <span className="text-base">↑</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Send</span>
                </Link>
                <Link
                  href={`/dashboard/chat?action=swap`}
                  className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center"
                >
                  <span className="text-base">⇄</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Swap</span>
                </Link>
                {explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center"
                  >
                    <span className="text-base">↗</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Explorer</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center opacity-60">
                    <span className="text-base">•</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Native</span>
                  </div>
                )}
              </div>

              <div className="mx-4 border border-border bg-soil p-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">About</div>
                <div className="text-sm leading-6 text-text2">
                  {asset.name} is currently loaded from the wallet snapshot. Refresh the dashboard if you need a fresher balance or pricing view.
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <InfoRow label="Contract" value={asset.address === 'native' ? 'Native asset' : asset.address} mono />
                  <InfoRow label="Chain ID" value={String(asset.chainId)} />
                </div>
              </div>

              <div className="px-4 pb-5 pt-4">
                <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-muted">Transaction History</div>
                <div className="overflow-hidden border border-border bg-soil">
                  {relatedTransactions.length ? relatedTransactions.map((entry) => (
                    <Link
                      key={entry.hash}
                      href={`/dashboard/activity/${entry.chainId}/${encodeURIComponent(entry.hash)}`}
                      className="flex items-center gap-3 border-b border-border/50 px-4 py-3 last:border-b-0"
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${entry.type === 'receive' ? 'border-green/25 bg-green/10 text-green' : 'border-kola/25 bg-kola/10 text-kola'}`}>
                        {entry.type === 'receive' ? '↓' : '↑'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-cream">{entry.type === 'receive' ? 'Received' : 'Sent'}</div>
                        <div className="mt-1 font-mono text-[10px] text-muted">{entry.hash.slice(0, 10)}…{entry.hash.slice(-4)}</div>
                      </div>
                      <div className="text-right">
                        <div className={`font-mono text-xs font-bold ${entry.type === 'receive' ? 'text-green' : 'text-kola'}`}>{entry.valueFormatted}</div>
                        <div className="mt-1 font-mono text-[10px] text-muted">{formatShortTime(entry.timestamp)}</div>
                      </div>
                    </Link>
                  )) : (
                    <div className="px-4 py-5 text-sm text-muted">No recent transaction history for this asset is available yet.</div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-24">
            <Card>
              <div className="p-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold mb-3">Token Context</div>
                <div className="flex flex-col gap-2">
                  <InfoRow label="Symbol" value={asset.symbol} />
                  <InfoRow label="Name" value={asset.name} />
                  <InfoRow label="Value" value={asset.balanceUsd} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

function normalizeAssetAddress(address: `0x${string}` | 'native') {
  return address === 'native' ? 'native' : address.toLowerCase()
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border bg-soil p-4 last:border-r-0">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted font-bold">{label}</div>
      <div className="text-lg font-display font-bold text-text2 break-words">{value}</div>
    </div>
  )
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.16em] text-muted font-bold">{label}</span>
      <span className={mono ? 'font-mono text-right text-[12px] text-text2 break-all' : 'text-right text-[12px] text-text2'}>
        {value}
      </span>
    </div>
  )
}

function formatShortTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric' })
}
