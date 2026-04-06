import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ScrollView, Dimensions, TextInput, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  hasError,
  isCreating,
  isNotCreated,
  useEmbeddedWallet,
  useLoginWithEmail,
  useLoginWithSMS,
  useOAuthFlow,
  usePrivy,
} from '@privy-io/expo'
import { router }     from 'expo-router'
import { resolveWalletIdentity } from '../lib/wallet'

const { width: W } = Dimensions.get('window')

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A', muted2: '#92714C', clay2: '#382715',
}

const SLIDES = [
  {
    icon: '🤖',
    title: 'Your Wallet,\nWorking 24/7',
    body: 'Amara helps you manage swaps, sends, bridges, and strategy previews from one guided wallet surface.',
    accent: C.gold,
  },
  {
    icon: '⛓',
    title: '3 Chains,\nOne Wallet',
    body: 'Base, Ethereum, and BNB Chain in one guided wallet with direct actions and conversational control.',
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
  const { user } = usePrivy()
  const wallet = useEmbeddedWallet()
  const authenticated = Boolean(user)
  const identity = resolveWalletIdentity(user)
  const { start: startOAuth } = useOAuthFlow()
  const emailLogin = useLoginWithEmail()
  const smsLogin = useLoginWithSMS()
  const [step, setStep]          = useState<'slides' | 'auth'>('slides')
  const [authMode, setAuthMode]  = useState<'root' | 'email' | 'phone'>('root')
  const [slide, setSlide]        = useState(0)
  const [loading, setLoading]    = useState(false)
  const [email, setEmail]        = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [phone, setPhone]        = useState('')
  const [phoneCode, setPhoneCode] = useState('')

  if (authenticated && identity.hasWallet) {
    router.replace('/')
    return null
  }

  if (authenticated && !identity.hasWallet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.kente} />
        <View style={styles.authWrap}>
          <AnaraMarkLarge />
          <Text style={styles.authTitle}>
            Finish wallet{'\n'}<Text style={{ color: C.gold2 }}>setup</Text>
          </Text>
          <Text style={styles.authSubtitle}>
            Your account is authenticated. Create or recover an embedded wallet to start using Amara on mobile.
          </Text>

          <View style={styles.authOptions}>
            {isNotCreated(wallet) && (
              <TouchableOpacity
                style={[styles.authOption, styles.walletOption]}
                onPress={() => wallet.create()}
              >
                <Text style={styles.authOptionIcon}>🔐</Text>
                <Text style={styles.authOptionText}>Create Embedded Wallet</Text>
              </TouchableOpacity>
            )}

            {isCreating(wallet) && (
              <View style={[styles.authOption, styles.walletOption, styles.optionCenter]}>
                <ActivityIndicator color={C.gold2} />
                <Text style={styles.authOptionText}>Creating wallet…</Text>
              </View>
            )}

            {hasError(wallet) && (
              <View style={styles.inlineErrorBox}>
                <Text style={styles.inlineErrorText}>{wallet.error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.skipBtnBox}
              onPress={async () => {
                try {
                  router.replace('/')
                } catch {}
              }}
            >
              <Text style={styles.skipText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    )
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
          Welcome to{'\n'}<Text style={{ color: C.gold2 }}>Amara</Text>
        </Text>
        <Text style={styles.authSubtitle}>
          A guided multichain wallet for real actions.{'\n'}Sign in to manage Base, Ethereum, and BNB Chain from one place.
        </Text>

        {/* Auth options */}
        <View style={styles.authOptions}>
          {authMode === 'root' ? (
            <>
              <TouchableOpacity
                style={styles.authOption}
                onPress={() => setAuthMode('email')}
              >
                <Text style={styles.authOptionIcon}>✉️</Text>
                <Text style={styles.authOptionText}>Continue with Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.authOption}
                onPress={() => setAuthMode('phone')}
              >
                <Text style={styles.authOptionIcon}>📱</Text>
                <Text style={styles.authOptionText}>Continue with Phone</Text>
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with google</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.authOption, styles.walletOption]}
                onPress={async () => {
                  setLoading(true)
                  try {
                    await startOAuth({ provider: 'google' })
                  } catch (error) {
                    Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Try again.')
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                <Text style={styles.authOptionIcon}>🔑</Text>
                <Text style={styles.authOptionText}>{loading ? 'Opening Google…' : 'Continue with Google'}</Text>
              </TouchableOpacity>
            </>
          ) : authMode === 'email' ? (
            <>
              <TextInput
                style={styles.authInput}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
              />
              {emailLogin.state.status === 'awaiting-code-input' && (
                <TextInput
                  style={styles.authInput}
                  value={emailCode}
                  onChangeText={setEmailCode}
                  keyboardType="number-pad"
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={C.muted}
                />
              )}
              <TouchableOpacity
                style={[styles.authOption, styles.walletOption, styles.optionCenter]}
                onPress={async () => {
                  try {
                    if (emailLogin.state.status === 'awaiting-code-input') {
                      await emailLogin.loginWithCode({ code: emailCode, email })
                    } else {
                      await emailLogin.sendCode({ email })
                    }
                  } catch (error) {
                    Alert.alert('Email sign-in failed', error instanceof Error ? error.message : 'Try again.')
                  }
                }}
              >
                <Text style={styles.authOptionText}>
                  {emailLogin.state.status === 'awaiting-code-input' ? 'Verify Email Code' : 'Send Email Code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtnBox} onPress={() => setAuthMode('root')}>
                <Text style={styles.skipText}>Back</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.authInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+2348012345678"
                placeholderTextColor={C.muted}
              />
              {smsLogin.state.status === 'awaiting-code-input' && (
                <TextInput
                  style={styles.authInput}
                  value={phoneCode}
                  onChangeText={setPhoneCode}
                  keyboardType="number-pad"
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={C.muted}
                />
              )}
              <TouchableOpacity
                style={[styles.authOption, styles.walletOption, styles.optionCenter]}
                onPress={async () => {
                  try {
                    if (smsLogin.state.status === 'awaiting-code-input') {
                      await smsLogin.loginWithCode({ code: phoneCode, phone })
                    } else {
                      await smsLogin.sendCode({ phone })
                    }
                  } catch (error) {
                    Alert.alert('Phone sign-in failed', error instanceof Error ? error.message : 'Try again.')
                  }
                }}
              >
                <Text style={styles.authOptionText}>
                  {smsLogin.state.status === 'awaiting-code-input' ? 'Verify SMS Code' : 'Send SMS Code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtnBox} onPress={() => setAuthMode('root')}>
                <Text style={styles.skipText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to Amara's Terms of Service and Privacy Policy.
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
      <Text style={styles.logoText}>Amara</Text>
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
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted2 },
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
  optionCenter:    { justifyContent: 'center' },
  authOptionIcon:  { fontSize: 20 },
  authOptionText:  { fontSize: 14, fontWeight: '600', color: C.text },
  authInput:       { width: '100%', backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 14, color: C.text, fontSize: 14 },
  divider:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:     { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  legal:           { fontSize: 10, color: C.muted2, textAlign: 'center', lineHeight: 15, marginTop: 8 },
  inlineErrorBox:  { width: '100%', borderWidth: 1, borderColor: `${C.kola}55`, backgroundColor: `${C.kola}22`, padding: 12 },
  inlineErrorText: { fontSize: 12, color: C.text2, lineHeight: 18 },
  skipBtnBox:      { paddingVertical: 10, alignItems: 'center' },
  logoWrap:        { alignItems: 'center', gap: 10, marginBottom: 8 },
  logoBlue:        { width: 64, height: 64, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center' },
  logoPurple:      { width: 45, height: 45, backgroundColor: '#7B3FB5', transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  logoGold:        { width: 32, height: 32, backgroundColor: '#F0A500', alignItems: 'center', justifyContent: 'center' },
  logoSquare:      { width: 14, height: 14, borderWidth: 2.5, borderColor: '#1A1208', backgroundColor: 'transparent' },
  logoText:        { fontFamily: 'serif', fontSize: 28, fontWeight: '900', color: C.text },
})
