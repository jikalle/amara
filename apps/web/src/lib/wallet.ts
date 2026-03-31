export interface ResolvedWalletIdentity {
  address: string | null
  hasWallet: boolean
}

export function resolveWalletIdentity(user: any): ResolvedWalletIdentity {
  const directWalletAddress =
    typeof user?.wallet?.address === 'string'
      ? user.wallet.address
      : typeof user?.smartWallet?.address === 'string'
        ? user.smartWallet.address
        : null

  const linkedAccounts = user?.linkedAccounts ?? user?.linked_accounts ?? []
  const walletAccount = linkedAccounts.find((account: any) =>
    account?.type === 'wallet' ||
    account?.type === 'smart_wallet' ||
    account?.type === 'embedded_wallet'
  )

  const address = directWalletAddress ?? (typeof walletAccount?.address === 'string' ? walletAccount.address : null)

  return {
    address,
    hasWallet: Boolean(address),
  }
}
