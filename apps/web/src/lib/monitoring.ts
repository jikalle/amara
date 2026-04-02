'use client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type ClientErrorType = 'window_error' | 'unhandled_rejection'

type ClientErrorPayload = {
  type: ClientErrorType
  message: string
  stack?: string
  source?: string
  pathname?: string
  userAgent?: string
  timestamp?: number
}

const seenErrors = new Set<string>()

export function reportClientError(payload: ClientErrorPayload) {
  if (typeof window === 'undefined') return

  const fingerprint = [
    payload.type,
    payload.message,
    payload.source ?? '',
    payload.pathname ?? '',
  ].join('::')

  if (seenErrors.has(fingerprint)) return
  seenErrors.add(fingerprint)

  const body = JSON.stringify({
    ...payload,
    pathname: payload.pathname ?? window.location.pathname,
    userAgent: payload.userAgent ?? window.navigator.userAgent,
    timestamp: payload.timestamp ?? Date.now(),
  })

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      navigator.sendBeacon(`${API_URL}/api/monitoring/client-error`, blob)
      return
    }
  } catch {
    // Fall through to fetch keepalive.
  }

  void fetch(`${API_URL}/api/monitoring/client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Avoid recursive error reporting if monitoring itself fails.
  })
}
