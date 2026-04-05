import { Pool, type QueryResultRow } from 'pg'

type DbUser = {
  id: string
  privy_user_id: string
  wallet_address: string | null
  display_name?: string | null
  avatar_url?: string | null
}

type AgentExecutionRow = {
  id: string
  user_id: string
  strategy_type: string
  status: 'success' | 'skipped' | 'failed' | 'pending'
  description: string
  tx_hash?: string | null
  chain_id?: number | null
  profit_usd?: number | null
  gas_cost_usd?: number | null
  amount_usd?: number | null
  error_message?: string | null
  executed_at: string
  metadata?: Record<string, unknown> | null
}

type AgentSettingsRow = {
  user_id: string
  arb_enabled: boolean
  yield_enabled: boolean
  rebalance_enabled: boolean
  brickt_enabled: boolean
  auto_execute: boolean
  require_approval_above: number
  allow_swaps: boolean
  allow_bridges: boolean
  allow_sends: boolean
  updated_at: string
}

type TransactionInsert = {
  txHash: string
  chainId: number
  txType: string
  status: string
  fromAddress: string
  toAddress?: string
  valueFormatted?: string
  valueUsd?: number
  tokenIn?: object
  tokenOut?: object
  fromChainId?: number
  toChainId?: number
  bridgeProtocol?: string
}

type TransactionRow = {
  tx_hash: string
  chain_id: number
  tx_type: string
  status: string
  from_address: string
  to_address?: string | null
  value_formatted?: string | null
  value_usd?: number | null
  token_in?: Record<string, unknown> | null
  token_out?: Record<string, unknown> | null
  from_chain_id?: number | null
  to_chain_id?: number | null
  bridge_protocol?: string | null
  updated_at?: string | null
}

const connectionString = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL
const hasUsableConnectionString =
  Boolean(connectionString) &&
  !String(connectionString).includes('db.xxx.supabase.co') &&
  !String(connectionString).includes('password@')
const pool = hasUsableConnectionString && connectionString ? new Pool({ connectionString }) : null
let hasLoggedDbFallback = false

const memory = {
  users: new Map<string, DbUser>(),
  executions: new Map<string, AgentExecutionRow[]>(),
  strategySettings: new Map<string, AgentSettingsRow>(),
  transactions: new Map<string, TransactionInsert[]>(),
  snapshots: new Map<string, { totalUsd: number; breakdown: object; snapshotDate: string }[]>(),
}

export function resetInMemoryDb() {
  memory.users.clear()
  memory.executions.clear()
  memory.strategySettings.clear()
  memory.transactions.clear()
  memory.snapshots.clear()
  hasLoggedDbFallback = false
}

export async function getDbHealth() {
  if (!pool) {
    return {
      ok: false,
      mode: 'memory_fallback' as const,
      message: 'DATABASE_URL is missing or unusable.',
    }
  }

  try {
    await pool.query('select 1')
    return {
      ok: true,
      mode: 'postgres' as const,
      message: 'Database reachable.',
    }
  } catch (error) {
    return {
      ok: false,
      mode: 'memory_fallback' as const,
      message: error instanceof Error ? error.message : 'Database unavailable.',
    }
  }
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeAddress(walletAddress?: string | null) {
  return walletAddress?.toLowerCase() ?? null
}

async function query<T extends QueryResultRow>(sql: string, values: unknown[]) {
  if (!pool) return null
  try {
    return await pool.query<T>(sql, values)
  } catch (error) {
    if (!hasLoggedDbFallback) {
      hasLoggedDbFallback = true
      console.warn('[db] database unavailable, falling back to in-memory mode', error)
    }
    return null
  }
}

function defaultSettings(userId: string): AgentSettingsRow {
  return {
    user_id: userId,
    arb_enabled: true,
    yield_enabled: true,
    rebalance_enabled: true,
    brickt_enabled: true,
    auto_execute: true,
    require_approval_above: 500,
    allow_swaps: true,
    allow_bridges: true,
    allow_sends: true,
    updated_at: new Date().toISOString(),
  }
}

export async function upsertUser(privyUserId: string, walletAddress?: string) {
  const normalizedAddress = normalizeAddress(walletAddress)

  if (pool) {
    const result = await query<DbUser>(
      `
        insert into users (privy_user_id, wallet_address, updated_at)
        values ($1, $2, now())
        on conflict (privy_user_id)
        do update set wallet_address = excluded.wallet_address, updated_at = now()
        returning *
      `,
      [privyUserId, normalizedAddress]
    )
    if (result?.rows[0]) {
      return result.rows[0]
    }
  }

  const existing = Array.from(memory.users.values()).find((user) => user.privy_user_id === privyUserId)
  const nextUser: DbUser = existing ?? {
    id: randomId('user'),
    privy_user_id: privyUserId,
    wallet_address: normalizedAddress,
  }
  nextUser.wallet_address = normalizedAddress
  memory.users.set(nextUser.id, nextUser)
  return nextUser
}

export async function getUserByPrivyId(privyUserId: string) {
  if (pool) {
    const result = await query<DbUser>('select * from users where privy_user_id = $1 limit 1', [privyUserId])
    if (result?.rows[0]) {
      return result.rows[0]
    }
  }

  return Array.from(memory.users.values()).find((user) => user.privy_user_id === privyUserId) ?? null
}

export async function getUserByWalletAddress(walletAddress: string) {
  const normalizedAddress = normalizeAddress(walletAddress)
  if (!normalizedAddress) return null

  if (pool) {
    const result = await query<DbUser>('select * from users where wallet_address = $1 limit 1', [normalizedAddress])
    if (result?.rows[0]) {
      return result.rows[0]
    }
  }

  return Array.from(memory.users.values()).find((user) => user.wallet_address === normalizedAddress) ?? null
}

export async function getAgentSettings(userId: string) {
  if (pool) {
    const existing = await query<AgentSettingsRow>(
      'select * from agent_settings where user_id = $1 limit 1',
      [userId]
    )
    if (existing?.rows[0]) return existing.rows[0]

    const created = await query<AgentSettingsRow>(
      `
        insert into agent_settings (user_id)
        values ($1)
        on conflict (user_id)
        do update set updated_at = agent_settings.updated_at
        returning *
      `,
      [userId]
    )
    if (created?.rows[0]) {
      return created.rows[0]
    }
  }

  const current = memory.strategySettings.get(userId) ?? defaultSettings(userId)
  memory.strategySettings.set(userId, current)
  return current
}

export async function setStrategyEnabled(userId: string, strategyId: string, enabled: boolean) {
  const column = strategyColumnMap[strategyId]
  if (!column) throw new Error(`Unsupported strategy: ${strategyId}`)

  if (pool) {
    await getAgentSettings(userId)
    const result = await query<AgentSettingsRow>(
      `update agent_settings set ${column} = $2, updated_at = now() where user_id = $1 returning *`,
      [userId, enabled]
    )
    if (result?.rows[0]) {
      return result.rows[0]
    }
  }

  const settings = await getAgentSettings(userId)
  const nextSettings = {
    ...settings,
    [column]: enabled,
    updated_at: new Date().toISOString(),
  } as AgentSettingsRow
  memory.strategySettings.set(userId, nextSettings)
  return nextSettings
}

export async function updateAgentSettings(
  userId: string,
  updates: Partial<Pick<
    AgentSettingsRow,
    'auto_execute' | 'require_approval_above' | 'allow_swaps' | 'allow_bridges' | 'allow_sends'
  >>
) {
  const nextUpdates: Record<string, unknown> = {}
  if (typeof updates.auto_execute === 'boolean') {
    nextUpdates.auto_execute = updates.auto_execute
  }
  if (typeof updates.require_approval_above === 'number' && Number.isFinite(updates.require_approval_above)) {
    nextUpdates.require_approval_above = updates.require_approval_above
  }
  if (typeof updates.allow_swaps === 'boolean') {
    nextUpdates.allow_swaps = updates.allow_swaps
  }
  if (typeof updates.allow_bridges === 'boolean') {
    nextUpdates.allow_bridges = updates.allow_bridges
  }
  if (typeof updates.allow_sends === 'boolean') {
    nextUpdates.allow_sends = updates.allow_sends
  }

  if (!Object.keys(nextUpdates).length) {
    return getAgentSettings(userId)
  }

  if (pool) {
    await getAgentSettings(userId)
    const fields = Object.keys(nextUpdates)
    const assignments = fields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(', ')
    const values = [userId, ...fields.map((field) => nextUpdates[field])]
    const result = await query<AgentSettingsRow>(
      `update agent_settings set ${assignments}, updated_at = now() where user_id = $1 returning *`,
      values
    )
    if (result?.rows[0]) {
      return result.rows[0]
    }
  }

  const settings = await getAgentSettings(userId)
  const nextSettings: AgentSettingsRow = {
    ...settings,
    ...nextUpdates,
    updated_at: new Date().toISOString(),
  }
  memory.strategySettings.set(userId, nextSettings)
  return nextSettings
}

export async function logExecution(data: {
  userId: string
  strategyType: string
  status: 'success' | 'skipped' | 'failed' | 'pending'
  description: string
  txHash?: string
  chainId?: number
  profitUsd?: number
  gasCostUsd?: number
  amountUsd?: number
  errorMessage?: string
  metadata?: Record<string, unknown>
}) {
  if (pool) {
    await query(
      `
        insert into agent_executions (
          user_id, strategy_type, status, description, tx_hash, chain_id,
          profit_usd, gas_cost_usd, amount_usd, error_message, metadata
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        data.userId,
        data.strategyType,
        data.status,
        data.description,
        data.txHash ?? null,
        data.chainId ?? null,
        data.profitUsd ?? null,
        data.gasCostUsd ?? null,
        data.amountUsd ?? null,
        data.errorMessage ?? null,
        JSON.stringify(data.metadata ?? {}),
      ]
    )
    return
  }

  const row: AgentExecutionRow = {
    id: randomId('exec'),
    user_id: data.userId,
    strategy_type: data.strategyType,
    status: data.status,
    description: data.description,
    tx_hash: data.txHash ?? null,
    chain_id: data.chainId ?? null,
    profit_usd: data.profitUsd ?? null,
    gas_cost_usd: data.gasCostUsd ?? null,
    amount_usd: data.amountUsd ?? null,
    error_message: data.errorMessage ?? null,
    executed_at: new Date().toISOString(),
    metadata: data.metadata ?? null,
  }
  const current = memory.executions.get(data.userId) ?? []
  current.unshift(row)
  memory.executions.set(data.userId, current.slice(0, 50))
}

export async function getRecentExecutions(userId: string, sinceHours = 14) {
  if (pool) {
    const result = await query<AgentExecutionRow>(
      `
        select *
        from agent_executions
        where user_id = $1
          and executed_at >= now() - ($2 || ' hours')::interval
        order by executed_at desc
        limit 20
      `,
      [userId, sinceHours]
    )
    return result?.rows ?? []
  }

  const cutoff = Date.now() - sinceHours * 60 * 60 * 1000
  return (memory.executions.get(userId) ?? []).filter(
    (execution) => new Date(execution.executed_at).getTime() >= cutoff
  )
}

export async function getStrategyExecutions(userId: string, strategyType: string, limit = 10) {
  if (pool) {
    const result = await query<AgentExecutionRow>(
      `
        select *
        from agent_executions
        where user_id = $1
          and strategy_type = $2
        order by executed_at desc
        limit $3
      `,
      [userId, strategyType, limit]
    )
    return result?.rows ?? []
  }

  return (memory.executions.get(userId) ?? [])
    .filter((execution) => execution.strategy_type === strategyType)
    .slice(0, limit)
}

export async function saveTransaction(userId: string, tx: TransactionInsert) {
  if (pool) {
    await query(
      `
        insert into transactions (
          user_id, tx_hash, chain_id, tx_type, status, from_address, to_address,
          value_formatted, value_usd, token_in, token_out, from_chain_id, to_chain_id, bridge_protocol
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        on conflict (tx_hash, chain_id)
        do update set
          status = excluded.status,
          value_formatted = excluded.value_formatted,
          value_usd = excluded.value_usd,
          token_in = excluded.token_in,
          token_out = excluded.token_out,
          from_chain_id = excluded.from_chain_id,
          to_chain_id = excluded.to_chain_id,
          bridge_protocol = excluded.bridge_protocol
      `,
      [
        userId,
        tx.txHash,
        tx.chainId,
        tx.txType,
        tx.status,
        normalizeAddress(tx.fromAddress),
        normalizeAddress(tx.toAddress),
        tx.valueFormatted ?? null,
        tx.valueUsd ?? null,
        tx.tokenIn ? JSON.stringify(tx.tokenIn) : null,
        tx.tokenOut ? JSON.stringify(tx.tokenOut) : null,
        tx.fromChainId ?? null,
        tx.toChainId ?? null,
        tx.bridgeProtocol ?? null,
      ]
    )
    return
  }

  const current = memory.transactions.get(userId) ?? []
  const next = current.filter((entry) => !(entry.txHash === tx.txHash && entry.chainId === tx.chainId))
  next.unshift(tx)
  memory.transactions.set(userId, next.slice(0, 100))
}

export async function getStoredTransactions(userId: string, chainId?: number, limit = 20) {
  if (pool) {
    const values: unknown[] = [userId]
    let sql = `
      select tx_hash, chain_id, tx_type, status, from_address, to_address, value_formatted,
             value_usd, token_in, token_out, from_chain_id, to_chain_id, bridge_protocol, updated_at
      from transactions
      where user_id = $1
    `
    if (typeof chainId === 'number') {
      values.push(chainId)
      sql += ` and chain_id = $${values.length}`
    }
    values.push(limit)
    sql += ` order by updated_at desc nulls last limit $${values.length}`

    const result = await query<TransactionRow>(sql, values)
    return result?.rows ?? []
  }

  return (memory.transactions.get(userId) ?? [])
    .filter((entry) => typeof chainId !== 'number' || entry.chainId === chainId)
    .slice(0, limit)
    .map((entry) => ({
      tx_hash: entry.txHash,
      chain_id: entry.chainId,
      tx_type: entry.txType,
      status: entry.status,
      from_address: entry.fromAddress,
      to_address: entry.toAddress ?? null,
      value_formatted: entry.valueFormatted ?? null,
      value_usd: entry.valueUsd ?? null,
      token_in: entry.tokenIn as Record<string, unknown> | null,
      token_out: entry.tokenOut as Record<string, unknown> | null,
      from_chain_id: entry.fromChainId ?? null,
      to_chain_id: entry.toChainId ?? null,
      bridge_protocol: entry.bridgeProtocol ?? null,
      updated_at: new Date().toISOString(),
    }))
}

export async function updateTransactionStatus(
  txHash: string,
  chainId: number,
  status: 'pending' | 'confirmed' | 'failed'
) {
  if (pool) {
    await query(
      `
        update transactions
        set status = $3, updated_at = now()
        where tx_hash = $1 and chain_id = $2
      `,
      [txHash, chainId, status]
    )

    await query(
      `
        update agent_executions
        set status = $3
        where tx_hash = $1 and chain_id = $2
      `,
      [txHash, chainId, status === 'confirmed' ? 'success' : status]
    )
    return
  }

  for (const [userId, entries] of memory.transactions.entries()) {
    const next = entries.map((entry) =>
      entry.txHash === txHash && entry.chainId === chainId
        ? { ...entry, status }
        : entry
    )
    memory.transactions.set(userId, next)
  }

  for (const [userId, entries] of memory.executions.entries()) {
    const next: AgentExecutionRow[] = entries.map((entry) =>
      entry.tx_hash === txHash && entry.chain_id === chainId
        ? { ...entry, status: status === 'confirmed' ? 'success' : status === 'failed' ? 'failed' : 'pending' }
        : entry
    )
    memory.executions.set(userId, next)
  }
}

export async function savePortfolioSnapshot(userId: string, totalUsd: number, breakdown: object) {
  const snapshotDate = new Date().toISOString().slice(0, 10)

  if (pool) {
    await query(
      `
        insert into portfolio_snapshots (user_id, total_usd, breakdown, snapshot_date)
        values ($1, $2, $3::jsonb, $4)
        on conflict (user_id, snapshot_date)
        do update set total_usd = excluded.total_usd, breakdown = excluded.breakdown
      `,
      [userId, totalUsd, JSON.stringify(breakdown), snapshotDate]
    )
    return
  }

  const current = memory.snapshots.get(userId) ?? []
  const next = current.filter((entry) => entry.snapshotDate !== snapshotDate)
  next.unshift({ totalUsd, breakdown, snapshotDate })
  memory.snapshots.set(userId, next)
}

const strategyColumnMap: Record<string, keyof AgentSettingsRow> = {
  arb: 'arb_enabled',
  yield: 'yield_enabled',
  rebalance: 'rebalance_enabled',
  reb: 'rebalance_enabled',
  brickt: 'brickt_enabled',
}
