import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePrivy }   from '@privy-io/expo'
import { router }     from 'expo-router'

const { width: W } = Dimensions.get('window')

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A',
}

const SLIDES = [
  {
    icon: '🤖',
    title: 'Your Wallet,\nWorking 24/7',
    body: 'Anara\'s AI agent executes arbitrage, compounds yield, and rebalances your portfolio — while you sleep.',
    accent: C.gold,
  },
  {
    icon: '⛓',
    title: '10 Chains,\nOne Wallet',
    body: 'Base, Ethereum, Arbitrum, Optimism, BNB, Polygon, Avalanche, Solana, zkSync, Linea — all from one place.',
    accent: C.teal,
  },
  {
    icon: '💬',
    title: 'Just Say It',
    body: 'Type or speak: "swap 0.5 ETH to USDC" or "send 100 USDC to my cold wallet". The agent handles the rest.',
    accent: C.kola,
  },
  {
    icon: '🏗️',
    title: 'Real African\nReal Estate',
    body: 'Invest in tokenized Nigerian and West African properties via Brickt pools — directly in your wallet.',
    accent: '#C8956A',
  },
]

export default function OnboardScreen() {
  const { login, authenticated } = usePrivy()
  const [step, setStep]          = useState<'slides' | 'auth'>('slides')
  const [slide, setSlide]        = useState(0)
  const [loading, setLoading]    = useState(false)

  if (authenticated) {
    router.replace('/')
    return null
  }

  if (step === 'slides') {
    return (
      <SafeAreaView style={styles.container}>
        {/* Kente top */}
        <View style={styles.kente} />

        {/* Slides */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
        >
          <View style={{ width: W * SLIDES.length, flexDirection: 'row' }}>
            {SLIDES.map((s, i) => (
              <View key={i} style={[styles.slide, { width: W }]}>
                {/* Logo mark */}
                <AnaraMarkLarge />

                <View style={[styles.iconWrap, { borderColor: s.accent, backgroundColor: `${s.accent}15` }]}>
                  <Text style={{ fontSize: 48 }}>{s.icon}</Text>
                </View>

                <Text style={styles.slideTitle}>{s.title}</Text>
                <Text style={styles.slideBody}>{s.body}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === slide && { backgroundColor: C.gold, width: 16 }]}
            />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.ctaRow}>
          {slide < SLIDES.length - 1 ? (
            <>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('auth')}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.nextBtn}
                onPress={() => setSlide(v => Math.min(v + 1, SLIDES.length - 1))}
              >
                <Text style={styles.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, { flex: 1 }]}
              onPress={() => setStep('auth')}
            >
              <Text style={styles.nextBtnText}>Get Started →</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // Auth screen
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.kente} />

      <View style={styles.authWrap}>
        <AnaraMarkLarge />

        <Text style={styles.authTitle}>
          Welcome to{'\n'}<Text style={{ color: C.gold2 }}>Anara</Text>
        </Text>
        <Text style={styles.authSubtitle}>
          The world's first autonomous multichain wallet.{'\n'}Your agent starts working the moment you sign in.
        </Text>

        {/* Auth options */}
        <View style={styles.authOptions}>
          <TouchableOpacity
            style={styles.authOption}
            onPress={async () => {
              setLoading(true)
              try { await login({ loginMethods: ['email'] }) } catch {}
              setLoading(false)
            }}
          >
            <Text style={styles.authOptionIcon}>✉️</Text>
            <Text style={styles.authOptionText}>Continue with Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.authOption}
            onPress={async () => {
              setLoading(true)
              try { await login({ loginMethods: ['sms'] }) } catch {}
              setLoading(false)
            }}
          >
            <Text style={styles.authOptionIcon}>📱</Text>
            <Text style={styles.authOptionText}>Continue with Phone</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or connect existing wallet</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.authOption, styles.walletOption]}
            onPress={async () => {
              setLoading(true)
              try { await login({ loginMethods: ['wallet'] }) } catch {}
              setLoading(false)
            }}
          >
            <Text style={styles.authOptionIcon}>🔑</Text>
            <Text style={styles.authOptionText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to Anara's Terms of Service and Privacy Policy.
          Your keys, your coins — always.
        </Text>
      </View>
    </SafeAreaView>
  )
}

function AnaraMarkLarge() {
  return (
    <View style={styles.logoWrap}>
      <View style={styles.logoBlue}>
        <View style={styles.logoPurple}>
          <View style={styles.logoGold}>
            <View style={styles.logoSquare} />
          </View>
        </View>
      </View>
      <Text style={styles.logoText}>Anara</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.earth },
  kente:           { height: 4, backgroundColor: C.gold },
  slide:           { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 40, gap: 20 },
  iconWrap:        { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  slideTitle:      { fontFamily: 'serif', fontSize: 30, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 36 },
  slideBody:       { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
  dots:            { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingBottom: 16 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted2, transition: 'all 0.2s' },
  ctaRow:          { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingBottom: 24 },
  skipBtn:         { paddingVertical: 14, paddingHorizontal: 20 },
  skipText:        { color: C.muted, fontSize: 14, fontWeight: '600' },
  nextBtn:         { flex: 1, backgroundColor: C.gold, paddingVertical: 14, alignItems: 'center' },
  nextBtnText:     { fontSize: 14, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.6 },
  authWrap:        { flex: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, alignItems: 'center', gap: 16 },
  authTitle:       { fontFamily: 'serif', fontSize: 34, fontWeight: '900', color: C.text, textAlign: 'center', lineHeight: 40 },
  authSubtitle:    { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  authOptions:     { width: '100%', gap: 10, marginTop: 8 },
  authOption:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, padding: 14 },
  walletOption:    { backgroundColor: C.clay2 },
  authOptionIcon:  { fontSize: 20 },
  authOptionText:  { fontSize: 14, fontWeight: '600', color: C.text },
  divider:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:     { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  legal:           { fontSize: 10, color: C.muted2, textAlign: 'center', lineHeight: 15, marginTop: 8 },
  logoWrap:        { alignItems: 'center', gap: 10, marginBottom: 8 },
  logoBlue:        { width: 64, height: 64, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center' },
  logoPurple:      { width: 45, height: 45, backgroundColor: '#7B3FB5', transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  logoGold:        { width: 32, height: 32, backgroundColor: '#F0A500', alignItems: 'center', justifyContent: 'center' },
  logoSquare:      { width: 14, height: 14, borderWidth: 2.5, borderColor: '#1A1208', backgroundColor: 'transparent' },
  logoText:        { fontFamily: 'serif', fontSize: 28, fontWeight: '900', color: C.text },
})
