# Amara Wallet

> Assistive web-first wallet for Base, Ethereum, and BNB Chain.
> The agent prepares actions, you confirm execution.

---

## What is Amara?

Amara is an AI-assisted crypto wallet focused on Base, Ethereum, and BNB Chain. The agent helps the user:

- view real balances, assets, NFTs, and wallet activity
- ask for swap, send, and bridge previews in natural language
- confirm and execute real wallet-backed transactions
- review status updates and recent execution history
- fund the wallet through hosted checkout or a Nigeria-first bank-transfer path

The current MVP is explicitly confirmation-based. It is not unattended autonomous execution.

---

## Monorepo Structure

```
anara/
├── apps/
│   ├── mobile/       # Expo React Native (iOS + Android)
│   ├── web/          # Next.js 14 (web app + landing)
│   ├── extension/    # React + Vite (browser extension)
│   ├── api/          # Express backend + agent orchestration
│   └── contracts/    # Foundry smart contracts (Base primary)
│
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── chain/        # Viem clients, LI.FI, Privy config
│   ├── agent/        # Claude API brain, LangGraph, tools, memory
│   ├── ui/           # Shared component library (NativeWind)
│   └── config/       # Shared tsconfig, eslint
│
├── .env.example      # All environment variables
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Mobile | Expo React Native | iOS + Android from one codebase |
| Web | Next.js 14 App Router | SEO, server components, API routes |
| Extension | React + Vite | Lightweight, fast HMR |
| State | Zustand | Lightweight, works everywhere |
| Auth + Wallets | Privy | Email/SMS onboarding + embedded wallets |
| Chain interaction | Viem + Wagmi | Type-safe, modern, fastest |
| Account Abstraction | Safe{Core} + Permissionless.js | Post-MVP path, not current beta-critical |
| Swap + Bridge | LI.FI SDK | Aggregates all DEXs + bridges in one call |
| AI Agent | Claude claude-sonnet-4-5 + LangGraph | Reasoning + multi-turn memory |
| Memory | Upstash Redis (short) + pgvector (long) | Fast context, persistent history |
| Database | Supabase (PostgreSQL) | Realtime, RLS, managed |
| Indexing | The Graph | Portfolio history, tx history |
| Nodes | Alchemy | Reliable, webhooks, NFT API |
| Notifications | Push Protocol | Candidate notification layer |
| Contracts | Foundry | You already know it |
| Primary Chain | Base | Low gas, growing ecosystem, Coinbase |
| Automation | Chainlink Automation | Future automation path, not current MVP |

---

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)

### Install

```bash
git clone https://github.com/your-org/anara
cd anara
pnpm install
```

### Environment

```bash
cp .env.example .env
```

Fill in at minimum:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `ALCHEMY_API_KEY` — from alchemy.com
- `NEXT_PUBLIC_PRIVY_APP_ID` — from privy.io
- `DATABASE_URL` — use the Supabase session pooler connection string for local dev

Important notes:
- The API loads the repo root [/.env](/home/mafita/amara/.env)
- Blank `apps/api/.env` values do not need to be edited for normal local development
- Prefer the Supabase session pooler host (`*.pooler.supabase.com`) over the direct `db.<project-ref>.supabase.co` host if your environment does not have working IPv6 routing
- Put the actual DB password inline in `DATABASE_URL`; `dotenv` will not expand `${DATABASE_PASSWORD}` automatically

### Run (development)

```bash
# All services in parallel
pnpm dev

# Or individually:
pnpm dev:api        # Express API on :4000
pnpm dev:web        # Next.js on :3000
pnpm dev:mobile     # Expo (scan QR with Expo Go)
```

### Test contracts

```bash
cd apps/contracts
forge install
forge test -vvv
```

---

## Product Status

### Working Now
- [x] Real Privy-backed web auth
- [x] Real wallet balances, assets, NFTs, and activity
- [x] Natural-language swap/send/bridge previews
- [x] Real wallet-backed transaction execution
- [x] Transaction submitted to confirmed lifecycle
- [x] Strategy guardrails with backend persistence
- [x] Auth hardening on agent, strategy, and tx routes

### Current MVP Scope
- [x] Web-first beta
- [x] Base + Ethereum + BNB Chain
- [x] Confirmation required before execution
- [x] Assistive agent behavior, not unattended autonomy

### Not On The Critical Beta Path
- [ ] Full autonomous execution
- [ ] ERC-4337 / Safe integration
- [ ] Browser extension
- [ ] Mobile parity
- [ ] Brickt integration
- [ ] Broad multichain expansion

### Launch Work Remaining
- [ ] Final staging regression pass
- [ ] Production deployment and rollback rehearsal
- [ ] cNGN merchant approval / KYB completion
- [ ] final funding-rail release posture decision

See:
- [launch_execution_board.md](/home/mafita/amara/launch_execution_board.md)
- [deployment_runbook.md](/home/mafita/amara/deployment_runbook.md)
- [staging_regression_checklist.md](/home/mafita/amara/staging_regression_checklist.md)
- [release_decision_sheet.md](/home/mafita/amara/release_decision_sheet.md)

---

## Smart Contract Architecture

```
AnaraWallet.sol
├── Owner          — Master key, full control
├── AgentModule    — Autonomous execution within guard rails
└── GuardRails     — Daily limits, per-trade caps, strategy toggles
```

This architecture section reflects a possible future contract path, not the current shipped MVP. The live beta path today is confirmation-based wallet execution from the connected user wallet.

---

## Contributing

This is currently in active development. The design prototype is complete (`agent-wallet-mobile.html` in the root). We are now building the real app on top of this scaffold.

---

## License

MIT

---

*"The wealth of a man is not in his pocket, but in the land he cultivates." — Yoruba proverb*
