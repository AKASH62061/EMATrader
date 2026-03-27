import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { indiaApi, fpINR, fp, signalApi } from '../services/api'
import { useStore } from '../store/useStore'
import { TrendingUp, TrendingDown, Zap, Shield, Target } from 'lucide-react'

const INDEX_SYMBOLS = [
  { sym:'NIFTY50.NS',    label:'NIFTY 50',    color:'#00ff88' },
  { sym:'BANKNIFTY.NS',  label:'BANK NIFTY',  color:'#00aaff' },
  { sym:'FINNIFTY.NS',   label:'FIN NIFTY',   color:'#ff8800' },
]

interface OptionRow {
  strike: number
  ce: { premium: number; oi: number; iv: number; delta: number; gamma: number; theta: number; signal: string }
  pe: { premium: number; oi: number; iv: number; delta: number; gamma: number; theta: number; signal: string }
  isATM: boolean
}

interface TradeModal {
  show: boolean
  sym: string; indexSym: string; strike: number
  optionType: 'CE'|'PE'; premium: number; expiry: string
  spotPrice: number
}

export default function OptionChainPage() {
  const [indexSym, setIndexSym] = useState('NIFTY50.NS')
  const [weeks,    setWeeks]    = useState(0)
  const [tradeModal, setTradeModal] = useState<TradeModal | null>(null)
  const [qty,      setQty]      = useState(1)
  const [capPct,   setCapPct]   = useState(0)
  const { metrics, notify } = useStore()
  const qc = useQueryClient()

  const { data: analysis, isLoading } = useQuery({
    queryKey: ['option-analysis', indexSym, weeks],
    queryFn: () => indiaApi.getOptionAnalysis(indexSym, weeks),
    refetchInterval: 15000,
  })

  // EMA signal for this index
  const { data: emaSig } = useQuery({
    queryKey: ['ema-signal-india', indexSym],
    queryFn: () => signalApi.getOne(indexSym, '15m'),
    refetchInterval: 15000,
  })

  const placeMut = useMutation({
    mutationFn: (order: any) => indiaApi.placeOptionTrade(order),
    onSuccess: (data) => {
      notify(`✓ ${data.symbolName} — Option trade placed`, 'ok')
      setTradeModal(null)
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
    onError: (e: any) => notify(`✗ ${e?.response?.data?.error || 'Trade failed'}`, 'warn'),
  })

  const spotPrice = analysis?.spotPrice || 0
  const oc        = analysis?.optionChain
  const rows: OptionRow[] = oc?.strikes || []

  const equity = (metrics as any)?.totalEquity || 100000

  function openTrade(row: OptionRow, type: 'CE'|'PE') {
    if (!oc) return
    const optData = type === 'CE' ? row.ce : row.pe
    setQty(1)
    setCapPct(0)
    setTradeModal({
      show: true,
      sym: `${indexSym.replace('.NS','')}_${row.strike}${type}`,
      indexSym,
      strike: row.strike,
      optionType: type,
      premium: optData.premium,
      expiry: oc.expiry,
      spotPrice,
    })
  }

  function applyCapPct(pct: number) {
    if (!tradeModal) return
    setCapPct(pct)
    const lotSize = indexSym.includes('BANKNIFTY') ? 25 : 50
    const capital = equity * (pct / 100)
    const q = Math.max(1, Math.floor(capital / (tradeModal.premium * lotSize)))
    setQty(q)
  }

  function placeOptionTrade() {
    if (!tradeModal) return
    placeMut.mutate({
      symbol:      tradeModal.sym,
      optionType:  tradeModal.optionType,
      strike:      tradeModal.strike,
      expiry:      tradeModal.expiry,
      quantity:    qty,
      premium:     tradeModal.premium,
      indexSymbol: tradeModal.indexSym,
      autoSL:      true,
      capitalPct:  capPct,
    })
  }

  const emaDirCol = emaSig?.direction === 'BUY' ? 'var(--bull)' : emaSig?.direction === 'SELL' ? 'var(--bear)' : 'var(--muted)'

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Controls */}
      <div style={{ padding:'8px 12px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <Zap size={13} color="var(--gold)" />
        <span style={{ fontSize:10, fontWeight:700, color:'var(--gold)', marginRight:4 }}>OPTION CHAIN</span>

        {INDEX_SYMBOLS.map(({ sym, label, color }) => (
          <button key={sym} onClick={() => setIndexSym(sym)}
            style={{ padding:'4px 12px', fontSize:10, fontWeight:700, borderRadius:4, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
              border:`1px solid ${indexSym===sym?color:'var(--border)'}`,
              background:indexSym===sym?`${color}15`:'transparent',
              color:indexSym===sym?color:'var(--muted)' }}>
            {label}
          </button>
        ))}

        <div style={{ display:'flex', gap:3, marginLeft:8 }}>
          {[0,1,2,3].map(w => (
            <button key={w} onClick={() => setWeeks(w)}
              style={{ padding:'3px 8px', fontSize:9, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${weeks===w?'var(--gold)':'var(--border)'}`,
                background:weeks===w?'rgba(255,204,0,.1)':'transparent',
                color:weeks===w?'var(--gold)':'var(--muted)' }}>
              {w===0?'Current':w===1?'+1W':w===2?'+2W':'+3W'}
            </button>
          ))}
        </div>
      </div>

      {/* Analysis bar */}
      {analysis && (
        <div style={{ display:'flex', gap:0, background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0, overflowX:'auto' }}>
          {[
            { label:'SPOT',      val:`₹${fpINR(spotPrice).replace('₹','')}`, col:'var(--text)' },
            { label:'MAX PAIN',  val:`₹${fp(analysis.maxPain,0)}`,           col:'var(--gold)' },
            { label:'PCR',       val:(analysis.pcr||0).toFixed(2),           col: (analysis.pcr||0)>1?'var(--bull)':'var(--bear)' },
            { label:'IV%',       val:`${(analysis.avgIV||0).toFixed(1)}%`,   col:'var(--purple)' },
            { label:'SUPPORT',   val:`₹${fp(analysis.support,0)}`,           col:'var(--bull)' },
            { label:'RESISTANCE',val:`₹${fp(analysis.resistance,0)}`,        col:'var(--bear)' },
            { label:'BIAS',      val:analysis.bias||'NEUTRAL',               col: analysis.bias==='BULLISH'?'var(--bull)':analysis.bias==='BEARISH'?'var(--bear)':'var(--muted)' },
          ].map(({ label, val, col }) => (
            <div key={label} style={{ padding:'5px 14px', borderRight:'1px solid var(--border)', textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8 }}>{label}</div>
              <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:col }}>{val}</div>
            </div>
          ))}
          {/* EMA signal for this index */}
          {emaSig && emaSig.direction !== 'NEUTRAL' && (
            <div style={{ padding:'5px 14px', borderRight:'1px solid var(--border)', flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:emaDirCol }} className="pulse-dot" />
              <div>
                <div style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.8 }}>EMA SIGNAL</div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:emaDirCol }}>
                  {emaSig.direction} {emaSig.angle?.toFixed(0)}°
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Option Chain Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {isLoading ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>
            <div className="pulse-dot" style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'var(--gold)', marginRight:8 }} />
            Loading option chain...
          </div>
        ) : (
          <>
            {/* Table header */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 60px 80px 80px 80px 80px 60px 1fr', gap:0, padding:'5px 8px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', position:'sticky', top:0, zIndex:1 }}>
              {/* CE side */}
              <div style={{ gridColumn:'1/6', textAlign:'center', fontSize:8, fontWeight:700, color:'var(--bull)', textTransform:'uppercase', letterSpacing:.8, borderRight:'2px solid var(--border2)', paddingBottom:2 }}>── CALLS (CE) ──</div>
              <div style={{ gridColumn:'6', textAlign:'center', fontSize:9, fontWeight:700, color:'var(--gold)', fontFamily:'JetBrains Mono,monospace' }}>STRIKE</div>
              {/* PE side */}
              <div style={{ gridColumn:'7/12', textAlign:'center', fontSize:8, fontWeight:700, color:'var(--bear)', textTransform:'uppercase', letterSpacing:.8, borderLeft:'2px solid var(--border2)', paddingBottom:2 }}>── PUTS (PE) ──</div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 60px 80px 80px 80px 80px 60px 1fr', padding:'3px 8px', background:'rgba(255,255,255,.02)', borderBottom:'1px solid var(--border)' }}>
              {['BUY CE','OI','IV%','Δ Delta','Premium','STRIKE','Premium','Δ Delta','IV%','OI','BUY PE'].map((h, i) => (
                <div key={i} style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5, textAlign:'center', fontFamily:'JetBrains Mono,monospace' }}>{h}</div>
              ))}
            </div>

            {rows.map((row: OptionRow) => {
              const isATM = row.isATM
              const atmStyle = isATM ? { background:'rgba(255,204,0,.05)', borderTop:'1px solid rgba(255,204,0,.2)', borderBottom:'1px solid rgba(255,204,0,.2)' } : {}
              const ceOIColor = (row.ce?.oi || 0) > 1000000 ? 'var(--bull)' : 'var(--text2)'
              const peOIColor = (row.pe?.oi || 0) > 1000000 ? 'var(--bear)' : 'var(--text2)'

              return (
                <div key={row.strike}
                  style={{ display:'grid', gridTemplateColumns:'1fr 80px 80px 80px 60px 80px 80px 80px 80px 60px 1fr', padding:'4px 8px', borderBottom:'1px solid var(--border)', ...atmStyle }}>

                  {/* BUY CE button */}
                  <button onClick={() => openTrade(row, 'CE')}
                    style={{ padding:'4px 6px', fontSize:9, borderRadius:3, border:'1px solid rgba(0,255,136,.4)', background:'rgba(0,255,136,.08)', color:'var(--bull)', cursor:'pointer', fontWeight:700, fontFamily:'JetBrains Mono,monospace', display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                    <TrendingUp size={9}/> BUY CE
                  </button>

                  {/* CE data */}
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:ceOIColor, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {((row.ce?.oi||0)/1e5).toFixed(1)}L
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(row.ce?.iv||0).toFixed(1)}%
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(row.ce?.delta||0).toFixed(2)}
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'var(--bull)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {fp(row.ce?.premium)}
                  </div>

                  {/* Strike */}
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:isATM?'var(--gold)':'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', borderLeft:'2px solid var(--border2)', borderRight:'2px solid var(--border2)' }}>
                    {isATM && <span style={{ fontSize:7, color:'var(--gold)', marginRight:3 }}>ATM</span>}
                    {row.strike.toLocaleString()}
                  </div>

                  {/* PE data */}
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:10, fontWeight:700, color:'var(--bear)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {fp(row.pe?.premium)}
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(row.pe?.delta||0).toFixed(2)}
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:'var(--purple)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {(row.pe?.iv||0).toFixed(1)}%
                  </div>
                  <div style={{ textAlign:'center', fontFamily:'JetBrains Mono,monospace', fontSize:9, color:peOIColor, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {((row.pe?.oi||0)/1e5).toFixed(1)}L
                  </div>

                  {/* BUY PE button */}
                  <button onClick={() => openTrade(row, 'PE')}
                    style={{ padding:'4px 6px', fontSize:9, borderRadius:3, border:'1px solid rgba(255,34,68,.4)', background:'rgba(255,34,68,.08)', color:'var(--bear)', cursor:'pointer', fontWeight:700, fontFamily:'JetBrains Mono,monospace', display:'flex', alignItems:'center', justifyContent:'center', gap:3 }}>
                    <TrendingDown size={9}/> BUY PE
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>

      {/* Trade Modal */}
      {tradeModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if (e.target === e.currentTarget) setTradeModal(null) }}>
          <div className="animate-in" style={{ background:'var(--card)', border:`1px solid ${tradeModal.optionType==='CE'?'rgba(0,255,136,.4)':'rgba(255,34,68,.4)'}`, borderRadius:8, padding:20, width:360, boxShadow:'0 20px 60px rgba(0,0,0,.8)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              {tradeModal.optionType==='CE' ? <TrendingUp size={18} color="var(--bull)"/> : <TrendingDown size={18} color="var(--bear)"/>}
              <div>
                <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, color:tradeModal.optionType==='CE'?'var(--bull)':'var(--bear)' }}>
                  BUY {tradeModal.optionType} — {tradeModal.strike.toLocaleString()}
                </div>
                <div style={{ fontSize:9, color:'var(--muted)' }}>{tradeModal.indexSym.replace('.NS','')} · Expiry: {tradeModal.expiry}</div>
              </div>
              <button onClick={() => setTradeModal(null)} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:18 }}>✕</button>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {[
                { label:'SPOT', val:`₹${fp(tradeModal.spotPrice,0)}`, col:'var(--text)' },
                { label:'PREMIUM', val:`₹${fp(tradeModal.premium)}`, col:tradeModal.optionType==='CE'?'var(--bull)':'var(--bear)' },
                { label:'STRIKE', val:tradeModal.strike.toLocaleString(), col:'var(--gold)' },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ padding:'8px 10px', background:'var(--bg3)', borderRadius:4, textAlign:'center' }}>
                  <div style={{ fontSize:7, color:'var(--muted)', marginBottom:3 }}>{label}</div>
                  <div style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, fontWeight:700, color:col }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Quantity */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:9, color:'var(--muted)', marginBottom:6 }}>LOTS (1 lot = {indexSym.includes('BANKNIFTY')?25:50} qty)</div>
              <div style={{ display:'flex', gap:4, marginBottom:6 }}>
                <button onClick={() => setQty(q => Math.max(1, q-1))} style={{ width:32, height:32, borderRadius:4, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontSize:16 }}>−</button>
                <input type="number" value={qty} min={1} onChange={e => setQty(parseInt(e.target.value)||1)}
                  style={{ flex:1, textAlign:'center', background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:4, color:'var(--text)', fontFamily:'JetBrains Mono,monospace', fontSize:14, fontWeight:700, outline:'none' }} />
                <button onClick={() => setQty(q => q+1)} style={{ width:32, height:32, borderRadius:4, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', fontSize:16 }}>+</button>
              </div>
              {/* Capital % auto-qty */}
              <div style={{ display:'flex', gap:4 }}>
                {[5,10,20,50].map(pct => (
                  <button key={pct} onClick={() => applyCapPct(pct)}
                    style={{ flex:1, padding:'4px 0', fontSize:9, borderRadius:3, border:`1px solid ${capPct===pct?'var(--gold)':'var(--border)'}`, background:capPct===pct?'rgba(255,204,0,.1)':'transparent', color:capPct===pct?'var(--gold)':'var(--muted)', cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Cost summary */}
            <div style={{ padding:'8px 12px', background:'var(--bg3)', borderRadius:4, marginBottom:12, fontSize:9, fontFamily:'JetBrains Mono,monospace' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--muted)' }}>Total Cost:</span>
                <span style={{ color:'var(--text)', fontWeight:700 }}>₹{fp(tradeModal.premium * qty * (indexSym.includes('BANKNIFTY')?25:50))}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ color:'var(--muted)' }}><Shield size={9} style={{display:'inline'}}/> Stop Loss (−30%):</span>
                <span style={{ color:'var(--bear)', fontWeight:700 }}>₹{fp(tradeModal.premium * 0.70)}</span>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:'var(--muted)' }}><Target size={9} style={{display:'inline'}}/> Target (2×):</span>
                <span style={{ color:'var(--bull)', fontWeight:700 }}>₹{fp(tradeModal.premium * 2)}</span>
              </div>
            </div>

            {/* Place button */}
            <button onClick={placeOptionTrade} disabled={placeMut.isPending}
              style={{ width:'100%', padding:'12px 0', borderRadius:4, fontWeight:700, fontSize:13, cursor:'pointer',
                border:`1px solid ${tradeModal.optionType==='CE'?'var(--bull)':'var(--bear)'}`,
                background:tradeModal.optionType==='CE'?'rgba(0,255,136,.15)':'rgba(255,34,68,.15)',
                color:tradeModal.optionType==='CE'?'var(--bull)':'var(--bear)',
                fontFamily:'JetBrains Mono,monospace', opacity: placeMut.isPending ? .6 : 1 }}>
              {placeMut.isPending ? 'PLACING...' : `⚡ BUY ${qty} LOT${qty>1?'S':''} ${tradeModal.strike} ${tradeModal.optionType}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
