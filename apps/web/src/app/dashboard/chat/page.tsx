'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ActionCard, Button, TypingIndicator } from '../../../components/ui'
import { useAgent } from '../../../hooks/useAgent'
import { useAgentStore, useWalletStore } from '../../../store'

const SUGGESTIONS = [
  'Swap 0.1 ETH to USDC',
  'Bridge 500 USDC to Ethereum',
  'Send 150 USDC to 0x1111111111111111111111111111111111111111',
  "What's my portfolio value?",
]

export default function DashboardChatPage() {
  const router = useRouter()
  const { messages, isThinking, sendMessage, executeAction, cancelAction } = useAgent()
  const clearChat = useAgentStore((state) => state.clearChat)
  const featureFlags = useAgentStore((state) => state.state.featureFlags)
  const hasWallet = useWalletStore((state) => state.hasWallet)
  const address = useWalletStore((state) => state.address)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const canSend = useMemo(() => input.trim().length > 0 && !isThinking && hasWallet, [input, isThinking, hasWallet])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  async function handleSend() {
    const text = input.trim()
    if (!text) return
    setInput('')
    await sendMessage(text)
  }

  return (
    <div className="min-h-screen bg-earth text-cream flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-soil">
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
          <Link href="/dashboard" className="text-xs text-muted hover:text-cream transition-colors">Back</Link>
          <button onClick={() => router.back()} className="text-xs border border-border px-3 py-1.5 hover:border-border2 transition-colors">
            Close
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 flex flex-col gap-4">
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

        <div className="bg-soil border border-border px-4 py-3 text-xs text-muted leading-5">
          Anara prepares previews and submits transactions only after your confirmation. Network fees, slippage, bridge delays, and external protocol failures can still affect outcomes.
        </div>

        {featureFlags?.allowBridges === false && (
          <div className="bg-teal/10 border border-teal/30 px-4 py-3 text-xs text-text2 leading-5">
            Bridge actions are currently disabled for this beta environment. Swap and send flows remain available.
          </div>
        )}

        {messages.length === 0 && (
          <div className="bg-soil border border-border p-4">
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

        <div ref={scrollRef} className="flex flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-xl' : 'mr-auto max-w-xl'}>
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
                : 'bg-soil border border-border px-4 py-3 text-sm leading-6 break-words overflow-hidden'}>
                <MessageBody content={message.content} />
              </div>
              <div className={`mt-1 text-[10px] font-mono text-muted ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}

          {isThinking && <TypingIndicator />}
        </div>
      </main>

      <div className="border-t border-border bg-soil px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
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
            className="flex-1 min-h-[80px] bg-clay border border-border text-sm px-3 py-3 outline-none focus:border-gold/40 resize-none disabled:opacity-50"
          />
          <Button onClick={handleSend} disabled={!canSend} loading={isThinking}>
            Send
          </Button>
        </div>
      </div>
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
