// ─────────────────────────────────────────────────────────────────
// Notification Service
// Push Protocol (on-chain) + Expo Push (mobile) + Web Push
// ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'arb_profit'
  | 'yield_compound'
  | 'rebalance'
  | 'brickt_payout'
  | 'tx_confirmed'
  | 'tx_failed'
  | 'agent_error'
  | 'daily_brief'

export interface NotificationPayload {
  type:    NotificationType
  title:   string
  body:    string
  data?:   Record<string, unknown>
  userId?: string
}

// ── Push Protocol (decentralized, on-chain notifications) ──────────
export async function sendPushNotification(
  recipientAddress: string,
  payload: NotificationPayload
) {
  // TODO: Replace stub with real Push Protocol SDK
  // import * as PushAPI from '@pushprotocol/restapi'
  // await PushAPI.payloads.sendNotification({
  //   signer:     channelSigner,
  //   type:       3, // targeted
  //   identityType: 2,
  //   notification: { title: payload.title, body: payload.body },
  //   payload:    { title: payload.title, body: payload.body, cta: '', img: '' },
  //   recipients: `eip155:8453:${recipientAddress}`,
  //   channel:    `eip155:8453:${process.env.PUSH_CHANNEL_ADDRESS}`,
  //   env:        'prod',
  // })
  console.log(`[Push] → ${recipientAddress}: ${payload.title}`)
}

// ── Expo Push (mobile notifications) ──────────────────────────────
export async function sendExpoPushNotification(
  expoPushToken: string,
  payload: NotificationPayload
) {
  const message = {
    to:    expoPushToken,
    sound: 'default',
    title: payload.title,
    body:  payload.body,
    data:  payload.data ?? {},
    badge: 1,
  }

  await fetch('https://exp.host/--/api/v2/push/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(message),
  })
}

// ── Notification templates ─────────────────────────────────────────
export function buildNotification(
  type: NotificationType,
  params: Record<string, string>
): Pick<NotificationPayload, 'title' | 'body'> {
  const templates: Record<NotificationType, (p: Record<string, string>) => { title: string; body: string }> = {
    arb_profit:     (p) => ({ title: '⚡ Arb Profit',     body: `Your agent earned ${p.profit} from arbitrage` }),
    yield_compound: (p) => ({ title: '🌾 Yield Compounded', body: `${p.amount} ${p.token} rewards compounded into your position` }),
    rebalance:      (p) => ({ title: '⚖️ Portfolio Rebalanced', body: `Drift of ${p.drift} corrected. Back on target.` }),
    brickt_payout:  (p) => ({ title: '🏗️ Brickt Payout',  body: `${p.amount} yield received from ${p.pool}` }),
    tx_confirmed:   (p) => ({ title: '✅ Transaction Confirmed', body: `${p.type} of ${p.amount} confirmed on ${p.chain}` }),
    tx_failed:      (p) => ({ title: '❌ Transaction Failed', body: `Your ${p.type} failed: ${p.reason}` }),
    agent_error:    (p) => ({ title: '⚠️ Agent Error',     body: `${p.strategy} encountered an error: ${p.message}` }),
    daily_brief:    (p) => ({ title: `🤖 Daily Brief`,     body: `Agent earned ${p.profit} in ${p.actions} actions today` }),
  }
  return templates[type](params)
}
