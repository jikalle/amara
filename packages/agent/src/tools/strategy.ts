export async function getStrategyStatus(strategyId: string) {
  const strategies: Record<string, object> = {
    arb:       { status: 'active',   pnl: '+$847.32', executions: 23 },
    yield:     { status: 'active',   pnl: '+$312.10', apy: '18.4%' },
    rebalance: { status: 'watching', drift: '1.2%',   threshold: '5%' },
    brickt:    { status: 'active',   pnl: '+$64.00',  pools: 4 },
  }
  return strategies[strategyId] ?? null
}

export async function toggleStrategy(strategyId: string, action: 'pause' | 'resume') {
  // TODO: Update DB + Chainlink Automation
  return { success: true, strategyId, newStatus: action === 'pause' ? 'paused' : 'active' }
}
