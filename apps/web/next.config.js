/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@anara/ui', '@anara/chain', '@anara/types'],
  images: {
    domains: ['assets.coingecko.com', 'ipfs.io', 'arweave.net'],
  },
  env: {
    NEXT_PUBLIC_API_URL:        process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_PRIVY_APP_ID:   process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_ALCHEMY_API_KEY:process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    NEXT_PUBLIC_WALLETCONNECT_ID:process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
  },
}

module.exports = nextConfig
