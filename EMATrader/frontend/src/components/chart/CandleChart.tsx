import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { fp, fm } from '../../services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portApi } from '../../services/api'
import { Maximize2, Minimize2 } from 'lucide-react'

function toTV(sym: string): string {
  if (sym.endsWith('-USD')) return `BINANCE:${sym.replace('-USD','')}USDT`
  const fmap: Record<string,string> = {
    'ES=F':'CME_MINI:ES1!','NQ=F':'CME_MINI:NQ1!','YM=F':'CBOT_MINI:YM1!',
    'GC=F':'COMEX:GC1!','SI=F':'COMEX:SI1!','CL=F':'NYMEX:CL1!',
    'NG=F':'NYMEX:NG1!','ZW=F':'CBOT:ZW1!','ZC=F':'CBOT:ZC1!',
  }
  if (fmap[sym]) return fmap[sym]
  if (sym.endsWith('.L')) return `LSE:${sym.replace('.L','')}`
  if (sym.endsWith('.NS')) return `NSE:${sym.replace('.NS','')}`
  return `NASDAQ:${sym}`
}

function intervalFromTF(tf: string): string {
  const map: Record<string,string> = { '1m':'1','5m':'5','15m':'15','1h':'60','3h':'180','1d':'D' }
  return map[tf] || '15'
}

export function TVChart({ symbol, timeframe, marketType }: { symbol: string; timeframe: string; marketType?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = ''
    const s = document.createElement('script')
    s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    s.async = true
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol: toTV(symbol),
      interval: intervalFromTF(timeframe),
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(0,0,0,1)',
      gridColor: 'rgba(34,34,34,0.6)',
      hide_top_toolbar: false,
      hide_legend: false,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      // EMA 9 and EMA 15 pre-loaded
      studies: [
        { id:'MASimple@tv-basicstudies', inputs:{ length:9  }, override:{ 'Plot.color':'#00ff88','Plot.linewidth':2 } },
        { id:'MASimple@tv-basicstudies', inputs:{ length:15 }, override:{ 'Plot.color':'#ff8800','Plot.linewidth':2 } },
        'STD;MACD',
        'STD;RSI',
      ],
      support_host: 'https://www.tradingview.com',
    })
    ref.current.appendChild(s)
    return () => { if (ref.current) ref.current.innerHTML = '' }
  }, [symbol, timeframe])

  return (
    <div className="tradingview-widget-container" ref={ref} style={{ height:'100%', width:'100%' }}>
      <div className="tradingview-widget-container__widget" style={{ height:'calc(100% - 20px)', width:'100%' }} />
      <div style={{ fontSize:9, color:'var(--muted)', textAlign:'right', padding:'2px 6px' }}>
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener" style={{ color:'var(--muted)' }}>Charts by TradingView</a>
      </div>
    </div>
  )
}

// Live open positions overlay
export function LivePositions() {
  const { openPositions, prices } = useStore()
  const qc = useQueryClient()
  const closeMut = useMutation({
    mutationFn: (id: string) => portApi.closePos(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
  const open = openPositions?.filter(p => p.status === 'OPEN') || []
  if (!open.length) return (
    <div style={{ width:180, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, padding:12, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:9, color:'var(--muted)' }}>No open positions</div>
    </div>
  )

  return (
    <div style={{ width:180, background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, overflowY:'auto', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'6px 10px', borderBottom:'1px solid var(--border)', fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, flexShrink:0 }}>
        Positions ({open.length})
      </div>
      {open.map(pos => {
        const pnl = pos.unrealisedPnl ?? 0
        const col = pnl >= 0 ? 'var(--bull)' : 'var(--bear)'
        return (
          <div key={pos.id} style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', animation:'slideUp .2s ease-out' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:9, fontWeight:700, fontFamily:'JetBrains Mono,monospace' }}>{pos.symbol}</span>
              <span style={{ fontSize:8, color: pos.side==='BUY'?'var(--bull)':'var(--bear)', fontWeight:700 }}>{pos.side}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:8, color:'var(--muted)' }}>Qty: {pos.quantity}</span>
              <span style={{ fontSize:8, color:'var(--muted)' }}>@{fp(pos.avgEntryPrice)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:9, color:col, fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}>{pnl>=0?'+':''}{fm(pnl,false)}</span>
              <span style={{ fontSize:8, color:col }}>{(pos.unrealisedPnlPct??0)>=0?'+':''}{(pos.unrealisedPnlPct??0).toFixed(2)}%</span>
            </div>
            <button onClick={() => closeMut.mutate(pos.id)}
              style={{ width:'100%', padding:'3px 0', fontSize:8, borderRadius:3, border:'1px solid var(--border2)', background:'rgba(255,34,68,.08)', color:'var(--bear)', cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
              CLOSE
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Main CandleChart wrapper used in trading page
export default function CandleChart({ symbol, timeframe }: { symbol?: string; timeframe: string }) {
  const { selectedSymbol, prices, emaSignals } = useStore()
  const sym  = symbol || selectedSymbol || 'ETH-USD'
  const pd   = prices[sym]
  const sig  = emaSignals[sym]
  const [isMax, setIsMax] = useState(false)

  const isG   = (pd?.changePct ?? 0) >= 0
  const dirCol = sig?.direction === 'BUY' ? 'var(--bull)' : sig?.direction === 'SELL' ? 'var(--bear)' : 'var(--muted)'

  const containerStyle: React.CSSProperties = isMax
    ? { position:'fixed', inset:0, zIndex:200, background:'#000', display:'flex', flexDirection:'column' }
    : { background:'var(--card)', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden', display:'flex', flexDirection:'column', height:'100%' }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'5px 10px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700 }}>{sym}</span>
        {pd && (
          <>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color: isG?'var(--bull)':'var(--bear)' }}>${fp(pd.price)}</span>
            <span style={{ fontSize:9, color: isG?'var(--bull)':'var(--bear)' }}>{isG?'+':''}{pd.changePct?.toFixed(2)}%</span>
            <span style={{ fontSize:8, color:'var(--muted)' }}>H:{fp(pd.high)} L:{fp(pd.low)}</span>
          </>
        )}
        {/* EMA signal badge */}
        {sig && sig.direction !== 'NEUTRAL' && (
          <div style={{ marginLeft:8, padding:'2px 8px', borderRadius:3, background:`${dirCol}15`, border:`1px solid ${dirCol}40`, display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:dirCol }} className={sig.direction==='BUY'?'pulse-dot':''} />
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, fontWeight:700, color:dirCol }}>
              EMA {sig.direction} {sig.angle?.toFixed(0)}°
            </span>
            {sig.confirmationOk && <span style={{ fontSize:8, color:'var(--gold)' }}>✓ CONFIRMED</span>}
          </div>
        )}
        <button onClick={() => setIsMax(v => !v)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:2 }}>
          {isMax ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Chart */}
      <div style={{ flex:1, minHeight:0 }}>
        <TVChart symbol={sym} timeframe={timeframe} marketType={pd?.marketType} />
      </div>
    </div>
  )
}
