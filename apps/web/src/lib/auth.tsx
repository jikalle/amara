'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  PrivyProvider,
  useIdentityToken,
  useLogout,
  usePrivy,
  type User,
} from '@privy-io/react-auth'
import { base, mainnet } from 'viem/chains'
import { resolveWalletIdentity } from './wallet'

type LoginMethod = 'email' | 'sms' | 'wallet' | 'google'

interface AuthContextValue {
  ready: boolean
  authenticated: boolean
  user: User | null
  identityToken: string | null
  login: (options?: { loginMethods?: LoginMethod[] }) => Promise<void>
  logout: () => Promise<void>
}

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? ''
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID. Configure Privy before running the web app.')
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'sms', 'google', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#D4920A',
          logo: '/anara-logo.svg',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
        },
        defaultChain: base,
        supportedChains: [base, mainnet],
        externalWallets: {
          walletConnect: {
            enabled: true,
          },
        },
      }}
    >
      <AuthSessionProvider>{children}</AuthSessionProvider>
    </PrivyProvider>
  )
}

function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login: openLogin } = usePrivy()
  const { identityToken } = useIdentityToken()
  const { logout } = useLogout()
  const lastSyncedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || !authenticated || !identityToken || !user?.id) return

    const { address } = resolveWalletIdentity(user)
    const syncKey = `${user.id}:${address ?? 'no-wallet'}`
    if (lastSyncedRef.current === syncKey) return

    let cancelled = false

    async function syncUser() {
      try {
        const res = await fetch(`${API_URL}/api/auth/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${identityToken}`,
          },
          body: JSON.stringify({
            walletAddress: address ?? undefined,
          }),
        })

        if (!res.ok) {
          throw new Error(`Auth sync failed with status ${res.status}`)
        }

        if (!cancelled) {
          lastSyncedRef.current = syncKey
        }
      } catch (error) {
        if (!cancelled) {
          lastSyncedRef.current = null
          console.error('[auth sync]', error)
        }
      }
    }

    void syncUser()

    return () => {
      cancelled = true
    }
  }, [authenticated, identityToken, ready, user])

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    authenticated,
    user,
    identityToken,
    login: async (options) => {
      const primaryMethod = options?.loginMethods?.[0] ?? 'email'
      openLogin({
        loginMethods: [primaryMethod],
      })
    },
    logout,
  }), [authenticated, identityToken, logout, openLogin, ready, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
