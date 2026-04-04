'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSwapQuote } from '@anara/chain'
import { ActionCard, Button, TypingIndicator } from '../../../components/ui'
import { useAgent } from '../../../hooks/useAgent'
import { useAgentStore, useWalletStore } from '../../../store'
import type { AgentActionCard, TokenBalance } from '@anara/types'

const SUGGESTIONS = [
  'Swap 0.1 ETH to USDC',
  'Bridge 500 USDC to Ethereum',
  'Send 150 USDC to 0x1111111111111111111111111111111111111111',
  "What's my portfolio value?",
]

export default function DashboardChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { messages, isThinking, sendMessage, executeAction, executeStandaloneAction, cancelAction } = useAgent()
  const clearChat = useAgentStore((state) => state.clearChat)
  const featureFlags = useAgentStore((state) => state.state.featureFlags)
  const hasWallet = useWalletStore((state) => state.hasWallet)
  const address = useWalletStore((state) => state.address)
  const tokens = useWalletStore((state) => state.tokens)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const autoSentRef = useRef<string | null>(null)
  const action = searchParams.get('action') as 'send' | 'receive' | 'swap' | 'bridge' | null

  const canSend = useMemo(() => input.trim().length > 0 && !isThinking && hasWallet, [input, isThinking, hasWallet])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    const prompt = searchParams.get('prompt')
    const autoSend = searchParams.get('autosend') === '1'
    if (prompt && !autoSend) {
      setInput(prompt)
    }
  }, [searchParams])

  useEffect(() => {
    const prompt = searchParams.get('prompt')
    const autoSend = searchParams.get('autosend') === '1'

    if (!prompt || !autoSend || !hasWallet || isThinking) return
    if (autoSentRef.current === prompt) return

    autoSentRef.current = prompt
    setInput('')
    void sendMessage(prompt)
  }, [searchParams, hasWallet, isThinking, sendMessage])

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await sendMessage(text)
  }

  return (
    <div className="min-h-screen bg-earth text-cream flex flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-soil/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6 xl:px-8">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-green font-bold">Agent Chat</div>
            <div className="text-sm text-muted">Execute swaps, sends, and bridges with confirmation.</div>
          </div>
          <div className="flex items-center gap-2">
            {!!messages.length && (
              <button
                onClick={clearChat}
                className="text-xs border border-border px-3 py-1.5 hover:border-kola/40 hover:text-kola transition-colors"
              >
                Clear
              </button>
            )}
            <button onClick={() => router.back()} className="text-xs text-muted hover:text-cream transition-colors">
              Back
            </button>
            <button onClick={() => router.push('/dashboard')} className="text-xs border border-border px-3 py-1.5 hover:border-border2 transition-colors">
              Close
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-5 md:px-6 xl:px-8 xl:gap-8">
        <section className="min-w-0 flex-1">
          {!hasWallet && (
            <div className="bg-kola/10 border border-kola/30 px-4 py-3 text-sm text-text2">
              Link a wallet first to use agent execution flows. Chat remains visible, but send and confirm actions are disabled until a wallet is available.
            </div>
          )}

          {hasWallet && address && (
            <div className="bg-clay border border-border px-4 py-3 text-xs font-mono text-muted">
              Active wallet: {address.slice(0, 8)}…{address.slice(-6)}
            </div>
          )}

          <div className="mt-4 bg-soil border border-border px-4 py-3 text-xs text-muted leading-5 xl:hidden">
            Amara prepares previews and submits transactions only after your confirmation. Network fees, slippage, bridge delays, and external protocol failures can still affect outcomes.
          </div>

          {featureFlags?.allowBridges === false && (
            <div className="mt-4 bg-teal/10 border border-teal/30 px-4 py-3 text-xs text-text2 leading-5">
              Bridge actions are currently disabled for this beta environment. Swap and send flows remain available.
            </div>
          )}

          {messages.length === 0 && (
            <div className="mt-4 bg-soil border border-border p-4">
              <div className="text-sm leading-6">
                Tell the agent what to do. It will return an action card for anything that needs confirmation before execution.
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs border border-border bg-clay px-3 py-2 hover:border-gold/40 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 border border-border bg-soil shadow-[0_18px_36px_rgba(0,0,0,0.14)]">
            <div ref={scrollRef} className="flex flex-col gap-4 overflow-y-auto px-4 py-4 pr-3 xl:min-h-[calc(100vh-17rem)] xl:max-h-[calc(100vh-17rem)] xl:px-5 xl:py-5">
              {action && (
                <div className="mr-auto max-w-xl xl:max-w-2xl">
                  <ChatQuickActionPanel
                    action={action}
                    address={address}
                    tokens={tokens}
                    hasWallet={hasWallet}
                    onExecuteDirectAction={executeStandaloneAction}
                    onClose={() => router.push('/dashboard/chat')}
                  />
                  <div className="mt-1 text-[10px] font-mono text-muted text-left">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-xl xl:max-w-2xl' : 'mr-auto max-w-xl xl:max-w-2xl'}>
                  {message.actionCard && (
                    <div className="mb-2">
                      <ActionCard
                        card={message.actionCard}
                        disabled={!hasWallet}
                        onConfirm={() => executeAction(message.id, message.actionCard!)}
                        onCancel={() => cancelAction(message.id)}
                      />
                    </div>
                  )}
                  <div className={message.role === 'user'
                    ? 'bg-gold text-earth px-4 py-3 text-sm'
                    : 'bg-clay/45 border border-border px-4 py-3 text-sm leading-6 break-words overflow-hidden'}>
                    <MessageBody content={message.content} />
                  </div>
                  <div className={`mt-1 text-[10px] font-mono text-muted ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}

              {isThinking && <TypingIndicator />}
            </div>
          </div>

          <div className="mt-4 border border-border bg-soil px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    if (canSend) void handleSend()
                  }
                }}
                placeholder={hasWallet ? 'Swap 0.2 ETH to USDC on Base' : 'Link a wallet to use the agent'}
                disabled={!hasWallet}
                className="flex-1 min-h-[90px] bg-clay border border-border text-sm px-3 py-3 outline-none focus:border-gold/40 resize-none disabled:opacity-50"
              />
              <Button onClick={handleSend} disabled={!canSend} loading={isThinking}>
                Send
              </Button>
            </div>
          </div>
        </section>

        <aside className="hidden xl:block xl:w-[320px] xl:flex-shrink-0 xl:space-y-4">
          <div className="border border-border bg-soil p-4 shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted">Execution Model</div>
            <div className="mt-3 text-sm text-text2 leading-6">
              Amara prepares previews and submits transactions only after your confirmation.
            </div>
            <div className="mt-3 text-xs text-muted leading-5">
              Network fees, slippage, bridge delays, and external protocol failures can still affect outcomes.
            </div>
          </div>

          <div className="border border-border bg-soil p-4 shadow-[0_14px_30px_rgba(0,0,0,0.12)]">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted">Quick Prompts</div>
            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="w-full text-left text-xs border border-border bg-clay px-3 py-3 hover:border-gold/40 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {featureFlags?.allowBridges === false && (
            <div className="border border-teal/30 bg-teal/10 px-4 py-3 text-xs text-text2 leading-5 shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
              Bridge actions are currently disabled for this beta environment. Swap and send flows remain available.
            </div>
          )}

          {hasWallet && address && (
            <div className="border border-border bg-soil px-4 py-3 text-xs font-mono text-muted shadow-[0_12px_24px_rgba(0,0,0,0.08)]">
              Active wallet: {address.slice(0, 8)}…{address.slice(-6)}
            </div>
          )}
        </aside>
      </main>
    </div>
  )
}

function MessageBody({ content }: { content: string }) {
  const executionSummary = parseExecutionSummary(content)

  if (executionSummary) {
    return (
      <div className="space-y-3">
        <div className="text-sm font-semibold text-cream">Execution submitted and awaiting confirmation.</div>
        <div className="grid gap-2 text-[12px]">
          {executionSummary.route && <SummaryRow label="Route" value={executionSummary.route} />}
          {executionSummary.gas && <SummaryRow label="Estimated gas" value={executionSummary.gas} />}
          {executionSummary.tx && <SummaryRow label="Tx" value={executionSummary.tx} mono />}
        </div>
        {executionSummary.explorerUrl && (
          <a
            href={executionSummary.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center border border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gold2 hover:border-gold/40"
          >
            View On Explorer
          </a>
        )}
      </div>
    )
  }

  return <div className="whitespace-pre-wrap break-words">{content}</div>
}

function SummaryRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted">{label}</span>
      <span className={mono ? 'font-mono text-right text-text2' : 'text-right text-text2'}>{value}</span>
    </div>
  )
}

function parseExecutionSummary(content: string) {
  if (!content.startsWith('Execution submitted and awaiting confirmation.')) {
    return null
  }

  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  return {
    route: lines.find((line) => line.startsWith('Route: '))?.replace('Route: ', '') ?? null,
    gas: lines.find((line) => line.startsWith('Estimated gas: '))?.replace('Estimated gas: ', '') ?? null,
    tx: lines.find((line) => line.startsWith('Tx: '))?.replace('Tx: ', '') ?? null,
    explorerUrl: lines.find((line) => line.startsWith('Explorer: '))?.replace('Explorer: ', '') ?? null,
  }
}

function ChatQuickActionPanel({
  action,
  address,
  tokens,
  hasWallet,
  onExecuteDirectAction,
  onClose,
}: {
  action: 'send' | 'receive' | 'swap' | 'bridge'
  address: string | null
  tokens: TokenBalance[]
  hasWallet: boolean
  onExecuteDirectAction: (card: AgentActionCard, onCardChange?: (nextCard: AgentActionCard) => void) => Promise<unknown>
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const sendTokenOptions = buildSendTokenOptions(tokens)
  const tokenOptions = buildTokenOptions(tokens)
  const defaultSendToken = sendTokenOptions[0]?.symbol ?? 'ETH'
  const defaultToken = tokenOptions[0]?.symbol ?? 'ETH'
  const [sendToken, setSendToken] = useState(defaultSendToken)
  const [sendAmount, setSendAmount] = useState('')
  const [sendAddress, setSendAddress] = useState('')
  const [sendChain, setSendChain] = useState<SendChainName>('Base')
  const [sendPreviewCard, setSendPreviewCard] = useState<AgentActionCard | null>(null)
  const [sendPreviewError, setSendPreviewError] = useState<string | null>(null)
  const [isSendPreviewLoading, setIsSendPreviewLoading] = useState(false)
  const [swapFromToken, setSwapFromToken] = useState(defaultToken)
  const [swapToToken, setSwapToToken] = useState(tokenOptions.find((token) => token.symbol !== defaultToken)?.symbol ?? 'USDC')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapChain, setSwapChain] = useState<SwapChainName>('Base')
  const [swapPreviewCard, setSwapPreviewCard] = useState<AgentActionCard | null>(null)
  const [swapPreviewError, setSwapPreviewError] = useState<string | null>(null)
  const [isSwapPreviewLoading, setIsSwapPreviewLoading] = useState(false)
  const [bridgeToken, setBridgeToken] = useState(defaultToken)
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgeFromChain, setBridgeFromChain] = useState<BridgeChainName>('Base')
  const [bridgeToChain, setBridgeToChain] = useState<BridgeChainName>('Ethereum')
  const bridgeTokenOptions = buildBridgeTokenOptions(tokens, bridgeFromChain, bridgeToChain)
  const [bridgePreviewCard, setBridgePreviewCard] = useState<AgentActionCard | null>(null)
  const [bridgePreviewError, setBridgePreviewError] = useState<string | null>(null)
  const [isBridgePreviewLoading, setIsBridgePreviewLoading] = useState(false)

  useEffect(() => {
    if (!bridgeTokenOptions.length) return
    if (!bridgeTokenOptions.some((token) => token.symbol === bridgeToken)) {
      setBridgeToken(bridgeTokenOptions[0]!.symbol)
    }
  }, [bridgeToken, bridgeTokenOptions])

  async function handleCopyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function handlePreviewSend() {
    setIsSendPreviewLoading(true)
    try {
      const preview = buildDirectSendPreviewCard({
        tokens,
        symbol: sendToken,
        amount: sendAmount,
        toAddress: sendAddress,
        chainName: sendChain,
      })

      if (preview instanceof Error) {
        setSendPreviewError(preview.message)
        setSendPreviewCard(null)
        return
      }

      setSendPreviewError(null)
      setSendPreviewCard(preview)
    } finally {
      setIsSendPreviewLoading(false)
    }
  }

  async function handlePreviewSwap() {
    setIsSwapPreviewLoading(true)
    try {
      const preview = await buildDirectSwapPreviewCard({
        tokens,
        symbolIn: swapFromToken,
        symbolOut: swapToToken,
        amount: swapAmount,
        chainName: swapChain,
        fromAddress: address,
      })

      if (preview instanceof Error) {
        setSwapPreviewError(preview.message)
        setSwapPreviewCard(null)
        return
      }

      setSwapPreviewError(null)
      setSwapPreviewCard(preview)
    } finally {
      setIsSwapPreviewLoading(false)
    }
  }

  async function handlePreviewBridge() {
    setIsBridgePreviewLoading(true)
    try {
      const preview = await buildDirectBridgePreviewCard({
        tokens,
        symbol: bridgeToken,
        amount: bridgeAmount,
        fromChainName: bridgeFromChain,
        toChainName: bridgeToChain,
        fromAddress: address,
      })

      if (preview instanceof Error) {
        setBridgePreviewError(preview.message)
        setBridgePreviewCard(null)
        return
      }

      setBridgePreviewError(null)
      setBridgePreviewCard(preview)
    } finally {
      setIsBridgePreviewLoading(false)
    }
  }

  return (
    <div className="bg-soil border border-border px-4 py-4 text-sm leading-6 xl:max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-text2">
            {action === 'receive'
              ? 'Here is your receive flow. You can copy your wallet address directly from chat.'
              : `I opened the ${action} flow here in chat. Fill the form below to generate a preview.`}
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted font-bold capitalize">
            {action} Form
          </div>
        </div>
        <button onClick={onClose} className="text-xs border border-border px-3 py-1.5 hover:border-border2 transition-colors flex-shrink-0">
          Close
        </button>
      </div>

      {action === 'receive' ? (
        <div className="mt-4 space-y-4">
          <div className="border border-border bg-clay p-4">
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">Wallet Address</div>
            <div className="font-mono text-[12px] text-text2 break-all">{address ?? 'No linked wallet address available yet.'}</div>
          </div>
          <button
            onClick={handleCopyAddress}
            disabled={!address}
            className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-50"
          >
            {copied ? 'Copied' : 'Copy Address'}
          </button>
        </div>
      ) : action === 'send' ? (
        <div className="mt-4 space-y-4">
          <QuickField
            label="Asset"
            control={(
              <select value={sendToken} onChange={(event) => setSendToken(event.target.value)} className={quickInputClassName}>
                {sendTokenOptions.map((token) => (
                  <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                ))}
              </select>
            )}
          />
          <QuickField
            label="Amount"
            control={<input value={sendAmount} onChange={(event) => setSendAmount(event.target.value)} placeholder="10" className={quickInputClassName} />}
          />
          <QuickField
            label="Recipient"
            control={<input value={sendAddress} onChange={(event) => setSendAddress(event.target.value)} placeholder="0x1111111111111111111111111111111111111111" className={`${quickInputClassName} font-mono`} />}
          />
          <QuickField
            label="Chain"
            control={(
              <select value={sendChain} onChange={(event) => setSendChain(event.target.value as SendChainName)} className={quickInputClassName}>
                <option>Base</option>
                <option>Ethereum</option>
                <option>BNB Chain</option>
              </select>
            )}
          />
          <button
            onClick={() => { void handlePreviewSend() }}
            disabled={isSendPreviewLoading}
            className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-60"
          >
            {isSendPreviewLoading ? 'Loading Preview…' : 'Preview Send'}
          </button>
          {sendPreviewError && <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">{sendPreviewError}</div>}
          {sendPreviewCard && (
            <PreviewModal
              card={sendPreviewCard}
              disabled={!hasWallet}
              onConfirm={() => { void onExecuteDirectAction(sendPreviewCard, setSendPreviewCard) }}
              onCancel={() => setSendPreviewCard({ ...sendPreviewCard, status: 'cancelled' })}
              onClose={() => setSendPreviewCard(null)}
            />
          )}
        </div>
      ) : action === 'swap' ? (
        <div className="mt-4 space-y-4">
          <QuickField
            label="From Asset"
            control={(
              <select value={swapFromToken} onChange={(event) => setSwapFromToken(event.target.value)} className={quickInputClassName}>
                {tokenOptions.map((token) => (
                  <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                ))}
              </select>
            )}
          />
          <QuickField
            label="To Asset"
            control={(
              <select value={swapToToken} onChange={(event) => setSwapToToken(event.target.value)} className={quickInputClassName}>
                {tokenOptions.map((token) => (
                  <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                ))}
              </select>
            )}
          />
          <QuickField label="Amount" control={<input value={swapAmount} onChange={(event) => setSwapAmount(event.target.value)} placeholder="0.01" className={quickInputClassName} />} />
          <QuickField
            label="Chain"
            control={(
              <select value={swapChain} onChange={(event) => setSwapChain(event.target.value as SwapChainName)} className={quickInputClassName}>
                <option>Base</option>
                <option>Ethereum</option>
                <option>BNB Chain</option>
              </select>
            )}
          />
          <button onClick={() => { void handlePreviewSwap() }} disabled={isSwapPreviewLoading} className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-60">
            {isSwapPreviewLoading ? 'Loading Preview…' : 'Preview Swap'}
          </button>
          {swapPreviewError && <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">{swapPreviewError}</div>}
          {swapPreviewCard && (
            <PreviewModal
              card={swapPreviewCard}
              disabled={!hasWallet}
              onConfirm={() => { void onExecuteDirectAction(swapPreviewCard, setSwapPreviewCard) }}
              onCancel={() => setSwapPreviewCard({ ...swapPreviewCard, status: 'cancelled' })}
              onClose={() => setSwapPreviewCard(null)}
            />
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <QuickField
            label="Asset"
            control={(
              <select value={bridgeToken} onChange={(event) => setBridgeToken(event.target.value)} className={quickInputClassName}>
                {bridgeTokenOptions.map((token) => (
                  <option key={`${token.symbol}-${token.chain}`} value={token.symbol}>{token.symbol} · {token.chain}</option>
                ))}
              </select>
            )}
          />
          <QuickField label="Amount" control={<input value={bridgeAmount} onChange={(event) => setBridgeAmount(event.target.value)} placeholder="10" className={quickInputClassName} />} />
          <div className="grid grid-cols-2 gap-3">
            <QuickField
              label="From"
              control={(
                <select value={bridgeFromChain} onChange={(event) => setBridgeFromChain(event.target.value as BridgeChainName)} className={quickInputClassName}>
                  <option>Base</option>
                  <option>Ethereum</option>
                  <option>BNB Chain</option>
                </select>
              )}
            />
            <QuickField
              label="To"
              control={(
                <select value={bridgeToChain} onChange={(event) => setBridgeToChain(event.target.value as BridgeChainName)} className={quickInputClassName}>
                  <option>Ethereum</option>
                  <option>Base</option>
                  <option>BNB Chain</option>
                </select>
              )}
            />
          </div>
          <button onClick={() => { void handlePreviewBridge() }} disabled={isBridgePreviewLoading} className="w-full bg-gold text-earth font-bold text-xs uppercase tracking-wide px-4 py-3 disabled:opacity-60">
            {isBridgePreviewLoading ? 'Loading Preview…' : 'Preview Bridge'}
          </button>
          {bridgePreviewError && <div className="border border-kola/30 bg-kola/10 px-4 py-3 text-xs text-text2">{bridgePreviewError}</div>}
          {!bridgeTokenOptions.length && (
            <div className="border border-border bg-clay px-4 py-3 text-xs text-text2">
              No bridgeable assets are available for this chain pair yet.
            </div>
          )}
          {bridgePreviewCard && (
            <PreviewModal
              card={bridgePreviewCard}
              disabled={!hasWallet}
              onConfirm={() => { void onExecuteDirectAction(bridgePreviewCard, setBridgePreviewCard) }}
              onCancel={() => setBridgePreviewCard({ ...bridgePreviewCard, status: 'cancelled' })}
              onClose={() => setBridgePreviewCard(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PreviewModal({
  card,
  disabled,
  onConfirm,
  onCancel,
  onClose,
}: {
  card: AgentActionCard
  disabled: boolean
  onConfirm: () => void
  onCancel: () => void
  onClose: () => void
}) {
  const terminalState =
    card.status === 'confirmed' ||
    card.status === 'failed' ||
    card.status === 'cancelled'

  return (
    <div className="fixed inset-0 z-30">
      <button
        aria-label="Close preview"
        className="absolute inset-0 bg-earth/75"
        onClick={terminalState ? onClose : undefined}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md border border-border bg-soil shadow-2xl xl:bottom-auto xl:left-1/2 xl:top-1/2 xl:max-w-xl xl:-translate-x-1/2 xl:-translate-y-1/2">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted">Action Preview</div>
            <div className="text-sm text-text2 mt-1">Review the route and confirm when ready.</div>
          </div>
          <button
            onClick={onClose}
            disabled={!terminalState && card.status !== 'pending'}
            className="text-xs border border-border px-3 py-1.5 hover:border-border2 transition-colors disabled:opacity-40"
          >
            Close
          </button>
        </div>
        <div className="p-4">
          <ActionCard
            card={card}
            disabled={disabled}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  )
}

function QuickField({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted mb-2">{label}</div>
      {control}
    </label>
  )
}

const quickInputClassName = 'w-full border border-border bg-clay px-3 py-3 text-sm text-text2 outline-none focus:border-gold/40'

function buildTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
    .filter((token) =>
      (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) &&
      (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
    )
    .map((token) => ({
      symbol: token.symbol,
      chain: token.chainId === 1 ? 'Ethereum' : token.chainId === 56 ? 'BNB Chain' : 'Base',
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!options.length) {
    return [
      { symbol: 'ETH', chain: 'Base' },
      { symbol: 'USDC', chain: 'Base' },
      { symbol: 'ETH', chain: 'Ethereum' },
      { symbol: 'BNB', chain: 'BNB Chain' },
      { symbol: 'USDT', chain: 'BNB Chain' },
    ]
  }

  return options
}

function buildSendTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
    .filter((token) =>
      (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) &&
      (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
    )
    .map((token) => ({
      symbol: token.symbol,
      chain: token.chainId === 1 ? 'Ethereum' : token.chainId === 56 ? 'BNB Chain' : 'Base',
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  if (!options.length) {
    return [
      { symbol: 'ETH', chain: 'Base' },
      { symbol: 'USDC', chain: 'Base' },
      { symbol: 'ETH', chain: 'Ethereum' },
      { symbol: 'BNB', chain: 'BNB Chain' },
      { symbol: 'USDT', chain: 'BNB Chain' },
    ]
  }

  return options
}

function buildBridgeTokenOptions(tokens: TokenBalance[], fromChain: BridgeChainName, toChain: BridgeChainName) {
  const fromChainId = getBridgeChainId(fromChain)
  const toChainId = getBridgeChainId(toChain)
  const seen = new Set<string>()

  return tokens
    .filter((token) =>
      token.chainId === fromChainId &&
      (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0)
    )
    .filter((token) => resolveSwapTokenConfig(tokens, token.symbol, toChainId))
    .map((token) => ({
      symbol: token.symbol,
      chain: fromChain,
    }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function parseUsdAmount(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

function buildDirectSendPreviewCard(input: {
  tokens: TokenBalance[]
  symbol: string
  amount: string
  toAddress: string
  chainName: SendChainName
}) {
  const amount = input.amount.trim()
  const toAddress = input.toAddress.trim()
  if (!amount || Number.parseFloat(amount) <= 0) return new Error('Enter a valid amount before previewing the send.')
  if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) return new Error('Enter a valid recipient address before previewing the send.')
  const chainId = getSendChainId(input.chainName)
  const token = input.tokens.find((entry) => entry.symbol === input.symbol && entry.chainId === chainId)
  if (!token) return new Error(`No ${input.symbol} balance is available on ${input.chainName}.`)
  const priceUsd = parseUsdAmount(token.priceUsd)
  const estimatedUsd = priceUsd > 0 ? `$${(priceUsd * Number.parseFloat(amount)).toFixed(2)}` : '$0.00'
  const shortAddress = `${toAddress.slice(0, 10)}…${toAddress.slice(-6)}`
  return {
    type: 'send',
    title: 'Send Preview',
    status: 'pending',
    rows: [
      { label: 'Asset', value: token.symbol },
      { label: 'Amount', value: `${amount} ${token.symbol}`, highlight: true },
      { label: 'USD', value: `~${estimatedUsd}` },
      { label: 'To', value: shortAddress },
      { label: 'Network', value: input.chainName },
      { label: 'Est. gas', value: '~$0.04' },
    ],
    metadata: {
      kind: 'send',
      fromChainId: chainId,
      fromTokenSymbol: token.symbol,
      fromTokenAddress: token.address === 'native' ? '0x0000000000000000000000000000000000000000' : token.address,
      fromTokenDecimals: token.decimals,
      fromAmount: amount,
      toAddress,
      estimatedGasUsd: 0.04,
    },
  } satisfies AgentActionCard
}

type SendChainName = 'Base' | 'Ethereum' | 'BNB Chain'

function getSendChainId(chainName: SendChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

async function buildDirectSwapPreviewCard(input: {
  tokens: TokenBalance[]
  symbolIn: string
  symbolOut: string
  amount: string
  chainName: SwapChainName
  fromAddress: string | null
}) {
  const amount = input.amount.trim()
  if (!input.fromAddress) return new Error('A linked wallet is required before previewing a swap.')
  if (!amount || Number.parseFloat(amount) <= 0) return new Error('Enter a valid amount before previewing the swap.')
  if (input.symbolIn === input.symbolOut) return new Error('Choose different assets for the swap preview.')
  const chainId = getSwapChainId(input.chainName)
  const fromToken = resolveSwapTokenConfig(input.tokens, input.symbolIn, chainId)
  if (!fromToken) return new Error(`${input.symbolIn} is not available on ${input.chainName} for this wallet.`)
  const toToken = resolveSwapTokenConfig(input.tokens, input.symbolOut, chainId)
  if (!toToken) return new Error(`${input.symbolOut} is not supported on ${input.chainName} yet.`)
  try {
    const quote = await getSwapQuote({
      fromChainId: chainId,
      toChainId: chainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      fromAmount: toRawAmount(amount, fromToken.decimals),
      fromAddress: input.fromAddress,
      slippage: 0.005,
    })
    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const rate = computeSwapRate(fromAmount, toAmount)
    const route = quote.toolDetails?.name ? `${quote.toolDetails.name} · ${input.chainName}` : input.chainName
    return {
      type: 'swap',
      title: 'Swap Preview',
      status: 'pending',
      rows: [
        { label: 'You send', value: `${fromAmount} ${quote.action.fromToken.symbol}` },
        { label: 'You receive', value: `~${toAmount} ${quote.action.toToken.symbol}`, highlight: true },
        { label: 'Rate', value: rate ? `1 ${quote.action.fromToken.symbol} = ${rate} ${quote.action.toToken.symbol}` : 'Unavailable' },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Route', value: route },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      metadata: {
        kind: 'swap',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId: chainId,
        toChainId: chainId,
        fromTokenSymbol: quote.action.fromToken.symbol,
        toTokenSymbol: quote.action.toToken.symbol,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromTokenDecimals: quote.action.fromToken.decimals,
        toTokenDecimals: quote.action.toToken.decimals,
        fromAmount: quote.action.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
        estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
        steps: quote.includedSteps?.length,
      },
    } satisfies AgentActionCard
  } catch (error) {
    return new Error(error instanceof Error ? error.message : 'Swap quote failed.')
  }
}

type SwapChainName = 'Base' | 'Ethereum' | 'BNB Chain'

function getSwapChainId(chainName: SwapChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

async function buildDirectBridgePreviewCard(input: {
  tokens: TokenBalance[]
  symbol: string
  amount: string
  fromChainName: BridgeChainName
  toChainName: BridgeChainName
  fromAddress: string | null
}) {
  const amount = input.amount.trim()
  if (!input.fromAddress) return new Error('A linked wallet is required before previewing a bridge.')
  if (!amount || Number.parseFloat(amount) <= 0) return new Error('Enter a valid amount before previewing the bridge.')
  if (input.fromChainName === input.toChainName) return new Error('Choose different source and destination chains for the bridge preview.')
  const fromChainId = getBridgeChainId(input.fromChainName)
  const toChainId = getBridgeChainId(input.toChainName)
  const fromToken = resolveSwapTokenConfig(input.tokens, input.symbol, fromChainId)
  const toToken = resolveSwapTokenConfig(input.tokens, input.symbol, toChainId)
  if (!fromToken) return new Error(`${input.symbol} is not available on ${input.fromChainName} for this wallet.`)
  if (!toToken) return new Error(`${input.symbol} is not supported on ${input.toChainName} yet.`)
  try {
    const quote = await getSwapQuote({
      fromChainId,
      toChainId,
      fromTokenAddress: fromToken.address,
      toTokenAddress: toToken.address,
      fromAmount: toRawAmount(amount, fromToken.decimals),
      fromAddress: input.fromAddress,
      slippage: 0.005,
    })
    const fromAmount = formatTokenAmount(quote.action.fromAmount, quote.action.fromToken.decimals)
    const toAmount = formatTokenAmount(quote.estimate?.toAmount, quote.action.toToken.decimals)
    const minReceived = formatTokenAmount(quote.estimate?.toAmountMin, quote.action.toToken.decimals)
    const gasUsd = formatUsdValue(quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? null)
    const feeUsd = formatUsdValue(quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? null)
    const protocol = quote.toolDetails?.name ?? 'Bridge route'
    const route = quote.includedSteps?.length ? `${quote.includedSteps.length} step${quote.includedSteps.length === 1 ? '' : 's'}` : 'Live route'
    return {
      type: 'bridge',
      title: 'Bridge Preview',
      status: 'pending',
      rows: [
        { label: 'From', value: `${fromAmount} ${quote.action.fromToken.symbol} on ${input.fromChainName}` },
        { label: 'To', value: `~${toAmount} ${quote.action.toToken.symbol} on ${input.toChainName}`, highlight: true },
        { label: 'Min received', value: `${minReceived} ${quote.action.toToken.symbol}` },
        { label: 'Protocol', value: protocol },
        { label: 'Route', value: route },
        { label: 'Bridge fee', value: feeUsd },
        { label: 'Est. gas', value: gasUsd },
      ],
      metadata: {
        kind: 'bridge',
        routeId: quote.id,
        tool: quote.toolDetails?.name,
        fromChainId,
        toChainId,
        fromTokenSymbol: quote.action.fromToken.symbol,
        toTokenSymbol: quote.action.toToken.symbol,
        fromTokenAddress: fromToken.address,
        toTokenAddress: toToken.address,
        fromTokenDecimals: quote.action.fromToken.decimals,
        toTokenDecimals: quote.action.toToken.decimals,
        fromAmount: quote.action.fromAmount,
        toAmount: quote.estimate?.toAmount,
        toAmountMin: quote.estimate?.toAmountMin,
        estimatedGasUsd: quote.estimate?.gasCosts?.reduce((sum, gas) => sum + Number(gas.amountUSD ?? 0), 0) ?? undefined,
        estimatedFeeUsd: quote.estimate?.feeCosts?.reduce((sum, fee) => sum + Number(fee.amountUSD ?? 0), 0) ?? undefined,
        steps: quote.includedSteps?.length,
      },
    } satisfies AgentActionCard
  } catch (error) {
    return new Error(error instanceof Error ? error.message : 'Bridge quote failed.')
  }
}

type BridgeChainName = 'Base' | 'Ethereum' | 'BNB Chain'

function getBridgeChainId(chainName: BridgeChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

function resolveSwapTokenConfig(tokens: TokenBalance[], symbol: string, chainId: number) {
  const walletToken = tokens.find((token) => token.symbol === symbol && token.chainId === chainId)
  if (walletToken) {
    return {
      address: walletToken.address === 'native' ? '0x0000000000000000000000000000000000000000' : walletToken.address,
      decimals: walletToken.decimals,
    }
  }
  return getKnownTokenConfig(symbol, chainId)
}

function getKnownTokenConfig(symbol: string, chainId: number) {
  const normalized = symbol.toUpperCase()
  const knownTokens: Record<string, { decimals: number; addresses: Partial<Record<1 | 56 | 8453, string>> }> = {
    ETH: { decimals: 18, addresses: { 1: '0x0000000000000000000000000000000000000000', 8453: '0x0000000000000000000000000000000000000000' } },
    BNB: { decimals: 18, addresses: { 56: '0x0000000000000000000000000000000000000000' } },
    WETH: { decimals: 18, addresses: { 1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 8453: '0x4200000000000000000000000000000000000006' } },
    WBNB: { decimals: 18, addresses: { 56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' } },
    USDC: { decimals: 6, addresses: { 1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' } },
    USDT: { decimals: 6, addresses: { 1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 56: '0x55d398326f99059fF775485246999027B3197955' } },
    DAI: { decimals: 18, addresses: { 1: '0x6B175474E89094C44Da98b954EedeAC495271d0F', 8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' } },
  }
  const config = knownTokens[normalized]
  const address = config?.addresses[chainId as 1 | 56 | 8453]
  if (!config || !address) return null
  return { address, decimals: config.decimals }
}

function toRawAmount(amount: string, decimals: number) {
  const [wholePart, fractionPart = ''] = amount.trim().split('.')
  const normalizedWhole = wholePart === '' ? '0' : wholePart
  const normalizedFraction = fractionPart.replace(/\D/g, '').slice(0, decimals).padEnd(decimals, '0')
  const raw = `${normalizedWhole}${normalizedFraction}`.replace(/^0+(?=\d)/, '')
  return raw || '0'
}

function formatTokenAmount(value: string | undefined | null, decimals: number, precision = 6) {
  if (!value) return '0'
  const bigintValue = BigInt(value)
  const padded = bigintValue.toString().padStart(decimals + 1, '0')
  const whole = padded.slice(0, -decimals)
  const fraction = padded.slice(-decimals).replace(/0+$/, '').slice(0, precision)
  return fraction ? `${whole}.${fraction}` : whole
}

function formatUsdValue(value: number | null) {
  if (!value || !Number.isFinite(value)) return 'Unavailable'
  if (value < 0.01) return '<$0.01'
  return `$${value.toFixed(2)}`
}

function computeSwapRate(fromAmount: string, toAmount: string) {
  const from = Number.parseFloat(fromAmount)
  const to = Number.parseFloat(toAmount)
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  return (to / from).toFixed(6)
}
