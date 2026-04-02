type FeatureFlags = {
  allowSwaps: boolean
  allowBridges: boolean
  allowSends: boolean
}

type ActionType = string | null | undefined

export function getFeatureFlags(): FeatureFlags {
  return {
    allowSwaps: readBooleanFlag(process.env.FEATURE_SWAP_ENABLED, true),
    allowBridges: readBooleanFlag(process.env.FEATURE_BRIDGE_ENABLED, true),
    allowSends: readBooleanFlag(process.env.FEATURE_SEND_ENABLED, true),
  }
}

export function evaluateFeatureAccess(actionType: ActionType) {
  const flags = getFeatureFlags()

  if (actionType === 'swap' && !flags.allowSwaps) {
    return {
      allowed: false,
      message: 'Swaps are temporarily disabled for this beta environment.',
      flags,
    }
  }

  if (actionType === 'bridge' && !flags.allowBridges) {
    return {
      allowed: false,
      message: 'Bridges are temporarily disabled for this beta environment.',
      flags,
    }
  }

  if (actionType === 'send' && !flags.allowSends) {
    return {
      allowed: false,
      message: 'Sends are temporarily disabled for this beta environment.',
      flags,
    }
  }

  return {
    allowed: true,
    message: null,
    flags,
  }
}

function readBooleanFlag(value: string | undefined, fallback: boolean) {
  if (value == null || value === '') return fallback
  return value.toLowerCase() === 'true'
}
