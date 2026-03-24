'use client'

import { useEffect, useState } from 'react'
import { usePrivy }    from '@privy-io/react-auth'
import { useRouter }   from 'next/navigation'
import { AnaraLogo, KenteStrip, Badge, Card, StatGrid, LiveDot } from '@anara/ui'
import { colors } from '@anara/ui/tokens'
import { useWalletStore, useAgentStore, useUIStore } from '../../store'
import { useAgent } from '../../hooks/useAgent'

export default function DashboardPage() {
  const { ready, authenticated, user, logout } = usePrivy()
  const router  = useRouter()
  const { fetchBrief } = useAgent()
  const { totalUsd, tokens } = useWalletStore()
  const { state: agentState } = useAgentStore()
  const { setChatOpen } = useAgentStore()

  const [brief, setBrief]           = useState<Brief | null>(null)
  const [showBrief, setShowBrief]   = useState(true)
  const [activeTab, setActiveTab]   = useState<'activity' | 'assets' | 'nfts'>('activity')
  const [chainOpen, setChainOpen]   = useState(false)

  useEffect(() => {
    if (ready && !authenticated) router.push('/onboard')
  }, [ready, authenticated, router])

  useEffect(() => {
    if (authenticated) {
      fetchBrief().then(data => { if (data) setBrief(data) })
    }
  }, [authenticated, fetchBrief])

  if (!ready || !authenticated) return <LoadingSplash />

  if (showBrief && brief) {
    return <BriefModal brief={brief} onDismiss={() => setShowBrief(false)} />
  }

  return (
    <div className="min-h-screen bg-earth text-cream flex flex-col">
      {/* Kente top strip */}
      <KenteStrip height={4} />

      {/* ── Status bar ── */}
      <header className="flex items-center justify-between px-4 py-3 bg-soil border-b border-border">
        <div className="flex items-center gap-3">
          <AnaraLogo size={32} />
          <div>
            <div className="font-display font-black text-lg leading-tight">Anara</div>
            <div className="text-[9px] text-muted tracking-widest uppercase">Autonomous · Multichain</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Chain dropdown */}
          <div className="relative">
            <button
              onClick={() => setChainOpen(v => !v)}
              className="flex items-center gap-1.5 bg-clay border border-border px-2.5 py-1.5 text-[9px] font-bold font-mono tracking-wide text-text2 hover:border-border2 transition-colors"
            >
              <span style={{ background: colors.chains.base }} className="inline-block w-2 h-2 rounded-full" />
              <span style={{ background: colors.chains.eth }} className="inline-block w-2 h-2 rounded-full" />
              <span style={{ background: colors.chains.arb }} className="inline-block w-2 h-2 rounded-full" />
              <span className="ml-1">10 chains ▾</span>
            </button>
            {chainOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setChainOpen(false)} />
                <ChainMenu />
              </>
            )}
          </div>

          {/* Live agent pip */}
          <div className="flex items-center gap-1.5 border border-green/25 bg-green/5 px-3 py-1.5">
            <LiveDot />
            <span className="text-[9px] font-bold text-green tracking-widest uppercase">Agent Live</span>
          </div>

          {/* Avatar / logout */}
          <button
            onClick={logout}
            className="w-8 h-8 bg-gold flex items-center justify-content-center text-earth font-black text-sm font-display"
            title="Log out"
          >
            {user?.email?.address?.[0]?.toUpperCase() ?? 'S'}
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-md mx-auto w-full pb-8">

        {/* Portfolio hero */}
        <PortfolioHero totalUsd={totalUsd || '$24,847.32'} />

        {/* Proverb ticker */}
        <div className="flex items-center gap-3 bg-clay border-x border-b border-border px-4 py-2 overflow-hidden">
          <span className="text-[8px] font-bold text-gold tracking-[0.18em] uppercase flex-shrink-0">Ọrọ àṣà</span>
          <span className="text-[10px] text-muted italic whitespace-nowrap animate-ticker">
            "The wealth of a man is not in his pocket, but in the land he cultivates." &nbsp;·&nbsp; "Oní owó ló ní ọrọ." &nbsp;·&nbsp; Brickt — African land. Global capital.
          </span>
        </div>

        {/* Strategy cards */}
        <div className="px-4 pt-4 pb-2">
          <div className="text-[9px] font-bold tracking-[0.2em] text-muted uppercase mb-3">Strategies</div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {STRATEGY_CARDS.map(s => (
              <StrategyCard key={s.id} {...s} />
            ))}
          </div>
        </div>

        {/* Inline tabs */}
        <div className="px-4 pt-4">
          <div className="text-[9px] font-bold tracking-[0.2em] text-muted uppercase mb-3">Wallet</div>
          <Card kente>
            {/* Tab bar */}
            <div className="flex bg-clay border-b border-border">
              {(['activity', 'assets', 'nfts'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
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

            {/* Tab content */}
            <div className="min-h-[200px]">
              {activeTab === 'activity' && <ActivityTab />}
              {activeTab === 'assets'   && <AssetsTab tokens={tokens} />}
              {activeTab === 'nfts'     && <NFTsTab />}
            </div>
          </Card>
        </div>

        {/* Agent stats */}
        <div className="px-4 pt-4">
          <StatGrid stats={[
            { label: 'Actions today',  value: String(agentState.actionsToday || 23) },
            { label: 'Profit today',   value: agentState.profitToday || '+$70.50', color: colors.green },
            { label: 'Errors',         value: String(agentState.errorsToday || 0),  color: colors.green },
            { label: 'Uptime',         value: '99.9%', color: colors.teal },
          ]} />
        </div>
      </main>

      {/* Agent FAB */}
      <button
        onClick={() => { setChatOpen(true); router.push('/dashboard/chat') }}
        className="fixed bottom-6 right-4 w-14 h-14 rounded-full bg-gold flex items-center justify-center text-2xl z-20"
        style={{ boxShadow: colors.shadows?.gold ?? '0 4px 20px rgba(212,146,10,0.4)' }}
      >
        🤖
        <span
          className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green border-2 border-gold"
        />
      </button>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function LoadingSplash() {
  return (
    <div className="min-h-screen bg-earth flex flex-col items-center justify-center gap-4">
      <AnaraLogo size={48} />
      <div className="text-[10px] font-mono text-muted tracking-widest animate-pulse">LOADING WALLET…</div>
    </div>
  )
}

interface Brief {
  summary: string
  totalProfitUsd: string
  actionsCount: number
  errorsCount: number
  events: { type: string; description: string; timeAgo: string; profitUsd: string | null }[]
}

function BriefModal({ brief, onDismiss }: { brief: Brief; onDismiss: () => void }) {
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
            {brief.events.map((ev, i) => (
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
            ))}
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
                <div className="text-[9px] text-muted tracking-wider uppercase mt-0.5">{s.lbl}</div>
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

function PortfolioHero({ totalUsd }: { totalUsd: string }) {
  const { openSheet } = useUIStore()
  return (
    <Card kente className="mx-4 mt-3">
      <div className="p-4">
        <div className="text-[9px] font-bold tracking-[0.2em] text-muted uppercase mb-2">Total Portfolio Value</div>
        <div className="font-display font-black text-[2.8rem] leading-none">
          <span className="text-gold2">$</span>
          {totalUsd.replace('$','').split('.')[0]}
          <span className="text-2xl text-muted font-bold">.{totalUsd.split('.')[1] ?? '00'}</span>
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <span className="bg-green/10 border border-green/20 text-green text-[10px] font-bold font-mono px-2.5 py-1">▲ +$312.48 (1.27%)</span>
          <span className="text-[10px] text-muted">since yesterday</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex border-t border-border">
        {[
          { label: 'Arb 30d',  value: '+$847',  color: colors.gold2 },
          { label: 'Yield APY',value: '18.4%',  color: colors.teal  },
          { label: 'Brickt',   value: '4',      color: '#C8956A'    },
        ].map((s, i) => (
          <div key={s.label} className={`flex-1 p-3 ${i < 2 ? 'border-r border-border' : ''}`}>
            <div className="font-display font-bold text-lg" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 p-3 border-t border-border">
        {[
          { label: 'Send',    icon: '↑', sheet: 'send'    as const, color: colors.kola   },
          { label: 'Receive', icon: '↓', sheet: 'receive' as const, color: colors.green  },
          { label: 'Swap',    icon: '⇄', sheet: 'swap'    as const, color: colors.gold   },
          { label: 'Bridge',  icon: '⛓', sheet: 'bridge'  as const, color: colors.teal   },
        ].map(a => (
          <button
            key={a.label}
            onClick={() => openSheet(a.sheet)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 bg-clay2 border border-border hover:border-border2 transition-colors"
            style={{ borderTopWidth: 2, borderTopColor: a.color }}
          >
            <span className="text-base">{a.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-text2">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Chain bar */}
      <div className="flex h-1">
        <div className="flex-1 bg-[#1C6EFF]" style={{ flex: 62 }} />
        <div className="flex-1 bg-[#627EEA]" style={{ flex: 38 }} />
      </div>
    </Card>
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
  const isNeutral = id === 'reb'
  return (
    <button
      onClick={() => router.push(`/dashboard/strategy/${id}`)}
      className="flex-shrink-0 w-32 bg-soil border border-border text-left hover:border-border2 transition-all hover:-translate-y-0.5 relative overflow-hidden"
    >
      <div style={{ height: 2, background: accent }} />
      <div className="p-3">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[18px]">{icon}</span>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 border tracking-wider uppercase"
            style={{ color: accent, borderColor: `${accent}40`, background: `${accent}15` }}
          >{status}</span>
        </div>
        <div className="text-[9px] font-bold text-muted uppercase tracking-wide mb-1.5">{name}</div>
        <div
          className="font-display font-bold text-lg leading-none"
          style={{ color: isNeutral ? colors.muted : colors.green }}
        >{pnl}</div>
        <div className="text-[9px] text-muted mt-1 font-mono">{sub}</div>
      </div>
    </button>
  )
}

function ActivityTab() {
  const items = [
    { icon: '⚡', type: 'arb',    msg: 'Flash arb: USDC→WETH→USDC',         profit: '+$12.40', time: '8m ago',  ok: true  },
    { icon: '🌾', type: 'yield',  msg: '4.2 AERO claimed and compounded',    profit: '+$2.18',  time: '22m ago', ok: true  },
    { icon: '⚡', type: 'arb',    msg: 'Arb scan — slippage too high, skip', profit: null,      time: '45m ago', ok: false },
    { icon: '⚡', type: 'arb',    msg: 'Triangular arb: USDC→ETH→WBTC',     profit: '+$47.32', time: '2h ago',  ok: true  },
    { icon: '🏗️', type: 'brickt', msg: 'Brickt Pool #3 yield accrued',      profit: '+$16.00', time: '3h ago',  ok: true  },
  ]
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 items-start px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-clay/30 transition-colors">
          <div className={`w-7 h-7 flex items-center justify-center text-xs flex-shrink-0 border ${
            item.type === 'arb' ? 'bg-kola/15 border-kola/20' :
            item.type === 'yield' ? 'bg-gold/12 border-gold/20' :
            'bg-teal/10 border-teal/20'
          }`}>{item.icon}</div>
          <div className="flex-1">
            <div className="text-[12px] text-cream">{item.msg}</div>
            <div className="flex gap-2 mt-1 items-center">
              <div className={`w-1 h-1 rounded-full ${item.ok ? 'bg-green' : 'bg-muted2'}`} />
              <span className="text-[10px] text-muted font-mono">{item.time}</span>
              {item.profit && <span className="text-[10px] font-bold text-green font-mono">{item.profit}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function AssetsTab({ tokens }: { tokens: any[] }) {
  const assets = tokens.length ? tokens : [
    { symbol: 'USDC',    icon: '$', amount: '8,420.00',  value: '$8,420', chain: 'BASE', color: colors.chains.base },
    { symbol: 'ETH',     icon: 'E', amount: '2.847 ETH', value: '$9,427', chain: 'ETH',  color: colors.chains.eth  },
    { symbol: 'WETH',    icon: 'W', amount: '0.820',     value: '$2,714', chain: 'BASE', color: colors.chains.base },
    { symbol: 'BRICKT',  icon: 'B', amount: '4 pools',   value: '$3,200', chain: 'BASE', color: '#C8956A'          },
    { symbol: 'AERO-LP', icon: 'A', amount: '1,240 LP',  value: '$1,086', chain: 'BASE', color: colors.gold        },
  ]
  return (
    <div>
      {assets.map((a: any, i: number) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-clay/30 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 flex items-center justify-center text-[10px] font-black font-mono border"
              style={{ background: `${a.color}20`, borderColor: `${a.color}35`, color: a.color }}
            >{a.icon}</div>
            <div>
              <div className="text-[13px] font-bold">{a.symbol}</div>
              <span className="text-[8px] text-muted bg-clay border border-border px-1.5 py-0.5 font-mono">{a.chain}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[12px] font-bold font-mono text-text2">{a.value}</div>
            <div className="text-[9px] text-muted font-mono mt-0.5">{a.amount}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function NFTsTab() {
  const nfts = [
    { coll: 'Brickt Land', name: 'Lekki Plot #03', floor: '0.08 ETH', emoji: '🏗️', chain: 'BASE' },
    { coll: 'Brickt Land', name: 'Abuja Plot #11', floor: '0.06 ETH', emoji: '🏡', chain: 'BASE' },
    { coll: 'Base Frens',  name: 'Fren #2847',     floor: '0.03 ETH', emoji: '🟦', chain: 'BASE' },
    { coll: 'ENS Domains', name: 'shehu.eth',       floor: '0.01 ETH', emoji: '🔷', chain: 'ETH'  },
  ]
  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {nfts.map((n, i) => (
        <div key={i} className="bg-clay2 border border-border overflow-hidden cursor-pointer hover:border-border2 transition-colors">
          <div className="aspect-square flex items-center justify-center text-4xl bg-gradient-to-br from-clay to-clay2">
            {n.emoji}
          </div>
          <div className="p-2">
            <div className="text-[8px] text-muted uppercase tracking-wide">{n.coll}</div>
            <div className="text-[11px] font-bold text-cream truncate">{n.name}</div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-bold font-mono text-gold2">{n.floor}</span>
              <span className="text-[8px] text-muted">{n.chain}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChainMenu() {
  const chains = [
    { name: 'Base',      sub: 'L2 · Coinbase', color: colors.chains.base,  active: true  },
    { name: 'Ethereum',  sub: 'L1 · Mainnet',  color: colors.chains.eth,   active: true  },
    { name: 'Arbitrum',  sub: 'L2 · Offchain', color: colors.chains.arb,   active: true  },
    { name: 'Optimism',  sub: 'L2 · OP Stack', color: colors.chains.op,    active: true  },
    { name: 'BNB Chain', sub: 'L1 · Binance',  color: colors.chains.bnb,   active: false },
    { name: 'Polygon',   sub: 'L2 · PoS',      color: colors.chains.poly,  active: false },
    { name: 'Avalanche', sub: 'L1 · Ava Labs', color: colors.chains.avax,  active: false },
    { name: 'Solana',    sub: 'L1 · SVM',      color: colors.chains.sol,   active: false },
    { name: 'zkSync',    sub: 'L2 · ZK Rollup',color: colors.chains.zk,    active: false },
    { name: 'Linea',     sub: 'L2 · Consensys',color: colors.chains.linea, active: false },
  ]
  return (
    <div className="absolute top-full right-0 mt-1.5 w-56 bg-soil border border-border z-20 shadow-dark">
      <div className="text-[9px] font-bold tracking-[0.16em] text-muted uppercase px-3 py-2.5 border-b border-border">Connected Networks</div>
      {chains.map(c => (
        <div key={c.name} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/50 last:border-b-0 hover:bg-clay transition-colors cursor-pointer">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
          <div className="flex-1">
            <div className="text-[12px] font-bold">{c.name}</div>
            <div className="text-[9px] text-muted">{c.sub}</div>
          </div>
          <Badge variant={c.active ? 'active' : 'paused'}>{c.active ? '● ON' : 'OFF'}</Badge>
        </div>
      ))}
    </div>
  )
}
