import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portApi, analyticsApi, riskApi, mktApi, indiaApi, fp, fm, fpct, fpINR, MKTCOLORS, TIMEFRAMES } from '../services/api'
import { useStore } from '../store/useStore'
import { TVChart } from '../components/chart/CandleChart'
import { EMASignalPanel } from '../components/trading/EMASignalPanel'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ─── PORTFOLIO ───────────────────────────────────────────────────────────
export function PortfolioPage() {
  const { metrics, openPositions } = useStore()
  const qc = useQueryClient()
  const { data: portData } = useQuery({ queryKey:['portfolio'], queryFn: portApi.getPositions, refetchInterval:5000 })
  const closeMut = useMutation({ mutationFn:(id:string)=>portApi.closePos(id), onSuccess:()=>qc.invalidateQueries({queryKey:['portfolio']}) })
  const resetMut = useMutation({ mutationFn:portApi.reset, onSuccess:()=>qc.invalidateQueries({queryKey:['portfolio']}) })

  const m = metrics as any
  const closed = portData?.closed || []
  const open   = portData?.open   || []

  const statCards = [
    { l:'Total Equity',    v:`$${Math.round(m?.totalEquity||0).toLocaleString()}`,     c:(m?.totalReturnPct||0)>=0?'var(--bull)':'var(--bear)' },
    { l:'Total Return',    v:`${(m?.totalReturnPct||0)>=0?'+':''}${(m?.totalReturnPct||0).toFixed(2)}%`, c:(m?.totalReturnPct||0)>=0?'var(--bull)':'var(--bear)' },
    { l:'Realised P&L',    v:fm(m?.totalRealisedPnl),   c:(m?.totalRealisedPnl||0)>=0?'var(--bull)':'var(--bear)' },
    { l:'Unrealised P&L',  v:fm(m?.totalUnrealisedPnl), c:(m?.totalUnrealisedPnl||0)>=0?'var(--bull)':'var(--bear)' },
    { l:'Win Rate',        v:`${(m?.winRate||0).toFixed(1)}%`,    c:'var(--gold)' },
    { l:'Profit Factor',   v:(m?.profitFactor||0).toFixed(2),     c:(m?.profitFactor||0)>=1?'var(--bull)':'var(--bear)' },
    { l:'Max Drawdown',    v:`${(m?.maxDrawdown||0).toFixed(2)}%`,c:'var(--bear)' },
    { l:'Sharpe Ratio',    v:(m?.sharpeRatio||0).toFixed(2),      c:'var(--blue)' },
    { l:'Risk/Reward',     v:`${(m?.riskReward||0).toFixed(2)}R`, c:'var(--blue)' },
    { l:'Total Trades',    v:String(m?.totalTrades||0),            c:'var(--text)' },
    { l:'Wins / Losses',   v:`${m?.winTrades||0}W / ${m?.lossTrades||0}L`, c:'var(--gold)' },
    { l:'Open Positions',  v:String(m?.openPositions||0),          c:'var(--gold)' },
  ]

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8 }}>
        {statCards.map(({ l, v, c }) => (
          <div key={l} className="card" style={{ textAlign:'center' }}>
            <div className="card-header">{l}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Open positions */}
      <div className="card">
        <div className="card-header">Open Positions ({open.length})</div>
        {open.length === 0 ? <div style={{ color:'var(--muted)', fontSize:11, textAlign:'center', padding:16 }}>No open positions</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, fontFamily:'JetBrains Mono,monospace' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Symbol','Side','Qty','Entry','Current','Unreal P&L','Market','Action'].map(h => (
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {open.map((p: any) => {
                  const pnlCol = (p.unrealisedPnl||0)>=0?'var(--bull)':'var(--bear)'
                  return (
                    <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'6px 8px', fontWeight:700 }}>{p.symbol}</td>
                      <td style={{ padding:'6px 8px', color:p.side==='BUY'?'var(--bull)':'var(--bear)', fontWeight:700 }}>{p.side}</td>
                      <td style={{ padding:'6px 8px' }}>{p.quantity}</td>
                      <td style={{ padding:'6px 8px' }}>{fp(p.avgEntryPrice)}</td>
                      <td style={{ padding:'6px 8px' }}>{fp(p.currentPrice)}</td>
                      <td style={{ padding:'6px 8px', color:pnlCol, fontWeight:700 }}>{fm(p.unrealisedPnl,false)} ({fpct(p.unrealisedPnlPct)})</td>
                      <td style={{ padding:'6px 8px', fontSize:9, color:MKTCOLORS[p.marketType]||'var(--muted)' }}>{p.marketType}</td>
                      <td style={{ padding:'6px 8px' }}>
                        <button onClick={() => closeMut.mutate(p.id)} style={{ padding:'2px 8px', fontSize:9, borderRadius:3, border:'1px solid var(--border2)', background:'rgba(255,34,68,.1)', color:'var(--bear)', cursor:'pointer' }}>CLOSE</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent closed */}
      <div className="card">
        <div className="card-header">Closed Positions (last 20)</div>
        {closed.length === 0 ? <div style={{ color:'var(--muted)', fontSize:11, textAlign:'center', padding:16 }}>No closed positions yet</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, fontFamily:'JetBrains Mono,monospace' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Symbol','Side','Qty','Entry','Close','Realised P&L','Opened'].map(h => (
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closed.slice(0,20).map((p: any) => {
                  const pnlCol = (p.realisedPnl||0)>=0?'var(--bull)':'var(--bear)'
                  return (
                    <tr key={p.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'6px 8px', fontWeight:700 }}>{p.symbol}</td>
                      <td style={{ padding:'6px 8px', color:p.side==='BUY'?'var(--bull)':'var(--bear)' }}>{p.side}</td>
                      <td style={{ padding:'6px 8px' }}>{p.quantity}</td>
                      <td style={{ padding:'6px 8px' }}>{fp(p.avgEntryPrice)}</td>
                      <td style={{ padding:'6px 8px' }}>{fp(p.closePrice)}</td>
                      <td style={{ padding:'6px 8px', color:pnlCol, fontWeight:700 }}>{fm(p.realisedPnl,false)}</td>
                      <td style={{ padding:'6px 8px', fontSize:9, color:'var(--muted)' }}>{p.openedAt ? new Date(p.openedAt).toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <button onClick={() => resetMut.mutate()} style={{ alignSelf:'flex-end', padding:'6px 16px', borderRadius:4, border:'1px solid var(--border2)', background:'transparent', color:'var(--muted)', cursor:'pointer', fontSize:10 }}>
        ↺ Reset Portfolio to $100,000
      </button>
    </div>
  )
}

// ─── HISTORY ─────────────────────────────────────────────────────────────
export function HistoryPage() {
  const { data: orders } = useQuery({ queryKey:['orders'], queryFn: portApi.getOrders, refetchInterval:5000 })
  const history = orders?.history || []

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:16 }}>
      <div className="card">
        <div className="card-header">Trade History ({history.length} orders)</div>
        {history.length === 0 ? <div style={{ color:'var(--muted)', fontSize:11, textAlign:'center', padding:24 }}>No trade history yet. Place your first trade!</div> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10, fontFamily:'JetBrains Mono,monospace' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--border)' }}>
                  {['Time','Symbol','Side','Type','Qty','Fill Price','Commission','P&L','Status'].map(h => (
                    <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((o: any) => {
                  const pnlCol = (o.pnl||0)>=0?'var(--bull)':'var(--bear)'
                  return (
                    <tr key={o.id} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'6px 8px', color:'var(--muted)', fontSize:9 }}>{o.filledAt ? new Date(o.filledAt).toLocaleTimeString() : '—'}</td>
                      <td style={{ padding:'6px 8px', fontWeight:700 }}>{o.symbol}</td>
                      <td style={{ padding:'6px 8px', color:o.side==='BUY'?'var(--bull)':'var(--bear)', fontWeight:700 }}>{o.side}</td>
                      <td style={{ padding:'6px 8px', color:'var(--muted)' }}>{o.type}</td>
                      <td style={{ padding:'6px 8px' }}>{o.quantity}</td>
                      <td style={{ padding:'6px 8px' }}>{fp(o.fillPrice)}</td>
                      <td style={{ padding:'6px 8px', color:'var(--muted)' }}>${(o.commission||0).toFixed(2)}</td>
                      <td style={{ padding:'6px 8px', color:pnlCol, fontWeight:700 }}>{o.pnl!=null ? fm(o.pnl,false) : '—'}</td>
                      <td style={{ padding:'6px 8px' }}>
                        <span className={`tag ${o.status==='FILLED'?'tag-bull':o.status==='CANCELLED'?'tag-neutral':'tag-bear'}`}>{o.status}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ANALYTICS ───────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey:['analytics'], queryFn: analyticsApi.get, refetchInterval:10000 })
  if (isLoading) return <div style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>Loading analytics...</div>
  if (!data) return null

  const bySymbol = Object.entries(data.bySymbol || {}).sort(([,a]:any,[,b]:any)=>b.totalPnl-a.totalPnl)
  const byMarket = Object.entries(data.byMarket || {}).sort(([,a]:any,[,b]:any)=>b.totalPnl-a.totalPnl)

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {/* By symbol */}
        <div className="card">
          <div className="card-header">Performance by Symbol</div>
          {bySymbol.length === 0 ? <div style={{ color:'var(--muted)', fontSize:11, padding:12 }}>No data yet</div> : bySymbol.map(([sym,s]:any) => (
            <div key={sym} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, flex:1 }}>{sym}</span>
              <span style={{ fontSize:9, color:'var(--muted)' }}>{s.trades}T</span>
              <span style={{ fontSize:9, color:'var(--bull)' }}>{s.wins}W</span>
              <span style={{ fontSize:9, color:'var(--bear)' }}>{s.losses}L</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:s.totalPnl>=0?'var(--bull)':'var(--bear)' }}>{fm(s.totalPnl,false)}</span>
            </div>
          ))}
        </div>
        {/* By market */}
        <div className="card">
          <div className="card-header">Performance by Market</div>
          {byMarket.length === 0 ? <div style={{ color:'var(--muted)', fontSize:11, padding:12 }}>No data yet</div> : byMarket.map(([mkt,s]:any) => (
            <div key={mkt} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:MKTCOLORS[mkt]||'var(--muted)', flexShrink:0 }}/>
              <span style={{ fontSize:10, flex:1 }}>{mkt.replace('_',' ')}</span>
              <span style={{ fontSize:9, color:'var(--muted)' }}>{s.trades}T</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:s.totalPnl>=0?'var(--bull)':'var(--bear)' }}>{fm(s.totalPnl,false)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── RISK ─────────────────────────────────────────────────────────────────
export function RiskPage() {
  const { data, isLoading } = useQuery({ queryKey:['risk'], queryFn: riskApi.get, refetchInterval:5000 })
  if (isLoading) return <div style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>Loading risk data...</div>
  if (!data) return null

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
        {[
          { l:'Equity',            v:`$${Math.round(data.equity||0).toLocaleString()}`,         c:'var(--text)' },
          { l:'Margin Used',       v:`$${Math.round(data.marginUsed||0).toLocaleString()}`,      c:'var(--orange)' },
          { l:'Margin Available',  v:`$${Math.round(data.marginAvailable||0).toLocaleString()}`, c:'var(--bull)' },
          { l:'Max Drawdown',      v:`${(data.maxDrawdown||0).toFixed(2)}%`,                     c:'var(--bear)' },
          { l:'Current Drawdown',  v:`${(data.currentDrawdown||0).toFixed(2)}%`,                c:(data.currentDrawdown||0)>5?'var(--bear)':'var(--bull)' },
          { l:'Win Rate',          v:`${(data.winRate||0).toFixed(1)}%`,                         c:'var(--gold)' },
          { l:'Profit Factor',     v:(data.profitFactor||0).toFixed(2),                         c:(data.profitFactor||0)>=1?'var(--bull)':'var(--bear)' },
          { l:'Open Positions',    v:String(data.openPositions||0),                              c:'var(--text)' },
        ].map(({ l, v, c }) => (
          <div key={l} className="card" style={{ textAlign:'center' }}>
            <div className="card-header">{l}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:20, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">Risk Guidelines (EMA 9/15 Strategy)</div>
        {[
          '✓ Only trade when EMA15 angle ≥ 30° — flat market means no trade',
          '✓ Always wait for confirmation candle before entering',
          '✓ Stop loss always below/above previous candle (never guess)',
          '✓ Minimum 1:2 Risk:Reward on every trade',
          '✓ Never risk more than 2% of capital per trade',
          '✓ In sideways condition (angle < 30°) — stay flat',
          '✓ Higher timeframe alignment = stronger signal',
          '✓ Volume should be above average on breakout candles',
        ].map((rule, i) => (
          <div key={i} style={{ padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:11, color: rule.startsWith('✓')?'var(--text2)':'var(--muted)', display:'flex', gap:8 }}>
            <span style={{ color:'var(--bull)', fontSize:10 }}>›</span>{rule}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HEATMAP ─────────────────────────────────────────────────────────────
export function HeatmapPage() {
  const { data: heatData = [], isLoading } = useQuery({ queryKey:['heatmap'], queryFn: mktApi.getHeatmap, refetchInterval:3000 })
  const { setSelectedSymbol, emaSignals } = useStore()
  const navigate = useNavigate()

  function goTrade(sym: string) { setSelectedSymbol(sym); navigate(`/trading/${sym}`) }

  const sorted = [...heatData].sort((a:any,b:any) => Math.abs(b.changePct||0)-Math.abs(a.changePct||0))

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:12 }}>
      {isLoading ? <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Loading heatmap...</div> : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {sorted.map((item:any) => {
            const chg = item.changePct || 0
            const intensity = Math.min(1, Math.abs(chg) / 5)
            const bg = chg >= 0
              ? `rgba(0,255,136,${0.08+intensity*.35})`
              : `rgba(255,34,68,${0.08+intensity*.35})`
            const border = chg >= 0 ? `rgba(0,255,136,${0.2+intensity*.4})` : `rgba(255,34,68,${0.2+intensity*.4})`
            const sig = emaSignals[item.symbol]
            const size = Math.max(80, Math.min(160, 80 + Math.abs(chg)*12))

            return (
              <div key={item.symbol} onClick={() => goTrade(item.symbol)}
                style={{ width:size, height:size, background:bg, border:`1px solid ${border}`, borderRadius:6, padding:8, cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between', transition:'all .15s' }}
                onMouseEnter={e => (e.currentTarget as any).style.transform='scale(1.04)'}
                onMouseLeave={e => (e.currentTarget as any).style.transform='scale(1)'}>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700 }}>{item.symbol.replace('-USD','').replace('.NS','')}</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color:chg>=0?'var(--bull)':'var(--bear)' }}>
                  {chg>=0?'+':''}{chg.toFixed(2)}%
                </div>
                {sig && sig.direction !== 'NEUTRAL' && (
                  <div style={{ fontSize:8, color:sig.direction==='BUY'?'var(--bull)':'var(--bear)', fontWeight:700 }}>
                    {sig.direction} {sig.angle?.toFixed(0)}°
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// useNavigate import needed for Heatmap
import { useNavigate } from 'react-router-dom'

// ─── INDIA PAGE ──────────────────────────────────────────────────────────
export function IndiaPage() {
  const { data: quotes = [], isLoading } = useQuery({ queryKey:['india-quotes'], queryFn: indiaApi.getQuotes, refetchInterval:15000 })
  const { setSelectedSymbol, emaSignals } = useStore()
  const navigate = useNavigate()

  return (
    <div style={{ height:'100%', overflowY:'auto', padding:12 }}>
      <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:14 }}>🇮🇳</span>
        <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Indian Markets — NSE/BSE Live</span>
        <span style={{ fontSize:9, color:'var(--muted)' }}>Refreshing every 15s via Yahoo Finance India</span>
      </div>

      {isLoading ? <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Loading Indian market data...</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:8 }}>
          {quotes.map((q: any) => {
            const isUp  = (q.changePct||0) >= 0
            const col   = isUp ? 'var(--bull)' : 'var(--bear)'
            const sig   = emaSignals[q.symbol]
            const sigCol = sig?.direction==='BUY'?'var(--bull)':sig?.direction==='SELL'?'var(--bear)':'var(--muted)'

            return (
              <div key={q.symbol} onClick={() => { setSelectedSymbol(q.symbol); navigate(`/trading/${q.symbol}`) }}
                className="card animate-in"
                style={{ cursor:'pointer', borderColor: sig?.direction==='BUY'?'rgba(0,255,136,.25)':sig?.direction==='SELL'?'rgba(255,34,68,.25)':'var(--border)' }}
                onMouseEnter={e => (e.currentTarget as any).style.borderColor='var(--bull)'}
                onMouseLeave={e => (e.currentTarget as any).style.borderColor=sig?.direction==='BUY'?'rgba(0,255,136,.25)':sig?.direction==='SELL'?'rgba(255,34,68,.25)':'var(--border)'}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700 }}>{q.symbol?.replace('.NS','')}</span>
                  <span style={{ fontSize:9, color:col, fontWeight:700 }}>{isUp?'+':''}{(q.changePct||0).toFixed(2)}%</span>
                </div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:16, fontWeight:700, color:col, marginBottom:4 }}>
                  {fpINR(q.price)}
                </div>
                <div style={{ fontSize:9, color:'var(--muted)', marginBottom:6 }}>{q.name}</div>
                {sig && sig.direction !== 'NEUTRAL' && (
                  <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 6px', background:`${sigCol}10`, borderRadius:3, border:`1px solid ${sigCol}30` }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', background:sigCol }} className="pulse-dot" />
                    <span style={{ fontSize:8, color:sigCol, fontWeight:700, fontFamily:'JetBrains Mono,monospace' }}>
                      EMA {sig.direction} · {sig.angle?.toFixed(0)}° · {sig.strength}%
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── CHART LAB ───────────────────────────────────────────────────────────
export function ChartLabPage() {
  const [sym,  setSym]  = useState('NIFTY50.NS')
  const [tf,   setTf]   = useState('15m')

  const popularSymbols = ['NIFTY50.NS','BANKNIFTY.NS','BTC-USD','ETH-USD','AAPL','MSFT','NVDA','TSLA','GC=F','ES=F']

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'8px 12px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <input value={sym} onChange={e => setSym(e.target.value.toUpperCase())} placeholder="Enter symbol..."
          style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:4, padding:'4px 10px', color:'var(--text)', fontSize:11, outline:'none', width:160, fontFamily:'JetBrains Mono,monospace' }} />
        {TIMEFRAMES.map(t => (
          <button key={t} onClick={() => setTf(t)}
            style={{ padding:'3px 8px', fontSize:9, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
              border:`1px solid ${tf===t?'var(--bull)':'var(--border)'}`,
              background:tf===t?'rgba(0,255,136,.1)':'transparent',
              color:tf===t?'var(--bull)':'var(--muted)' }}>
            {t}
          </button>
        ))}
        <div style={{ display:'flex', gap:3, marginLeft:8, flexWrap:'wrap' }}>
          {popularSymbols.map(s => (
            <button key={s} onClick={() => setSym(s)}
              style={{ padding:'2px 7px', fontSize:8, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${sym===s?'var(--gold)':'var(--border)'}`,
                background:sym===s?'rgba(255,204,0,.1)':'transparent',
                color:sym===s?'var(--gold)':'var(--muted)' }}>
              {s.replace('.NS','').replace('-USD','')}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex:1, display:'flex', overflow:'hidden', gap:0 }}>
        <div style={{ flex:1, padding:8, minWidth:0 }}>
          <TVChart symbol={sym} timeframe={tf} />
        </div>
        <div style={{ width:260, borderLeft:'1px solid var(--border)', overflowY:'auto', padding:10 }}>
          <EMASignalPanel symbol={sym} timeframe={tf} onTFChange={setTf} />
        </div>
      </div>
    </div>
  )
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────
export function SettingsPage() {
  return (
    <div style={{ height:'100%', overflowY:'auto', padding:24, maxWidth:600 }}>
      <h2 style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, marginBottom:20, color:'var(--text)' }}>Settings</h2>

      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-header">EMA Strategy Parameters</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[
            { l:'Fast EMA Period', v:'9', note:'EMA 9 (green line)' },
            { l:'Slow EMA Period', v:'15', note:'EMA 15 (orange line)' },
            { l:'Min Angle (°)',   v:'30', note:'Below = sideways = no trade' },
            { l:'SL Buffer (%)',   v:'0.1', note:'Buffer above/below prev candle' },
            { l:'Target RR',      v:'2.0', note:'Risk:Reward ratio (1:2)' },
            { l:'Signal Lookback',v:'5', note:'Candles for angle calculation' },
          ].map(({ l, v, note }) => (
            <div key={l}>
              <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>{l}</div>
              <input defaultValue={v} className="input" style={{ marginBottom:3 }} />
              <div style={{ fontSize:8, color:'var(--muted)' }}>{note}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-header">Backend Connection</div>
        <div>
          <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>API URL</div>
          <input defaultValue={(import.meta as any).env?.VITE_API_URL || 'https://ema-trader-backend.onrender.com'} className="input" style={{ marginBottom:8 }} />
          <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>WebSocket URL</div>
          <input defaultValue={(import.meta as any).env?.VITE_WS_URL || 'wss://ema-trader-backend.onrender.com/ws'} className="input" />
        </div>
      </div>

      <div className="card">
        <div className="card-header">About</div>
        <div style={{ fontSize:11, color:'var(--text2)', lineHeight:1.7 }}>
          <p><strong style={{ color:'var(--bull)' }}>EMA Trader</strong> — Strategy-based paper trading platform</p>
          <p>Strategy: <span style={{ fontFamily:'JetBrains Mono,monospace', color:'var(--gold)' }}>EMA 9/15 Crossover + 30° Angle Filter + Confirmation Candle</span></p>
          <p>Bull signal: EMA9 {">"} EMA15, angle ≥ 30° up → BUY LONG</p>
          <p>Bear signal: EMA15 {">"} EMA9, angle ≥ 30° down → SELL SHORT</p>
          <p>Sideways: angle {"<"} 30° → NO TRADE</p>
          <p style={{ color:'var(--muted)', fontSize:10 }}>Built for paper trading. Always backtest before using in live markets.</p>
        </div>
      </div>
    </div>
  )
}
