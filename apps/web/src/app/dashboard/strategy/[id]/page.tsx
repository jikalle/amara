'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Badge, Button, Card, KenteStrip, ActionCard } from '../../../../components/ui'
import { useAuth } from '../../../../lib/auth'
import { resolveWalletIdentity } from '../../../../lib/wallet'
import { useAgent } from '../../../../hooks/useAgent'
import type { AgentActionCard } from '@anara/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type StrategySettings = {
  autoExecute: boolean
  executionCapUsd: number
  allowSwaps: boolean
  allowBridges: boolean
  allowSends: boolean
  arbEnabled: boolean
  yieldEnabled: boolean
  rebalanceEnabled: boolean
  bricktEnabled: boolean
  updatedAt?: string
}

type StrategyResponse = {
  id: string
  name: string
  status: string
  type: string
  pnl: string
  settings: StrategySettings
  details: Record<string, string | number | boolean>
}

type StrategyPreviewResponse =
  | { actionable: true; actionCard: AgentActionCard; summary: string }
  | { actionable: false; reason: string; summary: string }

export default function StrategyDetailPage() {
  const params = useParams<{ id: string }>()
  const strategyId = params.id
  const apiStrategyId = strategyId === 'reb' ? 'rebalance' : strategyId
  const { ready, authenticated, user, identityToken } = useAuth()
  const { executeStandaloneAction } = useAgent()

  const [strategy, setStrategy] = useState<StrategyResponse | null>(null)
  const [settings, setSettings] = useState<StrategySettings | null>(null)
  const [thresholdInput, setThresholdInput] = useState('')
  const [previewSummary, setPreviewSummary] = useState<string | null>(null)
  const [previewReason, setPreviewReason] = useState<string | null>(null)
  const [previewCard, setPreviewCard] = useState<AgentActionCard | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const walletIdentity = resolveWalletIdentity(user)

  useEffect(() => {
    if (!ready) return
    if (!authenticated) {
      setIsLoading(false)
      return
    }
    if (!identityToken) {
      setIsLoading(false)
      return
    }
    let mounted = true

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/api/strategy/${apiStrategyId}`, {
          headers: {
            Authorization: `Bearer ${identityToken}`,
          },
        })
        if (!res.ok) throw new Error(`Failed to load strategy ${apiStrategyId}`)
        const data = await res.json() as StrategyResponse
        if (mounted) {
          setStrategy(data)
          setSettings(data.settings)
          setThresholdInput(String(data.settings.executionCapUsd ?? ''))
        }
      } catch (err) {
        if (mounted) {
          setStrategy(null)
          setSettings(null)
          setThresholdInput('')
          setError(err instanceof Error ? err.message : 'Strategy unavailable')
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [apiStrategyId, authenticated, identityToken, ready])

  async function toggle(action: 'pause' | 'resume') {
    if (!identityToken) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/strategy/${apiStrategyId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${identityToken}`,
        },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error('Failed to update strategy')
      const data = await res.json()
      setStrategy((current) => ({
        ...(current ?? {}),
        status: data.newStatus ?? (current?.status ?? 'active'),
      } as StrategyResponse))
      if (data.settings) {
        setSettings(data.settings)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update strategy')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function saveSettings() {
    if (!identityToken || !settings) return
    setIsSubmitting(true)
    setError(null)
    try {
      const nextThreshold = Number(thresholdInput)
      if (!thresholdInput.trim() || !Number.isFinite(nextThreshold) || nextThreshold < 0) {
        throw new Error('Enter a valid approval threshold.')
      }
      const res = await fetch(`${API_URL}/api/strategy/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${identityToken}`,
        },
        body: JSON.stringify({
          autoExecute: settings.autoExecute,
          requireApprovalAbove: nextThreshold,
          allowSwaps: settings.allowSwaps,
          allowBridges: settings.allowBridges,
          allowSends: settings.allowSends,
        }),
      })
      if (!res.ok) throw new Error('Failed to save strategy settings')
      const data = await res.json()
      if (data.settings) {
        setSettings(data.settings)
        setThresholdInput(String(data.settings.executionCapUsd ?? ''))
        setStrategy((current) => current ? { ...current, settings: data.settings } : current)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save strategy settings')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function generatePreview() {
    if (!identityToken) return
    setIsPreviewLoading(true)
    setPreviewSummary(null)
    setPreviewReason(null)
    setPreviewCard(null)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/strategy/${apiStrategyId}/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${identityToken}`,
        },
      })
      const data = await res.json() as StrategyPreviewResponse | { error?: string }
      if (!res.ok) throw new Error(typeof data === 'object' && data && 'error' in data ? data.error ?? 'Failed to generate strategy preview' : 'Failed to generate strategy preview')
      if (!('actionable' in data)) {
        throw new Error('Invalid strategy preview response')
      }
      setPreviewSummary(data.summary)
      if (data.actionable) {
        setPreviewCard(data.actionCard)
        setPreviewReason(null)
      } else {
        setPreviewReason(data.reason)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate strategy preview')
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const status = strategy?.status ?? 'unknown'
  const isAwaitingSession = ready && authenticated && !identityToken

  return (
    <div className="min-h-screen bg-earth text-cream">
      <KenteStrip height={4} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted font-bold">Strategy</div>
            <h1 className="text-3xl font-display font-black mt-1">{getStrategyTitle(strategyId)}</h1>
          </div>
          <Link href="/dashboard" className="text-sm text-muted hover:text-cream transition-colors">
            Back
          </Link>
        </div>

        <Card kente className="mb-4">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <Badge variant={status === 'active' ? 'active' : status === 'paused' ? 'paused' : 'watching'}>
                {status}
              </Badge>
              <div className="text-sm text-muted">ID: {apiStrategyId}</div>
            </div>

            {isLoading && <p className="text-sm text-muted">Loading strategy state…</p>}
            {!isLoading && isAwaitingSession && <p className="text-sm text-muted">Waiting for authenticated session…</p>}
            {!isLoading && error && <p className="text-sm text-kola">{error}</p>}

            {!isLoading && strategy && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted">Name</span>
                  <span className="font-mono text-text2">{strategy.name}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted">Type</span>
                  <span className="font-mono text-text2">{strategy.type}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <span className="text-muted">{strategy.type === 'rebalance' ? 'Signal' : 'Performance'}</span>
                  <span className="font-mono text-text2">{strategy.pnl}</span>
                </div>
                {Object.entries(strategy.details ?? {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between border-b border-border/50 pb-2">
                    <span className="text-muted capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-text2">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && !strategy && !error && (
              <p className="text-sm text-muted">No strategy details returned yet.</p>
            )}
          </div>
        </Card>

        <Card className="mb-4">
          <div className="p-5 space-y-4">
            <div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-muted font-bold">Guardrails</div>
              <div className="mt-1 text-sm text-muted">
                These settings are persisted server-side for {walletIdentity.address ? `${walletIdentity.address.slice(0, 6)}…${walletIdentity.address.slice(-4)}` : 'your wallet'}.
              </div>
            </div>

            <label className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-text2">Future auto-actions (beta)</div>
                <div className="text-xs text-muted">Stores your preference for later. The current MVP still requires explicit confirmation before execution.</div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#D4920A]"
                checked={settings?.autoExecute ?? false}
                disabled={!settings || isLoading || isAwaitingSession}
                onChange={(event) => setSettings((current) => current ? { ...current, autoExecute: event.target.checked } : current)}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex items-center justify-between gap-3 border border-border/60 bg-clay px-3 py-2">
                <span className="text-sm font-semibold text-text2">Allow swaps</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#D4920A]"
                  checked={settings?.allowSwaps ?? false}
                  disabled={!settings || isLoading || isAwaitingSession}
                  onChange={(event) => setSettings((current) => current ? { ...current, allowSwaps: event.target.checked } : current)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 border border-border/60 bg-clay px-3 py-2">
                <span className="text-sm font-semibold text-text2">Allow bridges</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#D4920A]"
                  checked={settings?.allowBridges ?? false}
                  disabled={!settings || isLoading || isAwaitingSession}
                  onChange={(event) => setSettings((current) => current ? { ...current, allowBridges: event.target.checked } : current)}
                />
              </label>
              <label className="flex items-center justify-between gap-3 border border-border/60 bg-clay px-3 py-2">
                <span className="text-sm font-semibold text-text2">Allow sends</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#D4920A]"
                  checked={settings?.allowSends ?? false}
                  disabled={!settings || isLoading || isAwaitingSession}
                  onChange={(event) => setSettings((current) => current ? { ...current, allowSends: event.target.checked } : current)}
                />
              </label>
            </div>

            <label className="block">
              <div className="text-sm font-semibold text-text2">Execution cap (USD)</div>
              <div className="text-xs text-muted mb-2">Actions above this cap are blocked until you raise it.</div>
              <input
                type="number"
                min={0}
                step="1"
                value={thresholdInput}
                disabled={!settings || isLoading || isAwaitingSession}
                onChange={(event) => setThresholdInput(event.target.value)}
                className="w-full bg-clay border border-border px-3 py-2 text-sm text-text2 outline-none focus:border-gold2"
              />
            </label>

            <Button
              variant="primary"
              loading={isSubmitting}
              disabled={isSubmitting || !settings || isLoading || isAwaitingSession}
              onClick={saveSettings}
            >
              Save guardrails
            </Button>
          </div>
        </Card>

        <div className="flex gap-3">
          {apiStrategyId === 'rebalance' && (
            <Button
              variant="primary"
              loading={isPreviewLoading}
              disabled={isPreviewLoading || isSubmitting || !walletIdentity.address || isLoading || isAwaitingSession}
              onClick={generatePreview}
            >
              Generate Rebalance Preview
            </Button>
          )}
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting || status === 'active' || !walletIdentity.address || isLoading || isAwaitingSession}
            onClick={() => toggle('resume')}
          >
            Resume
          </Button>
          <Button
            variant="secondary"
            loading={isSubmitting}
            disabled={isSubmitting || status === 'paused' || !walletIdentity.address || isLoading || isAwaitingSession}
            onClick={() => toggle('pause')}
          >
            Pause
          </Button>
        </div>

        {apiStrategyId === 'rebalance' && (previewSummary || previewReason || previewCard) && (
          <Card className="mt-4">
            <div className="p-5 space-y-4">
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted font-bold">Rebalance Action</div>
                {previewSummary && <div className="mt-2 text-sm text-text2 leading-6">{previewSummary}</div>}
                {previewReason && <div className="mt-2 text-sm text-muted leading-6">{previewReason}</div>}
              </div>

              {previewCard && (
                <ActionCard
                  card={previewCard}
                  disabled={isSubmitting}
                  onConfirm={() => { void executeStandaloneAction(previewCard, setPreviewCard) }}
                  onCancel={() => setPreviewCard({ ...previewCard, status: 'cancelled' })}
                />
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function getStrategyTitle(id: string) {
  const titles: Record<string, string> = {
    arb: 'Arb Bot',
    yield: 'Yield Optimizer',
    reb: 'Auto-Rebalance',
    rebalance: 'Auto-Rebalance',
    brickt: 'Brickt Pools',
  }
  return titles[id] ?? 'Strategy'
}
