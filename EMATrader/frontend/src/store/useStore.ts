import { create } from 'zustand'

export interface Notification { id: string; msg: string; type: 'ok'|'warn'|'info'|'signal'; at: number }
export interface PortfolioMetrics { [key: string]: any }
export interface Position { [key: string]: any }
export interface EMASignal { [key: string]: any }

interface Store {
  selectedSymbol: string
  setSelectedSymbol: (s: string) => void
  selectedTF: string
  setSelectedTF: (tf: string) => void
  prices: Record<string, any>
  setPrices: (p: Record<string, any>) => void
  updatePrices: (p: Record<string, any>) => void
  metrics: PortfolioMetrics | null
  setMetrics: (m: PortfolioMetrics) => void
  openPositions: Position[]
  setPortfolio: (p: any) => void
  emaSignals: Record<string, EMASignal>
  setEMASignals: (s: Record<string, EMASignal>) => void
  wsConnected: boolean
  setWsConnected: (v: boolean) => void
  notifications: Notification[]
  notify: (msg: string, type?: 'ok'|'warn'|'info'|'signal') => void
  dismissNotification: (id: string) => void
}

export const useStore = create<Store>((set, get) => ({
  selectedSymbol: 'ETH-USD',
  setSelectedSymbol: (s) => set({ selectedSymbol: s }),
  selectedTF: '15m',
  setSelectedTF: (tf) => set({ selectedTF: tf }),
  prices: {},
  setPrices: (p) => set({ prices: p }),
  updatePrices: (p) => set(s => ({ prices: { ...s.prices, ...p } })),
  metrics: null,
  setMetrics: (m) => set({ metrics: m }),
  openPositions: [],
  setPortfolio: (p) => set({ openPositions: p?.openPositions ?? [] }),
  emaSignals: {},
  setEMASignals: (s) => set({ emaSignals: s }),
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),
  notifications: [],
  notify: (msg, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set(s => ({ notifications: [{ id, msg, type, at: Date.now() }, ...s.notifications].slice(0, 8) }))
    setTimeout(() => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })), type === 'signal' ? 8000 : 4000)
  },
  dismissNotification: (id) => set(s => ({ notifications: s.notifications.filter(n => n.id !== id) })),
}))
