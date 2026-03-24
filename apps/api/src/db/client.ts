import { createClient } from '@supabase/supabase-js'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
}

// Server-side client (service role — bypasses RLS for agent operations)
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
    db:   { schema: 'public' },
  }
)

// ── User helpers ─────────────────────────────────────────────────
export async function upsertUser(privyUserId: string, walletAddress?: string) {
  const normalizedAddress = walletAddress ? walletAddress.toLowerCase() : undefined
  const { data, error } = await db
    .from('users')
    .upsert(
      { privy_user_id: privyUserId, wallet_address: normalizedAddress, updated_at: new Date().toISOString() },
      { onConflict: 'privy_user_id', ignoreDuplicates: false }
    )
    .select()
    .single()

  if (error) throw new Error(`upsertUser failed: ${error.message}`)
  return data
}

export async function getUserByPrivyId(privyUserId: string) {
  const { data } = await db
    .from('users')
    .select('*')
    .eq('privy_user_id', privyUserId)
    .single()
  return data
}

export async function getUserByWalletAddress(walletAddress: string) {
  const normalizedAddress = walletAddress.toLowerCase()
  const { data } = await db
    .from('users')
    .select('*')
    .eq('wallet_address', normalizedAddress)
    .single()
  return data
}

// ── Agent settings ───────────────────────────────────────────────
export async function getAgentSettings(userId: string) {
  const { data } = await db
    .from('agent_settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!data) {
    // Create default settings
    const { data: created } = await db
      .from('agent_settings')
      .insert({ user_id: userId })
      .select()
      .single()
    return created
  }
  return data
}

// ── Log agent execution ──────────────────────────────────────────
export async function logExecution(data: {
  userId:       string
  strategyType: string
  status:       'success' | 'skipped' | 'failed' | 'pending'
  description:  string
  txHash?:      string
  chainId?:     number
  profitUsd?:   number
  gasCostUsd?:  number
  amountUsd?:   number
  errorMessage?: string
  metadata?:    Record<string, unknown>
}) {
  const { error } = await db.from('agent_executions').insert({
    user_id:       data.userId,
    strategy_type: data.strategyType,
    status:        data.status,
    description:   data.description,
    tx_hash:       data.txHash,
    chain_id:      data.chainId,
    profit_usd:    data.profitUsd,
    gas_cost_usd:  data.gasCostUsd,
    amount_usd:    data.amountUsd,
    error_message: data.errorMessage,
    metadata:      data.metadata ?? {},
  })
  if (error) console.error('[logExecution]', error.message)
}

// ── Get agent brief data ─────────────────────────────────────────
export async function getRecentExecutions(userId: string, sinceHours = 14) {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()
  const { data } = await db
    .from('agent_executions')
    .select('*')
    .eq('user_id', userId)
    .gte('executed_at', since)
    .order('executed_at', { ascending: false })
    .limit(20)
  return data ?? []
}

// ── Save transaction ─────────────────────────────────────────────
export async function saveTransaction(userId: string, tx: {
  txHash:        string
  chainId:       number
  txType:        string
  status:        string
  fromAddress:   string
  toAddress?:    string
  valueFormatted?: string
  valueUsd?:     number
  tokenIn?:      object
  tokenOut?:     object
  fromChainId?:  number
  toChainId?:    number
  bridgeProtocol?: string
}) {
  const { error } = await db.from('transactions').upsert({
    user_id:         userId,
    tx_hash:         tx.txHash,
    chain_id:        tx.chainId,
    tx_type:         tx.txType,
    status:          tx.status,
    from_address:    tx.fromAddress,
    to_address:      tx.toAddress,
    value_formatted: tx.valueFormatted,
    value_usd:       tx.valueUsd,
    token_in:        tx.tokenIn,
    token_out:       tx.tokenOut,
    from_chain_id:   tx.fromChainId,
    to_chain_id:     tx.toChainId,
    bridge_protocol: tx.bridgeProtocol,
  }, { onConflict: 'tx_hash,chain_id' })
  if (error) console.error('[saveTransaction]', error.message)
}

// ── Portfolio snapshot ───────────────────────────────────────────
export async function savePortfolioSnapshot(userId: string, totalUsd: number, breakdown: object) {
  const today = new Date().toISOString().split('T')[0]
  await db.from('portfolio_snapshots').upsert({
    user_id:       userId,
    total_usd:     totalUsd,
    breakdown,
    snapshot_date: today,
  }, { onConflict: 'user_id,snapshot_date' })
}
