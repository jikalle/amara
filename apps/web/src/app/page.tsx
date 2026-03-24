'use client'

import { useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useRouter } from 'next/navigation'
import { AnaraLogo } from '@anara/ui'

export default function RootPage() {
  const { ready, authenticated } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (!ready) return
    router.replace(authenticated ? '/dashboard' : '/onboard')
  }, [ready, authenticated, router])

  return (
    <div className="min-h-screen bg-earth flex flex-col items-center justify-center gap-4">
      <AnaraLogo size={56} />
      <div className="text-[10px] font-mono text-muted tracking-[0.2em] animate-pulse">
        LOADING ANARA…
      </div>
    </div>
  )
}
