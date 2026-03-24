-- ─────────────────────────────────────────────────────────────────
-- Anara Wallet — Database Schema
-- Supabase (PostgreSQL) with Row Level Security
-- Run via: supabase db push  OR  psql -f schema.sql
-- ─────────────────────────────────────────────────────────────────

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector for agent memory

-- ─────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  privy_user_id   TEXT UNIQUE NOT NULL,
  wallet_address  TEXT,                          -- primary embedded wallet
  display_name    TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- WALLET SESSIONS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      TEXT UNIQUE NOT NULL,          -- agent conversation session
  device_type     TEXT CHECK (device_type IN ('mobile', 'web', 'extension')),
  last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- AGENT SETTINGS (guard rails per user)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_settings (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auto_execute            BOOLEAN NOT NULL DEFAULT TRUE,
  daily_spend_limit_usd   NUMERIC(12,2) NOT NULL DEFAULT 5000,
  max_trade_size_usd      NUMERIC(12,2) NOT NULL DEFAULT 2000,
  require_approval_above  NUMERIC(12,2) NOT NULL DEFAULT 500,
  -- per-strategy toggles
  arb_enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  yield_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  rebalance_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  brickt_enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  -- chain allow-list
  allowed_chain_ids       INTEGER[] NOT NULL DEFAULT '{8453,1,42161,10}',
  -- notifications
  notify_on_trade         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_error         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_profit        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────
-- AGENT EXECUTIONS (audit log of every agent action)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_executions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strategy_type   TEXT NOT NULL CHECK (strategy_type IN ('arb','yield','rebalance','brickt','send','receive','custom')),
  status          TEXT NOT NULL CHECK (status IN ('success','skipped','failed','pending')),
  description     TEXT NOT NULL,
  tx_hash         TEXT,
  chain_id        INTEGER,
  profit_usd      NUMERIC(12,4),
  gas_cost_usd    NUMERIC(8,4),
  amount_usd      NUMERIC(12,4),
  token_in        TEXT,
  token_out       TEXT,
  amount_in       TEXT,
  amount_out      TEXT,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_executions_user_id   ON agent_executions(user_id);
CREATE INDEX idx_executions_strategy  ON agent_executions(strategy_type);
CREATE INDEX idx_executions_timestamp ON agent_executions(executed_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- TRANSACTIONS (user-initiated: send, swap, bridge)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash         TEXT NOT NULL,
  chain_id        INTEGER NOT NULL,
  tx_type         TEXT NOT NULL CHECK (tx_type IN ('send','receive','swap','bridge','approve','mint','stake')),
  status          TEXT NOT NULL CHECK (status IN ('pending','confirmed','failed','cancelled')),
  from_address    TEXT NOT NULL,
  to_address      TEXT,
  value_raw       TEXT,                          -- BigInt as string
  value_formatted TEXT,
  value_usd       NUMERIC(14,2),
  gas_used        TEXT,
  gas_cost_usd    NUMERIC(8,4),
  block_number    BIGINT,
  nonce           INTEGER,
  -- swap / bridge specific
  token_in        JSONB,                         -- { symbol, amount, amountUsd }
  token_out       JSONB,
  from_chain_id   INTEGER,
  to_chain_id     INTEGER,
  bridge_protocol TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);

CREATE INDEX idx_txns_user_id    ON transactions(user_id);
CREATE INDEX idx_txns_chain      ON transactions(chain_id);
CREATE INDEX idx_txns_status     ON transactions(status);
CREATE INDEX idx_txns_created    ON transactions(created_at DESC);
CREATE UNIQUE INDEX idx_txns_hash ON transactions(tx_hash, chain_id);

-- ─────────────────────────────────────────────────────────────────
-- SAVED CONTACTS
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  address         TEXT NOT NULL,
  ens_name        TEXT,
  avatar_url      TEXT,
  chain_ids       INTEGER[] DEFAULT '{1,8453}',
  last_sent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, address)
);

-- ─────────────────────────────────────────────────────────────────
-- PORTFOLIO SNAPSHOTS (daily portfolio value for charting)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_usd       NUMERIC(14,2) NOT NULL,
  breakdown       JSONB DEFAULT '{}',            -- { chainId: { tokenSymbol: value } }
  pnl_24h_usd     NUMERIC(12,2),
  pnl_7d_usd      NUMERIC(12,2),
  snapshot_date   DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX idx_snapshots_user ON portfolio_snapshots(user_id, snapshot_date DESC);

-- ─────────────────────────────────────────────────────────────────
-- AGENT MEMORY (pgvector for semantic recall)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_memory (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      TEXT,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  embedding       VECTOR(1536),                  -- OpenAI/Anthropic embedding dim
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_memory_user    ON agent_memory(user_id, created_at DESC);
CREATE INDEX idx_memory_session ON agent_memory(session_id, created_at DESC);
-- Vector similarity index for semantic search
CREATE INDEX idx_memory_vector  ON agent_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory         ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (privy_user_id = auth.jwt()->>'sub');

CREATE POLICY "own_sessions" ON wallet_sessions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_agent_settings" ON agent_settings
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_executions" ON agent_executions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_transactions" ON transactions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_contacts" ON contacts
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_snapshots" ON portfolio_snapshots
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

CREATE POLICY "own_memory" ON agent_memory
  FOR ALL USING (user_id = (SELECT id FROM users WHERE privy_user_id = auth.jwt()->>'sub'));

-- ─────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────────────────────────────

-- Auto-update updated_at on users and agent_settings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agent_settings_updated_at
  BEFORE UPDATE ON agent_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Daily P&L calculation
CREATE OR REPLACE FUNCTION get_daily_pnl(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(snapshot_date DATE, total_usd NUMERIC, pnl_usd NUMERIC) AS $$
  SELECT
    snapshot_date,
    total_usd,
    total_usd - LAG(total_usd) OVER (ORDER BY snapshot_date) AS pnl_usd
  FROM portfolio_snapshots
  WHERE user_id = p_user_id
    AND snapshot_date >= CURRENT_DATE - p_days
  ORDER BY snapshot_date;
$$ LANGUAGE sql STABLE;
