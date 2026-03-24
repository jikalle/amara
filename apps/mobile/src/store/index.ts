import { create } from 'zustand'
import type { AgentMessage, AgentState, TokenBalance } from '@anara/types'

// ── Wallet Store ──
interface WalletStore {
  address:      string | null
  chainId:      number
  totalUsd:     string
  tokens:       TokenBalance[]
  setAddress:   (a: string | null) => void
  setChainId:   (id: number) => void
  setPortfolio: (d: { totalUsd: string; tokens: TokenBalance[] }) => void
}

export const useWalletStore = create<WalletStore>()((set) => ({
  address:      null,
  chainId:      8453,
  totalUsd:     '$0.00',
  tokens:       [],
  setAddress:   (address)  => set({ address }),
  setChainId:   (chainId)  => set({ chainId }),
  setPortfolio: (data)     => set(data),
}))

// ── Agent Store ──
interface AgentStore {
  sessionId:   string
  messages:    AgentMessage[]
  state:       AgentState
  isThinking:  boolean
  addMessage:  (msg: AgentMessage) => void
  setThinking: (v: boolean) => void
  updateState: (s: Partial<AgentState>) => void
  clearChat:   () => void
}

const DEFAULT_STATE: AgentState = {
  isRunning: true, lastActivity: Date.now(),
  actionsToday: 0, errorsToday: 0, profitToday: '$0.00', recentActions: [],
}

export const useAgentStore = create<AgentStore>()((set) => ({
  sessionId:   `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  messages:    [],
  state:       DEFAULT_STATE,
  isThinking:  false,
  addMessage:  (msg)   => set((s) => ({ messages: [...s.messages, msg] })),
  setThinking: (v)     => set({ isThinking: v }),
  updateState: (state) => set((s) => ({ state: { ...s.state, ...state } })),
  clearChat:   ()      => set({ messages: [] }),
}))
