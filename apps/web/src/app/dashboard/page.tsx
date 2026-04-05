'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter }   from 'next/navigation'
import Link from 'next/link'
import { getSwapQuote } from '@anara/chain'
import { AnaraLogo, KenteStrip, Badge, Card, StatGrid, LiveDot, ActionCard, ChainLogo, TokenLogo } from '../../components/ui'
import { chainMeta, colors, shadows } from '../../lib/ui-tokens'
import { useWalletStore, useAgentStore } from '../../store'
import { useAgent } from '../../hooks/useAgent'
import { track } from '../../lib/analytics'
import { resolveWalletIdentity } from '../../lib/wallet'
import { useAuth } from '../../lib/auth'
import type { AgentActionCard, TokenBalance, WalletChainSummary, WalletNftSummary } from '@anara/types'
import type { OnrampAttempt } from '../../store'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export default function DashboardPage() {
  const { ready, authenticated, syncReady, identityToken, user, logout } = useAuth()
  const router  = useRouter()
  const { fetchBrief, fetchStatus, refreshWallet, executeStandaloneAction } = useAgent()
  const {
    address,
    totalUsd,
    tokens,
    nfts,
    chains,
    transactions,
    onrampAttempts,
    isLoading,
    error,
    hasWallet,
    lastUpdated,
    setAddress,
    setHasWallet,
  } = useWalletStore()
  const { state: agentState, brief, setChatOpen } = useAgentStore()
  const [showBrief, setShowBrief]   = useState(true)
  const [activeTab, setActiveTab]   = useState<'activity' | 'assets' | 'nfts'>('assets')
  const [chainOpen, setChainOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [showFundSheet, setShowFundSheet] = useState(false)
  const [showQuickSheet, setShowQuickSheet] = useState<'send' | 'receive' | 'swap' | 'bridge' | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [trackedDashboardLoad, setTrackedDashboardLoad] = useState(false)
  const emailAddress = user?.email?.address ?? null
  const profileLabel = user?.email?.address?.[0]?.toUpperCase() ?? 'S'
  const shortWallet = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null
  const activeChainCount = Math.max(chains.filter((chain) => parseUsdAmount(chain.totalUsd) > 0).length, 1)

  useEffect(() => {
    if (ready && !authenticated) router.push('/onboard')
  }, [ready, authenticated, router])

  useEffect(() => {
    if (authenticated && syncReady) {
      const { address: walletAddress, hasWallet } = resolveWalletIdentity(user)
      setHasWallet(hasWallet)
      if (walletAddress) setAddress(walletAddress)
      if (walletAddress) {
        fetchStatus()
        refreshWallet()
        fetchBrief()
      }
    }
  }, [authenticated, syncReady, user, setAddress, setHasWallet, fetchBrief, fetchStatus, refreshWallet])

  useEffect(() => {
    if (!authenticated || !hasWallet || isLoading || trackedDashboardLoad) return

    track('dashboard_loaded', {
      walletAddress: address,
      totalUsd,
      tokenCount: tokens.length,
      nftCount: nfts.length,
      transactionCount: transactions.length,
      chainCount: chains.length,
      hasError: Boolean(error),
    })
    setTrackedDashboardLoad(true)
  }, [
    authenticated,
    hasWallet,
    isLoading,
    trackedDashboardLoad,
    address,
    totalUsd,
    tokens.length,
    nfts.length,
    transactions.length,
    chains.length,
    error,
  ])

  if (!ready || !authenticated) return <LoadingSplash />

  if (!hasWallet) return <MissingWalletState />

  if (showBrief && brief && hasReportableBrief(brief)) {
    return <BriefModal brief={brief} onDismiss={() => setShowBrief(false)} />
  }

  return (
    <div className="min-h-screen bg-earth text-cream flex flex-col">
      {/* Kente top strip */}
      <KenteStrip height={4} />

      {/* ── Status bar ── */}
      <header className="sticky top-0 z-20 bg-soil/95 backdrop-blur border-b border-border">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <AnaraLogo size={32} />
            <div>
              <div className="font-display font-black text-lg leading-tight">Amara</div>
              <div className="text-[11px] text-muted tracking-widest uppercase">Assisted · Base + Ethereum</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-3 border border-border bg-clay/65 px-3 py-2">
              <div className="text-right">
                <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted">Workspace</div>
                <div className="text-[12px] text-text2">
                  {emailAddress ? emailAddress.split('@')[0] : 'Wallet operator'}
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-left">
                <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted">Active wallet</div>
                <div className="text-[12px] font-mono text-text2">{shortWallet ?? 'No wallet'}</div>
              </div>
            </div>

            <div className="relative hidden md:block">
              <button
                onClick={() => setChainOpen(v => !v)}
                className="flex items-center gap-1.5 bg-clay border border-border px-2.5 py-1.5 text-[11px] font-bold font-mono tracking-wide text-text2 hover:border-border2 transition-colors"
              >
                {chains.slice(0, 3).map((chain) => (
                  <span
                    key={chain.chainId}
                    className="inline-flex"
                  >
                    <ChainLogo chainId={chain.chainId} size={10} />
                  </span>
                ))}
                <span className="ml-1">{activeChainCount} {activeChainCount === 1 ? 'chain' : 'chains'} ▾</span>
              </button>
              {chainOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setChainOpen(false)} />
                  <ChainMenu />
                </>
              )}
            </div>

            <div className="hidden md:flex items-center gap-1.5 border border-green/25 bg-green/5 px-3 py-1.5">
              <LiveDot />
              <span className="text-[11px] font-bold text-green tracking-widest uppercase">Agent Ready</span>
            </div>

            <div className="relative">
              <button
                onClick={() => setProfileOpen((current) => !current)}
                className="flex items-center gap-2 border border-border bg-clay/65 px-2 py-1.5 hover:border-border2 transition-colors"
                title="Profile"
              >
                <span className="flex h-8 w-8 items-center justify-center bg-gold text-earth font-black text-sm font-display">
                  {profileLabel}
                </span>
                <span className="hidden md:block text-left">
                  <span className="block text-[10px] font-bold tracking-[0.16em] uppercase text-muted">Profile</span>
                  <span className="block max-w-[120px] truncate text-[12px] text-text2">
                    {emailAddress ? emailAddress.split('@')[0] : 'Account'}
                  </span>
                </span>
                <span className="hidden md:block text-[10px] text-muted">▾</span>
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)} />
                  <ProfileMenu
                    emailAddress={emailAddress}
                    walletAddress={address}
                    totalUsd={totalUsd}
                    isLoggingOut={isLoggingOut}
                    onLogout={async () => {
                      setIsLoggingOut(true)
                      try {
                        await logout()
                      } finally {
                        setIsLoggingOut(false)
                      }
                    }}
                    onClose={() => setProfileOpen(false)}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 pb-8 pt-5 md:px-6 xl:px-8 xl:pb-12">
        {error && (
          <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-[12px] text-text2">
            <div className="font-bold text-kola mb-1">Wallet data is partially unavailable</div>
            <div>{error}</div>
            <button
              onClick={async () => {
                setIsRefreshing(true)
                try {
                  await refreshWallet()
                } finally {
                  setIsRefreshing(false)
                }
              }}
              disabled={isRefreshing}
              className="mt-2 text-[11px] font-bold uppercase tracking-wide text-gold2 hover:text-gold disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing…' : 'Retry refresh'}
            </button>
          </div>
        )}

        {!error && lastUpdated && (
          <div className="mt-3 text-[10px] font-mono text-muted">
            Last synced {formatRelativeSync(lastUpdated)}
          </div>
        )}

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)] xl:items-start">
          <section className="space-y-4">
            <PortfolioHero
              walletAddress={address}
              identityToken={identityToken}
              totalUsd={totalUsd}
              chains={chains}
              activeChainCount={activeChainCount}
              tokenCount={tokens.length}
              nftCount={nfts.length}
              isRefreshing={isRefreshing || isLoading}
              onOpenFund={() => setShowFundSheet(true)}
              onOpenSheet={(sheet) => setShowQuickSheet(sheet)}
              onRefresh={async () => {
                setIsRefreshing(true)
                try {
                  await refreshWallet()
                } finally {
                  setIsRefreshing(false)
                }
              }}
            />

            <div className="overflow-hidden border border-border bg-clay/60 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-center gap-3 px-4 py-2 overflow-hidden">
                <span className="text-[10px] font-bold text-gold tracking-[0.18em] uppercase flex-shrink-0">Ọrọ àṣà</span>
                <span className="text-[10px] text-muted italic whitespace-nowrap animate-ticker">
                  "The wealth of a man is not in his pocket, but in the land he cultivates." &nbsp;·&nbsp; "Oní owó ló ní ọrọ." &nbsp;·&nbsp; Brickt — African land. Global capital.
                </span>
              </div>
            </div>

            {onrampAttempts.length ? (
              <OnrampHistoryPanel />
            ) : null}

            <div className="xl:hidden">
            <WalletPanel
              activeTab={activeTab}
              onTabChange={setActiveTab}
              transactions={transactions}
              tokens={tokens}
              nfts={nfts}
              chains={chains}
              isLoading={isLoading}
              error={error}
            />
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-24">
            <section>
              <div className="text-[11px] font-bold tracking-[0.2em] text-muted uppercase mb-3">Strategies</div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide md:mx-0 md:px-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:gap-3 lg:pb-0">
                {STRATEGY_CARDS.map(s => (
                  <StrategyCard key={s.id} {...s} />
                ))}
              </div>
            </section>

            <section>
              <div className="text-[11px] font-bold tracking-[0.2em] text-muted uppercase mb-3">Agent Snapshot</div>
              <StatGrid stats={[
                { label: 'Actions today',  value: String(agentState.actionsToday || 0) },
                { label: 'Profit today',   value: agentState.profitToday || '$0.00', color: colors.green },
                { label: 'Errors',         value: String(agentState.errorsToday || 0),  color: agentState.errorsToday ? colors.kola : colors.green },
                { label: 'Wallet assets',  value: String(tokens.length + nfts.length), color: colors.teal },
              ]} />
            </section>

            {!brief && !isLoading && (
              <Card>
                <div className="p-4 text-[12px] text-muted leading-6">
                  No recent agent brief is available yet. Open chat to issue your first action or refresh once activity exists.
                </div>
              </Card>
            )}
          </aside>
        </div>

        <div className="mt-6 hidden xl:block">
          <WalletPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            transactions={transactions}
            tokens={tokens}
            nfts={nfts}
            chains={chains}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </main>
      {/* Agent Chat FAB — hidden on mobile since bottom nav covers chat */}
      <Link
        href="/dashboard/chat"
        onClick={() => setChatOpen(true)}
        className="hidden lg:flex fixed bottom-6 right-6 w-14 h-14 items-center justify-center bg-gold z-20 hover:bg-gold2 transition-colors"
        style={{ boxShadow: shadows.gold }}
        aria-label="Open agent chat"
      >
        {/* Chat bubble SVG */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 5.5C4 4.67 4.67 4 5.5 4h13C19.33 4 20 4.67 20 5.5v10c0 .83-.67 1.5-1.5 1.5H8.5L4 20V5.5z" fill="#1A1208" fillOpacity="0.85"/>
          <circle cx="9" cy="10" r="1.2" fill="#F0B429"/>
          <circle cx="12" cy="10" r="1.2" fill="#F0B429"/>
          <circle cx="15" cy="10" r="1.2" fill="#F0B429"/>
        </svg>
        <span
          className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green border-2 border-gold"
        />
      </Link>
      {showFundSheet ? (
        <FundWalletSheet
          walletAddress={address}
          identityToken={identityToken}
          onClose={() => setShowFundSheet(false)}
        />
      ) : null}
      {showQuickSheet ? (
        <QuickActionSheet
          sheet={showQuickSheet}
          address={address}
          tokens={tokens}
          hasWallet={hasWallet}
          onClose={() => setShowQuickSheet(null)}
          onExecuteDirectAction={executeStandaloneAction}
          onOpenChat={(prompt) => {
            setShowQuickSheet(null)
            setChatOpen(true)
            router.push(`/dashboard/chat?prompt=${encodeURIComponent(prompt)}`)
          }}
        />
      ) : null}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function LoadingSplash() {
  return (
    <div className="min-h-screen bg-earth flex flex-col">
      {/* Kente top strip */}
      <div className="h-1 w-full" style={{
        background: 'repeating-linear-gradient(90deg, #D4920A 0,#D4920A 10px,#C0392B 10px,#C0392B 20px,#E8A020 20px,#E8A020 30px,#1A1208 30px,#1A1208 36px)',
      }} />
      {/* Header skeleton */}
      <div className="h-[56px] bg-soil/95 border-b border-border flex items-center px-6 gap-3">
        <div className="skeleton w-8 h-8 rounded-sm" />
        <div className="skeleton w-24 h-4 rounded" />
        <div className="flex-1" />
        <div className="skeleton w-20 h-6 rounded" />
        <div className="skeleton w-28 h-6 rounded" />
      </div>
      {/* Main content skeleton */}
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 pt-6 md:px-6 xl:px-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.9fr)]">
          <div className="space-y-4">
            {/* Portfolio card skeleton */}
            <div className="border border-border bg-clay/60 p-4 space-y-4">
              <div className="skeleton w-32 h-3 rounded" />
              <div className="skeleton w-56 h-12 rounded" />
              <div className="flex gap-2">
                <div className="skeleton w-24 h-6 rounded" />
                <div className="skeleton w-32 h-4 rounded" />
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 border-t border-border pt-3 gap-3">
                {[1,2,3].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="skeleton w-12 h-5 rounded" />
                    <div className="skeleton w-10 h-3 rounded" />
                  </div>
                ))}
              </div>
              {/* Action buttons skeleton */}
              <div className="grid grid-cols-5 gap-2 border-t border-border pt-3">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="skeleton h-12 rounded" />
                ))}
              </div>
            </div>
            {/* Ticker skeleton */}
            <div className="skeleton h-8 w-full rounded" />
          </div>
          {/* Aside skeleton */}
          <div className="space-y-4 hidden xl:block">
            <div className="skeleton w-24 h-3 rounded" />
            <div className="grid grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="skeleton h-36 rounded" />
              ))}
            </div>
            <div className="skeleton w-28 h-3 rounded mt-4" />
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map(i => (
                <div key={i} className="skeleton h-14 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function hasReportableBrief(brief: Brief | null) {
  if (!brief) return false
  if ((brief.actionsCount ?? 0) > 0) return true
  if ((brief.errorsCount ?? 0) > 0) return true
  if (Array.isArray(brief.events) && brief.events.length > 0) return true
  return false
}

function QuickActionSheet({
  sheet,
  address,
  tokens,
  hasWallet,
  onClose,
  onExecuteDirectAction,
  onOpenChat,
}: {
  sheet: 'send' | 'receive' | 'swap' | 'bridge'
  address: string | null
  tokens: TokenBalance[]
  hasWallet: boolean
  onClose: () => void
  onExecuteDirectAction: (card: AgentActionCard, onCardChange?: (nextCard: AgentActionCard) => void) => Promise<unknown>
  onOpenChat: (prompt: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const sendTokenOptions = buildSendTokenOptions(tokens)
  const tokenOptions = buildTokenOptions(tokens)
  const defaultSendToken = sendTokenOptions[0]?.symbol ?? 'ETH'
  const defaultToken = tokenOptions[0]?.symbol ?? 'ETH'
  const [sendToken, setSendToken] = useState(defaultSendToken)
  const [sendAmount, setSendAmount] = useState('')
  const [sendAddress, setSendAddress] = useState('')
  const [sendChain, setSendChain] = useState<SendChainName>('Base')
  const [sendPreviewCard, setSendPreviewCard] = useState<AgentActionCard | null>(null)
  const [sendPreviewError, setSendPreviewError] = useState<string | null>(null)
  const [swapFromToken, setSwapFromToken] = useState(defaultToken)
  const [swapToToken, setSwapToToken] = useState(tokenOptions.find((token) => token.symbol !== defaultToken)?.symbol ?? 'USDC')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapChain, setSwapChain] = useState<SwapChainName>('Base')
  const [swapPreviewCard, setSwapPreviewCard] = useState<AgentActionCard | null>(null)
  const [swapPreviewError, setSwapPreviewError] = useState<string | null>(null)
  const [isSwapPreviewLoading, setIsSwapPreviewLoading] = useState(false)
  const [bridgeToken, setBridgeToken] = useState(defaultToken)
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgeFromChain, setBridgeFromChain] = useState<BridgeChainName>('Base')
  const [bridgeToChain, setBridgeToChain] = useState<BridgeChainName>('Ethereum')
  const bridgeTokenOptions = buildBridgeTokenOptions(tokens, bridgeFromChain, bridgeToChain)
  const [bridgePreviewCard, setBridgePreviewCard] = useState<AgentActionCard | null>(null)
  const [bridgePreviewError, setBridgePreviewError] = useState<string | null>(null)
  const [isBridgePreviewLoading, setIsBridgePreviewLoading] = useState(false)

  useEffect(() => {
    if (!bridgeTokenOptions.length) return
    if (!bridgeTokenOptions.some((token) => token.symbol === bridgeToken)) {
      setBridgeToken(bridgeTokenOptions[0]!.symbol)
    }
  }, [bridgeToken, bridgeTokenOptions])

  const sheetMeta = {
    send: {
      title: 'Send',
      body: 'Open chat with a prefilled send request and confirm it through the existing execution flow.',
      prompts: [
        'Send 10 USDC to 0x1111111111111111111111111111111111111111 on Base',
        'Send 0.001 ETH to 0x1111111111111111111111111111111111111111',
      ],
      accent: colors.kola,
    },
    receive: {
      title: 'Receive',
      body: 'Share your wallet address or copy it directly for inbound transfers.',
      prompts: [],
      accent: colors.green,
    },
    swap: {
      title: 'Swap',
      body: 'Open chat with a prefilled swap request and reuse the same preview and confirmation pipeline.',
      prompts: [
        'Swap 0.01 ETH to USDC on Base',
        'Swap 25 USDC to ETH on Base',
      ],
      accent: colors.gold,
    },
    bridge: {
      title: 'Bridge',
      body: 'Open chat with a prefilled bridge request. This still respects beta feature flags and guardrails.',
      prompts: [
        'Bridge 10 USDC from Base to Ethereum',
        'Bridge 0.005 ETH from Base to Ethereum',
      ],
      accent: colors.teal,
    },
  } as const

  const meta = sheetMeta[sheet]

  async function handleCopyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  function handlePreviewSend() {
    const preview = buildDirectSendPreviewCard({
      tokens,
      symbol: sendToken,
      amount: sendAmount,
      toAddress: sendAddress,
      chainName: sendChain,
    })

    if (preview instanceof Error) {
      setSendPreviewError(preview.message)
      setSendPreviewCard(null)
      return
    }

    setSendPreviewError(null)
    setSendPreviewCard(preview)
  }

  async function handlePreviewSwap() {
    setIsSwapPreviewLoading(true)
    try {
      const preview = await buildDirectSwapPreviewCard({
        tokens,
        symbolIn: swapFromToken,
        symbolOut: swapToToken,
        amount: swapAmount,
        chainName: swapChain,
        fromAddress: address,
      })

      if (preview instanceof Error) {
        setSwapPreviewError(preview.message)
        setSwapPreviewCard(null)
        return
      }

      setSwapPreviewError(null)
      setSwapPreviewCard(preview)
    } finally {
      setIsSwapPreviewLoading(false)
    }
  }

  async function handlePreviewBridge() {
    setIsBridgePreviewLoading(true)
    try {
      const preview = await buildDirectBridgePreviewCard({
        tokens,
        symbol: bridgeToken,
        amount: bridgeAmount,
        fromChainName: bridgeFromChain,
        toChainName: bridgeToChain,
        fromAddress: address,
      })

      if (preview instanceof Error) {
        setBridgePreviewError(preview.message)
        setBridgePreviewCard(null)
        return
      }

      setBridgePreviewError(null)
      setBridgePreviewCard(preview)
    } finally {
      setIsBridgePreviewLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30">
      <button
        aria-label="Close quick action sheet"
        className="absolute inset-0 bg-earth/70"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md border border-border bg-soil shadow-2xl max-h-[85dvh] flex flex-col">
        <KenteStrip height={4} />
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border flex-shrink-0">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-muted">Quick Action</div>
            <div className="text-xl font-display font-black mt-1" style={{ color: meta.accent }}>{meta.title}</div>
            <div className="text-sm text-muted mt-2 leading-6">{meta.body}</div>
          </div>
          <button onClick={onClose} className="text-xs border border-border px-3 py-1.5 text-muted hover:text-cream hover:border-border2">
            Close
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
        {sheet === 'receive' ? (
          <div className="p-4 space-y-4">
            <div className="border border-border bg-clay p-4">
              <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Wallet Address</div>
              <div className="font-mono text-[12px] text-text2 break-all">{address ?? 'No linked wallet address available yet.'}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyAddress}
                disabled={!address}
                className="flex-1 bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-50"
              >
                {copied ? 'Copied' : 'Copy Address'}
              </button>
              {address && (
                <Link
                  href={`/dashboard/chat?prompt=${encodeURIComponent(`What is my wallet address?`)}`}
                  onClick={onClose}
                  className="flex-1 border border-border text-center text-xs font-bold uppercase tracking-wide px-4 py-3 text-text2 hover:border-border2"
                >
                  Open In Chat
                </Link>
              )}
            </div>
          </div>
        ) : sheet === 'send' ? (
          <div className="p-4 space-y-4">
            <QuickField
              label="Asset"
              control={(
                <select value={sendToken} onChange={(event) => setSendToken(event.target.value)} className={quickInputClassName}>
                  {sendTokenOptions.map((token) => (
                    <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                  ))}
                </select>
              )}
            />
            <QuickField
              label="Amount"
              control={(
                <input
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  placeholder="10"
                  className={quickInputClassName}
                />
              )}
            />
            <QuickField
              label="Recipient"
              control={(
                <input
                  value={sendAddress}
                  onChange={(event) => setSendAddress(event.target.value)}
                  placeholder="0x1111111111111111111111111111111111111111"
                  className={`${quickInputClassName} font-mono`}
                />
              )}
            />
            <QuickField
              label="Chain"
              control={(
                <select value={sendChain} onChange={(event) => setSendChain(event.target.value as SendChainName)} className={quickInputClassName}>
                  <option>Base</option>
                  <option>Ethereum</option>
                  <option>BNB Chain</option>
                </select>
              )}
            />
            <button
              onClick={handlePreviewSend}
              className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3"
            >
              Preview Send
            </button>
            {sendPreviewError && (
              <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">
                {sendPreviewError}
              </div>
            )}
            {sendPreviewCard && (
              <ActionCard
                card={sendPreviewCard}
                disabled={!hasWallet}
                onConfirm={() => { void onExecuteDirectAction(sendPreviewCard, setSendPreviewCard) }}
                onCancel={() => setSendPreviewCard({ ...sendPreviewCard, status: 'cancelled' })}
              />
            )}
            <div className="text-[11px] text-muted leading-5">
              This direct send preview uses the existing transaction simulation and execution pipeline without depending on agent chat.
            </div>
          </div>
        ) : sheet === 'swap' ? (
          <div className="p-4 space-y-4">
            <QuickField
              label="From Asset"
              control={(
                <select value={swapFromToken} onChange={(event) => setSwapFromToken(event.target.value)} className={quickInputClassName}>
                  {tokenOptions.map((token) => (
                    <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                  ))}
                </select>
              )}
            />
            <QuickField
              label="To Asset"
              control={(
                <select value={swapToToken} onChange={(event) => setSwapToToken(event.target.value)} className={quickInputClassName}>
                  {tokenOptions.map((token) => (
                    <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                  ))}
                </select>
              )}
            />
            <QuickField
              label="Amount"
              control={(
                <input
                  value={swapAmount}
                  onChange={(event) => setSwapAmount(event.target.value)}
                  placeholder="0.01"
                  className={quickInputClassName}
                />
              )}
            />
            <QuickField
              label="Chain"
              control={(
                <select value={swapChain} onChange={(event) => setSwapChain(event.target.value as SwapChainName)} className={quickInputClassName}>
                  <option>Base</option>
                  <option>Ethereum</option>
                  <option>BNB Chain</option>
                </select>
              )}
            />
            <button
              onClick={() => { void handlePreviewSwap() }}
              disabled={isSwapPreviewLoading}
              className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-60"
            >
              {isSwapPreviewLoading ? 'Loading Preview…' : 'Preview Swap'}
            </button>
            {swapPreviewError && (
              <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">
                {swapPreviewError}
              </div>
            )}
            {swapPreviewCard && (
              <ActionCard
                card={swapPreviewCard}
                disabled={!hasWallet}
                onConfirm={() => { void onExecuteDirectAction(swapPreviewCard, setSwapPreviewCard) }}
                onCancel={() => setSwapPreviewCard({ ...swapPreviewCard, status: 'cancelled' })}
              />
            )}
            <div className="text-[11px] text-muted leading-5">
              This direct swap preview uses a live LI.FI quote, then confirms through the existing transaction execution pipeline without depending on agent chat.
            </div>
          </div>
        ) : sheet === 'bridge' ? (
          <div className="p-4 space-y-4">
            <QuickField
              label="Asset"
              control={(
                <select value={bridgeToken} onChange={(event) => setBridgeToken(event.target.value)} className={quickInputClassName}>
                  {bridgeTokenOptions.map((token) => (
                    <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                  ))}
                </select>
              )}
            />
            <QuickField
              label="Amount"
              control={(
                <input
                  value={bridgeAmount}
                  onChange={(event) => setBridgeAmount(event.target.value)}
                  placeholder="10"
                  className={quickInputClassName}
                />
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <QuickField
                label="From"
                control={(
                  <select value={bridgeFromChain} onChange={(event) => setBridgeFromChain(event.target.value as BridgeChainName)} className={quickInputClassName}>
                    <option>Base</option>
                    <option>Ethereum</option>
                    <option>BNB Chain</option>
                  </select>
                )}
              />
              <QuickField
                label="To"
                control={(
                  <select value={bridgeToChain} onChange={(event) => setBridgeToChain(event.target.value as BridgeChainName)} className={quickInputClassName}>
                    <option>Ethereum</option>
                    <option>Base</option>
                    <option>BNB Chain</option>
                  </select>
                )}
              />
            </div>
            <button
              onClick={() => { void handlePreviewBridge() }}
              disabled={isBridgePreviewLoading}
              className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-60"
            >
              {isBridgePreviewLoading ? 'Loading Preview…' : 'Preview Bridge'}
            </button>
            {bridgePreviewError && (
              <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">
                {bridgePreviewError}
              </div>
            )}
            {!bridgeTokenOptions.length && (
              <div className="border border-border bg-clay px-4 py-3 text-xs text-text2">
                No bridgeable assets are available for this chain pair yet.
              </div>
            )}
            {bridgePreviewCard && (
              <ActionCard
                card={bridgePreviewCard}
                disabled={!hasWallet}
                onConfirm={() => { void onExecuteDirectAction(bridgePreviewCard, setBridgePreviewCard) }}
                onCancel={() => setBridgePreviewCard({ ...bridgePreviewCard, status: 'cancelled' })}
              />
            )}
            <div className="text-[11px] text-muted leading-5">
              This direct bridge preview uses a live LI.FI route and confirms through the existing transaction execution pipeline without depending on agent chat.
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {meta.prompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => onOpenChat(prompt)}
                className="w-full text-left border border-border bg-clay px-4 py-3 hover:border-border2 transition-colors"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-bold mb-1">{meta.title} Prompt</div>
                <div className="text-sm text-text2 leading-6">{prompt}</div>
              </button>
            ))}
            <div className="text-[11px] text-muted leading-5 pt-1">
              These quick actions reuse the same chat preview, guardrails, and wallet-confirmed execution flow that is already live.
            </div>
          </div>
        )}
        </div>{/* end scrollable */}
      </div>
    </div>
  )
}

function QuickField({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">{label}</div>
      {control}
    </label>
  )
}

const quickInputClassName = 'w-full border border-border bg-clay px-3 py-3 text-sm text-text2 outline-none focus:border-gold/40'

function buildTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
      .filter((token) =>
        (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) &&
        (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
      )
    .map((token) => ({
      symbol: token.symbol,
      chain: token.chainId === 1 ? 'Ethereum' : token.chainId === 56 ? 'BNB Chain' : 'Base',
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!options.length) {
    return [
      { symbol: 'ETH', chain: 'Base' },
      { symbol: 'USDC', chain: 'Base' },
      { symbol: 'ETH', chain: 'Ethereum' },
      { symbol: 'BNB', chain: 'BNB Chain' },
      { symbol: 'USDT', chain: 'BNB Chain' },
    ]
  }

  return options
}

function buildSendTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
    .filter((token) =>
      (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) &&
      (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
    )
    .map((token) => ({
      symbol: token.symbol,
      chain: chainMeta[token.chainId]?.name ?? 'Base',
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!options.length) {
    return [
      { symbol: 'ETH', chain: 'Base' },
      { symbol: 'USDC', chain: 'Base' },
      { symbol: 'ETH', chain: 'Ethereum' },
      { symbol: 'BNB', chain: 'BNB Chain' },
      { symbol: 'USDT', chain: 'BNB Chain' },
    ]
  }

  return options
}

function buildBridgeTokenOptions(tokens: TokenBalance[], fromChain: BridgeChainName, toChain: BridgeChainName) {
  const fromChainId = getBridgeChainId(fromChain)
  const toChainId = getBridgeChainId(toChain)
  const seen = new Set<string>()

  return tokens
    .filter((token) =>
      token.chainId === fromChainId &&
      (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
    )
    .filter((token) => resolveSwapTokenConfig(tokens, token.symbol, toChainId))
    .map((token) => ({
      symbol: token.symbol,
      chain: fromChain,
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function buildDirectSendPreviewCard(input: {
  tokens: TokenBalance[]
  symbol: string
  amount: string
  toAddress: string
  chainName: SendChainName
}) {
  const amount = input.amount.trim()
  const toAddress = input.toAddress.trim()

  if (!amount || Number.parseFloat(amount) <= 0) {
    return new Error('Enter a valid amount before previewing the send.')
  }
  if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
    return new Error('Enter a valid recipient address before previewing the send.')
  }

  const chainId = getSendChainId(input.chainName)
  const token = input.tokens.find((entry) => entry.symbol === input.symbol && entry.chainId === chainId)
  if (!token) {
    return new Error(`No ${input.symbol} balance is available on ${input.chainName}.`)
  }

  const priceUsd = parseUsdAmount(token.priceUsd)
  const estimatedUsd = priceUsd > 0 ? `$${(priceUsd * Number.parseFloat(amount)).toFixed(2)}` : '$0.00'
  const shortAddress = `${toAddress.slice(0, 10)}…${toAddress.slice(-6)}`

  return {
    type: 'send',
    title: 'Send Preview',
    status: 'pending',
    rows: [
      { label: 'Asset', value: token.symbol },
      { label: 'Amount', value: `${amount} ${token.symbol}`, highlight: true },
      { label: 'USD', value: `~${estimatedUsd}` },
      { label: 'To', value: shortAddress },
      { label: 'Network', value: input.chainName },
      { label: 'Est. gas', value: '~$0.04' },
    ],
    metadata: {
      kind: 'send',
      fromChainId: chainId,
      fromTokenSymbol: token.symbol,
      fromTokenAddress: token.address === 'native' ? '0x0000000000000000000000000000000000000000' : token.address,
      fromTokenDecimals: token.decimals,
      fromAmount: amount,
      toAddress,
      estimatedGasUsd: 0.04,
    },
  } satisfies AgentActionCard
}

type SendChainName = 'Base' | 'Ethereum' | 'BNB Chain'
type OnrampChainName = SendChainName

function getSendChainId(chainName: SendChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

function getOnrampChainId(chainName: OnrampChainName) {
  return getSendChainId(chainName)
}

function getOnrampAssetOptions(chainName: OnrampChainName) {
  if (chainName === 'Ethereum') return ['ETH', 'USDC']
  if (chainName === 'BNB Chain') return ['BNB', 'USDT', 'USDC']
  return ['ETH', 'USDC']
}

function getOnrampStatusCopy(attempt: OnrampAttempt) {
  if (attempt.status === 'completed') {
    return `Funds were marked as received in ${attempt.asset} on ${getChainName(attempt.chainId)}.`
  }
  if (attempt.status === 'opening') {
    return attempt.method === 'bank_transfer'
      ? 'Virtual account is being prepared for NGN transfer instructions.'
      : 'Hosted checkout is opening. Complete payment and verification in the provider tab.'
  }
  if (attempt.method === 'bank_transfer') {
    return `Awaiting NGN bank transfer${attempt.accountNumber ? ` to ${attempt.accountNumber}` : ''} for cNGN funding.`
  }
  return 'Checkout was opened. Funds are still expected from provider settlement or final payment processing.'
}

function getChainName(chainId: number) {
  return chainMeta[chainId]?.name ?? `Chain ${chainId}`
}

function formatCompactFiat(amount: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount)
}

async function buildDirectSwapPreviewCard(input: {
  tokens: TokenBalance[]
  symbolIn: string
  symbolOut: string
  amount: string
  chainName: SwapChainName
  fromAddress: string | null
}) {
  const amount = input.amount.trim()
  if (!input.fromAddress) {
    return new Error('A linked wallet is required before previewing a swap.')
  }
  if (!amount || Number.parseFloat(amount) <= 0) {
    return new Error('Enter a valid amount before previewing the swap.')
  }
  if (input.symbolIn === input.symbolOut) {
    return new Error('Choose different assets for the swap preview.')
  }

  const chainId = getSwapChainId(input.chainName)
  const fromToken = resolveSwapTokenConfig(input.tokens, input.symbolIn, chainId)
  if (!fromToken) {
    return new Error(`${input.symbolIn} is not available on ${input.chainName} for this wallet.`)
  }

  const toToken = resolveSwapTokenConfig(input.tokens, input.symbolOut, chainId)
  if (!toToken) {
    return new Error(`${input.symbolOut} is not supported on ${input.chainName} yet.`)
  }

  try {
    const quote = await getSwapQuote({
      fromChainId: chainId,
      toChainId: chainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      fromAmount: toRawAmount(amount, fromToken.decimals),
      fromAddress: input.fromAddress,
      slippage: 0.005,
    })

    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const rate = computeSwapRate(fromAmount, toAmount)
    const route = quote.toolDetails?.name
      ? `${quote.toolDetails.name} · ${input.chainName}`
      : input.chainName

    return {
      type: 'swap',
      title: 'Swap Preview',
      status: 'pending',
      rows: [
        { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
        { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
        { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Route', value: route },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      metadata: {
        kind: 'swap',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId: chainId,
        toChainId: chainId,
        fromTokenSymbol: quote.action.fromToken.symbol,
        toTokenSymbol: quote.action.toToken.symbol,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromTokenDecimals: quote.action.fromToken.decimals,
        toTokenDecimals: quote.action.toToken.decimals,
        fromAmount: quote.action.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
        estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
        steps: quote.includedSteps?.length,
      },
    } satisfies AgentActionCard
  } catch (error) {
    return new Error(error instanceof Error ? error.message : 'Swap quote failed.')
  }
}

type SwapChainName = 'Base' | 'Ethereum' | 'BNB Chain'

function getSwapChainId(chainName: SwapChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

async function buildDirectBridgePreviewCard(input: {
  tokens: TokenBalance[]
  symbol: string
  amount: string
  fromChainName: BridgeChainName
  toChainName: BridgeChainName
  fromAddress: string | null
}) {
  const amount = input.amount.trim()
  if (!input.fromAddress) {
    return new Error('A linked wallet is required before previewing a bridge.')
  }
  if (!amount || Number.parseFloat(amount) <= 0) {
    return new Error('Enter a valid amount before previewing the bridge.')
  }
  if (input.fromChainName === input.toChainName) {
    return new Error('Choose different source and destination chains for the bridge preview.')
  }

  const fromChainId = getBridgeChainId(input.fromChainName)
  const toChainId = getBridgeChainId(input.toChainName)
  const fromToken = resolveSwapTokenConfig(input.tokens, input.symbol, fromChainId)
  const toToken = resolveSwapTokenConfig(input.tokens, input.symbol, toChainId)

  if (!fromToken) {
    return new Error(`${input.symbol} is not available on ${input.fromChainName} for this wallet.`)
  }
  if (!toToken) {
    return new Error(`${input.symbol} is not supported on ${input.toChainName} yet.`)
  }

  try {
    const quote = await getSwapQuote({
      fromChainId,
      toChainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      fromAmount: toRawAmount(amount, fromToken.decimals),
      fromAddress: input.fromAddress,
      slippage: 0.005,
    })

    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const protocol = quote.toolDetails?.name ?? 'Bridge route'
    const route = quote.includedSteps?.length
      ? `${quote.includedSteps.length} step${quote.includedSteps.length === 1 ? '' : 's'}`
      : 'Live route'

    return {
      type: 'bridge',
      title: 'Bridge Preview',
      status: 'pending',
      rows: [
        { label: 'From', value: `${fromAmount} ${quote.action.fromToken.symbol} on ${input.fromChainName}` },
        { label: 'To', value: `~${toAmount} ${quote.action.toToken.symbol} on ${input.toChainName}`, highlight: true },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Protocol', value: protocol },
        { label: 'Route', value: route },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      metadata: {
        kind: 'bridge',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId,
        toChainId,
        fromTokenSymbol: quote.action.fromToken.symbol,
        toTokenSymbol: quote.action.toToken.symbol,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromTokenDecimals: quote.action.fromToken.decimals,
        toTokenDecimals: quote.action.toToken.decimals,
        fromAmount: quote.action.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
        estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
        steps: quote.includedSteps?.length,
      },
    } satisfies AgentActionCard
  } catch (error) {
    return new Error(error instanceof Error ? error.message : 'Bridge quote failed.')
  }
}

type BridgeChainName = 'Base' | 'Ethereum' | 'BNB Chain'

function getBridgeChainId(chainName: BridgeChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

function resolveSwapTokenConfig(tokens: TokenBalance[], symbol: string, chainId: number) {
  const walletToken = tokens.find((token) => token.symbol === symbol && token.chainId === chainId)
  if (walletToken) {
    return {
      address: walletToken.address === 'native' ? '0x0000000000000000000000000000000000000000' : walletToken.address,
      decimals: walletToken.decimals,
    }
  }

  return getKnownTokenConfig(symbol, chainId)
}

function getKnownTokenConfig(symbol: string, chainId: number) {
  const normalized = symbol.toUpperCase()
  const knownTokens: Record<string, { decimals: number; addresses: Partial<Record<1 | 56 | 8453, string>> }> = {
    ETH: {
      decimals: 18,
      addresses: {
        1: '0x0000000000000000000000000000000000000000',
        8453: '0x0000000000000000000000000000000000000000',
      },
    },
    BNB: {
      decimals: 18,
      addresses: {
        56: '0x0000000000000000000000000000000000000000',
      },
    },
    WETH: {
      decimals: 18,
      addresses: {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        8453: '0x4200000000000000000000000000000000000006',
      },
    },
    WBNB: {
      decimals: 18,
      addresses: {
        56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      },
    },
    USDC: {
      decimals: 6,
      addresses: {
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      },
    },
    USDT: {
      decimals: 6,
      addresses: {
        1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        56: '0x55d398326f99059fF775485246999027B3197955',
      },
    },
    DAI: {
      decimals: 18,
      addresses: {
        1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      },
    },
  }

  const config = knownTokens[normalized]
  const address = config?.addresses[chainId as 1 | 56 | 8453]
  if (!config || !address) return null
  return { address, decimals: config.decimals }
}

function toRawAmount(amount: string, decimals: number) {
  const [wholePart, fractionPart = ''] = amount.trim().split('.')
  const normalizedWhole = wholePart === '' ? '0' : wholePart
  const normalizedFraction = fractionPart.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0')
  const raw = `${normalizedWhole}${normalizedFraction}`.replace(/^0+(?=\d)/, '')
  return raw || '0'
}

function formatTokenAmount(value: string | undefined | null, decimals: number, precision = 6) {
  if (!value) return '0'
  const bigintValue = BigInt(value)
  const padded = bigintValue.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}

function formatUsdValue(value: number | null) {
  if (!value || !Number.isFinite(value)) return 'Unavailable'
  if (value < 0.01) return '<$0.01'
  return `$${value.toFixed(2)}`
}

function computeSwapRate(fromAmount: string, toAmount: string) {
  const from = Number.parseFloat(fromAmount)
  const to = Number.parseFloat(toAmount)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  return (to / from).toFixed(6)
}

interface Brief {
  summary: string
  totalProfitUsd: string
  actionsCount: number
  errorsCount: number
  events: { type: string; description: string; timeAgo: string; profitUsd: string | null }[]
}

function MissingWalletState() {
  return (
    <div className="min-h-screen bg-earth text-cream">
      <KenteStrip height={4} />
      <div className="max-w-xl mx-auto px-6 py-16">
        <Card kente>
          <div className="p-6">
            <div className="text-[11px] tracking-[0.2em] uppercase text-muted font-bold mb-3">Wallet Required</div>
            <h1 className="text-3xl font-display font-black mb-3">No wallet linked yet.</h1>
            <p className="text-sm text-muted leading-6 mb-6">
              Your account is authenticated, but there is no linked wallet address. Connect one to start using the dashboard and agent actions.
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/onboard"
                className="flex items-center justify-center gap-2 bg-gold text-earth font-bold text-sm uppercase tracking-wider px-5 py-3 hover:bg-gold2 transition-colors"
              >
                <span>→</span> Set up wallet
              </Link>
              <Link
                href="/dashboard/chat"
                className="flex items-center justify-center gap-2 border border-border text-text2 font-bold text-sm uppercase tracking-wider px-5 py-3 hover:border-border2 transition-colors"
              >
                Open agent chat
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

function BriefModal({ brief, onDismiss }: { brief: Brief; onDismiss: () => void }) {
  const events = Array.isArray(brief.events) ? brief.events : []

  return (
    <div className="min-h-screen bg-earth/97 flex items-start justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-sm bg-soil border border-border overflow-hidden mt-4">
        <KenteStrip height={4} />

        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <LiveDot />
            <span className="text-[10px] font-bold text-green tracking-[0.2em] uppercase">Agent Online · Base & ETH</span>
          </div>
          <div className="font-display font-black text-2xl">
            Good morning, <span className="text-gold2">Shehu.</span>
          </div>
          <div className="text-[12px] text-muted mt-1">While you were away — last 14 hours.</div>
        </div>

        {/* Summary */}
        <div className="p-5">
          <div className="bg-gold/7 border border-gold/18 border-l-4 border-l-gold px-4 py-3 mb-5 text-[12px] text-text2 leading-relaxed">
            {brief.summary}
          </div>

          {/* Events */}
          <div className="flex flex-col gap-2">
            {events.length ? (
              events.map((ev, i) => (
                <div key={i} className="flex gap-3 items-start bg-clay border border-border p-3">
                  <div className={`w-7 h-7 flex items-center justify-center text-sm flex-shrink-0 border border-border/50 ${
                    ev.type === 'arb' ? 'bg-kola/15' : ev.type === 'yield' ? 'bg-gold/12' : 'bg-teal/10'
                  }`}>
                    {ev.type === 'arb' ? '⚡' : ev.type === 'yield' ? '🌾' : ev.type === 'rebalance' ? '⚖️' : '🏗️'}
                  </div>
                  <div className="flex-1">
                    <div className="text-[12px] text-cream">{ev.description}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] text-muted font-mono">{ev.timeAgo}</span>
                      {ev.profitUsd && <span className="text-[10px] font-bold text-green font-mono">{ev.profitUsd}</span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-clay border border-border p-3 text-[12px] text-muted">
                No recent agent events yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-border bg-earth">
          <div className="flex gap-6">
            {[
              { num: brief.totalProfitUsd, lbl: 'Gained' },
              { num: String(brief.actionsCount), lbl: 'Actions' },
              { num: String(brief.errorsCount), lbl: 'Errors' },
            ].map(s => (
              <div key={s.lbl}>
                <div className={`font-display font-bold text-xl ${s.lbl === 'Errors' ? 'text-green' : 'text-gold2'}`}>{s.num}</div>
                <div className="text-[11px] text-muted tracking-wider uppercase mt-0.5">{s.lbl}</div>
              </div>
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="bg-gold text-earth font-bold text-[12px] uppercase tracking-wide px-5 py-2.5 hover:bg-gold2 transition-colors"
          >
            Enter →
          </button>
        </div>
      </div>
    </div>
  )
}

function PortfolioHero({
  walletAddress,
  identityToken,
  totalUsd,
  chains,
  activeChainCount,
  tokenCount,
  nftCount,
  isRefreshing,
  onOpenFund,
  onOpenSheet,
  onRefresh,
}: {
  walletAddress: string | null
  identityToken: string | null
  totalUsd: string
  chains: WalletChainSummary[]
  activeChainCount: number
  tokenCount: number
  nftCount: number
  isRefreshing: boolean
  onOpenFund: () => void
  onOpenSheet: (sheet: 'send' | 'receive' | 'swap' | 'bridge') => void
  onRefresh: () => void | Promise<void>
}) {
  const [pendingAction, setPendingAction] = useState<'fund' | 'send' | 'receive' | 'swap' | 'bridge' | null>(null)
  const chainBreakdown = chains.filter((chain) => parseUsdAmount(chain.totalUsd) > 0)
  const totalValue = Math.max(parseUsdAmount(totalUsd), 0.01)
  const summaryChains = [...chains]
    .sort((left, right) => parseUsdAmount(right.totalUsd) - parseUsdAmount(left.totalUsd))
    .slice(0, 2)
  return (
    <Card kente className="shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold tracking-[0.2em] text-muted uppercase">Total Portfolio Value</div>
          <button
            onClick={() => { void onRefresh() }}
            disabled={isRefreshing}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-clay text-text2 transition-colors hover:border-border2 disabled:opacity-60"
            title="Refresh balances"
            aria-label="Refresh balances"
          >
            <span className={isRefreshing ? 'animate-spin' : ''}>↻</span>
          </button>
        </div>
        <div className="font-display font-black text-[2.8rem] leading-none md:text-[3.15rem] xl:text-[3.5rem]">
          <span className="text-gold2">$</span>
          {totalUsd.replace('$','').split('.')[0]}
          <span className="text-2xl text-muted font-bold">.{totalUsd.split('.')[1] ?? '00'}</span>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
            <span className="bg-clay border border-border text-text2 text-[10px] font-bold font-mono px-2.5 py-1">
            {activeChainCount} active {activeChainCount === 1 ? 'chain' : 'chains'}
          </span>
          <span className="text-[10px] text-muted">{tokenCount} tokens · {nftCount} NFTs</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-t border-border">
        {[
          ...summaryChains.map((chain) => ({
            label: chainMeta[chain.chainId]?.name ?? `Chain ${chain.chainId}`,
            value: chain.totalUsd,
            color: chainMeta[chain.chainId]?.color ?? colors.gold2,
            chainId: chain.chainId,
          })),
          { label: 'Assets',    value: String(tokenCount + nftCount),   color: colors.gold2       },
        ].slice(0, 3).map((s, i) => (
          <div key={s.label} className={`flex-1 p-3 ${i < 2 ? 'border-r border-border' : ''}`}>
            <div className="flex items-center gap-2">
              {'chainId' in s && s.chainId ? <ChainLogo chainId={s.chainId} size={16} /> : null}
              <div className="font-display font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            </div>
            <div className="text-[11px] text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2 p-3 border-t border-border sm:grid-cols-5">
        {[
          { label: 'Fund',    icon: '₦', sheet: 'fund'    as const, color: colors.green  },
          { label: 'Send',    icon: '↑', sheet: 'send'    as const, color: colors.kola   },
          { label: 'Receive', icon: '↓', sheet: 'receive' as const, color: colors.green  },
          { label: 'Swap',    icon: '⇄', sheet: 'swap'    as const, color: colors.gold   },
          { label: 'Bridge',  icon: '⛓', sheet: 'bridge'  as const, color: colors.teal   },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => {
              setPendingAction(a.sheet)
              if (a.sheet === 'fund') {
                onOpenFund()
                window.setTimeout(() => setPendingAction(null), 300)
                return
              }
              onOpenSheet(a.sheet)
              window.setTimeout(() => setPendingAction(null), 300)
            }}
            disabled={a.sheet === 'fund' ? !walletAddress || !identityToken : false}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 bg-clay2 border border-border hover:border-border2 transition-colors disabled:opacity-60"
            style={{ borderTopWidth: 2, borderTopColor: a.color }}
          >
            <span className="text-base">{a.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text2">
              {pendingAction === a.sheet ? 'Opening…' : a.label}
            </span>
          </button>
        ))}
      </div>

      {/* Chain bar */}
      <div className="flex h-1">
        {chainBreakdown.length ? chainBreakdown.map((chain) => (
          <div
            key={chain.chainId}
            className="flex-1"
            style={{
              flex: parseUsdAmount(chain.totalUsd) / totalValue,
              background: chainMeta[chain.chainId]?.color ?? colors.chains.base,
            }}
          />
        )) : (
          <div className="flex-1 bg-clay" />
        )}
      </div>
    </Card>
  )
}

function FundWalletSheet({
  walletAddress,
  identityToken,
  onClose,
}: {
  walletAddress: string | null
  identityToken: string | null
  onClose: () => void
}) {
  const addOnrampAttempt = useWalletStore((state) => state.addOnrampAttempt)
  const updateOnrampAttempt = useWalletStore((state) => state.updateOnrampAttempt)
  const [method, setMethod] = useState<'bank_transfer' | 'hosted'>('bank_transfer')
  const [chain, setChain] = useState<OnrampChainName>('Base')
  const [asset, setAsset] = useState('USDC')
  const [fiatCurrency, setFiatCurrency] = useState<'NGN' | 'USD'>('NGN')
  const [fiatAmount, setFiatAmount] = useState('50000')
  const [bankTransferDetails, setBankTransferDetails] = useState<{
    accountNumber: string
    accountReference: string
    bankName?: string | null
    accountName?: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOpening, setIsOpening] = useState(false)
  const assetOptions = getOnrampAssetOptions(chain)

  useEffect(() => {
    if (!assetOptions.includes(asset)) {
      setAsset(assetOptions[0] ?? 'USDC')
    }
  }, [asset, assetOptions])

  useEffect(() => {
    if (method === 'bank_transfer') {
      setAsset('CNGN')
      setFiatCurrency('NGN')
      return
    }
    if (asset === 'CNGN') {
      setAsset(assetOptions[0] ?? 'USDC')
    }
  }, [asset, assetOptions, method])

  async function handleOpenOnramp() {
    if (!walletAddress || !identityToken) {
      setError('A synced wallet session is required before funding can start.')
      return
    }

    const amount = Number(fiatAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid fiat amount to continue.')
      return
    }

    setIsOpening(true)
    setError(null)
    setBankTransferDetails(null)

    try {
      const chainId = getOnrampChainId(chain)
      const attemptId = `onramp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      if (method === 'bank_transfer') {
        const res = await fetch(`${API_URL}/api/cngn/virtual-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${identityToken}`,
          },
          body: JSON.stringify({
            walletAddress,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(typeof data?.error === 'string' ? data.error : `cNGN funding request failed with status ${res.status}`)
        }

        track('onramp_started', {
          walletAddress,
          chainId,
          asset: 'CNGN',
          fiatCurrency: 'NGN',
          fiatAmount: amount,
          provider: data.provider ?? 'cngn',
        })

        setBankTransferDetails(data.account)
        addOnrampAttempt({
          id: attemptId,
          provider: data.provider ?? 'cngn',
          walletAddress,
          chainId,
          asset: 'CNGN',
          fiatCurrency: 'NGN',
          fiatAmount: amount,
          status: 'awaiting_settlement',
          method: 'bank_transfer',
          accountReference: data.account?.accountReference ?? null,
          accountNumber: data.account?.accountNumber ?? null,
          bankName: data.account?.bankName ?? null,
          accountName: data.account?.accountName ?? null,
          createdAt: Date.now(),
        })
        return
      }

      const res = await fetch(`${API_URL}/api/onramp/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${identityToken}`,
        },
        body: JSON.stringify({
          walletAddress,
          chainId,
          asset,
          fiatCurrency,
          fiatAmount: amount,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `On-ramp request failed with status ${res.status}`)
      }

      track('onramp_started', {
        walletAddress,
        chainId,
        asset,
        fiatCurrency,
        fiatAmount: amount,
        provider: data.provider ?? 'transak',
      })

      addOnrampAttempt({
        id: attemptId,
        provider: data.provider ?? 'transak',
        walletAddress,
        chainId,
        asset,
        fiatCurrency,
        fiatAmount: amount,
        status: 'opening',
        method: 'hosted',
        widgetUrl: data.widgetUrl,
        createdAt: Date.now(),
      })

      const nextWindow = window.open(data.widgetUrl, '_blank', 'noopener')
      if (!nextWindow) {
        window.location.href = data.widgetUrl
      }
      updateOnrampAttempt(attemptId, { status: 'awaiting_settlement' })
      onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to open on-ramp right now.')
    } finally {
      setIsOpening(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Close fund wallet sheet"
        className="absolute inset-0 bg-earth/70"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md border border-border bg-soil shadow-2xl max-h-[85dvh] flex flex-col">
        <KenteStrip height={4} />
        <div className="flex items-start justify-between gap-4 border-b border-border p-4 flex-shrink-0">
          <div>
            <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-muted">Fund Wallet</div>
            <div className="mt-1 font-display text-xl font-black text-green">Buy crypto with fiat</div>
            <div className="mt-2 text-sm leading-6 text-muted">
              Use Nigerian bank transfer for local users, or fall back to hosted checkout for card and global flows.
            </div>
          </div>
          <button onClick={onClose} className="border border-border px-3 py-1.5 text-xs text-muted hover:border-border2 hover:text-cream">
            Close
          </button>
        </div>
        <div className="space-y-4 p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMethod('bank_transfer')}
              className={`border px-3 py-3 text-left ${method === 'bank_transfer' ? 'border-green bg-green/10 text-cream' : 'border-border bg-clay/40 text-text2'}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]">Bank Transfer</div>
              <div className="mt-1 text-[11px] text-muted">Nigeria-first funding with cNGN virtual account.</div>
            </button>
            <button
              onClick={() => setMethod('hosted')}
              className={`border px-3 py-3 text-left ${method === 'hosted' ? 'border-gold bg-gold/10 text-cream' : 'border-border bg-clay/40 text-text2'}`}
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.16em]">Card / Global</div>
              <div className="mt-1 text-[11px] text-muted">Hosted Transak checkout for broader payment options.</div>
            </button>
          </div>
          {method === 'bank_transfer' ? (
            <div className="border border-green/25 bg-green/5 p-3 text-[11px] leading-5 text-text2">
              Bank transfer creates a dedicated virtual account for funding cNGN. After payment, you can mark the funding as received from the dashboard history.
            </div>
          ) : null}
          <QuickField
            label="Destination chain"
            control={(
              <select value={chain} onChange={(event) => setChain(event.target.value as OnrampChainName)} className={quickInputClassName}>
                <option>Base</option>
                <option>Ethereum</option>
                <option>BNB Chain</option>
              </select>
            )}
          />
          <QuickField
            label="Asset"
            control={(
              <select value={asset} onChange={(event) => setAsset(event.target.value)} className={quickInputClassName}>
                {(method === 'bank_transfer' ? ['CNGN'] : assetOptions).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}
          />
          <div className="grid grid-cols-[1fr_1.25fr] gap-3">
            <QuickField
              label="Fiat"
              control={method === 'bank_transfer' ? (
                <div className={`${quickInputClassName} flex items-center bg-clay/30`}>NGN</div>
              ) : (
                <select value={fiatCurrency} onChange={(event) => setFiatCurrency(event.target.value as 'NGN' | 'USD')} className={quickInputClassName}>
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </select>
              )}
            />
            <QuickField
              label="Amount"
              control={(
                <input
                  value={fiatAmount}
                  onChange={(event) => setFiatAmount(event.target.value)}
                  placeholder={method === 'bank_transfer' || fiatCurrency === 'NGN' ? '50000' : '100'}
                  className={quickInputClassName}
                />
              )}
            />
          </div>
          <div className="border border-border bg-clay/50 p-3 text-[11px] leading-5 text-text2">
            <div className="font-bold uppercase tracking-[0.16em] text-muted">Funding target</div>
            <div className="mt-1">{asset} on {chain}</div>
            <div className="font-mono break-all text-[10px] text-muted">{walletAddress ?? 'No wallet linked yet.'}</div>
          </div>
          {error ? (
            <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">
              {error}
            </div>
          ) : null}
          {bankTransferDetails ? (
            <div className="space-y-3 border border-green/30 bg-green/10 p-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-green">Virtual account ready</div>
                <div className="mt-1 text-[12px] text-text2">Transfer NGN to the account below to mint cNGN for this wallet.</div>
              </div>
              <FundingInstructionRow label="Bank" value={bankTransferDetails.bankName ?? 'KoraPay virtual account'} copyValue={bankTransferDetails.bankName ?? undefined} />
              <FundingInstructionRow label="Account number" value={bankTransferDetails.accountNumber} copyValue={bankTransferDetails.accountNumber} />
              <FundingInstructionRow label="Reference" value={bankTransferDetails.accountReference} copyValue={bankTransferDetails.accountReference} />
              {bankTransferDetails.accountName ? (
                <FundingInstructionRow label="Account name" value={bankTransferDetails.accountName} copyValue={bankTransferDetails.accountName} />
              ) : null}
            </div>
          ) : null}
          <button
            onClick={() => { void handleOpenOnramp() }}
            disabled={isOpening || !walletAddress || !identityToken}
            className="w-full bg-green px-4 py-3 text-xs font-bold uppercase tracking-wide text-earth disabled:opacity-60"
          >
            {isOpening ? (method === 'bank_transfer' ? 'Generating Account…' : 'Opening Checkout…') : (method === 'bank_transfer' ? 'Generate Virtual Account' : 'Continue with Transak')}
          </button>
          <div className="text-[11px] leading-5 text-muted">
            {method === 'bank_transfer'
              ? 'Bank transfer funding is Nigeria-focused and settles after provider processing. Keep your account reference for reconciliation.'
              : 'Hosted on-ramp checkout runs outside Amara and may require provider-specific KYC, payment approval, and settlement time.'}
          </div>
        </div>
      </div>
    </div>
  )
}

function OnrampHistoryPanel() {
  const attempts = useWalletStore((state) => state.onrampAttempts)
  const updateAttempt = useWalletStore((state) => state.updateOnrampAttempt)
  const removeAttempt = useWalletStore((state) => state.removeOnrampAttempt)
  const { identityToken } = useAuth()
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const visibleAttempts = attempts
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 4)

  if (!visibleAttempts.length) return null

  async function handleRefreshFundingStatus() {
    if (!identityToken) {
      setRefreshError('Authenticated session is required before funding status can be refreshed.')
      return
    }

    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const res = await fetch(`${API_URL}/api/cngn/transactions?page=1&limit=30`, {
        headers: {
          Authorization: `Bearer ${identityToken}`,
        },
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(typeof data?.error === 'string' ? data.error : `Status refresh failed with ${res.status}`)
      }

      const history = Array.isArray(data?.data) ? data.data : []
      let matchedCount = 0

      visibleAttempts.forEach((attempt) => {
        if (attempt.provider !== 'cngn') return
        const match = history.find((entry: Record<string, unknown>) => (
          typeof entry?.trx_ref === 'string' &&
          attempt.accountReference &&
          entry.trx_ref === attempt.accountReference
        ) || (
          typeof entry?.receiver === 'object' &&
          entry.receiver &&
          typeof (entry.receiver as { accountNumber?: unknown }).accountNumber === 'string' &&
          attempt.accountNumber &&
          (entry.receiver as { accountNumber: string }).accountNumber === attempt.accountNumber
        ))

        if (!match) return
        matchedCount += 1
        const nextStatus = typeof match.status === 'string' && match.status.toLowerCase().includes('completed')
          ? 'completed'
          : 'awaiting_settlement'
        updateAttempt(attempt.id, { status: nextStatus })
      })

      track('onramp_status_refreshed', {
        provider: 'cngn',
        attemptCount: visibleAttempts.length,
        matchedCount,
      })
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Unable to refresh funding status right now.')
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Card>
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Funding Activity</div>
            <div className="mt-1 text-sm text-text2">Recent bank-transfer and hosted funding attempts with their current wallet-side status.</div>
          </div>
          <button
            onClick={() => { void handleRefreshFundingStatus() }}
            disabled={isRefreshing || !attempts.some((attempt) => attempt.provider === 'cngn')}
            className="border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text2 disabled:opacity-60"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh status'}
          </button>
        </div>
        {refreshError ? (
          <div className="mt-3 border border-kola/30 bg-kola/10 px-3 py-2 text-[11px] text-text2">
            {refreshError}
          </div>
        ) : null}
      </div>
      <div className="divide-y divide-border">
        {visibleAttempts.map((attempt) => (
          <div key={attempt.id} className="flex flex-col gap-3 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ChainLogo chainId={attempt.chainId} size={16} />
                <div className="text-sm font-bold text-cream">
                  {attempt.fiatCurrency} {formatCompactFiat(attempt.fiatAmount)} → {attempt.asset}
                </div>
                <StatusPill status={attempt.status} />
              </div>
              <div className="mt-1 text-[12px] text-text2">
                {getChainName(attempt.chainId)} · {attempt.provider} · {formatRelativeSync(attempt.createdAt)}
              </div>
              <div className="mt-1 text-[11px] leading-5 text-muted">
                {getOnrampStatusCopy(attempt)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {attempt.status !== 'completed' ? (
                <button
                  onClick={() => updateAttempt(attempt.id, { status: 'completed' })}
                  className="border border-green/30 bg-green/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-green"
                >
                  Mark Received
                </button>
              ) : null}
              {attempt.widgetUrl ? (
                <a
                  href={attempt.widgetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text2 hover:border-border2"
                >
                  Reopen Checkout
                </a>
              ) : null}
              <button
                onClick={() => removeAttempt(attempt.id)}
                className="border border-border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted hover:border-border2 hover:text-cream"
              >
                Hide
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function StatusPill({ status }: { status: OnrampAttempt['status'] }) {
  const theme = status === 'completed'
    ? 'border-green/30 bg-green/10 text-green'
    : status === 'opening'
      ? 'border-gold/30 bg-gold/10 text-gold2'
      : 'border-teal/30 bg-teal/10 text-teal'

  return (
    <span className={`border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${theme}`}>
      {status === 'awaiting_settlement' ? 'Awaiting' : status}
    </span>
  )
}

function FundingInstructionRow({
  label,
  value,
  copyValue,
}: {
  label: string
  value: string
  copyValue?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!copyValue) return
    await navigator.clipboard.writeText(copyValue)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="flex items-center justify-between gap-3 border border-green/15 bg-clay/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{label}</div>
        <div className="mt-1 break-all font-mono text-[12px] text-text2">{value}</div>
      </div>
      {copyValue ? (
        <button
          onClick={() => { void handleCopy() }}
          className="border border-border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-text2"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      ) : null}
    </div>
  )
}

const STRATEGY_CARDS = [
  { id: 'arb',    icon: '⚡', name: 'Arb Bot',   pnl: '+$847', sub: '23 runs · 30d',  accent: colors.kola,   status: 'On' },
  { id: 'yield',  icon: '🌾', name: 'Yield',      pnl: '+$312', sub: 'Aerodrome LP',   accent: colors.gold,   status: 'On' },
  { id: 'reb',    icon: '⚖️', name: 'Rebalance',  pnl: 'Range', sub: '±5% thresh',    accent: colors.teal,   status: 'Watch' },
  { id: 'brickt', icon: '🏗️', name: 'Brickt',     pnl: '+$64',  sub: 'Lagos · Abuja', accent: '#C8956A',     status: 'On' },
]

function StrategyCard({ id, icon, name, pnl, sub, accent, status }: typeof STRATEGY_CARDS[0]) {
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const isNeutral = id === 'reb'
  return (
    <button
      onClick={() => {
        startNavigation(() => {
          router.push(`/dashboard/strategy/${id}`)
        })
      }}
      disabled={isNavigating}
      className="flex-shrink-0 w-32 bg-soil border border-border text-left hover:border-border2 transition-all hover:-translate-y-0.5 relative overflow-hidden disabled:opacity-60 lg:w-auto lg:min-h-[152px]"
    >
      <div style={{ height: 2, background: accent }} />
      <div className="p-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[18px]">{icon}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 border tracking-wider uppercase"
            style={{ color: accent, borderColor: `${accent}40`, background: `${accent}15` }}
          >{status}</span>
        </div>
        <div className="text-[11px] font-bold text-muted uppercase tracking-wide mb-1.5">{isNavigating ? 'Opening…' : name}</div>
        <div
          className="font-display font-bold text-lg leading-none"
          style={{ color: isNeutral ? colors.muted : colors.green }}
        >{pnl}</div>
        <div className="text-[11px] text-muted mt-1 font-mono">{sub}</div>
      </div>
    </button>
  )
}

function ActivityTab({ transactions, isLoading, error }: { transactions: any[]; isLoading: boolean; error: string | null }) {
  const router = useRouter()
  if (isLoading) return <EmptyTabState message="Loading wallet activity…" />
  if (error && !transactions.length) return <EmptyTabState message={error} />
  if (!transactions.length) return <EmptyTabState message="No wallet activity yet." />
  return (
    <div>
      {transactions.map((item: any, i: number) => (
        <button
          key={i}
          onClick={() => router.push(`/dashboard/activity/${item.chainId}/${encodeURIComponent(item.hash)}`)}
          className="w-full flex gap-3 items-start px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-clay/30 transition-colors text-left"
        >
          <div className={`w-7 h-7 flex items-center justify-center text-xs flex-shrink-0 border ${
            item.type === 'send' ? 'bg-kola/15 border-kola/20' :
            item.type === 'receive' ? 'bg-green/10 border-green/20' :
            'bg-teal/10 border-teal/20'
          }`}>{item.type === 'send' ? '↑' : item.type === 'receive' ? '↓' : '⌘'}</div>
          <div className="flex-1">
            <div className="text-[12px] text-cream">{formatActivityLabel(item)}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted font-mono">
              <ChainLogo chainId={item.chainId} size={12} />
              <span>
              {item.hash ? `${item.hash.slice(0, 10)}…${item.hash.slice(-4)}` : 'Pending hash'}
              {' · '}
              {chainMeta[item.chainId]?.name ?? `Chain ${item.chainId}`}
              </span>
            </div>
            <div className="flex gap-2 mt-1 items-center">
              <div className={`w-1 h-1 rounded-full ${item.status === 'confirmed' ? 'bg-green' : 'bg-muted2'}`} />
              <span className="text-[10px] text-muted font-mono">{formatTime(item.timestamp)}</span>
              {item.valueUsd && <span className="text-[10px] font-bold text-green font-mono">{item.valueUsd}</span>}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function AssetsTab({
  tokens,
  selectedChain,
  availableChainIds,
}: {
  tokens: TokenBalance[]
  selectedChain: number | 'all'
  availableChainIds: number[]
}) {
  const router = useRouter()
  const [showHidden, setShowHidden] = useState(false)
  const scopeChainIds = selectedChain === 'all' ? availableChainIds : [selectedChain]
  const mergedAssets = buildAssetRows(tokens, scopeChainIds)
  const visibleAssets = mergedAssets.filter((asset) => showHidden || !asset.hidden)
  const hiddenCount = mergedAssets.filter((asset) => asset.hidden).length

  if (!mergedAssets.length) return <EmptyTabState message="No token balances found for this wallet yet." />

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
          {selectedChain === 'all'
            ? 'Verified assets across active chains'
            : `${chainMeta[selectedChain]?.name ?? 'Selected chain'} assets`}
        </div>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden((current) => !current)}
            className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold2 hover:text-gold"
          >
            {showHidden ? 'Hide low-value' : `Show hidden (${hiddenCount})`}
          </button>
        )}
      </div>
      {visibleAssets.map((a, i) => (
        <button
          key={`${a.chainId}:${a.address}:${i}`}
          onClick={() => router.push(`/dashboard/assets/${a.chainId}/${encodeURIComponent(a.address)}`)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-clay/30 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-3">
            <TokenLogo symbol={a.symbol} name={a.name} logoUrl={a.logoUrl} chainId={a.chainId} size={32} />
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-bold">{a.symbol}</div>
                {a.verified && <Badge variant="active">Verified</Badge>}
              </div>
              <div className="text-[10px] text-muted">{a.name}</div>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted bg-clay border border-border px-1.5 py-0.5 font-mono">
                <ChainLogo chainId={a.chainId} size={10} />
                {a.chain}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-bold font-mono text-text2">{a.value}</div>
            <div className="text-[11px] text-muted font-mono mt-0.5">{a.amount}</div>
          </div>
        </button>
      ))}
    </div>
  )
}

function NFTsTab({ nfts, isLoading, error }: { nfts: WalletNftSummary[]; isLoading: boolean; error: string | null }) {
  const router = useRouter()
  if (isLoading) return <EmptyTabState message="Loading NFT collection…" />
  if (error && !nfts.length) return <EmptyTabState message={error} />
  if (!nfts.length) return <EmptyTabState message="No NFTs found for this wallet yet." />

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {nfts.map((nft) => (
        <button
          key={`${nft.chain}:${nft.tokenId}:${nft.collection}`}
          onClick={() => router.push(`/dashboard/nfts/${encodeURIComponent(nft.chain)}/${encodeURIComponent(nft.tokenId)}`)}
          className="overflow-hidden border border-border bg-clay/30 text-left hover:border-border2 transition-colors"
        >
          <div className="aspect-square bg-clay border-b border-border flex items-center justify-center overflow-hidden">
            <NftArtwork nft={nft} />
          </div>
          <div className="p-3">
            <div className="text-[11px] font-bold text-text2 truncate">{nft.name ?? `#${nft.tokenId}`}</div>
            <div className="text-[10px] text-muted truncate mt-1">{nft.collection}</div>
            <div className="mt-2">
              <Badge variant="chain" color={getNftChainColor(nft.chain)}>
                {nft.chain}
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return <div className="p-6 text-sm text-muted leading-6">{message}</div>
}

function WalletPanel({
  activeTab,
  onTabChange,
  transactions,
  tokens,
  nfts,
  chains,
  isLoading,
  error,
}: {
  activeTab: 'activity' | 'assets' | 'nfts'
  onTabChange: (tab: 'activity' | 'assets' | 'nfts') => void
  transactions: any[]
  tokens: TokenBalance[]
  nfts: WalletNftSummary[]
  chains: WalletChainSummary[]
  isLoading: boolean
  error: string | null
}) {
  const [selectedChain, setSelectedChain] = useState<number | 'all'>('all')
  const availableChainIds = chains
    .map((chain) => chain.chainId)
    .filter((chainId, index, list) => list.indexOf(chainId) === index)
    .sort((left, right) => {
      if (left === 8453) return -1
      if (right === 8453) return 1
      if (left === 1) return -1
      if (right === 1) return 1
      return left - right
    })

  const filteredTransactions = selectedChain === 'all'
    ? transactions
    : transactions.filter((item) => item.chainId === selectedChain)

  const filteredTokens = selectedChain === 'all'
    ? tokens
    : tokens.filter((token) => token.chainId === selectedChain)

  const filteredNfts = selectedChain === 'all'
    ? nfts
    : nfts.filter((nft) => getChainIdFromNftChain(nft.chain) === selectedChain)

  return (
    <section>
      <div className="text-[11px] font-bold tracking-[0.2em] text-muted uppercase mb-3">Wallet</div>
      <Card kente>
        <div className="sticky top-0 z-10 flex bg-clay border-b border-border">
          {(['assets', 'activity', 'nfts'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`flex-1 py-2.5 text-[11px] font-bold tracking-wider uppercase border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-gold2 border-gold2'
                  : 'text-muted border-transparent hover:text-text2'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="sticky top-[41px] z-[9] flex flex-wrap gap-2 border-b border-border bg-soil/95 px-3 py-2 backdrop-blur">
          <button
            onClick={() => setSelectedChain('all')}
            className={`border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
              selectedChain === 'all'
                ? 'border-gold/40 bg-gold/10 text-gold2'
                : 'border-border bg-clay text-text2 hover:border-border2'
            }`}
          >
            All
          </button>
          {availableChainIds.map((chainId) => (
            <button
              key={chainId}
              onClick={() => setSelectedChain(chainId)}
              className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
                selectedChain === chainId
                  ? 'border-gold/40 bg-gold/10 text-gold2'
                  : 'border-border bg-clay text-text2 hover:border-border2'
              }`}
            >
              <ChainLogo chainId={chainId} size={12} />
              {chainMeta[chainId]?.shortName ?? chainId}
            </button>
          ))}
        </div>

        <div className="min-h-[200px] max-h-[26rem] overflow-y-auto overscroll-contain md:max-h-[34rem] xl:max-h-[44rem]">
          {activeTab === 'activity' && <ActivityTab transactions={filteredTransactions} isLoading={isLoading} error={error} />}
          {activeTab === 'assets'   && <AssetsTab tokens={filteredTokens} selectedChain={selectedChain} availableChainIds={availableChainIds} />}
          {activeTab === 'nfts'     && <NFTsTab nfts={filteredNfts} isLoading={isLoading} error={error} />}
        </div>
      </Card>
    </section>
  )
}

function formatTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRelativeSync(timestamp: number) {
  const diffMs = Date.now() - timestamp
  const minutes = Math.max(0, Math.floor(diffMs / (1000 * 60)))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function ProfileMenu({
  emailAddress,
  walletAddress,
  totalUsd,
  isLoggingOut,
  onLogout,
  onClose,
}: {
  emailAddress: string | null
  walletAddress: string | null
  totalUsd: string
  isLoggingOut: boolean
  onLogout: () => void | Promise<void>
  onClose: () => void
}) {
  return (
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[280px] border border-border bg-soil shadow-[0_24px_50px_rgba(0,0,0,0.28)]">
      <div className="border-b border-border p-4">
        <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted">Operator</div>
        <div className="mt-2 text-sm font-semibold text-text2 break-all">{emailAddress ?? 'Signed-in user'}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="border border-border bg-clay px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-bold">Portfolio</div>
            <div className="mt-1 font-mono text-text2">{totalUsd}</div>
          </div>
          <div className="border border-border bg-clay px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-bold">Wallet</div>
            <div className="mt-1 font-mono text-text2">{walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Unavailable'}</div>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2">
        <button
          onClick={onClose}
          className="w-full border border-border bg-clay px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-text2 hover:border-border2"
        >
          Close Menu
        </button>
        <button
          onClick={onLogout}
          disabled={isLoggingOut}
          className="w-full border border-kola/30 bg-kola/10 px-3 py-3 text-left text-xs font-bold uppercase tracking-[0.16em] text-kola hover:bg-kola/20 disabled:opacity-60"
        >
          {isLoggingOut ? 'Logging Out…' : 'Log Out'}
        </button>
      </div>
    </div>
  )
}

function parseUsdAmount(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

const VERIFIED_ASSETS: Record<number, Array<{
  address: `0x${string}` | 'native'
  symbol: string
  name: string
  decimals: number
  logoUrl?: string
}>> = {
  8453: [
    { address: 'native', symbol: 'ETH', name: 'Ether', decimals: 18 },
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  ],
  1: [
    { address: 'native', symbol: 'ETH', name: 'Ether', decimals: 18 },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  ],
  56: [
    { address: 'native', symbol: 'BNB', name: 'BNB', decimals: 18 },
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
  ],
}

function buildAssetRows(tokens: TokenBalance[], chainIds: number[]) {
  const rows = new Map<string, {
    address: `0x${string}` | 'native'
    chainId: number
    symbol: string
    logoUrl?: string
    amount: string
    value: string
    name: string
    chain: string
    color: string
    verified: boolean
    hidden: boolean
  }>()

  for (const token of tokens) {
    const key = `${token.chainId}:${normalizeAssetAddress(token.address)}`
    rows.set(key, {
      address: token.address,
      chainId: token.chainId,
      symbol: token.symbol,
      logoUrl: token.logoUrl,
      amount: token.balanceFormatted,
      value: token.balanceUsd,
      name: token.name,
      chain: chainMeta[token.chainId]?.shortName ?? `CHAIN ${token.chainId}`,
      color: chainMeta[token.chainId]?.color ?? colors.chains.base,
      verified: isVerifiedAsset(token.chainId, token.address),
      hidden: !isVerifiedAsset(token.chainId, token.address) && parseUsdAmount(token.balanceUsd) <= 0,
    })
  }

  for (const chainId of chainIds) {
    for (const asset of VERIFIED_ASSETS[chainId] ?? []) {
      const key = `${chainId}:${normalizeAssetAddress(asset.address)}`
      if (rows.has(key)) {
        const existing = rows.get(key)!
        rows.set(key, { ...existing, verified: true, hidden: false })
        continue
      }
      rows.set(key, {
        address: asset.address,
        chainId,
        symbol: asset.symbol,
        logoUrl: asset.logoUrl,
        amount: '0',
        value: '$0.00',
        name: asset.name,
        chain: chainMeta[chainId]?.shortName ?? `CHAIN ${chainId}`,
        color: chainMeta[chainId]?.color ?? colors.chains.base,
        verified: true,
        hidden: false,
      })
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    const usdDiff = parseUsdAmount(right.value) - parseUsdAmount(left.value)
    if (usdDiff !== 0) return usdDiff
    if (left.verified !== right.verified) return left.verified ? -1 : 1
    return left.symbol.localeCompare(right.symbol)
  })
}

function isVerifiedAsset(chainId: number, address: `0x${string}` | 'native') {
  return (VERIFIED_ASSETS[chainId] ?? []).some((asset) => normalizeAssetAddress(asset.address) === normalizeAssetAddress(address))
}

function normalizeAssetAddress(address: `0x${string}` | 'native') {
  return address === 'native' ? 'native' : address.toLowerCase()
}

function formatActivityLabel(item: any) {
  if (item.type === 'contract') {
    const raw = String(item.valueFormatted ?? '').trim()
    return raw && raw !== '0 ETH' ? raw : 'Contract interaction'
  }
  return item.valueFormatted ?? item.type
}

function formatChainTotal(chains: WalletChainSummary[], chainId: number) {
  const chain = chains.find((entry) => entry.chainId === chainId)
  return chain?.totalUsd ?? '$0.00'
}

function NftArtwork({ nft }: { nft: WalletNftSummary }) {
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
      className="flex h-full w-full items-center justify-center text-[1.4rem] font-display font-black tracking-[0.18em]"
      style={{
        background: `linear-gradient(135deg, ${colors.clay2} 0%, ${colors.earth} 100%)`,
        color: getNftChainColor(nft.chain),
      }}
    >
      {initials}
    </div>
  )
}

function ChainMenu() {
  const chains = [
    { name: 'Base',      sub: 'L2 · Coinbase', color: colors.chains.base,  active: true  },
    { name: 'Ethereum',  sub: 'L1 · Mainnet',  color: colors.chains.eth,   active: true  },
    { name: 'BNB Chain', sub: 'L1 · Wallet View', color: colors.chains.bnb, active: true },
  ]
  return (
    <div className="absolute top-full right-0 mt-1.5 w-56 bg-soil border border-border z-20 shadow-dark">
      <div className="text-[11px] font-bold tracking-[0.16em] text-muted uppercase px-3 py-2.5 border-b border-border">Connected Networks</div>
      {chains.map(c => (
        <div key={c.name} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-clay transition-colors cursor-pointer">
          <ChainLogo chainId={c.name === 'Ethereum' ? 1 : c.name === 'BNB Chain' ? 56 : 8453} size={16} />
          <div className="flex-1">
            <div className="text-[12px] font-bold">{c.name}</div>
            <div className="text-[11px] text-muted">{c.sub}</div>
          </div>
          <Badge variant={c.active ? 'active' : 'paused'}>{c.active ? '● ON' : 'OFF'}</Badge>
        </div>
      ))}
    </div>
  )
}

function getNftChainColor(chain: string) {
  if (chain === 'ethereum') return colors.chains.eth
  if (chain === 'bsc') return colors.chains.bnb
  return colors.chains.base
}

function getChainIdFromNftChain(chain: string) {
  if (chain === 'ethereum') return 1
  if (chain === 'bsc') return 56
  return 8453
}