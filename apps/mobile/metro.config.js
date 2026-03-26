const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

const resolveRequestWithPackageExports = (context, moduleName, platform) => {
  // Package exports in `isows` (a viem dependency) are incompatible
  if (moduleName === 'isows') {
    const ctx = { ...context, unstable_enablePackageExports: false }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }
  // Package exports in `zustand@4` are incompatible
  if (moduleName.startsWith('zustand')) {
    const ctx = { ...context, unstable_enablePackageExports: false }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }
  // Package exports in `jose` are incompatible, so force the browser build
  if (moduleName === 'jose') {
    const ctx = { ...context, unstable_conditionNames: ['browser'] }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }
  // Needed only for RN 0.78 or older, but safe to keep
  if (moduleName.startsWith('@privy-io/')) {
    const ctx = { ...context, unstable_enablePackageExports: true }
    return ctx.resolveRequest(ctx, moduleName, platform)
  }

  return context.resolveRequest(context, moduleName, platform)
}

config.resolver.resolveRequest = resolveRequestWithPackageExports

module.exports = config
