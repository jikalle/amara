# Known Limitations And Support Runbook

Status date: 2026-04-02

This document is for beta operators and support triage.

## Current Product Limits

- Web-first beta only
- Base + Ethereum only
- Confirmation is required before execution
- Bridge flows are higher-risk than swap and send
- Some features may be beta-gated by environment flags
- Mobile, extension, ERC-4337, and unattended autonomy are not current beta commitments

## External Dependencies

The product depends on:
- Privy for auth and wallet session handling
- Alchemy for wallet balances, NFTs, and transaction data
- LI.FI for swap and bridge quoting/execution paths
- Supabase Postgres for persistence
- Anthropic for agent chat quality

If any of these degrade, the product may still partially work but with warnings or reduced functionality.

## Common Failure Classes

### Auth mismatch

Symptoms:
- `403` on auth-bound routes
- wallet mismatch errors

Likely cause:
- request wallet does not match authenticated wallet

Operator action:
- verify active wallet in UI
- verify bearer token/session is current
- retry after re-authentication

### Insufficient balance

Symptoms:
- action blocked before submission
- UI shows insufficient balance message

Likely cause:
- wallet lacks token amount, gas, or route overhead

Operator action:
- confirm source token balance
- confirm chain gas balance
- retry with smaller amount

### Route or provider failure

Symptoms:
- preview unavailable
- execute unavailable
- wallet data partially unavailable

Likely cause:
- external provider outage or invalid credentials

Operator action:
- inspect API structured logs
- verify Alchemy and LI.FI connectivity
- verify environment keys are present and valid
- disable bridge flow if bridge-specific provider path is unstable

### Transaction pending too long

Symptoms:
- action card remains `SUBMITTED`
- explorer shows pending tx for extended period

Likely cause:
- network congestion
- stuck wallet tx
- delayed receipt propagation

Operator action:
- inspect explorer directly
- verify `/api/tx/status/:chainId/:txHash`
- if still pending, communicate status instead of forcing false confirmation

### Database degradation

Symptoms:
- settings fail to persist
- brief/history become incomplete

Likely cause:
- Supabase unreachable
- schema mismatch

Operator action:
- check API logs for DB fallback or SQL errors
- verify `DATABASE_URL`
- verify latest schema is applied

## Beta Feature Flags

Current API flags:
- `FEATURE_SWAP_ENABLED`
- `FEATURE_BRIDGE_ENABLED`
- `FEATURE_SEND_ENABLED`

Use these to disable risky flows without code changes.

Recommended default if bridge quality is uncertain:
- keep swaps and sends enabled
- disable bridges until staging and internal beta are consistently stable

## Operator Checks

Before expanding beta:
- verify staging regression checklist is green
- verify analytics events appear
- verify monitoring route receives client errors
- verify strategy settings persist across restart
- verify bridge gating works if disabled

## Incident Handling

If there is a live issue:
1. Classify whether the issue is auth, provider, DB, execution, or UX-only
2. Disable risky flows with feature flags if needed
3. Confirm whether the issue is reproducible on staging
4. Capture:
   - wallet address
   - chain
   - action type
   - tx hash if one exists
   - API log event names around the failure
5. Decide whether to hotfix, rollback, or pause beta access

## User-Facing Truths

Do not overstate current capability:
- The wallet is assistive, not unattended autonomous
- The user still confirms execution
- External providers can affect previews and execution
- Bridge routes may be slower or less reliable than same-chain actions
