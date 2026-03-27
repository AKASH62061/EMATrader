import express from 'express'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import cron from 'node-cron'
import { body, validationResult } from 'express-validator'

import { PriceSimulator } from './services/PriceSimulator'
import { RealMarketData } from './services/RealMarketData'
import { fetchIndianStocks, getOptionChain, analyzeOptionChain } from './services/IndianMarketData'
import { PortfolioManager } from './services/PortfolioManager'
import { INSTRUMENTS, MARKET_CONFIG, FUTURES_MULTIPLIERS } from './models/instruments'
import { computeEMASignal, computeMultiTFEMA, EMASignal, MultiTFAnalysis } from './strategy/EMAStrategy'

dotenv.config()

const app = express()
const srv = createServer(app)
const wss = new WebSocketServer({ server: srv, path: '/ws' })

export const sim     = new PriceSimulator()
export const pm      = new PortfolioManager(sim)
export const realMkt = new RealMarketData()

const indianQuotes = new Map<string, any>()
async function refreshIndianData() {
  try {
    const quotes = await fetchIndianStocks()
    quotes.forEach((q, sym) => { indianQuotes.set(sym, q); sim.applyLiveQuote(sym, q) })
  } catch (e) { console.warn('[IndianMkt]', (e as Error).message) }
}
refreshIndianData()
setInterval(refreshIndianData, 15_000)

realMkt.onUpdate((quotes) => { for (const [sym, q] of quotes) sim.applyLiveQuote(sym, q) })
realMkt.start().catch(e => console.warn('[RealMkt]', e.message))

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : ['http://localhost:5173','http://localhost:5174','http://localhost:5175'], credentials: true }))
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use('/api/', rateLimit({ windowMs: 60_000, max: 800, standardHeaders: true, legacyHeaders: false }))

// ── EMA Signal Cache ─────────────────────────────────────────────────────
const emaCache    = new Map<string, { signal: EMASignal; at: number }>()
const multiTFCache = new Map<string, { analysis: MultiTFAnalysis; at: number }>()

function getEMASignal(sym: string, tf = '15m'): EMASignal | null {
  const pd = sim.getPrice(sym); if (!pd) return null
  const candles = pd.candles[tf] ?? pd.candles['15m'] ?? pd.candles['1m']
  if (!candles || candles.length < 30) return null
  const key = `${sym}:${tf}`
  const cached = emaCache.get(key)
  if (cached && Date.now() - cached.at < 15000) return cached.signal
  try {
    const s = computeEMASignal(sym, candles, tf)
    if (s) { emaCache.set(key, { signal: s, at: Date.now() }); return s }
  } catch (e) { console.warn('[EMA]', sym, (e as Error).message) }
  return null
}

function getMultiTFAnalysis(sym: string): MultiTFAnalysis | null {
  const pd = sim.getPrice(sym); if (!pd) return null
  const cached = multiTFCache.get(sym)
  if (cached && Date.now() - cached.at < 20000) return cached.analysis
  try {
    const a = computeMultiTFEMA(sym, pd.candles)
    multiTFCache.set(sym, { analysis: a, at: Date.now() })
    return a
  } catch { return null }
}

function getAllEMASignals(tf = '15m'): Record<string, EMASignal> {
  const result: Record<string, EMASignal> = {}
  for (const [, list] of Object.entries(INSTRUMENTS))
    list.forEach(inst => { const s = getEMASignal(inst.sym, tf); if (s) result[inst.sym] = s })
  return result
}

// ── Health ───────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  status: 'ok', uptime: process.uptime(),
  symbols: Object.values(INSTRUMENTS).flat().length,
  indianSymbols: indianQuotes.size,
  strategy: 'EMA 9/15 Crossover + 30° Angle Filter + Confirmation Candle'
}))

// ── Prices ───────────────────────────────────────────────────────────────
app.get('/api/prices',              (_, res) => res.json(sim.getSnapshot()))
app.get('/api/prices/heatmap',      (_, res) => res.json(sim.getHeatmapData()))
app.get('/api/prices/live-status',  (_, res) => {
  const q = realMkt.getAllQuotes()
  res.json({ liveSymbols: q.size + indianQuotes.size, symbols: Array.from(q.keys()), indianSymbols: Array.from(indianQuotes.keys()), lastUpdate: Date.now() })
})
app.get('/api/prices/:sym',         (req, res) => { const d = sim.getPrice(req.params.sym); d ? res.json(d) : res.status(404).json({ error: 'Not found' }) })
app.get('/api/prices/:sym/candles', (req, res) => {
  const { tf = '15m', limit = '200' } = req.query as any
  res.json(sim.getCandles(req.params.sym, tf, parseInt(limit)))
})

// ── EMA Strategy Signals ─────────────────────────────────────────────────
app.get('/api/signals', (req, res) => {
  const tf = (req.query.tf as string) || '15m'
  res.json(getAllEMASignals(tf))
})

app.get('/api/signals/:sym', (req, res) => {
  const tf = (req.query.tf as string) || '15m'
  const s = getEMASignal(req.params.sym, tf)
  s ? res.json(s) : res.status(404).json({ error: 'No signal' })
})

app.get('/api/signals/:sym/multitf', (req, res) => {
  const a = getMultiTFAnalysis(req.params.sym)
  a ? res.json(a) : res.status(404).json({ error: 'No multi-TF data' })
})

// ── Markets ──────────────────────────────────────────────────────────────
app.get('/api/markets', (_, res) => {
  const all: any[] = []
  for (const [mkt, list] of Object.entries(INSTRUMENTS)) {
    list.forEach(i => {
      const pd = sim.getPrice(i.sym), iq = indianQuotes.get(i.sym)
      const price     = pd?.price     ?? iq?.price     ?? i.price
      const changePct = pd?.changePct ?? iq?.changePct ?? i.dailyChg
      const sig = getEMASignal(i.sym)
      all.push({ ...i, marketType:mkt, config:MARKET_CONFIG[mkt], multiplier:FUTURES_MULTIPLIERS[i.sym]??1, currentPrice:price, changePct, volume:pd?.volume??iq?.volume??0, emaSignal: sig ? { direction: sig.direction, condition: sig.condition, angle: sig.angle, strength: sig.strength } : null })
    })
  }
  res.json(all)
})
app.get('/api/markets/config', (_, res) => res.json({ markets: MARKET_CONFIG, multipliers: FUTURES_MULTIPLIERS }))
app.get('/api/markets/:type',  (req, res) => { const l = INSTRUMENTS[req.params.type]; l ? res.json(l) : res.status(404).json({ error: 'Unknown market' }) })

// ── Indian Markets ───────────────────────────────────────────────────────
app.get('/api/india/quotes', (_, res) => { const q: any[] = []; indianQuotes.forEach(v => q.push(v)); res.json(q) })
app.get('/api/india/quotes/:sym', (req, res) => {
  const q = indianQuotes.get(req.params.sym) ?? (() => { const pd = sim.getPrice(req.params.sym); return pd ? { symbol:req.params.sym, price:pd.price, changePct:pd.changePct } : null })()
  q ? res.json(q) : res.status(404).json({ error: 'Not found' })
})

const INDEX_SYMS = ['NIFTY50.NS','BANKNIFTY.NS','FINNIFTY.NS','MIDCPNIFTY.NS']
app.get('/api/india/option-chain/:sym', (req, res) => {
  const sym = req.params.sym
  if (!INDEX_SYMS.includes(sym)) return res.status(400).json({ error: 'Option chain only available for Nifty indices' })
  const weeks     = parseInt(req.query.weeks as string || '0', 10)
  const spotPrice = indianQuotes.get(sym)?.price ?? sim.getPrice(sym)?.price ?? 22500
  try { res.json(getOptionChain(sym, spotPrice, weeks)) } catch(e) { res.status(500).json({ error: (e as Error).message }) }
})

app.get('/api/india/option-analysis/:sym', (req, res) => {
  const sym = req.params.sym
  if (!INDEX_SYMS.includes(sym)) return res.status(400).json({ error: 'Indices only' })
  const weeks     = parseInt(req.query.weeks as string || '0', 10)
  const spotPrice = indianQuotes.get(sym)?.price ?? sim.getPrice(sym)?.price ?? 22500
  try { const oc = getOptionChain(sym, spotPrice, weeks); res.json({ ...analyzeOptionChain(oc), spotPrice, optionChain: oc }) } catch(e) { res.status(500).json({ error: (e as Error).message }) }
})

app.get('/api/india/all-options', (_, res) => {
  const result: any = {}
  for (const sym of ['NIFTY50.NS','BANKNIFTY.NS','FINNIFTY.NS']) {
    const spot = indianQuotes.get(sym)?.price ?? sim.getPrice(sym)?.price ?? 22500
    try { const oc = getOptionChain(sym, spot); result[sym] = { ...analyzeOptionChain(oc), spotPrice:spot, impliedMove:oc.impliedMove, maxPain:oc.maxPainStrike, pcr:oc.pcr, support:oc.supportLevel, resistance:oc.resistanceLevel } } catch {}
  }
  res.json(result)
})

// ── Option Trade endpoint (place order directly from option chain) ────────
app.post('/api/india/option-trade', [
  body('symbol').isString().notEmpty(),
  body('optionType').isIn(['CE','PE']),
  body('strike').isFloat({ min: 1 }),
  body('expiry').isString().notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('premium').isFloat({ min: 0.01 }),
  body('indexSymbol').isString().notEmpty(),
],
(req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

  const { symbol, optionType, strike, expiry, quantity, premium, indexSymbol, autoSL, capitalPct } = req.body

  // Build synthetic instrument for paper trading
  const optSym   = `${symbol}_${strike}${optionType}_${expiry}`
  const spotPrice = indianQuotes.get(indexSymbol)?.price ?? sim.getPrice(indexSymbol)?.price ?? strike
  const lotSize   = FUTURES_MULTIPLIERS[indexSymbol] ?? 50

  // Auto SL: 30% of premium / Auto TP: 2x premium
  const stopLoss   = autoSL !== false ? premium * 0.70  : undefined  // SL at -30% of premium
  const takeProfit = premium * 2                                       // TP at 2x premium (1:2 RR)

  const result = pm.placeOrder({
    symbol:     optSym,
    symbolName: `${symbol} ${strike} ${optionType} ${expiry}`,
    side:       'BUY',
    type:       'MARKET',
    quantity:   quantity * lotSize,
    marketType: 'IN_OPTION',
    leverage:   1,
    multiplier: 1,
    stopLoss,
    takeProfit,
  })

  if (result.error) return res.status(400).json({ error: result.error })
  res.json({ ...result.order, optionDetails: { strike, optionType, expiry, premium, lotSize, spotPrice, stopLoss, takeProfit } })
})

// ── Portfolio ────────────────────────────────────────────────────────────
app.get('/api/portfolio/metrics',    (_, res) => res.json(pm.getMetrics()))
app.get('/api/portfolio/positions',  (_, res) => res.json({ open: pm.getOpenPositions(), closed: pm.getClosedPositions() }))
app.get('/api/portfolio/orders',     (_, res) => res.json({ pending: pm.getPendingOrders(), history: pm.getTradeHistory() }))
app.post('/api/portfolio/close-all', (_, res) => { pm.closeAll(); res.json({ success: true }) })
app.post('/api/portfolio/reset',     (_, res) => { pm.reset(); res.json({ success: true }) })
app.delete('/api/portfolio/positions/:id', (req, res) => res.json(pm.closePosition(req.params.id)))
app.delete('/api/portfolio/orders/:id',    (req, res) => res.json({ success: pm.cancelOrder(req.params.id) }))

// ── Orders ───────────────────────────────────────────────────────────────
app.post('/api/orders', [
  body('symbol').isString().notEmpty(),
  body('side').isIn(['BUY','SELL']),
  body('type').isIn(['MARKET','LIMIT','STOP']),
  body('quantity').isFloat({ min: 0.000001 })
], (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
  const result = pm.placeOrder({ ...req.body, symbolName: req.body.symbolName || req.body.symbol })
  result.error ? res.status(400).json({ error: result.error }) : res.json(result.order)
})

// ── Risk ─────────────────────────────────────────────────────────────────
app.get('/api/risk', (_, res) => {
  const openPos = pm.getOpenPositions(), metrics = pm.getMetrics(), equity = metrics.totalEquity
  const marginUsed = openPos.reduce((s,p) => s+p.avgEntryPrice*p.quantity*p.multiplier/p.leverage, 0)
  res.json({
    equity, marginUsed, marginAvailable: equity - marginUsed,
    openPositions: openPos.length,
    maxDrawdown: metrics.maxDrawdown,
    currentDrawdown: metrics.currentDrawdown,
    winRate: metrics.winRate,
    profitFactor: metrics.profitFactor,
  })
})

// ── Analytics ────────────────────────────────────────────────────────────
app.get('/api/analytics', (_, res) => {
  const m = pm.getMetrics(), closed = pm.getClosedPositions()
  const bySymbol: Record<string,any> = {}, byMarket: Record<string,any> = {}
  closed.forEach(p => {
    if (!bySymbol[p.symbol]) bySymbol[p.symbol] = { wins:0,losses:0,totalPnl:0,trades:0 }
    bySymbol[p.symbol].trades++; bySymbol[p.symbol].totalPnl += p.realisedPnl
    p.realisedPnl > 0 ? bySymbol[p.symbol].wins++ : bySymbol[p.symbol].losses++
    if (!byMarket[p.marketType]) byMarket[p.marketType] = { wins:0,losses:0,totalPnl:0,trades:0 }
    byMarket[p.marketType].trades++; byMarket[p.marketType].totalPnl += p.realisedPnl
    p.realisedPnl > 0 ? byMarket[p.marketType].wins++ : byMarket[p.marketType].losses++
  })
  res.json({ metrics:m, bySymbol, byMarket, recentTrades: closed.slice(0,30) })
})

// ── WebSocket ────────────────────────────────────────────────────────────
const clients = new Set<WebSocket>()
wss.on('connection', ws => {
  clients.add(ws)
  ws.send(JSON.stringify({ type:'INIT', data:sim.getSnapshot(), metrics:pm.getMetrics() }))
  ws.on('message', raw => {
    try {
      const m = JSON.parse(raw.toString())
      if (m.type === 'PING') ws.send(JSON.stringify({ type:'PONG', ts:Date.now() }))
      if (m.type === 'GET_SIGNAL' && m.symbol) {
        const sig = getEMASignal(m.symbol, m.tf || '15m')
        ws.send(JSON.stringify({ type:'EMA_SIGNAL', symbol:m.symbol, data:sig }))
      }
    } catch {}
  })
  ws.on('close',  () => clients.delete(ws))
  ws.on('error',  () => { try { ws.close() } catch {} clients.delete(ws) })
})

function broadcast(p: string) {
  clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) ws.send(p) })
}

// Broadcast signals every 15s so frontend gets live EMA updates
cron.schedule('* * * * * *',    () => { const t = sim.tick(); pm.processTickFills(t); broadcast(JSON.stringify({ type:'PRICE_UPDATE', data:t, ts:Date.now() })) })
cron.schedule('*/3 * * * * *',  () => broadcast(JSON.stringify({ type:'PORTFOLIO_UPDATE', data:pm.getMetrics(), ts:Date.now() })))
cron.schedule('*/15 * * * * *', () => {
  const signals = getAllEMASignals('15m')
  broadcast(JSON.stringify({ type:'EMA_SIGNALS_UPDATE', data:signals, ts:Date.now() }))
})

const PORT = parseInt(process.env.PORT||'4000', 10)
srv.listen(PORT, () => {
  console.log(`\n🚀 EMA Trader — Strategy Engine  →  http://localhost:${PORT}`)
  console.log(`📊 Strategy: EMA 9/15 Crossover + 30° Angle + Confirmation Candle`)
  console.log(`🇮🇳 Indian Markets: NSE/BSE + Nifty/BankNifty Option Chain Trading\n`)
})
export default app
