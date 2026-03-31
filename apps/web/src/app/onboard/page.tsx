'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnaraLogo, KenteStrip, LiveDot } from '../../components/ui'
import { colors } from '../../lib/ui-tokens'
import { useAuth } from '../../lib/auth'

const FEATURES = [
  { icon: '🤖', title: 'Autonomous Agent',    body: 'Executes arbitrage, yield compounding, and rebalancing 24/7 — no approvals needed.' },
  { icon: '⛓',  title: '10 Chains',           body: 'Base, Ethereum, Arbitrum, Optimism, BNB, Polygon, Avalanche, Solana, zkSync, Linea.' },
  { icon: '💬', title: 'Natural Language',     body: '"Swap 0.5 ETH to USDC" — or say it out loud. The agent handles execution.' },
  { icon: '🏗️', title: 'Real Estate Pools',   body: 'Invest in tokenized Nigerian and West African properties via Brickt.' },
]

export default function OnboardPage() {
  const { login, authenticated } = useAuth()
  const router  = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (authenticated) {
      router.replace('/dashboard')
    }
  }, [authenticated, router])

  const handleLogin = async (method: 'email' | 'sms' | 'wallet' | 'google') => {
    setLoading(true)
    try {
      await login({ loginMethods: [method] })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-earth text-cream flex flex-col">
      <KenteStrip height={4} />

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <AnaraLogo size={32} />
          <span className="font-display font-black text-xl">Anara</span>
        </div>
        <div className="flex items-center gap-2">
          <LiveDot />
          <span className="text-[10px] text-green font-bold tracking-widest uppercase">Agent Online</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center max-w-2xl mx-auto w-full">

        <div className="mb-6">
          <AnaraLogo size={64} />
        </div>

        <h1 className="font-display font-black text-5xl leading-tight mb-4">
          The World's First<br />
          <span className="text-gold2">Autonomous</span> Wallet
        </h1>

        <p className="text-muted text-lg leading-relaxed mb-10 max-w-md">
          Your agent executes DeFi strategies, manages 10 chains, and briefs you on everything it did — while you live your life.
        </p>

        {/* Auth options */}
        <div className="flex flex-col gap-3 w-full max-w-sm mb-10">
          {[
            { method: 'email'  as const, icon: '✉️', label: 'Continue with Email' },
            { method: 'sms'    as const, icon: '📱', label: 'Continue with Phone' },
            { method: 'google' as const, icon: '🔷', label: 'Continue with Google' },
          ].map(o => (
            <button
              key={o.method}
              onClick={() => handleLogin(o.method)}
              disabled={loading}
              className="flex items-center gap-4 bg-soil border border-border px-5 py-3.5 hover:border-border2 transition-colors disabled:opacity-50 text-left"
            >
              <span className="text-xl">{o.icon}</span>
              <span className="font-semibold">{o.label}</span>
            </button>
          ))}

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted uppercase tracking-wider">or connect wallet</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={() => handleLogin('wallet')}
            disabled={loading}
            className="flex items-center gap-4 bg-clay2 border border-border px-5 py-3.5 hover:border-gold/40 transition-colors disabled:opacity-50 text-left"
          >
            <span className="text-xl">🔑</span>
            <span className="font-semibold">MetaMask / WalletConnect</span>
          </button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-soil border border-border p-4 text-left">
              <span className="text-2xl mb-2 block">{f.icon}</span>
              <div className="font-bold text-sm mb-1">{f.title}</div>
              <div className="text-muted text-xs leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>

        <p className="text-muted2 text-xs mt-8 leading-relaxed max-w-sm">
          By continuing, you agree to Anara's Terms of Service and Privacy Policy.
          Your keys stay yours — always.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AnaraLogo size={16} />
          <span className="text-[10px] text-muted font-mono">v0.1.0 · Base · Autonomous</span>
        </div>
        <span className="text-[10px] text-muted italic">
          "The wealth of a man is not in his pocket, but in the land he cultivates."
        </span>
      </footer>
    </div>
  )
}
