import type { AgentActionCard } from '@anara/types'

const BRIDGE_PROTOCOLS: Record<string, { name: string; time: string; fee: number }> = {
  'base-ethereum':  { name: 'Across Protocol', time: '~2 min',  fee: 0.06 },
  'base-arbitrum':  { name: 'Across Protocol', time: '~1 min',  fee: 0.04 },
  'ethereum-base':  { name: 'Across Protocol', time: '~2 min',  fee: 0.06 },
  'arbitrum-base':  { name: 'Across Protocol', time: '~1 min',  fee: 0.04 },
  'base-solana':    { name: 'Wormhole',        time: '~15 min', fee: 0.10 },
}

export async function getBridgePreview(params: {
  token: string; amount: string; fromChain: string; toChain: string
}) {
  const key    = `${params.fromChain.toLowerCase()}-${params.toChain.toLowerCase()}`
  const proto  = BRIDGE_PROTOCOLS[key] ?? { name: 'Across Protocol', time: '~2 min', fee: 0.06 }
  const fee    = parseFloat(params.amount) * proto.fee / 100
  const receive = parseFloat(params.amount) - fee

  const actionCard: AgentActionCard = {
    type: 'bridge', title: 'Bridge Preview',
    rows: [
      { label: 'From',      value: `${params.amount} ${params.token} on ${params.fromChain}` },
      { label: 'To',        value: `${receive.toFixed(4)} ${params.token} on ${params.toChain}`, highlight: true },
      { label: 'Protocol',  value: proto.name },
      { label: 'Fee',       value: `${fee.toFixed(4)} ${params.token} (${proto.fee}%)` },
      { label: 'Est. time', value: proto.time },
    ],
    status: 'pending',
  }
  return { success: true, actionCard }
}
