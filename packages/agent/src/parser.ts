import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ParsedIntent } from '@anara/types'

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null

const IntentSchema = z.object({
  type: z.enum(['swap', 'send', 'bridge', 'query', 'strategy', 'settings', 'unknown']),
  confidence: z.number().min(0).max(1),
  requiresConfirmation: z.boolean(),
  params: z.object({
    // swap / bridge
    fromToken: z.string().optional(),
    toToken: z.string().optional(),
    amount: z.string().optional(),
    fromChain: z.string().optional(),
    toChain: z.string().optional(),
    // send
    toAddress: z.string().optional(),
    contactName: z.string().optional(),
    // query
    queryType: z.enum(['balance', 'price', 'pnl', 'history', 'gas', 'portfolio']).optional(),
    // strategy
    strategyId: z.string().optional(),
    action: z.enum(['pause', 'resume', 'configure']).optional(),
  }).passthrough(),
})

export async function parseIntent(userMessage: string): Promise<ParsedIntent> {
  if (!client) {
    return parseIntentLocally(userMessage)
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      system: `Parse the user's wallet command into structured JSON.
Output ONLY valid JSON matching this schema, no markdown:
{
  "type": "swap|send|bridge|query|strategy|settings|unknown",
  "confidence": 0.0-1.0,
  "requiresConfirmation": boolean,
  "params": { ...relevant params }
}

Examples:
- "swap 0.5 ETH to USDC" → type: "swap", params: {fromToken: "ETH", toToken: "USDC", amount: "0.5"}
- "send 100 USDC to 0xff89" → type: "send", params: {fromToken: "USDC", amount: "100", toAddress: "0xff89"}
- "bridge 500 USDC from Base to Arbitrum" → type: "bridge", params: {fromToken: "USDC", amount: "500", fromChain: "base", toChain: "arbitrum"}
- "what's my ETH balance?" → type: "query", params: {queryType: "balance"}
- "pause arb bot" → type: "strategy", params: {action: "pause", strategyId: "arb"}`,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text.trim())
    return IntentSchema.parse(parsed) as ParsedIntent
  } catch {
    return parseIntentLocally(userMessage)
  }
}

function parseIntentLocally(userMessage: string): ParsedIntent {
  const raw = userMessage.trim()
  const text = raw.toLowerCase()

  if (text.includes('swap')) {
    const match = raw.match(/swap\s+([\d.]+)\s+([a-zA-Z0-9]+)\s+(?:to|for)\s+([a-zA-Z0-9]+)/i)
    return {
      type: 'swap',
      confidence: match ? 0.88 : 0.55,
      requiresConfirmation: true,
      params: {
        amount: match?.[1],
        fromToken: match?.[2]?.toUpperCase(),
        toToken: match?.[3]?.toUpperCase(),
      },
    }
  }

  if (text.includes('bridge')) {
    const match = raw.match(/bridge\s+([\d.]+)\s+([a-zA-Z0-9]+)(?:\s+from\s+([a-zA-Z0-9]+))?(?:\s+to\s+([a-zA-Z0-9]+))?/i)
    return {
      type: 'bridge',
      confidence: match ? 0.86 : 0.52,
      requiresConfirmation: true,
      params: {
        amount: match?.[1],
        fromToken: match?.[2]?.toUpperCase(),
        fromChain: match?.[3]?.toLowerCase(),
        toChain: match?.[4]?.toLowerCase(),
      },
    }
  }

  if (text.includes('send')) {
    const match = raw.match(/send\s+([\d.]+)\s+([a-zA-Z0-9]+)\s+to\s+(0x[a-fA-F0-9]{40})/i)
    return {
      type: 'send',
      confidence: match ? 0.9 : 0.58,
      requiresConfirmation: true,
      params: {
        amount: match?.[1],
        fromToken: match?.[2]?.toUpperCase(),
        toAddress: match?.[3],
      },
    }
  }

  if (text.includes('portfolio') || text.includes('balance') || text.includes('worth') || text.includes('value')) {
    return {
      type: 'query',
      confidence: 0.85,
      requiresConfirmation: false,
      params: {
        queryType: text.includes('price') ? 'price' : text.includes('balance') ? 'balance' : 'portfolio',
      },
    }
  }

  if (text.includes('price')) {
    const match = raw.match(/price(?:\s+of)?\s+([a-zA-Z0-9]+)/i)
    return {
      type: 'query',
      confidence: 0.8,
      requiresConfirmation: false,
      params: {
        queryType: 'price',
        fromToken: match?.[1]?.toUpperCase(),
      },
    }
  }

  if (text.includes('pause') || text.includes('resume')) {
    const strategyId =
      text.includes('arb') ? 'arb' :
      text.includes('yield') ? 'yield' :
      text.includes('rebalance') || text.includes('reb') ? 'rebalance' :
      text.includes('brickt') ? 'brickt' :
      undefined

    return {
      type: 'strategy',
      confidence: strategyId ? 0.82 : 0.48,
      requiresConfirmation: false,
      params: {
        action: text.includes('pause') ? 'pause' : 'resume',
        strategyId,
      },
    }
  }

  return {
    type: 'unknown',
    confidence: 0.2,
    requiresConfirmation: false,
    params: {},
  }
}
