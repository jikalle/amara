# Launch Execution Board

Status date: 2026-04-02

This board converts the current repo state into execution-ready work for Weeks 10-12.

Assumptions:
- Web-first beta
- Base + Ethereum only
- Confirmation-based agent, not unattended autonomy
- Bridge remains a higher-risk flow and can be feature-flagged

## Current State

Done enough for beta path:
- Real Privy-backed auth
- Real wallet portfolio, assets, NFTs, and activity
- Real swap/send/bridge previews
- Real wallet-backed execution
- Submitted to confirmed tx lifecycle
- Strategy guardrails with DB persistence
- Auth hardening on strategy, agent, and tx routes
- Structured API logging
- Basic API tests for authz, guardrails, and settings persistence

Not done enough yet:
- Analytics funnel instrumentation
- Production error monitoring
- Formal beta gating / feature flags
- Final staging regression sweep
- Known limitations / support runbook

## Epic 1: Analytics Funnel

Owner:
- Frontend/web owner
- Backend support where event attribution is server-side

Priority:
- P0

Dependencies:
- Current auth and tx flows

Tickets:

1. Add frontend analytics client wrapper
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - One shared analytics helper exists
  - Events can be called from onboarding, dashboard, chat, and tx flows
  - Analytics can be disabled cleanly in local dev

2. Instrument activation funnel
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - Events emitted for `signup_completed`, `wallet_linked`, `dashboard_loaded`
  - Event payload includes chain and wallet type when available

3. Instrument chat and preview funnel
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - Events emitted for `chat_opened`, `chat_submitted`, `preview_generated`
  - Event payload includes action type when preview is send, swap, or bridge

4. Instrument execution funnel
- Owner: Frontend/web + backend support
- Estimate: 0.5 day
- Acceptance criteria:
  - Events emitted for `tx_submitted`, `tx_confirmed`, `tx_failed`
  - Submitted and confirmed events carry chain ID and action type

## Epic 2: Error Monitoring

Owner:
- Backend/chain owner
- Frontend/web owner

Priority:
- P0

Dependencies:
- Structured API logs already in place

Tickets:

1. Add web error monitoring
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - Uncaught errors and route failures are captured in production
  - Environment and release metadata are attached

2. Add API error monitoring
- Owner: Backend/chain
- Estimate: 0.5 day
- Acceptance criteria:
  - Route failures are captured in production
  - Execution errors include wallet, chain, action type, and tx hash when available

3. Add alertable tx failure logging
- Owner: Backend/chain
- Estimate: 0.5 day
- Acceptance criteria:
  - Failed execute / confirm reconciliation paths are visible in one dashboard or sink
  - Common failure classes are searchable: auth, guardrail, balance, route, submission, confirmation

## Epic 3: Beta Gating And Safety Controls

Owner:
- Backend/chain owner
- Frontend/web owner

Priority:
- P0

Dependencies:
- Strategy guardrails and auth hardening completed

Tickets:

1. Add feature flags for risky flows
- Owner: Backend/chain
- Estimate: 1 day
- Acceptance criteria:
  - Bridge can be disabled globally
  - Additional risky actions can be disabled without deploy-time code edits
  - API enforces flags, not only UI

2. Add cohort gating
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - Access can be limited to approved users or wallets
  - Non-approved users see a clear beta access message

3. Add user-visible maintenance and degradation states
- Owner: Frontend/web
- Estimate: 0.5 day
- Acceptance criteria:
  - If providers are degraded, wallet and execution screens show honest state
  - Bridge-disabled state is obvious in chat and action cards

## Epic 4: Final Regression And Release Signoff

Owner:
- Tech lead
- QA/product
- Frontend/web owner
- Backend/chain owner

Priority:
- P0

Dependencies:
- Analytics and error monitoring installed

Tickets:

1. Build the staging regression checklist
- Owner: QA/product
- Estimate: 0.5 day
- Acceptance criteria:
  - Checklist exists in repo
  - It covers auth, dashboard, preview, execute, guardrails, strategy settings, and tx confirmation

2. Execute the regression sweep
- Owner: QA/product + engineering
- Estimate: 1 day
- Acceptance criteria:
  - Each critical flow is tested on staging
  - Failures are recorded with severity and owner
  - No Sev-1 issue remains open

3. Verify persistence and restart safety
- Owner: Backend/chain
- Estimate: 0.5 day
- Acceptance criteria:
  - Strategy settings survive API restart
  - Submitted tx records survive API restart
  - Brief/history still reflect persisted records after restart

## Epic 5: Support And Launch Operations

Owner:
- Product/tech lead
- Backend/chain owner

Priority:
- P1

Dependencies:
- Beta gating
- Monitoring

Tickets:

1. Write known limitations doc
- Owner: Product/tech lead
- Estimate: 0.5 day
- Acceptance criteria:
  - Documents supported chains
  - States confirmation requirement clearly
  - Calls out provider dependency and bridge risk

2. Write support runbook
- Owner: Backend/chain
- Estimate: 0.5 day
- Acceptance criteria:
  - Covers auth mismatch
  - Covers insufficient balance
  - Covers tx pending too long
  - Covers provider outage
  - Covers failed route execution

3. Define rollback and incident owner
- Owner: Tech lead
- Estimate: 0.25 day
- Acceptance criteria:
  - One owner is named for beta incidents
  - Rollback procedure exists for API and web

## Suggested Sequence

Week 10:
1. Epic 1: Analytics Funnel
2. Epic 2: Error Monitoring
3. Epic 5.1: Known limitations doc

Week 11:
1. Epic 3: Beta Gating And Safety Controls
2. Epic 4.1: Regression checklist
3. Epic 4.2: Staging sweep
4. Epic 5.2: Support runbook

Week 12:
1. Epic 4.3: Persistence and restart safety verification
2. Epic 5.3: Rollback and incident ownership
3. Controlled beta rollout

## Launch Exit Criteria

Call this beta-ready when:
- A real user can authenticate, load wallet data, generate a preview, confirm an action, and see the resulting status/history
- Failures are observable in logs and monitoring
- Risky flows can be disabled without code changes
- Guardrails are persisted and enforced
- Product copy matches actual capabilities
- Support has a known limitations doc and a basic incident path

## Supporting Docs

- [staging_regression_checklist.md](/home/mafita/amara/staging_regression_checklist.md)
- [known_limitations_and_support.md](/home/mafita/amara/known_limitations_and_support.md)
- [release_decision_sheet.md](/home/mafita/amara/release_decision_sheet.md)
