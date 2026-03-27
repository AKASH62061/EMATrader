import { useQuery } from '@tanstack/react-query'
import { signalApi, fp, TIMEFRAMES } from '../../services/api'
import { TrendingUp, TrendingDown, Minus, Target, Shield, Activity, BarChart2 } from 'lucide-react'

interface Props {
  symbol: string
  timeframe: string
  onTFChange?: (tf: string) => void
  compact?: boolean
}

export function EMASignalPanel({ symbol, timeframe, onTFChange, compact = false }: Props) {
  const { data: sig, isLoading } = useQuery({
    queryKey: ['ema-signal', symbol, timeframe],
    queryFn: () => signalApi.getOne(symbol, timeframe),
    refetchInterval: 10000,
    enabled: !!symbol,
  })

  const { data: multiTF } = useQuery({
    queryKey: ['multitf', symbol],
    queryFn: () => signalApi.getMultiTF(symbol),
    refetchInterval: 20000,
    enabled: !!symbol && !compact,
  })

  if (isLoading) return (
    <div style={{ padding: 16, textAlign:'center', color:'var(--muted)', fontSize:10 }}>
      <div className="pulse-dot" style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--bull)', marginRight:6 }} />
      Computing EMA signals...
    </div>
  )
  if (!sig) return <div style={{ padding:12, color:'var(--muted)', fontSize:10 }}>No signal data</div>

  const isBuy     = sig.direction === 'BUY'
  const isSell    = sig.direction === 'SELL'
  const isNeutral = sig.direction === 'NEUTRAL'
  const dirCol    = isBuy ? 'var(--bull)' : isSell ? 'var(--bear)' : 'var(--muted)'
  const DirIcon   = isBuy ? TrendingUp : isSell ? TrendingDown : Minus

  const strengthColor = sig.strength >= 70 ? 'var(--bull)' : sig.strength >= 40 ? 'var(--gold)' : 'var(--bear)'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {/* TF selector */}
      {onTFChange && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => onTFChange(tf)}
              style={{ padding:'2px 8px', fontSize:9, fontWeight:700, borderRadius:3, fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${tf === timeframe ? dirCol : 'var(--border2)'}`,
                background: tf === timeframe ? `${dirCol}15` : 'transparent',
                color: tf === timeframe ? dirCol : 'var(--muted)', cursor:'pointer' }}>
              {tf}
            </button>
          ))}
        </div>
      )}

      {/* Main signal card */}
      <div style={{ padding:12, borderRadius:6, border:`1px solid ${dirCol}44`, background:`${dirCol}06` }}
        className={isBuy ? 'neon-border-bull' : isSell ? 'neon-border-bear' : ''}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <DirIcon size={16} color={dirCol} />
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color:dirCol }}>
            {sig.direction}
          </span>
          <span style={{ fontSize:9, color:'var(--muted)' }}>{sig.condition}</span>
          <div style={{ marginLeft:'auto', padding:'2px 8px', borderRadius:3, background:`${dirCol}20`, border:`1px solid ${dirCol}40` }}>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:dirCol }}>
              {sig.strength}%
            </span>
          </div>
        </div>

        {/* Strength bar */}
        <div className="strength-bar" style={{ marginBottom:10 }}>
          <div className="strength-fill" style={{ width:`${sig.strength}%`, background: strengthColor }} />
        </div>

        {/* EMA values */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
          <div style={{ padding:'6px 8px', borderRadius:4, background:'var(--card)', border:'1px solid var(--border)' }}>
            <div style={{ fontSize:7, color:'var(--muted)', marginBottom:2 }}>EMA 9</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color: sig.ema9AboveEma15 ? 'var(--bull)' : 'var(--bear)' }}>
              {fp(sig.ema9)}
            </div>
          </div>
          <div style={{ padding:'6px 8px', borderRadius:4, background:'var(--card)', border:'1px solid var(--border)' }}>
            <div style={{ fontSize:7, color:'var(--muted)', marginBottom:2 }}>EMA 15</div>
            <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color: sig.ema9AboveEma15 ? 'var(--bear)' : 'var(--bull)' }}>
              {fp(sig.ema15)}
            </div>
          </div>
        </div>

        {/* Angle */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:4, background:'var(--card)', border:`1px solid ${sig.angleOk ? dirCol+'40' : 'var(--border)'}`, marginBottom:8 }}>
          <Activity size={12} color={sig.angleOk ? dirCol : 'var(--muted)'} />
          <span style={{ fontSize:10, color:'var(--muted)', flex:1 }}>EMA15 Angle</span>
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700, color: sig.angleOk ? dirCol : 'var(--bear)' }}>
            {sig.angle?.toFixed(1)}°
          </span>
          <span style={{ fontSize:9, color: sig.angleOk ? 'var(--bull)' : 'var(--bear)' }}>
            {sig.angleOk ? '✓ ≥30°' : '✗ <30°'}
          </span>
        </div>

        {/* Confirmation */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:4, background:'var(--card)', border:`1px solid ${sig.confirmationOk ? dirCol+'40' : 'var(--border)'}`, marginBottom: isNeutral ? 0 : 8 }}>
          <BarChart2 size={12} color={sig.confirmationOk ? dirCol : 'var(--muted)'} />
          <span style={{ fontSize:10, color:'var(--muted)', flex:1 }}>Confirmation</span>
          <span style={{ fontSize:9, fontWeight:700, color: sig.confirmationOk ? dirCol : 'var(--muted)' }}>
            {sig.confirmation === 'NONE' ? 'Waiting...' : sig.confirmation?.replace(/_/g,' ')}
          </span>
        </div>

        {/* SL / TP / RR — only if not neutral */}
        {!isNeutral && sig.stopLoss > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
            <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(255,34,68,.08)', border:'1px solid rgba(255,34,68,.25)' }}>
              <div style={{ fontSize:7, color:'var(--muted)', marginBottom:2 }}>
                <Shield size={8} style={{ display:'inline', marginRight:3 }} />STOP LOSS
              </div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'var(--bear)' }}>
                {fp(sig.stopLoss)}
              </div>
            </div>
            <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(0,255,136,.08)', border:'1px solid rgba(0,255,136,.25)' }}>
              <div style={{ fontSize:7, color:'var(--muted)', marginBottom:2 }}>
                <Target size={8} style={{ display:'inline', marginRight:3 }} />TARGET
              </div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'var(--bull)' }}>
                {fp(sig.takeProfit)}
              </div>
            </div>
            <div style={{ padding:'6px 8px', borderRadius:4, background:'rgba(0,170,255,.08)', border:'1px solid rgba(0,170,255,.25)' }}>
              <div style={{ fontSize:7, color:'var(--muted)', marginBottom:2 }}>RISK:REW</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'var(--blue)' }}>
                1:{sig.riskReward?.toFixed(1)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reasons */}
      {sig.reasons?.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {sig.reasons.map((r: string, i: number) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:9, color:'var(--text2)', fontFamily:'JetBrains Mono,monospace' }}>
              <span style={{ color: r.startsWith('✓') ? 'var(--bull)' : r.startsWith('⚠') ? 'var(--gold)' : r.startsWith('✗') ? 'var(--bear)' : 'var(--muted)', fontSize:8 }}>›</span>
              {r}
            </div>
          ))}
        </div>
      )}

      {/* Multi-TF consensus */}
      {multiTF && !compact && (
        <div style={{ padding:10, borderRadius:6, background:'var(--card)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>Multi-Timeframe Consensus</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
            {Object.entries(multiTF.signals ?? {}).map(([tf, s]: any) => {
              if (!s) return null
              const c = s.direction === 'BUY' ? 'var(--bull)' : s.direction === 'SELL' ? 'var(--bear)' : 'var(--muted)'
              return (
                <div key={tf} style={{ padding:'3px 7px', borderRadius:3, border:`1px solid ${c}40`, background:`${c}10` }}>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:8, color:'var(--muted)', marginRight:4 }}>{tf}</span>
                  <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, fontWeight:700, color:c }}>{s.direction}</span>
                </div>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:9, color:'var(--muted)' }}>Consensus:</span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color: multiTF.consensus === 'BUY' ? 'var(--bull)' : multiTF.consensus === 'SELL' ? 'var(--bear)' : 'var(--muted)' }}>
              {multiTF.consensus}
            </span>
            {multiTF.alignedTFs?.length > 0 && (
              <span style={{ fontSize:9, color:'var(--muted)' }}>({multiTF.alignedTFs.join(', ')} aligned)</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
