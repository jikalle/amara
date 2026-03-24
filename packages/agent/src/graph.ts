import Anthropic from '@anthropic-ai/sdk'
import { ANARA_SYSTEM_PROMPT } from './prompts/system'
import { parseIntent } from './parser'
import { getConversationHistory, appendMessage } from './memory'
import { getSwapPreview } from './tools/swap'
import { getSendPreview } from './tools/send'
import { getBridgePreview } from './tools/bridge'
import { getPortfolioSummary, getAssetPrice } from './tools/portfolio'
import { getStrategyStatus, toggleStrategy } from './tools/strategy'
import type { AgentMessage, AgentActionCard } from '@anara/types'

const claude = new Anthropic()

export interface AgentRunInput {
  sessionId: string
  userMessage: string
  walletAddress: string
  chainId?: number
}

export interface AgentRunOutput {
  message: string
  actionCard?: AgentActionCard
  requiresConfirmation: boolean
  intent: string
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunOutput> {
  const { sessionId, userMessage, walletAddress } = input

  // 1. Get conversation history
  const history = await getConversationHistory(sessionId)

  // 2. Parse intent
  const intent = await parseIntent(userMessage)

  // 3. Prepare tool response based on intent
  let toolResult: { actionCard?: AgentActionCard; toolContext?: string } = {}

  if (intent.type === 'swap' && intent.params.fromToken && intent.params.toToken && intent.params.amount) {
    const result = await getSwapPreview({
      fromToken:   String(intent.params.fromToken),
      toToken:     String(intent.params.toToken),
      amount:      String(intent.params.amount),
      fromAddress: walletAddress,
      fromChainId: input.chainId ?? 8453,
      toChainId:   input.chainId ?? 8453,
    })
    if (result.success) {
      toolResult = { actionCard: result.actionCard, toolContext: 'Swap quote retrieved successfully.' }
    } else {
      toolResult = { toolContext: `Swap quote failed: ${result.error}` }
    }
  }

  if (intent.type === 'send' && intent.params.toAddress && intent.params.amount) {
    const result = await getSendPreview({
      token:       String(intent.params.fromToken ?? 'USDC'),
      amount:      String(intent.params.amount),
      toAddress:   String(intent.params.toAddress),
      fromAddress: walletAddress,
      chainId:     input.chainId ?? 8453,
    })
    if (result.success) {
      toolResult = { actionCard: result.actionCard, toolContext: 'Send preview ready.' }
    }
  }

  if (intent.type === 'bridge' && intent.params.fromToken && intent.params.amount) {
    const result = await getBridgePreview({
      token:     String(intent.params.fromToken),
      amount:    String(intent.params.amount),
      fromChain: String(intent.params.fromChain ?? 'base'),
      toChain:   String(intent.params.toChain ?? 'ethereum'),
    })
    if (result.success) {
      toolResult = { actionCard: result.actionCard, toolContext: 'Bridge quote ready.' }
    }
  }

  if (intent.type === 'query') {
    if (intent.params.queryType === 'portfolio' || intent.params.queryType === 'balance') {
      const portfolio = await getPortfolioSummary(walletAddress)
      toolResult = { toolContext: JSON.stringify(portfolio) }
    }
    if (intent.params.queryType === 'price' && intent.params.fromToken) {
      const price = await getAssetPrice(String(intent.params.fromToken))
      toolResult = { toolContext: `Current ${intent.params.fromToken} price: ${price}` }
    }
  }

  if (intent.type === 'strategy' && intent.params.strategyId) {
    if (intent.params.action === 'pause' || intent.params.action === 'resume') {
      const result = await toggleStrategy(
        String(intent.params.strategyId),
        intent.params.action as 'pause' | 'resume'
      )
      toolResult = { toolContext: JSON.stringify(result) }
    } else {
      const status = await getStrategyStatus(String(intent.params.strategyId))
      toolResult = { toolContext: JSON.stringify(status) }
    }
  }

  // 4. Build system prompt with context
  const systemPrompt = ANARA_SYSTEM_PROMPT
    .replace('{userContext}', `Address: ${walletAddress}`)
    .replace('{walletState}', 'Portfolio: $24,847.32 across Base + Ethereum')
    .replace('{strategies}', 'Arb Bot: Active (+$847), Yield: Active (18.4% APY), Rebalance: Watching, Brickt: 4 pools')
    .replace('{history}', history.map(h => `${h.role}: ${h.content}`).join('\n') || 'No previous messages.')

  // 5. Call Claude with full context
  const messages = [
    ...history.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    {
      role: 'user' as const,
      content: toolResult.toolContext
        ? `${userMessage}\n\n[Tool result: ${toolResult.toolContext}]`
        : userMessage,
    },
  ]

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 600,
    system: systemPrompt,
    messages,
  })

  const assistantMessage = response.content[0]?.type === 'text'
    ? response.content[0].text
    : 'I encountered an issue. Please try again.'

  // 6. Save to memory
  await appendMessage(sessionId, { role: 'user', content: userMessage, timestamp: Date.now() })
  await appendMessage(sessionId, { role: 'assistant', content: assistantMessage, timestamp: Date.now() })

  return {
    message: assistantMessage,
    actionCard: toolResult.actionCard,
    requiresConfirmation: intent.requiresConfirmation,
    intent: intent.type,
  }
}
