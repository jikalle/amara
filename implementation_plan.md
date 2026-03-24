 Concrete Implementation Plan (MVP end‑to‑end)

  Assumptions

  1. Target MVP = usable web + mobile wallet with agent chat, real portfolio data, swap/bridge execution with
     confirmation, and basic strategy toggles (no full automation yet).
  2. Base + Ethereum are the first supported chains.
  3. Supabase is the backend DB of record.

  If any of these are wrong, tell me and I’ll adjust.

  Plan

  1. Environment + Config
     1.1 Create real env files for API, web, mobile.
     Files: apps/api/.env, apps/web/.env.local, apps/mobile/.env
     1.2 Standardize env names and validate at boot (throw early).
     Files: apps/api/src/index.ts, packages/chain/src/chains.ts, packages/chain/src/privy.ts
  2. Database Schema + API Wiring
     2.1 Finalize Supabase schema for users, agent_settings, agent_executions, transactions, portfolio_snapshots.
     File: apps/api/src/db/schema.sql
     2.2 Wire /api/agent/brief to real agent_executions via getRecentExecutions.
     File: apps/api/src/routes/agent.ts
     2.3 Wire /api/wallet/:address/portfolio to real balances (Alchemy) and snapshot store.
     Files: apps/api/src/routes/wallet.ts, apps/api/src/services/portfolio.ts (create if missing)
     2.4 Wire /api/wallet/:address/transactions to The Graph or Alchemy history.
     File: apps/api/src/routes/wallet.ts
  3. Agent Core Hardening
     3.1 Replace mock tool outputs with real LI.FI quotes and price feeds.
     Files: packages/agent/src/tools/swap.ts, packages/agent/src/tools/bridge.ts, packages/agent/src/tools/portfolio.ts
     3.2 Add confidence gating: if parser confidence < threshold, ask clarification.
     File: packages/agent/src/graph.ts
     3.3 Persist conversation memory to Redis (short) + Postgres (long).
     File: packages/agent/src/memory/index.ts
     3.4 Add address + balance validations to prevent invalid executes.
     File: packages/agent/src/graph.ts
  4. Transaction Execution Pipeline
     4.1 Add /api/tx/simulate integration with Tenderly.
     File: apps/api/src/routes/transactions.ts
     4.2 Add /api/tx/broadcast integration with Alchemy.
     File: apps/api/src/routes/transactions.ts
     4.3 Create execution endpoint that consumes actionCard + signature and executes swap/bridge.
     Files: apps/api/src/routes/transactions.ts, packages/chain/src/lifi.ts
  5. Web UI: Real Data + Agent Chat
     5.1 Connect wallet state to API (portfolio, tx history).
     Files: apps/web/src/store/index.ts, apps/web/src/app/dashboard/page.tsx
     5.2 Add agent chat panel route and hook to /api/agent/chat.
     Files: apps/web/src/app/dashboard/page.tsx, apps/web/src/hooks/useAgent.ts
     5.3 Render actionCard in chat UI with confirm/cancel.
     Files: apps/web/src/app/dashboard/page.tsx, packages/ui/src/components/index.tsx
  6. Mobile UI: Parity
     6.1 Mirror web data fetching and chat confirmation UX.
     Files: apps/mobile/src/hooks/useAgent.ts, apps/mobile/src/store/index.ts, apps/mobile/src/app/chat.tsx
  7. Contracts + Wallet Execution
     7.1 Keep AnaraWallet.sol as v1 scaffold; add minimal deploy script + tests.
     Files: apps/contracts/src/AnaraWallet.sol, apps/contracts/test/AnaraWallet.t.sol
     7.2 When ready, integrate Safe/Permissionless for ERC‑4337 (post‑MVP).
  8. Observability + Guardrails
     8.2 Add strategy toggle persistence in DB.
     Files: apps/api/src/routes/strategy.ts, apps/api/src/db/client.ts
  9. QA + Release
     Commands: pnpm typecheck, pnpm --filter @anara/web build, pnpm --filter @anara/mobile typecheck

  Suggested Build Order (fastest path to demo)
  3. Step 4 (tx execution)
  4. Step 6 (mobile parity)
  5. Step 8–9 (hardening + release)
  schema + Step 2.2 brief wiring”).