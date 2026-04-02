# Staging Regression Checklist

Status date: 2026-04-02

Use this checklist before opening or expanding the beta cohort.

## Auth

- [ ] Open onboarding page and complete login successfully
- [ ] `POST /api/auth/sync` succeeds after login
- [ ] Authenticated user lands on dashboard
- [ ] Logout returns the app to onboarding

## Dashboard

- [ ] Portfolio total loads
- [ ] Assets tab shows real token balances
- [ ] NFTs tab renders owned NFTs or empty state without error
- [ ] Activity tab shows wallet activity
- [ ] Wallet refresh works after page reload
- [ ] Partial provider failures show an honest warning banner instead of fake data

## Agent Chat

- [ ] Chat opens successfully from dashboard
- [ ] Simple wallet query returns a valid response
- [ ] Swap request returns a preview card
- [ ] Send request returns a preview card
- [ ] Bridge request returns a preview card if enabled, or a clean disabled message if feature-flagged off
- [ ] Unsupported or ambiguous request fails cleanly without crashing

## Execution

- [ ] Tiny swap can be confirmed and submitted
- [ ] Submitted action moves to confirmed after polling
- [ ] Explorer link opens correctly
- [ ] Tiny send can be confirmed and submitted
- [ ] Bridge can be confirmed and submitted if enabled
- [ ] Insufficient-balance action is blocked before wallet submission

## Guardrails

- [ ] Lower execution cap blocks larger action
- [ ] Disabling swaps blocks swap execution
- [ ] Disabling sends blocks send execution
- [ ] Disabling bridges blocks bridge execution
- [ ] Guardrail errors are shown clearly in the UI

## Strategy Settings

- [ ] Strategy detail page loads
- [ ] Pause/resume works
- [ ] Execution cap can be edited and saved
- [ ] Per-action toggles can be edited and saved
- [ ] Settings persist after API restart

## Monitoring And Analytics

- [ ] `window.dataLayer` receives funnel events in the browser
- [ ] Client runtime errors are accepted by `POST /api/monitoring/client-error`
- [ ] Structured API logs appear for preview, execute, fail, and confirm paths

## Restart Safety

- [ ] Restart API and reload dashboard without losing persisted strategy settings
- [ ] Restart API and confirm brief/history still load
- [ ] Previously submitted tx records still reconcile correctly after restart

## Signoff

- [ ] No Sev-1 issue remains open
- [ ] No hidden fallback mode is masking a critical production risk
- [ ] Product copy still matches actual live capability
