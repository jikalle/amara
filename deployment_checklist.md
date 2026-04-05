# Deployment Checklist

Status date: 2026-04-05

Use this as the execution checklist that sits beside [deployment_runbook.md](/home/mafita/amara/deployment_runbook.md).

## Part 1: Staging Environment Setup

### Domains And URLs

- [ ] Staging web URL is chosen
- [ ] Staging API URL is chosen
- [ ] `NEXT_PUBLIC_API_URL` points to the staging API
- [ ] CORS allows the staging web origin
- [ ] `CORS_ALLOWED_ORIGINS` includes the staging web origin

### Staging Web Environment

- [ ] `NEXT_PUBLIC_PRIVY_APP_ID`
- [ ] `NEXT_PUBLIC_ALCHEMY_API_KEY`
- [ ] `NEXT_PUBLIC_WALLETCONNECT_ID`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `NEXT_PUBLIC_ANALYTICS_DEBUG=false`

### Staging API Environment

- [ ] `PORT`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `ALCHEMY_API_KEY`
- [ ] `DATABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `UPSTASH_REDIS_URL`
- [ ] `UPSTASH_REDIS_TOKEN`
- [ ] `LIFI_API_KEY`
- [ ] `FEATURE_SWAP_ENABLED`
- [ ] `FEATURE_SEND_ENABLED`
- [ ] `FEATURE_BRIDGE_ENABLED`

### Optional Funding Rails

Hosted/global:
- [ ] `TRANSAK_API_KEY`
- [ ] `TRANSAK_API_SECRET`
- [ ] `TRANSAK_ENVIRONMENT`
- [ ] `TRANSAK_REFERRER_DOMAIN`

Nigeria-first:
- [ ] `CNGN_API_KEY`
- [ ] `CNGN_ENCRYPTION_KEY`
- [ ] `CNGN_PRIVATE_KEY_PATH`
- [ ] `CNGN_API_BASE_URL`

### Staging Infra Sanity

- [ ] Postgres is reachable from the staging API
- [ ] API starts without DB fallback warnings
- [ ] API `/health` returns `200`
- [ ] API `/ready` returns `200`
- [ ] API `/api/agent/status` returns `200`

## Part 2: Staging Release Validation

- [ ] `pnpm --filter @anara/api build`
- [ ] `pnpm --filter @anara/web typecheck`
- [ ] Deploy API to staging
- [ ] Deploy web to staging
- [ ] Log into staging successfully
- [ ] Run [staging_regression_checklist.md](/home/mafita/amara/staging_regression_checklist.md)
- [ ] Fill [release_decision_sheet.md](/home/mafita/amara/release_decision_sheet.md) for staging

### Staging Must-Pass Items

- [ ] Dashboard loads
- [ ] Tiny send works
- [ ] Tiny swap works
- [ ] Bridge behavior matches flag decision
- [ ] Strategy settings persist after restart
- [ ] Funding sheet opens without crash
- [ ] Monitoring route accepts client errors
- [ ] API structured logs are visible

## Part 3: Production Environment Setup

### Production Domains And URLs

- [ ] Production web URL is chosen
- [ ] Production API URL is chosen
- [ ] `NEXT_PUBLIC_API_URL` points to production API
- [ ] Production CORS allows the production web origin
- [ ] `CORS_ALLOWED_ORIGINS` includes the production web origin

### Production Web Environment

- [ ] `NEXT_PUBLIC_PRIVY_APP_ID`
- [ ] `NEXT_PUBLIC_ALCHEMY_API_KEY`
- [ ] `NEXT_PUBLIC_WALLETCONNECT_ID`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_API_URL`
- [ ] `NEXT_PUBLIC_ANALYTICS_DEBUG=false`

### Production API Environment

- [ ] `PORT`
- [ ] `ANTHROPIC_API_KEY`
- [ ] `ALCHEMY_API_KEY`
- [ ] `DATABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `UPSTASH_REDIS_URL`
- [ ] `UPSTASH_REDIS_TOKEN`
- [ ] `LIFI_API_KEY`
- [ ] `FEATURE_SWAP_ENABLED`
- [ ] `FEATURE_SEND_ENABLED`
- [ ] `FEATURE_BRIDGE_ENABLED`

### Production Funding Rails

Hosted/global:
- [ ] `TRANSAK_API_KEY`
- [ ] `TRANSAK_API_SECRET`
- [ ] `TRANSAK_ENVIRONMENT`
- [ ] `TRANSAK_REFERRER_DOMAIN`

Nigeria-first:
- [ ] `CNGN_API_KEY`
- [ ] `CNGN_ENCRYPTION_KEY`
- [ ] `CNGN_PRIVATE_KEY_PATH`
- [ ] `CNGN_API_BASE_URL`
- [ ] cNGN merchant approval / KYB is complete before enabling the rail

## Part 4: Production Release

- [ ] Freeze release commit
- [ ] Confirm release sheet says `GO`
- [ ] Decide bridge release posture
- [ ] Decide cNGN release posture
- [ ] Deploy API to production
- [ ] Check API startup logs
- [ ] Verify `/health`
- [ ] Verify `/ready`
- [ ] Deploy web to production
- [ ] Run a production smoke pass

### Production Smoke Pass

- [ ] Login works
- [ ] Dashboard portfolio loads
- [ ] Tiny send or swap works
- [ ] Strategy page loads
- [ ] Funding sheet opens
- [ ] Analytics events appear
- [ ] API structured logs appear

## Part 5: Rollback Readiness

- [ ] Previous stable API build is known
- [ ] Previous stable web build is known
- [ ] Rollback owner is known
- [ ] Incident/support owner is known
- [ ] Bridge can be disabled quickly with env flags
- [ ] cNGN rail can be hidden quickly if needed

## Part 6: First-Cohort Watch Window

Watch for the first 60 to 120 minutes:

- [ ] dashboard load success
- [ ] preview generation success
- [ ] tx submission success
- [ ] tx confirmation success
- [ ] funding-session creation success
- [ ] cNGN virtual account generation success
- [ ] top support issue category logged

## Signoff

- [ ] Product signoff
- [ ] Engineering signoff
- [ ] Operations/support signoff
