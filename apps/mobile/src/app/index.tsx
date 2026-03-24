import { useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions, Animated,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePrivy } from '@privy-io/expo'
import { router } from 'expo-router'

const { width: W } = Dimensions.get('window')
const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A',
}

export default function HomeScreen() {
  const { user, authenticated } = usePrivy()
  const [showBrief, setShowBrief]   = useState(true)
  const [briefDone, setBriefDone]   = useState(false)
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!authenticated) router.replace('/onboard')
  }, [authenticated])

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, useNativeDriver: true,
    }).start()
  }, [])

  // Show agent brief modal on first open
  if (showBrief && !briefDone) {
    return <AgentBriefScreen onDismiss={() => { setBriefDone(true); setShowBrief(false) }} />
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.brandRow}>
          <AnaraLogo size={28} />
          <Text style={styles.brandName}>Anara</Text>
        </View>
        <View style={styles.statusRight}>
          <ChainDropdown />
          <AgentPip />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Portfolio Hero */}
        <PortfolioHero />

        {/* Proverb Ticker */}
        <ProverbTicker />

        {/* Strategy Cards */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>Strategies</Text>
        </View>
        <StrategyScroll />

        {/* Inline Tabs */}
        <View style={styles.sectionLabel}>
          <Text style={styles.sectionText}>Wallet</Text>
        </View>
        <InlineTabs />
      </ScrollView>

      {/* Agent FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/chat')}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>🤖</Text>
        <View style={styles.fabDot} />
      </TouchableOpacity>

      {/* Bottom Nav */}
      <BottomNav />
    </SafeAreaView>
  )
}

// ── Placeholder sub-components ──
// These will each become their own files as we build out

function AnaraLogo({ size }: { size: number }) {
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

function ChainDropdown() {
  return (
    <TouchableOpacity style={styles.chainDropBtn}>
      <View style={[styles.chainDot, { backgroundColor: '#1C6EFF' }]} />
      <View style={[styles.chainDot, { backgroundColor: '#627EEA', marginLeft: 2 }]} />
      <View style={[styles.chainDot, { backgroundColor: '#28A0F0', marginLeft: 2 }]} />
      <Text style={styles.chainCount}>10 chains ▾</Text>
    </TouchableOpacity>
  )
}

function PortfolioHero() {
  return (
    <View style={styles.heroCard}>
      <View style={styles.kenteStrip} />
      <View style={styles.heroInner}>
        <Text style={styles.heroLabel}>TOTAL PORTFOLIO VALUE</Text>
        <Text style={styles.heroValue}>
          <Text style={styles.heroDollar}>$</Text>24,847
          <Text style={styles.heroCents}>.32</Text>
        </Text>
        <View style={styles.changeRow}>
          <View style={styles.changeBadge}>
            <Text style={styles.changeText}>▲ +$312.48 (1.27%)</Text>
          </View>
          <Text style={styles.changeLabel}>24h</Text>
        </View>
      </View>
      <View style={styles.heroStats}>
        {[
          { label: 'ARB 30D', value: '+$847', color: C.gold2 },
          { label: 'YIELD APY', value: '18.4%', color: C.teal },
          { label: 'BRICKT', value: '4', color: '#C8956A' },
        ].map(stat => (
          <View key={stat.label} style={styles.hstat}>
            <Text style={[styles.hstatNum, { color: stat.color }]}>{stat.value}</Text>
            <Text style={styles.hstatLbl}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {/* Chain bar */}
      <View style={styles.chainBar}>
        <View style={[styles.chainSeg, { backgroundColor: '#1C6EFF', flex: 62 }]} />
        <View style={[styles.chainSeg, { backgroundColor: '#627EEA', flex: 38 }]} />
      </View>
    </View>
  )
}

function ProverbTicker() {
  return (
    <View style={styles.proverb}>
      <Text style={styles.proverbLbl}>ỌRỌ ÀṢÀ</Text>
      <Text style={styles.proverbText} numberOfLines={1}>
        "The wealth of a man is not in his pocket, but in the land he cultivates." · Brickt — African land. Global capital.
      </Text>
    </View>
  )
}

function StrategyScroll() {
  const strategies = [
    { id: 'arb',    icon: '⚡', name: 'Arb Bot',   pnl: '+$847', sub: '23 runs · 30d',  color: C.kola,    status: 'On' },
    { id: 'yield',  icon: '🌾', name: 'Yield',      pnl: '+$312', sub: 'Aerodrome LP',   color: C.gold,    status: 'On' },
    { id: 'reb',    icon: '⚖️', name: 'Rebalance',  pnl: 'Range', sub: '±5% thresh',    color: C.teal,    status: 'Watch' },
    { id: 'brickt', icon: '🏗️', name: 'Brickt',     pnl: '+$64',  sub: 'Lagos · Abuja', color: '#C8956A', status: 'On' },
  ]
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stratScroll}>
      {strategies.map(s => (
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
            <Text style={[styles.stratPnl, { color: s.id === 'reb' ? C.muted : C.green }]}>{s.pnl}</Text>
            <Text style={styles.stratSub}>{s.sub}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function InlineTabs() {
  const [active, setActive] = useState<'activity' | 'assets' | 'nfts'>('activity')
  return (
    <View style={styles.inlineTabs}>
      <View style={styles.tabRow}>
        {(['activity', 'assets', 'nfts'] as const).map(tab => (
          <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActive(tab)}>
            <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
            {active === tab && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.tabContent}>
        <Text style={{ color: C.muted, fontSize: 12, padding: 16 }}>
          {active === 'activity' ? 'Agent activity will appear here' :
           active === 'assets'   ? 'Token holdings will appear here' :
                                   'NFT collection will appear here'}
        </Text>
      </View>
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
            <Text style={styles.pipText}>AGENT ONLINE · BASE & ETH</Text>
          </View>
          <Text style={styles.briefTitle}>Good morning, <Text style={{ color: C.gold2 }}>Shehu.</Text></Text>
          <Text style={styles.briefSub}>While you were away — last 14 hours.</Text>
          <View style={styles.briefSummary}>
            <Text style={styles.briefSummaryText}>
              Agent ran <Text style={{ color: C.gold2, fontWeight: '700' }}>23 autonomous actions</Text>. Arb net: <Text style={{ color: C.green, fontWeight: '700' }}>+$70.50</Text>. Yield compounded. 4 Brickt pools active. <Text style={{ fontWeight: '700' }}>Zero errors.</Text>
            </Text>
          </View>
        </View>
        <View style={styles.briefFooter}>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            {[{ num: '+$312', lbl: 'Gained' }, { num: '23', lbl: 'Actions' }, { num: '0', lbl: 'Errors' }].map(s => (
              <View key={s.lbl}>
                <Text style={[styles.briefStatNum, s.lbl === 'Errors' ? { color: C.green } : {}]}>{s.num}</Text>
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
        { icon: '🏠', label: 'Home',     route: '/' },
        { icon: '🤖', label: 'Agent',    route: '/agent' },
        { icon: '⚙️', label: 'Settings', route: '/settings' },
      ].map(item => (
        <TouchableOpacity
          key={item.label}
          style={styles.navItem}
          onPress={() => router.push(item.route as any)}
        >
          <Text style={styles.navIcon}>{item.icon}</Text>
          <Text style={styles.navLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.earth },
  scroll:         { flex: 1 },
  statusBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  brandRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName:      { fontSize: 16, fontWeight: '900', color: C.text, fontFamily: 'serif' },
  statusRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  agentPip:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(46,204,113,.25)', backgroundColor: 'rgba(46,204,113,.06)', paddingHorizontal: 8, paddingVertical: 4 },
  pipDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  pipText:        { fontSize: 9, fontWeight: '700', color: C.green, letterSpacing: 0.8 },
  chainDropBtn:   { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#4A3520', backgroundColor: '#2E2010', paddingHorizontal: 8, paddingVertical: 5, gap: 2 },
  chainDot:       { width: 5, height: 5, borderRadius: 3 },
  chainCount:     { fontSize: 9, fontWeight: '700', color: C.text2, marginLeft: 4 },
  kenteStrip:     { height: 3, backgroundColor: C.gold },
  heroCard:       { margin: 16, marginTop: 12, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border },
  heroInner:      { padding: 16 },
  heroLabel:      { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: C.muted, marginBottom: 6 },
  heroValue:      { fontSize: 38, fontWeight: '900', color: C.text, fontFamily: 'serif', lineHeight: 42 },
  heroDollar:     { color: C.gold2 },
  heroCents:      { fontSize: 22, color: C.muted, fontWeight: '700' },
  changeRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  changeBadge:    { backgroundColor: 'rgba(46,204,113,.1)', borderWidth: 1, borderColor: 'rgba(46,204,113,.2)', paddingHorizontal: 10, paddingVertical: 3 },
  changeText:     { fontSize: 10, fontWeight: '700', color: C.green, fontFamily: 'monospace' },
  changeLabel:    { fontSize: 10, color: C.muted },
  heroStats:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border },
  hstat:          { flex: 1, padding: 10, borderRightWidth: 1, borderRightColor: C.border, alignItems: 'flex-start' },
  hstatNum:       { fontSize: 16, fontWeight: '700', fontFamily: 'serif' },
  hstatLbl:       { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  chainBar:       { flexDirection: 'row', height: 3 },
  chainSeg:       { height: 3 },
  proverb:        { marginHorizontal: 16, marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' },
  proverbLbl:     { fontSize: 8, fontWeight: '700', color: C.gold, letterSpacing: 1 },
  proverbText:    { fontSize: 10, color: C.muted, fontStyle: 'italic', flex: 1 },
  sectionLabel:   { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  sectionText:    { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: C.muted, textTransform: 'uppercase' },
  stratScroll:    { paddingLeft: 16 },
  stratCard:      { width: 130, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, marginRight: 10, overflow: 'hidden' },
  stratTopBar:    { height: 2 },
  stratInner:     { padding: 12 },
  stratTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stratIcon:      { fontSize: 18 },
  stratBadge:     { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
  stratBadgeText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.6 },
  stratName:      { fontSize: 9, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  stratPnl:       { fontSize: 18, fontWeight: '700', fontFamily: 'serif', lineHeight: 20 },
  stratSub:       { fontSize: 9, color: C.muted, marginTop: 4, fontFamily: 'monospace' },
  inlineTabs:     { marginHorizontal: 16, marginTop: 8, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  tabRow:         { flexDirection: 'row', backgroundColor: C.clay, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:            { flex: 1, paddingVertical: 10, alignItems: 'center', position: 'relative' },
  tabText:        { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.muted },
  tabTextActive:  { color: C.gold2 },
  tabUnderline:   { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, backgroundColor: C.gold2 },
  tabContent:     { minHeight: 80 },
  fab:            { position: 'absolute', bottom: 72, right: 16, width: 58, height: 58, borderRadius: 29, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', shadowColor: C.gold, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  fabIcon:        { fontSize: 24 },
  fabDot:         { position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: C.green, borderWidth: 2, borderColor: C.gold },
  bottomNav:      { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.soil, paddingBottom: 4, position: 'relative' },
  navKente:       { position: 'absolute', top: -3, left: 0, right: 0, height: 3, backgroundColor: C.gold },
  navItem:        { flex: 1, paddingVertical: 10, alignItems: 'center', gap: 2 },
  navIcon:        { fontSize: 18 },
  navLabel:       { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: C.muted },
  briefCard:      { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  agentBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  briefTitle:     { fontSize: 22, fontWeight: '900', color: C.text, fontFamily: 'serif', marginBottom: 4 },
  briefSub:       { fontSize: 12, color: C.muted, marginBottom: 16 },
  briefSummary:   { backgroundColor: 'rgba(212,146,10,.07)', borderWidth: 1, borderColor: 'rgba(212,146,10,.18)', borderLeftWidth: 3, borderLeftColor: C.gold, padding: 12, marginBottom: 0 },
  briefSummaryText:{ fontSize: 12, color: C.text2, lineHeight: 19 },
  briefFooter:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.earth },
  briefStatNum:   { fontSize: 18, fontWeight: '700', color: C.gold2, fontFamily: 'serif' },
  briefStatLbl:   { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },
  enterBtn:       { backgroundColor: C.gold, paddingVertical: 11, paddingHorizontal: 20 },
  enterBtnText:   { fontSize: 12, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.6 },
})
