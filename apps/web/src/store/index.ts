import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AgentMessage, AgentState, TokenBalance, Transaction } from '@anara/types'

// ── Wallet Store ──
interface WalletStore {
  address:      string | null
  chainId:      number
  totalUsd:     string
  tokens:       TokenBalance[]
  isLoading:    boolean
  setAddress:   (address: string | null) => void
  setChainId:   (chainId: number) => void
  setPortfolio: (data: { totalUsd: string; tokens: TokenBalance[] }) => void
  setLoading:   (loading: boolean) => void
}

export const useWalletStore = create<WalletStore>()(
  persist(
    (set) => ({
      address:      null,
      chainId:      8453,
      totalUsd:     '$0.00',
      tokens:       [],
      isLoading:    false,
      setAddress:   (address) => set({ address }),
      setChainId:   (chainId) => set({ chainId }),
      setPortfolio: (data)    => set(data),
      setLoading:   (loading) => set({ isLoading: loading }),
    }),
    { name: 'anara-wallet', storage: createJSONStorage(() => localStorage) }
  )
)

// ── Agent Store ──
interface AgentStore {
  sessionId:    string
  messages:     AgentMessage[]
  state:        AgentState
  isThinking:   boolean
  chatOpen:     boolean
  addMessage:   (msg: AgentMessage) => void
  setThinking:  (thinking: boolean) => void
  setChatOpen:  (open: boolean) => void
  updateState:  (state: Partial<AgentState>) => void
  clearChat:    () => void
}

const DEFAULT_AGENT_STATE: AgentState = {
  isRunning:    true,
  lastActivity: Date.now(),
  actionsToday: 0,
  errorsToday:  0,
  profitToday:  '$0.00',
  recentActions:[],
}

export const useAgentStore = create<AgentStore>()((set) => ({
  sessionId:   `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  messages:    [],
  state:       DEFAULT_AGENT_STATE,
  isThinking:  false,
  chatOpen:    false,
  addMessage:  (msg)   => set((s) => ({ messages: [...s.messages, msg] })),
  setThinking: (v)     => set({ isThinking: v }),
  setChatOpen: (v)     => set({ chatOpen: v }),
  updateState: (state) => set((s) => ({ state: { ...s.state, ...state } })),
  clearChat:   ()      => set({ messages: [] }),
}))

// ── UI Store ──
interface UIStore {
  activeSheet: 'send' | 'receive' | 'swap' | 'bridge' | null
  activeTab:   'home' | 'agent' | 'settings'
  openSheet:   (sheet: UIStore['activeSheet']) => void
  closeSheet:  () => void
  setTab:      (tab: UIStore['activeTab']) => void
}

export const useUIStore = create<UIStore>()((set) => ({
  activeSheet: null,
  activeTab:   'home',
  openSheet:   (sheet) => set({ activeSheet: sheet }),
  closeSheet:  ()      => set({ activeSheet: null }),
  setTab:      (tab)   => set({ activeTab: tab }),
}))
