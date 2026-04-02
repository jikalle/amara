# Release Decision Sheet

Status date: 2026-04-02

Use this after completing [staging_regression_checklist.md](/home/mafita/amara/staging_regression_checklist.md).

## Release Target

- Environment:
- Build / commit:
- Planned cohort size:
- Owner:

## Go / No-Go Summary

- Decision: `GO` / `NO-GO`
- Date:
- Decided by:

## Critical Checks

Mark each item:
- `PASS`
- `FAIL`
- `WAIVED`

### Auth And Access

- [ ] Login and auth sync work
- [ ] Logout works
- [ ] Beta-gated users only, if gating is enabled

### Dashboard

- [ ] Portfolio loads
- [ ] Assets load
- [ ] NFTs load or show safe empty state
- [ ] Activity loads

### Agent And Execution

- [ ] Chat responds
- [ ] Preview generation works
- [ ] Tiny swap works end to end
- [ ] Tiny send works end to end
- [ ] Bridge behavior matches release decision

### Guardrails

- [ ] Execution cap blocks oversized action
- [ ] Disabled action types are blocked
- [ ] Settings persist after restart

### Monitoring

- [ ] Analytics events appear
- [ ] Client error reporting works
- [ ] API structured logs are visible

## Bridge Decision

- Launch with bridge enabled: `YES` / `NO`
- If `NO`, confirm:
  - [ ] `FEATURE_BRIDGE_ENABLED=false` in target environment
  - [ ] Chat shows bridge-disabled beta notice
  - [ ] Bridge requests are blocked server-side

Reason:

## Known Risks Accepted For This Release

1.
2.
3.

## Blockers

List any blocker-class issues that prevent release:

1.
2.
3.

## Rollback Trigger

Rollback or pause beta if any of these occur:
- auth failure on core path
- dashboard data unavailable for most users
- preview generation broadly unavailable
- confirmed execution path failing at unacceptable rate
- monitoring or logging insufficient to support incidents

## Signoff

- Product:
- Engineering:
- Operations / support:

## First-Cohort Watchlist

Track during the first beta cohort:
- wallet linked rate
- dashboard loaded rate
- preview generated rate
- tx submitted rate
- tx confirmed rate
- top support issue category
