export interface ResolvedWalletIdentity {
  address: string | null
  hasWallet: boolean
}

export function resolveWalletIdentity(user: any): ResolvedWalletIdentity {
  const directWalletAddress = firstAddress([
    user?.wallet?.address,
    user?.smartWallet?.address,
    user?.wallets?.[0]?.address,
  ])

  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts ?? []
  const walletAccount = linkedAccounts.find((account: any) => {
    const type = String(account?.type ?? '').toLowerCase()
    return (
      type === 'wallet' ||
      type === 'smart_wallet' ||
      type === 'embedded_wallet' ||
      type.includes('wallet')
    )
  })

  const address = firstAddress([
    directWalletAddress,
    walletAccount?.address,
    walletAccount?.walletClient?.address,
    walletAccount?.wallet_client?.address,
    walletAccount?.account?.address,
  ])

  return {
    address,
    hasWallet: Boolean(address),
  }
}

function firstAddress(candidates: Array<unknown>) {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && /^0x[a-fA-F0-9]{40}$/.test(candidate)) {
      return candidate
    }
  }
  return null
}
