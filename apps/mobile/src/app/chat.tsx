import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import * as Clipboard from 'expo-clipboard'
import { useAgent } from '../hooks/useAgent'
import { useWalletStore } from '../store'
import type { AgentActionCard, TokenBalance } from '@anara/types'

const C = {
  earth: '#1A1208', soil: '#221A0E', clay: '#2E2010', border: '#4A3520',
  gold: '#D4920A', gold2: '#F0B429', kola: '#C0392B', green: '#2ECC71',
  teal: '#48C9B0', text: '#F5E6C8', text2: '#C8AA7A', muted: '#7A5E3A', clay2: '#382715',
}

const SUGGESTIONS = [
  'Swap 0.1 ETH → USDC',
  'Send 200 USDC to 0xff89',
  'Bridge 500 USDC to Ethereum',
  'What\'s my portfolio value?',
  'Check arb profit this month',
]

export default function ChatScreen() {
  const params = useLocalSearchParams<{ action?: string; prompt?: string; autosend?: string }>()
  const { messages, isThinking, sendMessage, executeAction, executeStandaloneAction, cancelAction } = useAgent()
  const address = useWalletStore((state) => state.address)
  const tokens = useWalletStore((state) => state.tokens)
  const hasWallet = useWalletStore((state) => state.hasWallet)
  const [input, setInput]             = useState('')
  const [suggsDismissed, setSuggsDismissed] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const autoSentRef = useRef<string | null>(null)
  const action = params.action === 'send' || params.action === 'swap' || params.action === 'bridge' || params.action === 'receive'
    ? params.action
    : null

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || isThinking) return
    setInput('')
    setSuggsDismissed(true)
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await sendMessage(text)
    scrollRef.current?.scrollToEnd({ animated: true })
  }, [input, isThinking, sendMessage])

  const handleSugg = useCallback((text: string) => {
    setInput(text)
    setSuggsDismissed(true)
  }, [])

  useEffect(() => {
    const prompt = typeof params.prompt === 'string' ? params.prompt : null
    const autoSend = params.autosend === '1'
    if (!prompt) return
    if (!autoSend) {
      setInput(prompt)
      return
    }
    if (autoSentRef.current === prompt || isThinking) return
    autoSentRef.current = prompt
    setInput('')
    setSuggsDismissed(true)
    void sendMessage(prompt)
  }, [params.prompt, params.autosend, isThinking, sendMessage])

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.agentInfo}>
          <View style={styles.agentAvatar}>
            <Text style={styles.agentAvatarText}>AI</Text>
            <View style={styles.onlineDot} />
          </View>
          <View>
            <Text style={styles.agentName}>Amara Agent</Text>
            <Text style={styles.agentStatus}>Online · Base · Ethereum · BNB</Text>
          </View>
        </View>
      </View>
      <View style={styles.kenteBar} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {action && (
            <ChatQuickActionPanel
              action={action}
              address={address}
              tokens={tokens}
              hasWallet={hasWallet}
              onExecuteDirectAction={executeStandaloneAction}
              onClose={() => router.replace('/chat')}
            />
          )}

          {/* Welcome message */}
          {messages.length === 0 && (
            <View style={styles.agentMsg}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>
                  Hey Shehu 👋 I'm your wallet agent. Tell me what to do — I'll handle the rest.{'\n\n'}
                  <Text style={styles.bubbleHint}>Try: "swap 0.5 ETH to USDC" or "send 200 USDC to 0xff89"</Text>
                </Text>
              </View>
              <Text style={styles.msgTime}>Now</Text>
            </View>
          )}

          {messages.map(msg => (
            <View key={msg.id} style={msg.role === 'user' ? styles.userMsgWrap : styles.agentMsgWrap}>
              {msg.role === 'user' ? (
                <View style={styles.userMsg}>
                  <Text style={styles.userMsgText}>{msg.content}</Text>
                </View>
              ) : (
                <View style={styles.agentMsg}>
                  {/* Action card */}
                  {msg.actionCard && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardTop}>
                        <Text style={styles.actionCardTitle}>{msg.actionCard.title}</Text>
                        <View style={styles.readyBadge}><Text style={styles.readyText}>READY</Text></View>
                      </View>
                      {msg.actionCard.rows.map((row, i) => (
                        <View key={i} style={styles.actionRow}>
                          <Text style={styles.actionLbl}>{row.label}</Text>
                          <Text style={[styles.actionVal, row.highlight && styles.actionValHighlight]}>{row.value}</Text>
                        </View>
                      ))}
                      <View style={styles.actionBtns}>
                        <TouchableOpacity
                          style={styles.confirmBtn}
                          onPress={async () => {
                            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                            await executeAction(msg.id, msg.actionCard!)
                          }}
                        >
                          <Text style={styles.confirmBtnText}>Execute →</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => cancelAction(msg.id)}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  <View style={styles.bubble}>
                    <Text style={styles.bubbleText}>{msg.content}</Text>
                  </View>
                  <Text style={styles.msgTime}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              )}
            </View>
          ))}

          {/* Typing indicator */}
          {isThinking && (
            <View style={styles.agentMsg}>
              <View style={styles.typingBubble}>
                {[0,1,2].map(i => (
                  <View key={i} style={[styles.typingDot, { opacity: 0.3 + i * 0.2 }]} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {!suggsDismissed && messages.length === 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggsScroll}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 6 }}
          >
            {SUGGESTIONS.map(s => (
              <TouchableOpacity key={s} style={styles.sugg} onPress={() => handleSugg(s)}>
                <Text style={styles.suggText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Instruct your agent…"
            placeholderTextColor={C.muted}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          {/* Mic button */}
          <TouchableOpacity style={styles.micBtn}>
            <Text style={{ fontSize: 16 }}>🎙️</Text>
          </TouchableOpacity>
          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isThinking) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || isThinking}
          >
            {isThinking
              ? <ActivityIndicator size="small" color={C.earth} />
              : <Text style={styles.sendBtnText}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function ChatQuickActionPanel({
  action,
  address,
  tokens,
  hasWallet,
  onExecuteDirectAction,
  onClose,
}: {
  action: 'send' | 'swap' | 'bridge' | 'receive'
  address: string | null
  tokens: TokenBalance[]
  hasWallet: boolean
  onExecuteDirectAction: (card: AgentActionCard, onCardChange?: (next: AgentActionCard) => void) => Promise<unknown>
  onClose: () => void
}) {
  const tokenOptions = buildTokenOptions(tokens)
  const sendTokenOptions = buildSendTokenOptions(tokens)
  const [copied, setCopied] = useState(false)
  const [sendToken, setSendToken] = useState(sendTokenOptions[0]?.symbol ?? 'ETH')
  const [sendAmount, setSendAmount] = useState('')
  const [sendAddress, setSendAddress] = useState('')
  const [sendChain, setSendChain] = useState<SendChainName>('Base')
  const [sendPreviewCard, setSendPreviewCard] = useState<AgentActionCard | null>(null)
  const [sendPreviewError, setSendPreviewError] = useState<string | null>(null)
  const [swapFromToken, setSwapFromToken] = useState(tokenOptions[0]?.symbol ?? 'ETH')
  const [swapToToken, setSwapToToken] = useState(tokenOptions.find((token) => token.symbol !== (tokenOptions[0]?.symbol ?? 'ETH'))?.symbol ?? 'USDC')
  const [swapAmount, setSwapAmount] = useState('')
  const [swapChain, setSwapChain] = useState<SwapChainName>('Base')
  const [swapPreviewCard, setSwapPreviewCard] = useState<AgentActionCard | null>(null)
  const [swapPreviewError, setSwapPreviewError] = useState<string | null>(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [bridgeToken, setBridgeToken] = useState(tokenOptions[0]?.symbol ?? 'ETH')
  const [bridgeAmount, setBridgeAmount] = useState('')
  const [bridgeFromChain, setBridgeFromChain] = useState<BridgeChainName>('Base')
  const [bridgeToChain, setBridgeToChain] = useState<BridgeChainName>('Ethereum')
  const bridgeTokenOptions = buildBridgeTokenOptions(tokens, bridgeFromChain, bridgeToChain)
  const [bridgePreviewCard, setBridgePreviewCard] = useState<AgentActionCard | null>(null)
  const [bridgePreviewError, setBridgePreviewError] = useState<string | null>(null)
  const [bridgeLoading, setBridgeLoading] = useState(false)

  useEffect(() => {
    if (!bridgeTokenOptions.length) return
    if (!bridgeTokenOptions.some((token) => token.symbol === bridgeToken)) {
      setBridgeToken(bridgeTokenOptions[0]!.symbol)
    }
  }, [bridgeToken, bridgeTokenOptions])

  async function handleCopyAddress() {
    if (!address) return
    await Clipboard.setStringAsync(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  async function previewSend() {
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
  }

  async function previewSwap() {
    setSwapLoading(true)
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
      setSwapLoading(false)
    }
  }

  async function previewBridge() {
    setBridgeLoading(true)
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
      setBridgeLoading(false)
    }
  }

  return (
    <View style={styles.quickPanel}>
      <View style={styles.quickHeader}>
        <View>
          <Text style={styles.quickKicker}>Quick Action</Text>
          <Text style={styles.quickTitle}>{action}</Text>
        </View>
        <TouchableOpacity style={styles.quickClose} onPress={onClose}>
          <Text style={styles.quickCloseText}>Close</Text>
        </TouchableOpacity>
      </View>

      {action === 'receive' ? (
        <View style={styles.quickBody}>
          <Text style={styles.fieldLabel}>Wallet address</Text>
          <View style={styles.addressBox}>
            <Text style={styles.addressText}>{address ?? 'No linked wallet address available yet.'}</Text>
          </View>
          <TouchableOpacity style={styles.primaryAction} disabled={!address} onPress={() => { void handleCopyAddress() }}>
            <Text style={styles.primaryActionText}>{copied ? 'Copied' : 'Copy Address'}</Text>
          </TouchableOpacity>
        </View>
      ) : action === 'send' ? (
        <View style={styles.quickBody}>
          <FieldLabel label="Asset" />
          <OptionRow
            options={sendTokenOptions.map((token) => ({ label: token.symbol, value: token.symbol }))}
            value={sendToken}
            onChange={setSendToken}
          />
          <FieldLabel label="Amount" />
          <TextInput style={styles.fieldInput} value={sendAmount} onChangeText={setSendAmount} placeholder="10" placeholderTextColor={C.muted} />
          <FieldLabel label="Recipient" />
          <TextInput style={styles.fieldInput} value={sendAddress} onChangeText={setSendAddress} placeholder="0x1111111111111111111111111111111111111111" placeholderTextColor={C.muted} />
          <FieldLabel label="Chain" />
          <OptionRow
            options={CHAIN_OPTIONS}
            value={sendChain}
            onChange={(value) => setSendChain(value as SendChainName)}
          />
          <TouchableOpacity style={styles.primaryAction} onPress={() => { void previewSend() }}>
            <Text style={styles.primaryActionText}>Preview Send</Text>
          </TouchableOpacity>
          {sendPreviewError ? <Text style={styles.quickError}>{sendPreviewError}</Text> : null}
          {sendPreviewCard ? (
            <QuickPreviewCard card={sendPreviewCard} disabled={!hasWallet} onConfirm={() => { void onExecuteDirectAction(sendPreviewCard, setSendPreviewCard) }} onCancel={() => setSendPreviewCard({ ...sendPreviewCard, status: 'cancelled' })} />
          ) : null}
        </View>
      ) : action === 'swap' ? (
        <View style={styles.quickBody}>
          <FieldLabel label="From asset" />
          <OptionRow options={tokenOptions.map((token) => ({ label: token.symbol, value: token.symbol }))} value={swapFromToken} onChange={setSwapFromToken} />
          <FieldLabel label="To asset" />
          <OptionRow options={tokenOptions.map((token) => ({ label: token.symbol, value: token.symbol }))} value={swapToToken} onChange={setSwapToToken} />
          <FieldLabel label="Amount" />
          <TextInput style={styles.fieldInput} value={swapAmount} onChangeText={setSwapAmount} placeholder="0.01" placeholderTextColor={C.muted} />
          <FieldLabel label="Chain" />
          <OptionRow options={CHAIN_OPTIONS} value={swapChain} onChange={(value) => setSwapChain(value as SwapChainName)} />
          <TouchableOpacity style={styles.primaryAction} disabled={swapLoading} onPress={() => { void previewSwap() }}>
            <Text style={styles.primaryActionText}>{swapLoading ? 'Loading…' : 'Preview Swap'}</Text>
          </TouchableOpacity>
          {swapPreviewError ? <Text style={styles.quickError}>{swapPreviewError}</Text> : null}
          {swapPreviewCard ? (
            <QuickPreviewCard card={swapPreviewCard} disabled={!hasWallet} onConfirm={() => { void onExecuteDirectAction(swapPreviewCard, setSwapPreviewCard) }} onCancel={() => setSwapPreviewCard({ ...swapPreviewCard, status: 'cancelled' })} />
          ) : null}
        </View>
      ) : (
        <View style={styles.quickBody}>
          <FieldLabel label="Asset" />
          <OptionRow options={bridgeTokenOptions.map((token) => ({ label: token.symbol, value: token.symbol }))} value={bridgeToken} onChange={setBridgeToken} />
          <FieldLabel label="Amount" />
          <TextInput style={styles.fieldInput} value={bridgeAmount} onChangeText={setBridgeAmount} placeholder="10" placeholderTextColor={C.muted} />
          <FieldLabel label="From chain" />
          <OptionRow options={CHAIN_OPTIONS} value={bridgeFromChain} onChange={(value) => setBridgeFromChain(value as BridgeChainName)} />
          <FieldLabel label="To chain" />
          <OptionRow options={CHAIN_OPTIONS} value={bridgeToChain} onChange={(value) => setBridgeToChain(value as BridgeChainName)} />
          <TouchableOpacity style={styles.primaryAction} disabled={bridgeLoading} onPress={() => { void previewBridge() }}>
            <Text style={styles.primaryActionText}>{bridgeLoading ? 'Loading…' : 'Preview Bridge'}</Text>
          </TouchableOpacity>
          {!bridgeTokenOptions.length ? <Text style={styles.quickError}>No bridgeable assets are available for this chain pair yet.</Text> : null}
          {bridgePreviewError ? <Text style={styles.quickError}>{bridgePreviewError}</Text> : null}
          {bridgePreviewCard ? (
            <QuickPreviewCard card={bridgePreviewCard} disabled={!hasWallet} onConfirm={() => { void onExecuteDirectAction(bridgePreviewCard, setBridgePreviewCard) }} onCancel={() => setBridgePreviewCard({ ...bridgePreviewCard, status: 'cancelled' })} />
          ) : null}
        </View>
      )}
    </View>
  )
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>
}

function OptionRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((option) => (
        <TouchableOpacity
          key={`${option.label}-${option.value}`}
          style={[styles.optionChip, value === option.value && styles.optionChipActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.optionChipText, value === option.value && styles.optionChipTextActive]}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

function QuickPreviewCard({
  card,
  disabled,
  onConfirm,
  onCancel,
}: {
  card: AgentActionCard
  disabled: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <View style={styles.actionCard}>
      <View style={styles.actionCardTop}>
        <Text style={styles.actionCardTitle}>{card.title}</Text>
        <View style={styles.readyBadge}><Text style={styles.readyText}>{card.status.toUpperCase()}</Text></View>
      </View>
      {card.rows.map((row, i) => (
        <View key={`${row.label}-${i}`} style={styles.actionRow}>
          <Text style={styles.actionLbl}>{row.label}</Text>
          <Text style={[styles.actionVal, row.highlight && styles.actionValHighlight]}>{row.value}</Text>
        </View>
      ))}
      <View style={styles.actionBtns}>
        <TouchableOpacity style={[styles.confirmBtn, disabled && styles.sendBtnDisabled]} onPress={onConfirm} disabled={disabled}>
          <Text style={styles.confirmBtnText}>Execute →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const CHAIN_OPTIONS = [
  { label: 'Base', value: 'Base' },
  { label: 'Ethereum', value: 'Ethereum' },
  { label: 'BNB Chain', value: 'BNB Chain' },
]

function buildTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
    .filter((token) => (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) && (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0))
    .map((token) => ({ symbol: token.symbol, chain: token.chainId === 1 ? 'Ethereum' : token.chainId === 56 ? 'BNB Chain' : 'Base' }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return options.length ? options : [
    { symbol: 'ETH', chain: 'Base' },
    { symbol: 'USDC', chain: 'Base' },
    { symbol: 'ETH', chain: 'Ethereum' },
    { symbol: 'BNB', chain: 'BNB Chain' },
    { symbol: 'USDT', chain: 'BNB Chain' },
  ]
}

function buildSendTokenOptions(tokens: TokenBalance[]) {
  const seen = new Set<string>()
  const options = tokens
    .filter((token) => (token.chainId === 1 || token.chainId === 56 || token.chainId === 8453) && (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0))
    .map((token) => ({ symbol: token.symbol, chain: token.chainId === 1 ? 'Ethereum' : token.chainId === 56 ? 'BNB Chain' : 'Base' }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return options.length ? options : buildTokenOptions(tokens)
}

function buildBridgeTokenOptions(tokens: TokenBalance[], fromChain: BridgeChainName, toChain: BridgeChainName) {
  const fromChainId = getBridgeChainId(fromChain)
  const toChainId = getBridgeChainId(toChain)
  const seen = new Set<string>()

  return tokens
    .filter((token) => token.chainId === fromChainId && (parseUsdAmount(token.balanceUsd) > 0 || parseFloat(token.balanceFormatted || '0') > 0))
    .filter((token) => resolveSwapTokenConfig(tokens, token.symbol, toChainId))
    .map((token) => ({ symbol: token.symbol, chain: fromChain }))
    .filter((token) => {
      const key = `${token.symbol}:${token.chain}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
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
type SwapChainName = SendChainName
type BridgeChainName = SendChainName

function getSendChainId(chainName: SendChainName) {
  if (chainName === 'Ethereum') return 1
  if (chainName === 'BNB Chain') return 56
  return 8453
}

function getSwapChainId(chainName: SwapChainName) {
  return getSendChainId(chainName)
}

function getBridgeChainId(chainName: BridgeChainName) {
  return getSendChainId(chainName)
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
  const toToken = resolveSwapTokenConfig(input.tokens, input.symbolOut, chainId)
  if (!fromToken) return new Error(`${input.symbolIn} is not available on ${input.chainName} for this wallet.`)
  if (!toToken) return new Error(`${input.symbolOut} is not supported on ${input.chainName} yet.`)

  try {
    const quote = await getLifiQuote({
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
    const quote = await getLifiQuote({
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
    const route = quote.includedSteps?.length ? `${quote.includedSteps.length} steps` : 'Live route'

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

async function getLifiQuote(params: {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  fromAddress: string
  slippage: number
}) {
  const search = new URLSearchParams({
    fromChain: String(params.fromChainId),
    toChain: String(params.toChainId),
    fromToken: params.fromTokenAddress,
    toToken: params.toTokenAddress,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    slippage: String(params.slippage),
  })

  const res = await fetch(`https://li.quest/v1/quote?${search.toString()}`)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(typeof data?.message === 'string' ? data.message : 'LI.FI quote failed.')
  }
  return data
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

function parseUsdAmount(value?: string) {
  if (!value) return 0
  return Number.parseFloat(value.replace(/[$,]/g, '')) || 0
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: C.earth },
  header:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 10, backgroundColor: C.soil, borderBottomWidth: 1, borderBottomColor: C.border },
  backBtn:           { width: 32, height: 32, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  backText:          { color: C.text2, fontSize: 18, lineHeight: 20 },
  agentInfo:         { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  agentAvatar:       { width: 32, height: 32, backgroundColor: '#3B5BDB', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  agentAvatarText:   { fontSize: 11, fontWeight: '900', color: '#1A1208' },
  onlineDot:         { position: 'absolute', bottom: 1, right: 1, width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, borderWidth: 1.5, borderColor: C.soil },
  agentName:         { fontSize: 13, fontWeight: '700', color: C.text },
  agentStatus:       { fontSize: 10, color: C.green, fontWeight: '600', letterSpacing: 0.5 },
  kenteBar:          { height: 3, backgroundColor: C.gold },
  messages:          { flex: 1, paddingHorizontal: 14 },
  agentMsgWrap:      { alignSelf: 'flex-start', maxWidth: '88%' },
  userMsgWrap:       { alignSelf: 'flex-end', maxWidth: '88%' },
  agentMsg:          { alignItems: 'flex-start', gap: 4 },
  userMsg:           { backgroundColor: C.gold, paddingVertical: 10, paddingHorizontal: 13 },
  userMsgText:       { fontSize: 12.5, color: C.earth, fontWeight: '500', lineHeight: 18 },
  bubble:            { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, paddingVertical: 10, paddingHorizontal: 13 },
  bubbleText:        { fontSize: 12.5, color: C.text, lineHeight: 18 },
  bubbleHint:        { color: C.muted, fontSize: 10.5, fontStyle: 'italic' },
  msgTime:           { fontSize: 9.5, color: C.muted, fontFamily: 'monospace' },
  typingBubble:      { flexDirection: 'row', gap: 4, backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center' },
  typingDot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: C.muted },
  actionCard:        { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, width: 280, overflow: 'hidden', marginBottom: 6 },
  actionCardTop:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  actionCardTitle:   { fontSize: 11, fontWeight: '700', color: C.text2, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
  readyBadge:        { backgroundColor: `${C.gold}15`, borderWidth: 1, borderColor: `${C.gold}30`, paddingHorizontal: 7, paddingVertical: 2 },
  readyText:         { fontSize: 8, fontWeight: '700', color: C.gold2, letterSpacing: 0.6 },
  actionRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: `${C.border}80` },
  actionLbl:         { fontSize: 10.5, color: C.muted },
  actionVal:         { fontSize: 10.5, fontWeight: '700', color: C.text2, fontFamily: 'monospace' },
  actionValHighlight:{ color: C.green },
  actionBtns:        { flexDirection: 'row', gap: 6, padding: 10 },
  confirmBtn:        { flex: 1, backgroundColor: C.gold, paddingVertical: 9, alignItems: 'center' },
  confirmBtnText:    { fontSize: 11, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.6 },
  cancelBtn:         { paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  cancelBtnText:     { fontSize: 11, fontWeight: '700', color: C.muted },
  suggsScroll:       { flexShrink: 0, paddingVertical: 8 },
  sugg:              { backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 7, marginRight: 0 },
  suggText:          { fontSize: 10.5, fontWeight: '600', color: C.text2 },
  inputBar:          { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.soil },
  input:             { flex: 1, backgroundColor: C.clay, borderWidth: 1, borderColor: C.border, color: C.text, fontSize: 13, paddingVertical: 10, paddingHorizontal: 12, maxHeight: 80, lineHeight: 18 },
  micBtn:            { width: 38, height: 38, backgroundColor: C.clay2, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  sendBtn:           { width: 38, height: 38, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:   { opacity: 0.4 },
  sendBtnText:       { fontSize: 18, fontWeight: '900', color: C.earth, lineHeight: 20 },
  quickPanel:        { backgroundColor: C.soil, borderWidth: 1, borderColor: C.border, marginBottom: 10, overflow: 'hidden' },
  quickHeader:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  quickKicker:       { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 },
  quickTitle:        { marginTop: 4, fontSize: 18, color: C.text, fontWeight: '900', textTransform: 'capitalize', fontFamily: 'serif' },
  quickClose:        { borderWidth: 1, borderColor: C.border, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.clay },
  quickCloseText:    { fontSize: 10, color: C.text2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  quickBody:         { padding: 12, gap: 10 },
  fieldLabel:        { fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  fieldInput:        { borderWidth: 1, borderColor: C.border, backgroundColor: C.clay, color: C.text, fontSize: 13, paddingVertical: 10, paddingHorizontal: 12 },
  optionChip:        { borderWidth: 1, borderColor: C.border, backgroundColor: C.clay, paddingHorizontal: 12, paddingVertical: 8 },
  optionChipActive:  { borderColor: C.gold, backgroundColor: 'rgba(212,146,10,0.12)' },
  optionChipText:    { fontSize: 11, color: C.text2, fontWeight: '700' },
  optionChipTextActive:{ color: C.gold2 },
  primaryAction:     { backgroundColor: C.gold, paddingVertical: 12, alignItems: 'center' },
  primaryActionText: { fontSize: 12, fontWeight: '800', color: C.earth, textTransform: 'uppercase', letterSpacing: 0.7 },
  quickError:        { fontSize: 11, lineHeight: 16, color: C.text2, backgroundColor: 'rgba(192,57,43,0.12)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.24)', paddingHorizontal: 10, paddingVertical: 8 },
  addressBox:        { borderWidth: 1, borderColor: C.border, backgroundColor: C.clay, padding: 12 },
  addressText:       { fontSize: 12, color: C.text2, lineHeight: 18, fontFamily: 'monospace' },
})
