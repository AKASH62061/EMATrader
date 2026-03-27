import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { signalApi, TIMEFRAMES, fp } from '../services/api'
import { useStore } from '../store/useStore'
import { TrendingUp, TrendingDown, Minus, Activity, WifiOff } from 'lucide-react'

export default function SignalsPage() {
  const [tf, setTf]     = useState('15m')
  const [dir, setDir]   = useState<'ALL'|'BUY'|'SELL'|'NEUTRAL'>('ALL')
  const [minStr, setMinStr] = useState(0)
  const { setSelectedSymbol } = useStore()
  const navigate = useNavigate()

  const { data: signals = {}, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['all-signals', tf],
    queryFn: () => signalApi.getAll(tf),
    refetchInterval: 15000,
    retry: 2,
  })

  const entries = Object.entries(signals as Record<string, any>)
    .filter(([, s]) => dir === 'ALL' || s.direction === dir)
    .filter(([, s]) => s.strength >= minStr)
    .sort(([, a], [, b]) => (b.strength || 0) - (a.strength || 0))

  const buys    = entries.filter(([, s]) => s.direction === 'BUY').length
  const sells   = entries.filter(([, s]) => s.direction === 'SELL').length
  const neutral = entries.filter(([, s]) => s.direction === 'NEUTRAL').length

  function goTrade(sym: string) {
    setSelectedSymbol(sym)
    navigate(`/trading/${sym}`)
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Controls */}
      <div style={{ padding:'8px 12px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <Activity size={13} color="var(--bull)" />
        <span style={{ fontSize:10, fontWeight:700, color:'var(--text)', marginRight:8 }}>EMA 9/15 SIGNALS</span>

        {/* TF */}
        <div style={{ display:'flex', gap:3 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)}
              style={{ padding:'3px 8px', fontSize:9, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${tf===t?'var(--bull)':'var(--border)'}`,
                background:tf===t?'rgba(0,255,136,.1)':'transparent',
                color:tf===t?'var(--bull)':'var(--muted)' }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }} />

        {/* Direction */}
        {(['ALL','BUY','SELL','NEUTRAL'] as const).map(d => {
          const c = d==='BUY'?'var(--bull)':d==='SELL'?'var(--bear)':d==='NEUTRAL'?'var(--muted)':'var(--gold)'
          return (
            <button key={d} onClick={() => setDir(d)}
              style={{ padding:'3px 8px', fontSize:9, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${dir===d?c:'var(--border)'}`,
                background:dir===d?`${c}15`:'transparent', color:dir===d?c:'var(--muted)' }}>
              {d}
            </button>
          )
        })}

        {/* Min strength */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:'auto' }}>
          <span style={{ fontSize:9, color:'var(--muted)' }}>Min Strength:</span>
          {[0,30,50,70].map(v => (
            <button key={v} onClick={() => setMinStr(v)}
              style={{ padding:'3px 6px', fontSize:9, borderRadius:3, cursor:'pointer',
                border:`1px solid ${minStr===v?'var(--gold)':'var(--border)'}`,
                background:minStr===v?'rgba(255,204,0,.1)':'transparent',
                color:minStr===v?'var(--gold)':'var(--muted)', fontFamily:'JetBrains Mono,monospace' }}>
              {v}%
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display:'flex', gap:0, background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {[
          { label:'BUY SIGNALS',  val:buys,    col:'var(--bull)' },
          { label:'SELL SIGNALS', val:sells,   col:'var(--bear)' },
          { label:'SIDEWAYS',     val:neutral, col:'var(--muted)' },
          { label:'TOTAL',        val:entries.length, col:'var(--text)' },
        ].map(({ label, val, col }) => (
          <div key={label} style={{ flex:1, padding:'6px 12px', borderRight:'1px solid var(--border)', textAlign:'center' }}>
            <div style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8 }}>{label}</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700, color:col }}>{val}</div>
          </div>
        ))}
        <div style={{ padding:'6px 12px', display:'flex', alignItems:'center', fontSize:9, color:'var(--muted)' }}>
          Updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
        </div>
      </div>

      {/* Signal cards */}
      <div style={{ flex:1, overflowY:'auto', padding:12, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10, alignContent:'start' }}>
        {isLoading ? (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40, color:'var(--muted)' }}>
            <div className="pulse-dot" style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--bull)', marginRight:8 }} />
            Computing EMA signals across all timeframes...
          </div>
        ) : isError ? (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:40 }}>
            <WifiOff size={28} color='rgba(255,34,68,.4)' style={{ display:'block', margin:'0 auto 12px' }} />
            <div style={{ color:'var(--bear)', fontSize:12, marginBottom:6 }}>Backend unreachable</div>
            <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.8 }}>
              Open <a href="https://ematrader.onrender.com/api/health" target="_blank" rel="noopener" style={{color:'var(--blue)'}}>this link</a> to wake up the Render backend, then refresh.
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:24, color:'var(--muted)', fontSize:12 }}>
            No signals match your filters
          </div>
        ) : entries.map(([sym, sig]: [string, any]) => {
          const isBuy    = sig.direction === 'BUY'
          const isSell   = sig.direction === 'SELL'
          const dirCol   = isBuy ? 'var(--bull)' : isSell ? 'var(--bear)' : 'var(--muted)'
          const DirIcon  = isBuy ? TrendingUp : isSell ? TrendingDown : Minus
          const strengthCol = sig.strength >= 70 ? 'var(--bull)' : sig.strength >= 40 ? 'var(--gold)' : 'var(--muted)'

          return (
            <div key={sym} onClick={() => goTrade(sym)} className="animate-in"
              style={{ background:'var(--card)', border:`1px solid ${dirCol}33`, borderRadius:6, padding:12, cursor:'pointer', transition:'all .15s' }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = dirCol; (e.currentTarget as any).style.boxShadow = `0 0 12px ${dirCol}20` }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = `${dirCol}33`; (e.currentTarget as any).style.boxShadow = 'none' }}>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <DirIcon size={14} color={dirCol} />
                <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700 }}>{sym}</span>
                <span style={{ fontSize:9, color:dirCol, fontWeight:700, marginLeft:'auto' }}>{sig.direction}</span>
              </div>

              {/* Strength bar */}
              <div className="strength-bar" style={{ marginBottom:8 }}>
                <div className="strength-fill" style={{ width:`${sig.strength}%`, background:strengthCol }} />
              </div>

              {/* Key stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:8, fontSize:9, fontFamily:'JetBrains Mono,monospace' }}>
                <div style={{ padding:'4px 6px', background:'var(--bg3)', borderRadius:3 }}>
                  <div style={{ fontSize:7, color:'var(--muted)', marginBottom:1 }}>ANGLE</div>
                  <span style={{ color: sig.angleOk?'var(--bull)':'var(--bear)', fontWeight:700 }}>{sig.angle?.toFixed(1)}°</span>
                </div>
                <div style={{ padding:'4px 6px', background:'var(--bg3)', borderRadius:3 }}>
                  <div style={{ fontSize:7, color:'var(--muted)', marginBottom:1 }}>STRENGTH</div>
                  <span style={{ color:strengthCol, fontWeight:700 }}>{sig.strength}%</span>
                </div>
                <div style={{ padding:'4px 6px', background:'var(--bg3)', borderRadius:3 }}>
                  <div style={{ fontSize:7, color:'var(--muted)', marginBottom:1 }}>CONFIRM</div>
                  <span style={{ color: sig.confirmationOk?'var(--bull)':'var(--muted)', fontWeight:700 }}>{sig.confirmationOk?'✓':'✗'}</span>
                </div>
              </div>

              {/* SL/TP */}
              {sig.direction !== 'NEUTRAL' && sig.stopLoss > 0 && (
                <div style={{ display:'flex', gap:4, fontSize:9 }}>
                  <div style={{ flex:1, padding:'3px 6px', background:'rgba(255,34,68,.08)', borderRadius:3, fontFamily:'JetBrains Mono,monospace' }}>
                    <span style={{ color:'var(--muted)', fontSize:7 }}>SL </span>
                    <span style={{ color:'var(--bear)' }}>{fp(sig.stopLoss)}</span>
                  </div>
                  <div style={{ flex:1, padding:'3px 6px', background:'rgba(0,255,136,.08)', borderRadius:3, fontFamily:'JetBrains Mono,monospace' }}>
                    <span style={{ color:'var(--muted)', fontSize:7 }}>TP </span>
                    <span style={{ color:'var(--bull)' }}>{fp(sig.takeProfit)}</span>
                  </div>
                  <div style={{ padding:'3px 6px', background:'rgba(0,170,255,.08)', borderRadius:3, fontFamily:'JetBrains Mono,monospace' }}>
                    <span style={{ color:'var(--blue)' }}>1:{sig.riskReward?.toFixed(1)}</span>
                  </div>
                </div>
              )}

              {/* Condition tag */}
              <div style={{ marginTop:6, display:'flex', gap:4 }}>
                <span className={`tag ${sig.condition==='BULL'?'tag-bull':sig.condition==='BEAR'?'tag-bear':'tag-neutral'}`}>{sig.condition}</span>
                {sig.confirmationOk && <span className="tag tag-gold">{sig.confirmation?.replace(/_/g,' ')}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
