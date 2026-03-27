import { useStore } from '../../store/useStore'
import { X } from 'lucide-react'

export default function Notifications() {
  const { notifications, dismissNotification } = useStore()
  if (!notifications.length) return null

  return (
    <div style={{ position:'fixed', bottom:16, right:16, zIndex:1000, display:'flex', flexDirection:'column', gap:6, maxWidth:340 }}>
      {notifications.map(n => {
        const colors: Record<string, string> = {
          ok:     'var(--bull)', warn: 'var(--bear)',
          info:   'var(--blue)', signal: 'var(--gold)'
        }
        const col = colors[n.type] || 'var(--text)'
        return (
          <div key={n.id} className="animate-in"
            style={{ background:'var(--card)', border:`1px solid ${col}44`, borderLeft:`3px solid ${col}`, borderRadius:6, padding:'8px 12px', display:'flex', alignItems:'center', gap:8, boxShadow:`0 4px 16px rgba(0,0,0,.6), 0 0 8px ${col}22` }}>
            <span style={{ fontSize:10, color:col, fontFamily:'JetBrains Mono,monospace', flex:1 }}>{n.msg}</span>
            <button onClick={() => dismissNotification(n.id)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0, display:'flex' }}>
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// PnL Strip for trading page bottom
export function PnlStrip() {
  const { metrics, openPositions } = useStore()
  if (!metrics) return null
  const m = metrics as any
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, overflowX:'auto', background:'var(--bg3)', borderBottom:'1px solid var(--border)', height:28, flexShrink:0, padding:'0 8px' }}>
      {[
        { l:'EQUITY',   v:`$${Math.round(m.totalEquity||0).toLocaleString()}`, c: (m.totalReturnPct||0)>=0?'var(--bull)':'var(--bear)' },
        { l:'DAY P&L',  v:`${(m.dayPnl||0)>=0?'+':''}$${Math.abs(m.dayPnl||0).toFixed(0)}`, c:(m.dayPnl||0)>=0?'var(--bull)':'var(--bear)' },
        { l:'UNREALISED',v:`${(m.totalUnrealisedPnl||0)>=0?'+':''}$${Math.abs(m.totalUnrealisedPnl||0).toFixed(0)}`, c:(m.totalUnrealisedPnl||0)>=0?'var(--bull)':'var(--bear)' },
        { l:'REALISED',  v:`${(m.totalRealisedPnl||0)>=0?'+':''}$${Math.abs(m.totalRealisedPnl||0).toFixed(0)}`, c:(m.totalRealisedPnl||0)>=0?'var(--bull)':'var(--bear)' },
        { l:'WIN',       v:`${(m.winRate||0).toFixed(0)}%`, c:'var(--gold)' },
        { l:'RR',        v:`${(m.riskReward||0).toFixed(2)}R`, c:'var(--blue)' },
        { l:'PF',        v:(m.profitFactor||0).toFixed(2), c:(m.profitFactor||0)>=1?'var(--bull)':'var(--bear)' },
        { l:'MAX DD',    v:`${(m.maxDrawdown||0).toFixed(1)}%`, c:'var(--bear)' },
        { l:'SHARPE',    v:(m.sharpeRatio||0).toFixed(2), c:'var(--purple)' },
        { l:'POSITIONS', v:String(openPositions?.length||0), c:'var(--gold)' },
      ].map(({ l, v, c }) => (
        <div key={l} style={{ padding:'0 10px', borderRight:'1px solid var(--border)', flexShrink:0, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8 }}>{l}</span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:c }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
