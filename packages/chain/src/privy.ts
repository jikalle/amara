// Privy configuration for embedded wallets
// https://docs.privy.io/

export const PRIVY_CONFIG = {
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '',
  config: {
    loginMethods: ['email', 'sms', 'wallet', 'google', 'twitter'],
    appearance: {
      theme: 'dark' as const,
      accentColor: '#D4920A', // Anara gold
      logo: '/anara-logo.svg',
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets' as const,
      noPromptOnSignature: false,
    },
    defaultChain: {
      id: 8453, // Base
      name: 'Base',
    },
    supportedChains: [
      { id: 8453 },   // Base
      { id: 1 },      // Ethereum
      { id: 42161 },  // Arbitrum
      { id: 10 },     // Optimism
    ],
  },
}
