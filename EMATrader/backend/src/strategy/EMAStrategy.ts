// ─── EMA Strategy Engine ──────────────────────────────────────────────────
// Strategy: EMA 9 & EMA 15 crossover with 30° angle filter
// Bull:  EMA15 < EMA9, EMA15 angle ≥ 30° upward   → LONG
// Bear:  EMA15 > EMA9, EMA15 angle ≥ 30° downward → SHORT
// Sideways: EMA15 angle < 30° → NO TRADE
// Confirmation: engulfing / pin bar / momentum candle before entry
// ─────────────────────────────────────────────────────────────────────────

export interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number
}

export type MarketCondition = 'BULL' | 'BEAR' | 'SIDEWAYS'
export type SignalDirection  = 'BUY' | 'SELL' | 'NEUTRAL'
export type ConfirmationType = 'BULLISH_ENGULFING' | 'BEARISH_ENGULFING' | 'HAMMER' | 'SHOOTING_STAR' | 'STRONG_BULL_CANDLE' | 'STRONG_BEAR_CANDLE' | 'NONE'

export interface EMAValues {
  ema9:  number
  ema15: number
  angle: number          // degrees of EMA15 vs horizontal
  slope: number          // raw slope per candle
}

export interface EMASignal {
  symbol:      string
  timeframe:   string
  direction:   SignalDirection
  condition:   MarketCondition
  ema9:        number
  ema15:       number
  ema9Prev:    number
  ema15Prev:   number
  angle:       number            // EMA15 angle in degrees
  angleOk:     boolean           // angle >= 30°
  confirmation: ConfirmationType
  confirmationOk: boolean
  entryPrice:  number
  stopLoss:    number
  takeProfit:  number
  riskReward:  number
  riskAmount:  number            // $ distance entry → SL
  reasons:     string[]
  strength:    number            // 0–100 signal strength
  timestamp:   number
  // Extra filters
  volumeOk:    boolean
  trendStrength: number          // how many candles in direction
  ema9AboveEma15: boolean
}

// ─── EMA Calculation ─────────────────────────────────────────────────────
function calcEMA(candles: Candle[], period: number): number[] {
  if (candles.length < period) return []
  const k    = 2 / (period + 1)
  const emas: number[] = []
  // seed with SMA
  let sum = 0
  for (let i = 0; i < period; i++) sum += candles[i].close
  emas.push(sum / period)
  for (let i = period; i < candles.length; i++) {
    emas.push(candles[i].close * k + emas[emas.length - 1] * (1 - k))
  }
  return emas
}

// ─── Angle Calculation ───────────────────────────────────────────────────
// We use the last N candles of EMA to compute angle vs horizontal
// Normalise by price to get % change, then convert to degrees
function calcAngle(emaArr: number[], lookback = 5): number {
  if (emaArr.length < lookback + 1) return 0
  const recent = emaArr.slice(-lookback - 1)
  const start  = recent[0]
  const end    = recent[recent.length - 1]
  if (start === 0) return 0
  // slope in % per candle
  const slopePct = ((end - start) / start) * 100 / lookback
  // map: 0.05% per candle ≈ 45°, scale linearly
  const angle = Math.atan(slopePct / 0.05) * (180 / Math.PI)
  return Math.round(angle * 10) / 10
}

// ─── Confirmation Candle Detection ────────────────────────────────────────
function detectConfirmation(candles: Candle[], direction: 'BUY' | 'SELL'): ConfirmationType {
  if (candles.length < 2) return 'NONE'
  const cur  = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const body     = Math.abs(cur.close - cur.open)
  const prevBody = Math.abs(prev.close - prev.open)
  const range    = cur.high - cur.low
  const upperWick = cur.high - Math.max(cur.open, cur.close)
  const lowerWick = Math.min(cur.open, cur.close) - cur.low

  if (direction === 'BUY') {
    // Bullish Engulfing: current bullish candle body > prev bearish body
    if (cur.close > cur.open && prev.close < prev.open && body > prevBody * 0.8 && cur.close > prev.open)
      return 'BULLISH_ENGULFING'
    // Hammer: small body at top, long lower wick ≥ 2x body
    if (lowerWick >= body * 2 && upperWick <= body * 0.5 && range > 0)
      return 'HAMMER'
    // Strong bull candle: body > 60% of range, closes in top 30%
    if (cur.close > cur.open && range > 0 && body / range > 0.6 && (cur.close - cur.low) / range > 0.7)
      return 'STRONG_BULL_CANDLE'
  } else {
    // Bearish Engulfing
    if (cur.close < cur.open && prev.close > prev.open && body > prevBody * 0.8 && cur.close < prev.open)
      return 'BEARISH_ENGULFING'
    // Shooting Star: small body at bottom, long upper wick ≥ 2x body
    if (upperWick >= body * 2 && lowerWick <= body * 0.5 && range > 0)
      return 'SHOOTING_STAR'
    // Strong bear candle: body > 60% range, closes in bottom 30%
    if (cur.close < cur.open && range > 0 && body / range > 0.6 && (cur.high - cur.close) / range > 0.7)
      return 'STRONG_BEAR_CANDLE'
  }
  return 'NONE'
}

// ─── Volume Filter ────────────────────────────────────────────────────────
function checkVolume(candles: Candle[], lookback = 20): boolean {
  if (candles.length < lookback + 1) return true // not enough data, allow
  const recent  = candles[candles.length - 1]
  const avgVol  = candles.slice(-lookback - 1, -1).reduce((s, c) => s + c.volume, 0) / lookback
  return avgVol > 0 ? recent.volume >= avgVol * 0.7 : true
}

// ─── Trend Strength ───────────────────────────────────────────────────────
// Count consecutive candles in direction of signal
function calcTrendStrength(candles: Candle[], direction: 'BUY' | 'SELL', lookback = 10): number {
  let count = 0
  const slice = candles.slice(-lookback)
  for (let i = slice.length - 1; i >= 0; i--) {
    if (direction === 'BUY'  && slice[i].close > slice[i].open) count++
    else if (direction === 'SELL' && slice[i].close < slice[i].open) count++
    else break
  }
  return count
}

// ─── Stop Loss Calculation ───────────────────────────────────────────────
function calcStopLoss(candles: Candle[], direction: 'BUY' | 'SELL', buffer = 0.001): number {
  if (candles.length < 3) return 0
  // Use previous candle's high/low + small buffer
  const prevCandle = candles[candles.length - 2]
  if (direction === 'BUY')  return prevCandle.low  * (1 - buffer)
  if (direction === 'SELL') return prevCandle.high * (1 + buffer)
  return 0
}

// ─── Main EMA Signal Computation ─────────────────────────────────────────
export function computeEMASignal(symbol: string, candles: Candle[], timeframe: string): EMASignal | null {
  if (candles.length < 30) return null

  const ema9arr  = calcEMA(candles, 9)
  const ema15arr = calcEMA(candles, 15)

  if (ema9arr.length < 5 || ema15arr.length < 5) return null

  const ema9  = ema9arr[ema9arr.length - 1]
  const ema15 = ema15arr[ema15arr.length - 1]
  const ema9Prev  = ema9arr[ema9arr.length - 2]
  const ema15Prev = ema15arr[ema15arr.length - 2]

  // Angle of EMA15 (lookback scales with timeframe)
  const angleLookback = timeframe === '1m' ? 3 : timeframe === '5m' ? 4 : 5
  const angle    = calcAngle(ema15arr, angleLookback)
  const angleAbs = Math.abs(angle)
  const angleOk  = angleAbs >= 30

  const ema9AboveEma15 = ema9 > ema15
  const entryPrice     = candles[candles.length - 1].close

  // ── Market condition ─────────────────────────────────────────────────
  let condition: MarketCondition = 'SIDEWAYS'
  if (angleOk) {
    if (angle > 0 && ema9AboveEma15)  condition = 'BULL'  // EMA15 below EMA9, rising ≥30°
    if (angle < 0 && !ema9AboveEma15) condition = 'BEAR'  // EMA15 above EMA9, falling ≥30°
  }

  // ── Direction ────────────────────────────────────────────────────────
  let direction: SignalDirection = 'NEUTRAL'
  if (condition === 'BULL') direction = 'BUY'
  if (condition === 'BEAR') direction = 'SELL'

  if (direction === 'NEUTRAL') {
    return {
      symbol, timeframe, direction: 'NEUTRAL', condition: 'SIDEWAYS',
      ema9, ema15, ema9Prev, ema15Prev, angle, angleOk: false,
      confirmation: 'NONE', confirmationOk: false,
      entryPrice, stopLoss: 0, takeProfit: 0, riskReward: 0, riskAmount: 0,
      reasons: [`EMA15 angle ${angleAbs.toFixed(1)}° < 30° — Sideways, no trade`],
      strength: 0, timestamp: Date.now(), volumeOk: true, trendStrength: 0,
      ema9AboveEma15,
    }
  }

  // ── Confirmation candle ───────────────────────────────────────────────
  const confirmation    = detectConfirmation(candles, direction)
  const confirmationOk  = confirmation !== 'NONE'

  // ── Stop Loss & Take Profit (1:2 RR) ─────────────────────────────────
  const stopLoss   = calcStopLoss(candles, direction)
  const riskAmount = Math.abs(entryPrice - stopLoss)
  const takeProfit = direction === 'BUY'
    ? entryPrice + riskAmount * 2
    : entryPrice - riskAmount * 2
  const riskReward = riskAmount > 0 ? Math.abs(takeProfit - entryPrice) / riskAmount : 2

  // ── Volume & trend strength ──────────────────────────────────────────
  const volumeOk     = checkVolume(candles)
  const trendStrength = calcTrendStrength(candles, direction)

  // ── Signal strength score 0–100 ──────────────────────────────────────
  let strength = 0
  strength += Math.min(40, (angleAbs - 30) * 1.5)  // angle bonus up to 40
  if (confirmationOk)  strength += 25
  if (volumeOk)        strength += 15
  strength += Math.min(20, trendStrength * 4)
  strength = Math.round(Math.max(0, Math.min(100, strength)))

  // ── Reasons ──────────────────────────────────────────────────────────
  const reasons: string[] = []
  reasons.push(`EMA15 angle: ${angle.toFixed(1)}° (${angleAbs >= 30 ? '✓ ≥30°' : '✗ <30°'})`)
  reasons.push(`EMA9=${ema9.toFixed(2)} ${ema9AboveEma15 ? '>' : '<'} EMA15=${ema15.toFixed(2)}`)
  if (confirmationOk) reasons.push(`✓ Confirmation: ${confirmation.replace(/_/g,' ')}`)
  else reasons.push('⚠ No confirmation candle yet')
  if (volumeOk) reasons.push('✓ Volume OK')
  if (trendStrength > 0) reasons.push(`${trendStrength} consecutive ${direction === 'BUY' ? 'bull' : 'bear'} candles`)

  return {
    symbol, timeframe, direction, condition,
    ema9, ema15, ema9Prev, ema15Prev, angle, angleOk,
    confirmation, confirmationOk,
    entryPrice, stopLoss, takeProfit, riskReward, riskAmount,
    reasons, strength, timestamp: Date.now(),
    volumeOk, trendStrength, ema9AboveEma15,
  }
}

// ─── Multi-timeframe EMA Analysis ────────────────────────────────────────
export interface MultiTFAnalysis {
  symbol:     string
  signals:    Record<string, EMASignal | null>
  consensus:  SignalDirection
  bestSignal: EMASignal | null
  alignedTFs: string[]   // timeframes agreeing with consensus
}

export function computeMultiTFEMA(
  symbol: string,
  candlesByTF: Record<string, Candle[]>
): MultiTFAnalysis {
  const signals: Record<string, EMASignal | null> = {}
  const TF_PRIORITY = ['1d','1h','15m','5m','1m']

  for (const tf of TF_PRIORITY) {
    const candles = candlesByTF[tf]
    signals[tf] = candles && candles.length >= 30
      ? computeEMASignal(symbol, candles, tf)
      : null
  }

  // Count votes
  let buyVotes = 0, sellVotes = 0
  const alignedTFs: string[] = []

  for (const [tf, sig] of Object.entries(signals)) {
    if (!sig || sig.direction === 'NEUTRAL') continue
    if (sig.direction === 'BUY')  { buyVotes++;  }
    if (sig.direction === 'SELL') { sellVotes++; }
  }

  const consensus: SignalDirection =
    buyVotes > sellVotes ? 'BUY' :
    sellVotes > buyVotes ? 'SELL' : 'NEUTRAL'

  for (const [tf, sig] of Object.entries(signals)) {
    if (sig && sig.direction === consensus) alignedTFs.push(tf)
  }

  // Best signal = highest strength among consensus direction
  const bestSignal = Object.values(signals)
    .filter(s => s && s.direction === consensus)
    .sort((a, b) => (b?.strength ?? 0) - (a?.strength ?? 0))[0] ?? null

  return { symbol, signals, consensus, bestSignal, alignedTFs }
}
