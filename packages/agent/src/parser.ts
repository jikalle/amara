import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { ParsedIntent } from '@anara/types'

const client = new Anthropic()

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

  try {
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '{}'
    const parsed = JSON.parse(text.trim())
    return IntentSchema.parse(parsed) as ParsedIntent
  } catch {
    return {
      type: 'unknown',
      confidence: 0,
      requiresConfirmation: false,
      params: {},
    }
  }
}
