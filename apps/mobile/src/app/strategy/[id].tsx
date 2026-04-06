import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A',
}

const STRATEGIES: Record<string, {
  title: string
  badge: string
  status: string
  accent: string
  summary: string
  facts: Array<{ label: string; value: string }>
}> = {
  arb: {
    title: 'Arb Bot',
    badge: 'beta',
    status: 'watching',
    accent: C.kola,
    summary: 'Same-chain dislocation monitoring with user-confirmed previews. Estimated net is not guaranteed profit.',
    facts: [
      { label: 'Mode', value: 'Same-chain monitor' },
      { label: 'Markets', value: 'ETH/USDC · BNB/USDT' },
      { label: 'Trigger', value: '>1.25% edge' },
    ],
  },
  yield: {
    title: 'Yield Optimizer',
    badge: 'live',
    status: 'watching',
    accent: C.gold2,
    summary: 'Tracks idle capital and stages yield-ready moves when stable or major balances become actionable.',
    facts: [
      { label: 'Mode', value: 'Capital routing' },
      { label: 'Chains', value: 'Base · Ethereum' },
      { label: 'Action', value: 'Preview required' },
    ],
  },
  reb: {
    title: 'Auto-Rebalance',
    badge: 'live',
    status: 'watching',
    accent: C.teal,
    summary: 'Monitors live wallet allocation drift and prepares rebalancing previews when the portfolio moves off target.',
    facts: [
      { label: 'Mode', value: 'Allocation drift' },
      { label: 'Action', value: 'Preview required' },
      { label: 'Guardrails', value: 'Wallet-level' },
    ],
  },
  brickt: {
    title: 'Brickt',
    badge: 'beta',
    status: 'watching',
    accent: '#C8956A',
    summary: 'Brickt remains a placeholder strategy surface while the rest of the mobile shell catches up to the web app.',
    facts: [
      { label: 'Mode', value: 'Placeholder' },
      { label: 'Status', value: 'No live actions yet' },
      { label: 'Next', value: 'Mobile parity first' },
    ],
  },
}

export default function StrategyScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const strategy = useMemo(() => STRATEGIES[params.id ?? 'arb'] ?? STRATEGIES.arb, [params.id])

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Strategy</Text>
          <Text style={styles.title}>{strategy.title}</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroAccent, { backgroundColor: strategy.accent }]} />
          <View style={styles.heroBody}>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { borderColor: strategy.accent }]}>
                <Text style={[styles.badgeText, { color: strategy.accent }]}>{strategy.badge}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{strategy.status}</Text>
              </View>
            </View>
            <Text style={styles.summary}>{strategy.summary}</Text>
          </View>
        </View>

        <View style={styles.card}>
          {strategy.facts.map((fact) => (
            <View key={fact.label} style={styles.row}>
              <Text style={styles.rowLabel}>{fact.label}</Text>
              <Text style={styles.rowValue}>{fact.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/chat')}>
          <Text style={styles.primaryBtnText}>Open In Chat</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.earth },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, backgroundColor: C.soil, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: C.clay, borderWidth: 1, borderColor: C.border },
  backText: { color: C.text2, fontSize: 20, lineHeight: 22 },
  kicker: { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '700' },
  title: { marginTop: 2, fontSize: 24, color: C.text, fontWeight: '900', fontFamily: 'serif' },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14 },
  hero: { overflow: 'hidden', backgroundColor: C.soil, borderWidth: 1, borderColor: C.border },
  heroAccent: { height: 3 },
  heroBody: { padding: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { borderWidth: 1, borderColor: C.border, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 9, color: C.text2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  summary: { fontSize: 13, lineHeight: 21, color: C.text2 },
  card: { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(74,53,32,0.65)' },
  rowLabel: { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  rowValue: { flexShrink: 1, textAlign: 'right', fontSize: 12, color: C.text2, fontFamily: 'monospace' },
  primaryBtn: { backgroundColor: C.gold, paddingVertical: 14, alignItems: 'center' },
  primaryBtnText: { color: C.earth, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
})
