import axios from 'axios'

const api = axios.create({
  baseURL: ((import.meta as any).env?.VITE_API_URL || 'https://ematrader.onrender.com') + '/api',
  timeout: 10000,
})

// ── Markets ─────────────────────────────────────────────────────────────
export const mktApi = {
  getAll:     () => api.get('/markets').then(r => r.data),
  getCandles: (sym: string, tf = '15m', limit = 200) => api.get(`/prices/${sym}/candles`, { params: { tf, limit } }).then(r => r.data),
  getHeatmap: () => api.get('/prices/heatmap').then(r => r.data),
  getPrice:   (sym: string) => api.get(`/prices/${sym}`).then(r => r.data),
}

// ── EMA Strategy Signals ─────────────────────────────────────────────────
export const signalApi = {
  getAll:    (tf = '15m') => api.get('/signals', { params: { tf } }).then(r => r.data),
  getOne:    (sym: string, tf = '15m') => api.get(`/signals/${sym}`, { params: { tf } }).then(r => r.data),
  getMultiTF:(sym: string) => api.get(`/signals/${sym}/multitf`).then(r => r.data),
}

// ── Portfolio ────────────────────────────────────────────────────────────
export const portApi = {
  getMetrics:   () => api.get('/portfolio/metrics').then(r => r.data),
  getPositions: () => api.get('/portfolio/positions').then(r => r.data),
  getOrders:    () => api.get('/portfolio/orders').then(r => r.data),
  closePos:     (id: string) => api.delete(`/portfolio/positions/${id}`).then(r => r.data),
  closeAll:     () => api.post('/portfolio/close-all').then(r => r.data),
  cancelOrder:  (id: string) => api.delete(`/portfolio/orders/${id}`).then(r => r.data),
  reset:        () => api.post('/portfolio/reset').then(r => r.data),
}

// ── Orders ───────────────────────────────────────────────────────────────
export const orderApi = {
  place: (o: any) => api.post('/orders', o).then(r => r.data),
}

// ── India / Options ──────────────────────────────────────────────────────
export const indiaApi = {
  getQuotes:          () => api.get('/india/quotes').then(r => r.data),
  getOptionChain:     (sym: string, weeks = 0) => api.get(`/india/option-chain/${sym}`, { params: { weeks } }).then(r => r.data),
  getOptionAnalysis:  (sym: string, weeks = 0) => api.get(`/india/option-analysis/${sym}`, { params: { weeks } }).then(r => r.data),
  getAllOptions:       () => api.get('/india/all-options').then(r => r.data),
  placeOptionTrade:   (o: any) => api.post('/india/option-trade', o).then(r => r.data),
}

// ── Analytics / Risk ─────────────────────────────────────────────────────
export const analyticsApi = { get: () => api.get('/analytics').then(r => r.data) }
export const riskApi      = { get: () => api.get('/risk').then(r => r.data) }

export default api

// ── Format helpers ────────────────────────────────────────────────────────
export function fp(p: number | null | undefined, d?: number): string {
  if (p == null || isNaN(p as number)) return '—'
  const dec = d != null ? d : p >= 10000 ? 0 : p >= 100 ? 2 : p >= 1 ? 2 : 4
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(p)
}
export function fpINR(p: number | null | undefined): string {
  if (p == null || isNaN(p as number)) return '—'
  return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p)
}
export function fm(n: number | null | undefined, sign = true): string {
  if (n == null || isNaN(n as number)) return '—'
  const s = sign ? (n < 0 ? '-' : n > 0 ? '+' : '') : '', a = Math.abs(n)
  if (a >= 1e9) return `${s}$${fp(a/1e9,2)}B`
  if (a >= 1e6) return `${s}$${fp(a/1e6,2)}M`
  if (a >= 1e3) return `${s}$${fp(a/1e3,2)}K`
  return `${s}$${fp(a,2)}`
}
export function fpct(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return '—'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}
export function pnlColor(n: number): string {
  return n > 0 ? 'var(--bull)' : n < 0 ? 'var(--bear)' : 'var(--muted)'
}

export const TIMEFRAMES = ['1m','5m','15m','1h','3h','1d']

export const MKTCOLORS: Record<string,string> = {
  US_STOCK:'#00aaff', UK_STOCK:'#cc44ff', CRYPTO:'#ffcc00',
  COMMODITY:'#00ff88', FUTURES:'#ff2244', IN_STOCK:'#ff8800',
  IN_INDEX:'#00ff88', IN_OPTION:'#ff44cc'
}

export const MKTMETA: Record<string,{ label:string; badge:string; color:string; maxLev:number; emoji:string }> = {
  US_STOCK:  { label:'US Stock',    badge:'NYSE/NASDAQ', color:'#00aaff', maxLev:4,  emoji:'🇺🇸' },
  UK_STOCK:  { label:'UK Stock',    badge:'LSE',         color:'#cc44ff', maxLev:4,  emoji:'🇬🇧' },
  CRYPTO:    { label:'Crypto',      badge:'24/7',         color:'#ffcc00', maxLev:10, emoji:'₿'   },
  COMMODITY: { label:'Commodity',   badge:'CME',          color:'#00ff88', maxLev:20, emoji:'🪙'  },
  FUTURES:   { label:'Futures',     badge:'E-Mini',       color:'#ff2244', maxLev:50, emoji:'📈'  },
  IN_STOCK:  { label:'India Stock', badge:'NSE/BSE',      color:'#ff8800', maxLev:5,  emoji:'🇮🇳' },
  IN_INDEX:  { label:'India Index', badge:'NSE F&O',      color:'#00ff88', maxLev:30, emoji:'📊'  },
  IN_OPTION: { label:'India Option',badge:'NSE OPT',      color:'#ff44cc', maxLev:1,  emoji:'⚡'  },
}

export const INDEX_SYMBOLS = ['NIFTY50.NS','BANKNIFTY.NS','FINNIFTY.NS','MIDCPNIFTY.NS']
