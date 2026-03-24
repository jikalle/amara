// ─────────────────────────────────────────────────────────────────
// Anara Extension — Background Service Worker
// Runs persistently, handles agent scheduling + notifications
// ─────────────────────────────────────────────────────────────────

const API_URL = 'https://api.anara.io' // production
// const API_URL = 'http://localhost:4000'  // development

// ── Installation ─────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Anara] Extension installed')

  // Schedule agent status check every 10 minutes
  chrome.alarms.create('agentStatusCheck', { periodInMinutes: 10 })

  // Set default storage
  chrome.storage.local.set({
    agentRunning:  true,
    notifications: true,
    lastBrief:     null,
  })
})

// ── Alarm handler ────────────────────────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'agentStatusCheck') {
    await checkAgentStatus()
  }
})

async function checkAgentStatus() {
  try {
    const { walletAddress } = await chrome.storage.local.get('walletAddress')
    if (!walletAddress) return

    const res  = await fetch(`${API_URL}/api/agent/status`)
    const data = await res.json()

    // Notify on significant profit
    if (data.profitToday && parseFloat(data.profitToday.replace('$','').replace('+','')) > 10) {
      await showNotification(
        'Agent Update 🤖',
        `Your agent has earned ${data.profitToday} today across ${data.actionsToday} actions.`
      )
    }

    await chrome.storage.local.set({ lastAgentCheck: Date.now(), agentStatus: data })
  } catch (err) {
    console.error('[Anara] Status check failed:', err)
  }
}

async function showNotification(title: string, message: string) {
  const { notifications } = await chrome.storage.local.get('notifications')
  if (!notifications) return

  chrome.notifications.create({
    type:    'basic',
    iconUrl: 'icons/icon48.png',
    title,
    message,
  })
}

// ── Message handler (from popup) ──────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_AGENT_STATUS') {
    chrome.storage.local.get('agentStatus').then(({ agentStatus }) => {
      sendResponse({ status: agentStatus })
    })
    return true // async
  }

  if (message.type === 'OPEN_FULL_WALLET') {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') })
    sendResponse({ ok: true })
  }
})

// ── WalletConnect relay ───────────────────────────────────────────
// Intercepts dApp connection requests and routes to Anara's signer
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Inject provider only on known DeFi sites
    const dapps = ['app.uniswap.org', 'aerodrome.finance', 'brickt.xyz', 'opensea.io']
    const isDapp = dapps.some(d => tab.url?.includes(d))
    if (isDapp) {
      console.log('[Anara] DApp detected, provider available:', tab.url)
    }
  }
})
