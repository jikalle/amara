import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'
import { useWalletStore } from '../store'
import { resolveWalletIdentity } from '../lib/wallet'
import type { TokenBalance, Transaction, WalletChainSummary, WalletNftSummary } from '@anara/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A',
}

export default function HomeScreen() {
  const { user } = usePrivy()
  const authenticated = Boolean(user)
  const [showBrief, setShowBrief] = useState(true)
  const [briefDone, setBriefDone] = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const {
    address,
    hasWallet,
    totalUsd,
    tokens,
    nfts,
    chains,
    transactions,
    isLoading,
    error,
    setAddress,
    setHasWallet,
    setPortfolio,
    setTransactions,
    setLoading,
    setError,
  } = useWalletStore()

  useEffect(() => {
    if (!authenticated) router.replace('/onboard')
  }, [authenticated])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  useEffect(() => {
    const identity = resolveWalletIdentity(user)
    setHasWallet(identity.hasWallet)
    setAddress(identity.address)
  }, [user, setAddress, setHasWallet])

  useEffect(() => {
    if (!authenticated || !address) return
    let cancelled = false

    async function loadWallet() {
      setLoading(true)
      setError(null)
      try {
        const [portfolioRes, txRes] = await Promise.all([
          fetch(`${API_URL}/api/wallet/${address}/portfolio`),
          fetch(`${API_URL}/api/wallet/${address}/transactions`),
        ])

        const portfolio = portfolioRes.ok ? await portfolioRes.json() : null
        const txData = txRes.ok ? await txRes.json() : null

        if (cancelled) return

        if (portfolio) {
          setPortfolio({
            totalUsd: portfolio.totalUsd ?? '$0.00',
            tokens: normalizeTokens(portfolio.tokens ?? []),
            nfts: normalizeNfts(portfolio.nfts ?? []),
            chains: normalizeChains(portfolio.chains ?? []),
          })
        }

        if (txData) {
          setTransactions((txData.transactions ?? []) as Transaction[])
        }

        if (Array.isArray(portfolio?.warnings) && portfolio.warnings.length) {
          setError(String(portfolio.warnings[0]))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Wallet data is unavailable right now.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadWallet()
    return () => { cancelled = true }
  }, [authenticated, address, setError, setLoading, setPortfolio, setTransactions])

  const activeChainCount = Math.max(chains.filter((chain) => parseUsdAmount(chain.totalUsd) > 0).length, hasWallet ? 1 : 0)

  if (showBrief && !briefDone) {
    return <AgentBriefScreen onDismiss={() => { setBriefDone(true); setShowBrief(false) }} />
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.statusBar}>
        <View style={styles.brandRow}>
          <AmaraLogo size={28} />
          <Text style={styles.brandName}>Amara</Text>
        </View>
        <View style={styles.statusRight}>
          <ChainDropdown count={activeChainCount} />
          <AgentPip />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Wallet data is partially unavailable</Text>
            <Text style={styles.errorBody}>{error}</Text>
          </View>
        ) : null}

        <PortfolioHero
          totalUsd={totalUsd}
          activeChainCount={activeChainCount}
          tokenCount={tokens.length}
          nftCount={nfts.length}
          topChains={chains}
          loading={isLoading}
        />

        <QuickActions />

        <ProverbTicker />

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>Strategies</Text>
        </View>
        <StrategyScroll />

        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>Wallet</Text>
        </View>
        <InlineTabs
          tokens={tokens}
          nfts={nfts}
          transactions={transactions}
          loading={isLoading}
          hasWallet={hasWallet}
        />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/chat')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✦</Text>
        <View style={styles.fabDot} />
      </TouchableOpacity>

      <BottomNav />
    </SafeAreaView>
  )
}

function AmaraLogo({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.4, color: '#F0A500', fontWeight: '900' }}>A</Text>
    </View>
  )
}

function AgentPip() {
  return (
    <View style={styles.agentPip}>
      <View style={styles.pipDot} />
      <Text style={styles.pipText}>LIVE</Text>
    </View>
  )
}

function ChainDropdown({ count }: { count: number }) {
  return (
    <TouchableOpacity style={styles.chainDropBtn}>
      <View style={[styles.chainDot, { backgroundColor: '#1C6EFF' }]} />
      <View style={[styles.chainDot, { backgroundColor: '#627EEA', marginLeft: 2 }]} />
      <View style={[styles.chainDot, { backgroundColor: '#28A0F0', marginLeft: 2 }]} />
      <Text style={styles.chainCount}>{count || 3} chains ▾</Text>
    </TouchableOpacity>
  )
}

function PortfolioHero({
  totalUsd,
  activeChainCount,
  tokenCount,
  nftCount,
  topChains,
  loading,
}: {
  totalUsd: string
  activeChainCount: number
  tokenCount: number
  nftCount: number
  topChains: WalletChainSummary[]
  loading: boolean
}) {
  const topStats = [
    ...topChains
      .slice()
      .sort((left, right) => parseUsdAmount(right.totalUsd) - parseUsdAmount(left.totalUsd))
      .slice(0, 2)
      .map((chain) => ({
        label: chainLabel(chain.chainId),
        value: chain.totalUsd,
        color: chainColor(chain.chainId),
      })),
    { label: 'Assets', value: String(tokenCount + nftCount), color: '#C8956A' },
  ].slice(0, 3)

  return (
    <View style={styles.heroCard}>
      <View style={styles.kenteStrip} />
      <View style={styles.heroInner}>
        <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
        <Text style={styles.heroValue}>
          {loading ? (
            <Text style={styles.heroCents}>Loading…</Text>
          ) : (
            <>
              <Text style={styles.heroDollar}>$</Text>{formatUsdWhole(totalUsd)}
              <Text style={styles.heroCents}>.{formatUsdFraction(totalUsd)}</Text>
            </>
          )}
        </Text>
        <View style={styles.changeRow}>
          <View style={styles.changeBadge}>
            <Text style={styles.changeText}>{activeChainCount} active chains</Text>
          </View>
          <Text style={styles.changeLabel}>{tokenCount} tokens · {nftCount} NFTs</Text>
        </View>
      </View>
      <View style={styles.heroStats}>
        {topStats.map((stat) => (
          <View key={stat.label} style={styles.hstat}>
            <Text style={[styles.hstatNum, { color: stat.color }]} numberOfLines={1}>{stat.value}</Text>
            <Text style={styles.hstatLbl}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.chainBar}>
        {(topChains.length ? topChains : [{ chainId: 8453, totalUsd: '$1.00', nativeBalance: '0' }]).map((chain) => (
          <View key={chain.chainId} style={[styles.chainSeg, { backgroundColor: chainColor(chain.chainId), flex: Math.max(parseUsdAmount(chain.totalUsd), 1) }]} />
        ))}
      </View>
    </View>
  )
}

function ProverbTicker() {
  return (
    <View style={styles.proverb}>
      <Text style={styles.proverbLbl}>ỌRỌ ÀṢÀ</Text>
      <Text style={styles.proverbText} numberOfLines={1}>
        "The wealth of a man is not in his pocket, but in the land he cultivates." · Amara — guided multichain execution.
      </Text>
    </View>
  )
}

function QuickActions() {
  const actions = [
    { label: 'Send', icon: '↑', route: '/chat?action=send' },
    { label: 'Receive', icon: '↓', route: '/chat?action=receive' },
    { label: 'Swap', icon: '⇄', route: '/chat?action=swap' },
    { label: 'Bridge', icon: '⛓', route: '/chat?action=bridge' },
  ]

  return (
    <View style={styles.quickActionsWrap}>
      {actions.map((action) => (
        <TouchableOpacity key={action.label} style={styles.quickActionBtn} onPress={() => router.push(action.route as never)}>
          <Text style={styles.quickActionIcon}>{action.icon}</Text>
          <Text style={styles.quickActionText}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function StrategyScroll() {
  const strategies = [
    { id: 'arb', icon: '⚡', name: 'Arb Bot', pnl: 'Beta', sub: 'Opportunity monitor', color: C.kola, status: 'Watch' },
    { id: 'yield', icon: '🌾', name: 'Yield', pnl: 'Live', sub: 'Capital routing', color: C.gold, status: 'On' },
    { id: 'reb', icon: '⚖️', name: 'Rebalance', pnl: 'Live', sub: 'Drift monitor', color: C.teal, status: 'On' },
    { id: 'brickt', icon: '🏗️', name: 'Brickt', pnl: 'Beta', sub: 'Placeholder', color: '#C8956A', status: 'Watch' },
  ]
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stratScroll}>
      {strategies.map((s) => (
        <TouchableOpacity
          key={s.id}
          style={styles.stratCard}
          onPress={() => router.push(`/strategy/${s.id}`)}
          activeOpacity={0.8}
        >
          <View style={[styles.stratTopBar, { backgroundColor: s.color }]} />
          <View style={styles.stratInner}>
            <View style={styles.stratTopRow}>
              <Text style={styles.stratIcon}>{s.icon}</Text>
              <View style={[styles.stratBadge, { borderColor: s.color }]}>
                <Text style={[styles.stratBadgeText, { color: s.color }]}>{s.status}</Text>
              </View>
            </View>
            <Text style={styles.stratName}>{s.name}</Text>
            <Text style={[styles.stratPnl, { color: s.id === 'reb' ? C.teal : C.green }]}>{s.pnl}</Text>
            <Text style={styles.stratSub}>{s.sub}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function InlineTabs({
  tokens,
  nfts,
  transactions,
  loading,
  hasWallet,
}: {
  tokens: TokenBalance[]
  nfts: WalletNftSummary[]
  transactions: Transaction[]
  loading: boolean
  hasWallet: boolean
}) {
  const [active, setActive] = useState<'activity' | 'assets' | 'nfts'>('assets')
  const assets = useMemo(
    () => tokens.slice().sort((left, right) => parseUsdAmount(right.balanceUsd) - parseUsdAmount(left.balanceUsd)).slice(0, 8),
    [tokens],
  )
  const activity = useMemo(
    () => transactions.slice().sort((left, right) => right.timestamp - left.timestamp).slice(0, 8),
    [transactions],
  )
  const visibleNfts = useMemo(() => nfts.slice(0, 8), [nfts])

  return (
    <View style={styles.inlineTabs}>
      <View style={styles.tabRow}>
        {(['assets', 'activity', 'nfts'] as const).map((tab) => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActive(tab)}>
            <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {active === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tabContent}>
        {loading ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={C.gold2} />
          </View>
        ) : !hasWallet ? (
          <EmptyTabState message="Connect a wallet to load mobile portfolio data." />
        ) : active === 'assets' ? (
          assets.length ? assets.map((asset) => (
            <View key={`${asset.chainId}-${asset.address}`} style={styles.listRow}>
              <View>
                <Text style={styles.listTitle}>{asset.symbol}</Text>
                <Text style={styles.listMeta}>{chainLabel(asset.chainId)} · {asset.balanceFormatted}</Text>
              </View>
              <Text style={styles.listValue}>{asset.balanceUsd}</Text>
            </View>
          )) : <EmptyTabState message="No assets detected yet." />
        ) : active === 'activity' ? (
          activity.length ? activity.map((item) => (
            <View key={item.hash} style={styles.listRow}>
              <View>
                <Text style={styles.listTitle}>{formatActivityType(item.type)}</Text>
                <Text style={styles.listMeta}>{chainLabel(item.chainId)} · {formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.listValue}>{item.valueUsd ?? item.valueFormatted}</Text>
            </View>
          )) : <EmptyTabState message="No recent activity yet." />
        ) : (
          visibleNfts.length ? visibleNfts.map((nft) => (
            <View key={`${nft.chain}-${nft.tokenId}`} style={styles.listRow}>
              <View>
                <Text style={styles.listTitle}>{nft.name ?? `NFT #${nft.tokenId}`}</Text>
                <Text style={styles.listMeta}>{nft.collection} · {nft.chain}</Text>
              </View>
              <Text style={styles.listValue}>#{nft.tokenId}</Text>
            </View>
          )) : <EmptyTabState message="No NFTs detected yet." />
        )}
      </View>
    </View>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

function AgentBriefScreen({ onDismiss }: { onDismiss: () => void }) {
  return (
    <SafeAreaView style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
      <View style={styles.briefCard}>
        <View style={styles.kenteStrip} />
        <View style={{ padding: 20 }}>
          <View style={styles.agentBadge}>
            <View style={styles.pipDot} />
            <Text style={styles.pipText}>AGENT ONLINE · BASE · ETH · BNB</Text>
          </View>
          <Text style={styles.briefTitle}>Good morning, <Text style={{ color: C.gold2 }}>Operator.</Text></Text>
          <Text style={styles.briefSub}>Your mobile wallet is ready.</Text>
          <View style={styles.briefSummary}>
            <Text style={styles.briefSummaryText}>
              Amara mobile now mirrors the wallet home, chat, and strategy entry points. Next we can deepen execution parity and funding flows.
            </Text>
          </View>
        </View>
        <View style={styles.briefFooter}>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {[{ num: '3', lbl: 'Chains' }, { num: 'Live', lbl: 'Wallet' }, { num: 'Chat', lbl: 'Ready' }].map((s) => (
              <View key={s.lbl}>
                <Text style={styles.briefStatNum}>{s.num}</Text>
                <Text style={styles.briefStatLbl}>{s.lbl}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.enterBtn} onPress={onDismiss}>
            <Text style={styles.enterBtnText}>Enter →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}

function BottomNav() {
  return (
    <View style={styles.bottomNav}>
      <View style={styles.navKente} />
      {[
        { icon: '🏠', label: 'Home', route: '/' },
        { icon: '✦', label: 'Chat', route: '/chat' },
        { icon: '⚡', label: 'Arb', route: '/strategy/arb' },
      ].map((item) => (
        <TouchableOpacity
          key={item.label}
          style={styles.navItem}
          onPress={() => router.push(item.route as never)}
        >
          <Text style={styles.navIcon}>{item.icon}</Text>
          <Text style={styles.navLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

function formatUsdWhole(value: string) {
  const cleaned = value.replace('$', '')
  const [whole = '0'] = cleaned.split('.')
  return whole
}

function formatUsdFraction(value: string) {
  const cleaned = value.replace('$', '')
  const [, fraction = '00'] = cleaned.split('.')
  return fraction.padEnd(2, '0').slice(0, 2)
}

function parseUsdAmount(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

function chainLabel(chainId: number) {
  if (chainId === 1) return 'Ethereum'
  if (chainId === 56) return 'BNB Chain'
  return 'Base'
}

function chainColor(chainId: number) {
  if (chainId === 1) return '#627EEA'
  if (chainId === 56) return '#28A0F0'
  return '#1C6EFF'
}

function formatActivityType(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function formatTime(timestamp?: number) {
  if (!timestamp) return 'Pending'
  return new Date(timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function normalizeTokens(tokens: Array<Record<string, unknown>>): TokenBalance[] {
  return tokens.map((token, index) => ({
    address: (typeof token.contractAddress === 'string' ? token.contractAddress : 'native') as `0x${string}` | 'native',
    symbol: String(token.symbol ?? 'TOKEN'),
    name: String(token.name ?? token.symbol ?? `Token ${index + 1}`),
    decimals: Number(token.decimals ?? 18),
    balance: String(token.balance ?? token.balanceFormatted ?? '0'),
    balanceFormatted: String(token.balanceFormatted ?? token.balance ?? '0'),
    balanceUsd: String(token.balanceUsd ?? '$0.00'),
    priceUsd: String(token.priceUsd ?? '$0.00'),
    change24h: String(token.change24h ?? '0.00%'),
    logoUrl: typeof token.logoUrl === 'string' ? token.logoUrl : undefined,
    chainId: Number(token.chainId ?? 8453),
  }))
}

function normalizeNfts(nfts: Array<Record<string, unknown>>): WalletNftSummary[] {
  return nfts.map((nft, index) => ({
    tokenId: String(nft.tokenId ?? nft.id ?? index),
    collection: String(nft.collection ?? 'Collection'),
    name: typeof nft.name === 'string' ? nft.name : undefined,
    chain: String(nft.chain ?? 'base'),
    imageUrl: typeof nft.imageUrl === 'string' ? nft.imageUrl : undefined,
  }))
}

function normalizeChains(chains: Array<Record<string, unknown>>): WalletChainSummary[] {
  return chains.map((chain) => ({
    chainId: Number(chain.chainId ?? 8453),
    nativeBalance: String(chain.nativeBalance ?? '0'),
    totalUsd: String(chain.totalUsd ?? '$0.00'),
  }))
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.earth },
  scroll: { flex: 1 },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 16, fontWeight: '900', color: C.text, fontFamily: 'serif' },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agentPip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(46,204,113,.25)', backgroundColor: 'rgba(46,204,113,.06)', paddingHorizontal: 8, paddingVertical: 4 },
  pipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  pipText: { fontSize: 9, fontWeight: '700', color: C.green, letterSpacing: 0.8 },
  chainDropBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#4A3520', backgroundColor: '#2E2010', paddingHorizontal: 8, paddingVertical: 5, gap: 2 },
  chainDot: { width: 5, height: 5, borderRadius: 3 },
  chainCount: { fontSize: 9, fontWeight: '700', color: C.text2, marginLeft: 4 },
  errorCard: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: 'rgba(192,57,43,.3)', backgroundColor: 'rgba(192,57,43,.1)', paddingHorizontal: 12, paddingVertical: 10 },
  errorTitle: { fontSize: 11, fontWeight: '700', color: C.kola, marginBottom: 4 },
  errorBody: { fontSize: 12, color: C.text2, lineHeight: 18 },
  kenteStrip: { height: 3, backgroundColor: C.gold },
  heroCard: { margin: 16, marginTop: 12, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border },
  heroInner: { padding: 16 },
  heroLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: C.muted, marginBottom: 6 },
  heroValue: { fontSize: 38, fontWeight: '900', color: C.text, fontFamily: 'serif', lineHeight: 42 },
  heroDollar: { color: C.gold2 },
  heroCents: { fontSize: 22, color: C.muted, fontWeight: '700' },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  changeBadge: { backgroundColor: 'rgba(46,204,113,.1)', borderWidth: 1, borderColor: 'rgba(46,204,113,.2)', paddingHorizontal: 10, paddingVertical: 3 },
  changeText: { fontSize: 10, fontWeight: '700', color: C.green, fontFamily: 'monospace' },
  changeLabel: { fontSize: 10, color: C.muted },
  heroStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  hstat: { flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: C.border, alignItems: 'flex-start' },
  hstatNum: { fontSize: 16, fontWeight: '700', fontFamily: 'serif' },
  hstatLbl: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  chainBar: { flexDirection: 'row', height: 3 },
  chainSeg: { height: 3 },
  proverb: { marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  proverbLbl: { fontSize: 8, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  proverbText: { fontSize: 10, color: C.muted, fontStyle: 'italic', flex: 1 },
  quickActionsWrap: { marginHorizontal: 16, marginTop: 10, flexDirection: 'row', gap: 8 },
  quickActionBtn: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border },
  quickActionIcon: { fontSize: 15, color: C.text2 },
  quickActionText: { fontSize: 10, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionLabel: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sectionText: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' },
  stratScroll: { paddingLeft: 16 },
  stratCard: { width: 130, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, marginRight: 10, overflow: 'hidden' },
  stratTopBar: { height: 2 },
  stratInner: { padding: 12 },
  stratTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stratIcon: { fontSize: 18 },
  stratBadge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  stratBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  stratName: { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  stratPnl: { fontSize: 18, fontWeight: '700', fontFamily: 'serif', lineHeight: 20 },
  stratSub: { fontSize: 9, color: C.muted, marginTop: 4, fontFamily: 'monospace' },
  inlineTabs: { marginHorizontal: 16, marginTop: 8, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tabRow: { flexDirection: 'row', backgroundColor: C.clay, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted },
  tabTextActive: { color: C.gold2 },
  tabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: C.gold2 },
  tabContent: { minHeight: 100 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(74,53,32,0.65)' },
  listTitle: { fontSize: 12, color: C.text, fontWeight: '700' },
  listMeta: { marginTop: 3, fontSize: 10, color: C.muted },
  listValue: { maxWidth: '42%', textAlign: 'right', fontSize: 11, color: C.text2, fontFamily: 'monospace' },
  emptyWrap: { minHeight: 88, alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyText: { fontSize: 12, lineHeight: 18, color: C.muted, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 72, right: 16, width: 58, height: 58, borderRadius: 29, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabIcon: { fontSize: 24, color: C.earth },
  fabDot: { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.gold },
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.soil, paddingBottom: 4, position: 'relative' },
  navKente: { position: 'absolute', top: -3, left: 0, right: 0, height: 3, backgroundColor: C.gold },
  navItem: { flex: 1, paddingVertical: 10, alignItems: 'center', gap: 2 },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  briefCard: { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  agentBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  briefTitle: { fontSize: 22, fontWeight: '900', color: C.text, fontFamily: 'serif', marginBottom: 4 },
  briefSub: { fontSize: 12, color: C.muted, marginBottom: 16 },
  briefSummary: { backgroundColor: 'rgba(212,146,10,.07)', borderWidth: 1, borderColor: 'rgba(212,146,10,.18)', borderLeftWidth: 3, borderLeftColor: C.gold, padding: 12, marginBottom: 0 },
  briefSummaryText: { fontSize: 12, color: C.text2, lineHeight: 19 },
  briefFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.earth },
  briefStatNum: { fontSize: 18, fontWeight: '700', color: C.gold2, fontFamily: 'serif' },
  briefStatLbl: { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  enterBtn: { backgroundColor: C.gold, paddingVertical: 11, paddingHorizontal: 20 },
  enterBtnText: { fontSize: 12, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.6 },
})
