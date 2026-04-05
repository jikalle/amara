'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge, Card, KenteStrip } from '../../../../../components/ui'
import { useWalletStore } from '../../../../../store'
import { colors } from '../../../../../lib/ui-tokens'

export default function NftDetailPage() {
  const router = useRouter()
  const params = useParams<{ chain: string; tokenId: string }>()
  const nfts = useWalletStore((state) => state.nfts)

  const nft = useMemo(() => {
    const chain = decodeURIComponent(params.chain)
    const tokenId = decodeURIComponent(params.tokenId)
    return nfts.find((entry) => entry.chain === chain && entry.tokenId === tokenId) ?? null
  }, [nfts, params.chain, params.tokenId])

  if (!nft) {
    return (
      <div className="min-h-screen bg-earth text-cream">
        <KenteStrip height={4} />
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
          <Card kente>
            <div className="p-6">
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted font-bold mb-3">NFT Not Found</div>
              <div className="text-sm text-muted leading-6">
                This NFT is not available in the current wallet state. Refresh the dashboard and try again.
              </div>
              <div className="mt-4">
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

  return (
    <div className="min-h-screen bg-earth text-cream">
      <KenteStrip height={4} />
      <header className="sticky top-0 z-20 border-b border-border bg-soil/95 px-4 py-3 backdrop-blur md:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <button onClick={() => router.back()} className="rounded-full border border-border bg-clay/55 px-3 py-1.5 text-xs text-muted hover:text-cream">Back</button>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold">NFT Detail</div>
            <div className="mt-1 text-xs text-text2">{nft.collection} · #{nft.tokenId}</div>
          </div>
          <Link href="/dashboard" className="rounded-full text-xs border border-border bg-clay/70 px-3 py-1.5 hover:border-border2">Close</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] xl:items-start">
          <Card kente>
            <div className="overflow-hidden p-4">
              <div className="overflow-hidden rounded-[1.35rem] border border-border bg-clay">
                <div className="aspect-square border-b border-border bg-clay flex items-center justify-center overflow-hidden">
                  <NftArtwork nft={nft} />
                </div>
                <div className="border-b border-border bg-soil px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-display font-black">{nft.name ?? `#${nft.tokenId}`}</div>
                      <div className="mt-1 text-sm text-muted">{nft.collection}</div>
                    </div>
                    <Badge variant="chain" color={nft.chain === 'ethereum' ? colors.chains.eth : colors.chains.base}>
                      {nft.chain}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-b border-border">
                  <MiniNftMetric label="Token ID" value={`#${nft.tokenId}`} />
                  <MiniNftMetric label="Collection" value={truncate(nft.collection, 14)} />
                  <MiniNftMetric label="Chain" value={nft.chain} />
                </div>

                <div className="grid grid-cols-3 gap-2 p-4">
                  <button className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center">
                    <span className="text-base">⤴</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Share</span>
                  </button>
                  <button className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center opacity-70">
                    <span className="text-base">⛓</span>
                    <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Bridge</span>
                  </button>
                  {nft.imageUrl ? (
                    <a
                      href={nft.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center"
                    >
                      <span className="text-base">↗</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Artwork</span>
                    </a>
                  ) : (
                    <div className="flex flex-col items-center gap-1 border border-border bg-soil px-3 py-3 text-center opacity-60">
                      <span className="text-base">•</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text2">Artwork</span>
                    </div>
                  )}
                </div>

                <div className="mx-4 mb-4 border border-border bg-soil p-4">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">About</div>
                  <div className="text-sm leading-6 text-text2">
                    This NFT detail mirrors the current wallet snapshot. Missing artwork falls back to collection initials so the asset never renders as a blank card.
                  </div>
                </div>

                <div className="mx-4 mb-5 border border-border bg-soil p-4">
                  <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-muted">Details</div>
                  <InfoRow label="Token ID" value={nft.tokenId} mono />
                  <InfoRow label="Collection" value={nft.collection} />
                  <InfoRow label="Chain" value={nft.chain} />
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-4 xl:sticky xl:top-24">
            <Card>
              <div className="p-5">
                <div className="mb-3 text-[10px] uppercase tracking-[0.2em] text-muted font-bold">Provenance</div>
                <div className="text-sm text-muted leading-6">
                  Collection provenance, listing, and bridge actions are still lightweight in this MVP. The core goal here is clear ownership display and dependable artwork rendering.
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

function MiniNftMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-border bg-soil p-4 last:border-r-0">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted font-bold">{label}</div>
      <div className="text-sm font-display font-bold text-text2 break-words">{value}</div>
    </div>
  )
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value
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

function NftArtwork({ nft }: { nft: { chain: string; collection: string; name?: string; imageUrl?: string } }) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasImage = Boolean(nft.imageUrl && !imageFailed)
  const initials = (nft.collection || nft.name || 'NFT')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, 2)
    .toUpperCase() || 'NFT'

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={nft.imageUrl}
        alt={nft.name ?? nft.collection}
        className="h-full w-full object-cover"
        onError={() => setImageFailed(true)}
      />
    )
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center text-[1.6rem] font-display font-black tracking-[0.18em]"
      style={{
        background: `linear-gradient(135deg, ${colors.clay2} 0%, ${colors.earth} 100%)`,
        color: nft.chain === 'ethereum' ? colors.chains.eth : colors.chains.base,
      }}
    >
      {initials}
    </div>
  )
}
