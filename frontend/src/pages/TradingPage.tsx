import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { fm, TIMEFRAMES } from '../services/api'
import CandleChart, { LivePositions } from '../components/chart/CandleChart'
import OrderTicket from '../components/trading/OrderTicket'
import { EMASignalPanel } from '../components/trading/EMASignalPanel'
import { PnlStrip } from '../components/common/Notifications'
import { Activity, ChevronDown, ChevronUp } from 'lucide-react'

export default function TradingPage() {
  const { sym } = useParams()
  const { setSelectedSymbol, selectedSymbol, setSelectedTF, selectedTF, emaSignals } = useStore()
  const [showSignal, setShowSignal] = useState(true)

  useEffect(() => { if (sym) setSelectedSymbol(sym) }, [sym])

  const sig     = selectedSymbol ? emaSignals[selectedSymbol] : null
  const dirCol  = sig?.direction === 'BUY' ? 'var(--bull)' : sig?.direction === 'SELL' ? 'var(--bear)' : 'var(--muted)'

  // Prefill order ticket from EMA signal
  const prefill = sig && sig.direction !== 'NEUTRAL' ? {
    side:       sig.direction as 'BUY'|'SELL',
    stopLoss:   sig.stopLoss,
    takeProfit: sig.takeProfit,
  } : undefined

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <PnlStrip />

      {/* EMA mini-bar */}
      {sig && sig.direction !== 'NEUTRAL' && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'3px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0, fontSize:9 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:dirCol }} className="pulse-dot" />
          <span style={{ color:dirCol, fontWeight:700, fontFamily:'JetBrains Mono,monospace' }}>{sig.direction}</span>
          <span style={{ color:'var(--muted)' }}>EMA Angle: <span style={{ color:sig.angleOk?'var(--bull)':'var(--bear)', fontWeight:700 }}>{sig.angle?.toFixed(1)}°</span></span>
          <span style={{ color:'var(--muted)' }}>·</span>
          <span style={{ color:'var(--muted)' }}>Condition: <span style={{ color:'var(--text)', fontWeight:600 }}>{sig.condition}</span></span>
          <span style={{ color:'var(--muted)' }}>·</span>
          <span style={{ color:'var(--muted)' }}>Confirm: <span style={{ color: sig.confirmationOk?'var(--bull)':'var(--gold)' }}>{sig.confirmationOk ? sig.confirmation?.replace(/_/g,' ') : 'Waiting...'}</span></span>
          <span style={{ color:'var(--muted)' }}>·</span>
          <span style={{ color:'var(--muted)' }}>SL: <span style={{ color:'var(--bear)', fontFamily:'JetBrains Mono,monospace' }}>${sig.stopLoss?.toFixed(2)}</span></span>
          <span style={{ color:'var(--muted)' }}>·</span>
          <span style={{ color:'var(--muted)' }}>TP: <span style={{ color:'var(--bull)', fontFamily:'JetBrains Mono,monospace' }}>${sig.takeProfit?.toFixed(2)}</span></span>
          <span style={{ color:'var(--muted)' }}>·</span>
          <span style={{ color:'var(--muted)' }}>Strength: <span style={{ color: sig.strength>=70?'var(--bull)':sig.strength>=40?'var(--gold)':'var(--bear)', fontFamily:'JetBrains Mono,monospace' }}>{sig.strength}%</span></span>
        </div>
      )}

      <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
        {/* Chart + positions */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
          {/* TF selector */}
          <div style={{ display:'flex', gap:3, padding:'4px 8px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setSelectedTF(tf)}
                style={{ padding:'2px 10px', fontSize:9, fontWeight:700, borderRadius:3,
                  border:`1px solid ${tf===selectedTF?'var(--bull)':'var(--border)'}`,
                  background:tf===selectedTF?'rgba(0,255,136,.1)':'transparent',
                  color:tf===selectedTF?'var(--bull)':'var(--muted)', cursor:'pointer',
                  fontFamily:'JetBrains Mono,monospace' }}>
                {tf}
              </button>
            ))}
          </div>

          <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0, padding:6, gap:6 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <CandleChart symbol={selectedSymbol || undefined} timeframe={selectedTF} />
            </div>
            <LivePositions />
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width:300, borderLeft:'1px solid var(--border)', background:'var(--bg2)', display:'flex', flexDirection:'column', overflow:'hidden', flexShrink:0 }}>
          {/* EMA Signal toggle */}
          <button onClick={() => setShowSignal(v => !v)}
            style={{ padding:'6px 12px', borderBottom:'1px solid var(--border)', background: sig?.direction==='BUY'?'rgba(0,255,136,.05)': sig?.direction==='SELL'?'rgba(255,34,68,.05)':'transparent',
              border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left' }}>
            <Activity size={11} color={dirCol} />
            <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:dirCol }}>EMA Strategy Signal</span>
            {showSignal ? <ChevronUp size={10} style={{ marginLeft:'auto', color:'var(--muted)' }}/> : <ChevronDown size={10} style={{ marginLeft:'auto', color:'var(--muted)' }}/>}
          </button>

          {/* EMA Signal panel */}
          {showSignal && selectedSymbol && (
            <div style={{ padding:10, borderBottom:'1px solid var(--border)', maxHeight:380, overflowY:'auto', flexShrink:0 }}>
              <EMASignalPanel symbol={selectedSymbol} timeframe={selectedTF} onTFChange={setSelectedTF} />
            </div>
          )}

          {/* Order ticket header */}
          <div style={{ padding:'6px 12px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'var(--muted)' }}>Order Ticket</span>
          </div>

          {/* Order ticket */}
          <div style={{ flex:1, overflow:'hidden', minHeight:0 }}>
            <OrderTicket prefill={prefill} />
          </div>
        </div>
      </div>
    </div>
  )
}
