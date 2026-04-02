'use client'

type AnalyticsEvent =
  | 'signup_completed'
  | 'wallet_linked'
  | 'dashboard_loaded'
  | 'chat_submitted'
  | 'preview_generated'
  | 'tx_submitted'
  | 'tx_confirmed'
  | 'tx_failed'

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

const DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true'

export function track(event: AnalyticsEvent, payload: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') return

  const entry = {
    event,
    timestamp: Date.now(),
    ...payload,
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(entry)

  if (DEBUG) {
    console.info('[analytics]', entry)
  }
}
