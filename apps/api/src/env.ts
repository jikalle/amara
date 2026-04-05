import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: '../../.env', override: true })

export function hasUsableValue(value?: string | null) {
  if (!value) return false
  const normalized = value.trim()
  if (!normalized) return false
  return ![
    'xxxxxx',
    'xxx',
    'password',
    'changeme',
    'placeholder',
  ].some((token) => normalized.toLowerCase().includes(token))
}

export function getAllowedOrigins() {
  const raw = process.env.CORS_ALLOWED_ORIGINS
  if (!raw) {
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'exp://localhost:8081',
    ]
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function getRuntimeSummary() {
  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    allowedOrigins: getAllowedOrigins(),
    featureFlags: {
      send: process.env.FEATURE_SEND_ENABLED !== 'false',
      swap: process.env.FEATURE_SWAP_ENABLED !== 'false',
      bridge: process.env.FEATURE_BRIDGE_ENABLED !== 'false',
    },
    providers: {
      anthropic: hasUsableValue(process.env.ANTHROPIC_API_KEY),
      alchemy: hasUsableValue(process.env.ALCHEMY_API_KEY),
      lifi: hasUsableValue(process.env.LIFI_API_KEY),
      transak: hasUsableValue(process.env.TRANSAK_API_KEY) && hasUsableValue(process.env.TRANSAK_API_SECRET),
      cngn: hasUsableValue(process.env.CNGN_API_KEY) && hasUsableValue(process.env.CNGN_ENCRYPTION_KEY),
    },
  }
}
