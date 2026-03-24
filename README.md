# Anara Wallet

> **The world's first autonomous multichain wallet.**
> Your agent works while you sleep.

---

## What is Anara?

Anara is an AI-powered crypto wallet where an autonomous agent manages your DeFi portfolio on your behalf. Unlike MetaMask, Rainbow, or Coinbase Wallet — which are purely passive — Anara's agent:

- Executes arbitrage trades 24/7
- Auto-compounds yield positions
- Rebalances your portfolio when it drifts
- Bridges assets to the best chain for the action
- Sends and receives on voice command
- Briefs you on everything it did while you were away

The African-inspired identity — kente colours, Adinkra motifs, Yoruba proverbs — is distinctive without limiting global adoption.

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
| Account Abstraction | Safe{Core} + Permissionless.js | Battle-tested, ERC-4337 |
| Swap + Bridge | LI.FI SDK | Aggregates all DEXs + bridges in one call |
| AI Agent | Claude claude-sonnet-4-5 + LangGraph | Reasoning + multi-turn memory |
| Memory | Upstash Redis (short) + pgvector (long) | Fast context, persistent history |
| Database | Supabase (PostgreSQL) | Realtime, RLS, managed |
| Indexing | The Graph | Portfolio history, tx history |
| Nodes | Alchemy | Reliable, webhooks, NFT API |
| Notifications | Push Protocol | Decentralized, cross-device |
| Contracts | Foundry | You already know it |
| Primary Chain | Base | Low gas, growing ecosystem, Coinbase |
| Automation | Chainlink Automation | Scheduled strategy execution |

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
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
cp .env.example apps/mobile/.env
```

Fill in at minimum:
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `ALCHEMY_API_KEY` — from alchemy.com
- `NEXT_PUBLIC_PRIVY_APP_ID` — from privy.io

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

## Build Roadmap

### Phase 1 — Core Wallet (Months 1–2)
- [ ] Privy embedded wallet + WalletConnect
- [ ] Viem + Wagmi multichain setup
- [ ] Real send/receive transactions
- [ ] Expo working on iOS + Android
- [ ] Basic portfolio view from Alchemy

### Phase 2 — The Agent (Months 3–4)
- [ ] Claude API + LangGraph multi-turn memory
- [ ] Natural language swap/send/bridge via LI.FI
- [ ] Alchemy webhooks → Push Protocol notifications
- [ ] Agent brief on wallet open (real data)

### Phase 3 — The Moat (Months 5–6)
- [ ] ERC-4337 via Safe + Permissionless.js
- [ ] Autonomous agent execution with guard rails
- [ ] Arb scanner (from existing TypeScript bot)
- [ ] Brickt pool integration

### Phase 4 — Polish + Launch (Months 7–8)
- [ ] Browser extension
- [ ] Portfolio analytics (The Graph)
- [ ] Transaction history screen
- [ ] Agent config / guardrail UI
- [ ] Beta launch

### Phase 5 — On-ramp (Months 9+)
- [ ] Yellow Card (NGN, GHS, KES)
- [ ] Transak (global card on-ramp)
- [ ] Local currency display

---

## Smart Contract Architecture

```
AnaraWallet.sol
├── Owner          — Master key, full control
├── AgentModule    — Autonomous execution within guard rails
└── GuardRails     — Daily limits, per-trade caps, strategy toggles
```

The agent is a registered module on the Safe-style wallet. It can execute swaps, bridges, and yield deposits autonomously — but the owner always holds the master key and can pause everything with `emergencyPause()`.

---

## Contributing

This is currently in active development. The design prototype is complete (`agent-wallet-mobile.html` in the root). We are now building the real app on top of this scaffold.

---

## License

MIT

---

*"The wealth of a man is not in his pocket, but in the land he cultivates." — Yoruba proverb*
