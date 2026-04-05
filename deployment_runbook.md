# Deployment Runbook

Status date: 2026-04-05

Use this when promoting Amara from local/staging to a real hosted environment.

## Deployment Scope

This runbook covers:
- web app deployment
- API deployment
- environment setup
- pre-release smoke checks
- rollback procedure

It assumes:
- the web app and API are deployed separately
- Postgres is already provisioned
- the API can reach its providers and RPCs

## Environment Model

Use at least two environments:
- `staging`
- `production`

Do not reuse the same:
- database
- Privy app
- API keys
- feature-flag values

Recommended domains:
- staging web: `staging.<your-domain>`
- production web: `<your-domain>`
- staging api: `api-staging.<your-domain>`
- production api: `api.<your-domain>`

## Required Environment Variables

### Web

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_ALCHEMY_API_KEY`
- `NEXT_PUBLIC_WALLETCONNECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ANALYTICS_DEBUG=false`

### API

- `PORT`
- `ANTHROPIC_API_KEY`
- `ALCHEMY_API_KEY`
- `DATABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_URL`
- `UPSTASH_REDIS_TOKEN`
- `LIFI_API_KEY`
- `FEATURE_SWAP_ENABLED`
- `FEATURE_BRIDGE_ENABLED`
- `FEATURE_SEND_ENABLED`

### Optional Funding Rails

Hosted/global fallback:
- `TRANSAK_API_KEY`
- `TRANSAK_API_SECRET`
- `TRANSAK_ENVIRONMENT`
- `TRANSAK_REFERRER_DOMAIN`

Nigeria-first bank transfer:
- `CNGN_API_KEY`
- `CNGN_ENCRYPTION_KEY`
- `CNGN_PRIVATE_KEY_PATH`
- `CNGN_API_BASE_URL`

### Environment Rules

- Use the Supabase session pooler connection string for `DATABASE_URL`
- Use a real inline DB password in `DATABASE_URL`
- Keep staging and production Privy apps separate
- Keep staging and production cNGN / Transak credentials separate

## Pre-Deploy Checklist

Before every release:

- [ ] `pnpm --filter @anara/api build`
- [ ] `pnpm --filter @anara/web typecheck`
- [ ] staging env variables are present
- [ ] production env variables are present
- [ ] feature-flag posture is decided
- [ ] [staging_regression_checklist.md](/home/mafita/amara/staging_regression_checklist.md) is current
- [ ] [release_decision_sheet.md](/home/mafita/amara/release_decision_sheet.md) is filled for the target release

## Staging Deployment Sequence

1. Deploy API to staging
2. Verify `/health`
3. Verify `/api/agent/status`
4. Deploy web to staging
5. Log in with a staging user
6. Run the staging regression checklist

Minimum staging smoke checks:
- login works
- dashboard loads
- direct send works
- direct swap works
- direct bridge behavior matches flag choice
- cNGN funding screen opens without crashing
- monitoring route accepts client errors

## Production Deployment Sequence

1. Freeze release commit
2. Confirm release sheet says `GO`
3. Deploy API to production
4. Check API startup logs
5. Verify `/health`
6. Deploy web to production
7. Run production smoke check
8. Open the first beta cohort only after smoke checks pass

Minimum production smoke checks:
- login
- dashboard portfolio
- one tiny send or swap
- strategy settings load
- funding sheet opens
- analytics events appear
- API structured logs appear

## Feature-Flag Guidance

For early beta, decide explicitly:

- `FEATURE_SWAP_ENABLED=true`
- `FEATURE_SEND_ENABLED=true`
- `FEATURE_BRIDGE_ENABLED=true|false`

If bridge confidence is low:
- set `FEATURE_BRIDGE_ENABLED=false`
- verify the UI copy still matches that decision

## Monitoring During Deployment

Watch:
- API startup errors
- auth failures
- wallet data provider failures
- tx simulation/execute failures
- client runtime errors
- funding-session creation failures
- cNGN virtual account failures

## Rollback Procedure

Rollback if any of these occur:
- most users cannot log in
- dashboard data is broadly unavailable
- transaction execution is broadly failing
- monitoring/logging is too weak to diagnose live failures
- funding rail breaks the primary wallet experience

Rollback order:

1. Disable high-risk features with env flags if needed
2. Revert web deployment to previous stable build
3. Revert API deployment to previous stable build
4. Pause beta expansion
5. Log the incident in the release sheet / support notes

## Post-Deploy Watch Window

Watch closely for the first 60 to 120 minutes:
- dashboard load success
- preview generation success
- tx submission rate
- tx confirmation rate
- top support complaint
- cNGN funding request failures

## Notes

- cNGN integration is merchant/KYB-gated. If merchant approval is incomplete, keep the Nigeria-first path hidden or marked as coming soon.
- The hosted global fallback can remain enabled while cNGN approval is pending.
