import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi, portApi, fp, MKTMETA } from '../../services/api'
import { useStore } from '../../store/useStore'
import { TrendingUp, TrendingDown, Plus, Minus } from 'lucide-react'

interface Props {
  prefill?: {
    symbol?: string; symbolName?: string; side?: 'BUY'|'SELL'
    stopLoss?: number; takeProfit?: number; marketType?: string
    price?: number
  }
}

export default function OrderTicket({ prefill }: Props) {
  const { selectedSymbol, prices, metrics, notify } = useStore()
  const qc = useQueryClient()

  const sym  = prefill?.symbol || selectedSymbol
  const pd   = prices[sym]
  const meta = MKTMETA[pd?.marketType ?? 'US_STOCK']

  const [side,      setSide]      = useState<'BUY'|'SELL'>(prefill?.side || 'BUY')
  const [otype,     setOtype]     = useState<'MARKET'|'LIMIT'|'STOP'>('MARKET')
  const [qty,       setQty]       = useState(1)
  const [limitP,    setLimitP]    = useState('')
  const [stopP,     setStopP]     = useState('')
  const [sl,        setSl]        = useState(prefill?.stopLoss ? String(prefill.stopLoss.toFixed(2)) : '')
  const [tp,        setTp]        = useState(prefill?.takeProfit ? String(prefill.takeProfit.toFixed(2)) : '')
  const [trailStop, setTrailStop] = useState('')
  const [leverage,  setLeverage]  = useState(1)
  const [capPct,    setCapPct]    = useState(0)

  // Update when prefill changes
  useEffect(() => {
    if (prefill?.side)       setSide(prefill.side)
    if (prefill?.stopLoss)   setSl(prefill.stopLoss.toFixed(2))
    if (prefill?.takeProfit) setTp(prefill.takeProfit.toFixed(2))
  }, [prefill?.side, prefill?.stopLoss, prefill?.takeProfit])

  const price    = prefill?.price || pd?.price || 0
  const equity   = (metrics as any)?.totalEquity || 100000
  const maxLev   = meta?.maxLev || 1
  const riskAmt  = sl && price ? Math.abs(price - parseFloat(sl)) : 0
  const rrRatio  = sl && tp && price ? Math.abs(parseFloat(tp) - price) / Math.abs(price - parseFloat(sl)) : 0

  // Capital % → quantity
  function applyCapPct(pct: number) {
    if (!price || !equity) return
    setCapPct(pct)
    const capital = equity * (pct / 100)
    const q = Math.max(1, Math.floor(capital / (price / leverage)))
    setQty(q)
  }

  const placeMut = useMutation({
    mutationFn: () => orderApi.place({
      symbol: sym, symbolName: prefill?.symbolName || pd?.name || sym,
      side, type: otype, quantity: qty, leverage,
      marketType: prefill?.marketType || pd?.marketType || 'US_STOCK',
      limitPrice: otype !== 'MARKET' ? parseFloat(limitP) : undefined,
      stopPrice:  otype === 'STOP' ? parseFloat(stopP) : undefined,
      stopLoss:   sl ? parseFloat(sl) : undefined,
      takeProfit: tp ? parseFloat(tp) : undefined,
      trailingStop: trailStop ? parseFloat(trailStop) : undefined,
    }),
    onSuccess: () => {
      notify(`✓ ${side} ${qty}×${sym} order placed`, 'ok')
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
    onError: (e: any) => notify(`✗ ${e?.response?.data?.error || 'Order failed'}`, 'warn'),
  })

  const closeMut = useMutation({
    mutationFn: () => portApi.closeAll(),
    onSuccess: () => { notify('All positions closed', 'warn'); qc.invalidateQueries({ queryKey: ['portfolio'] }) },
  })

  const isBuy = side === 'BUY'
  const btnCol = isBuy ? 'var(--bull)' : 'var(--bear)'

  return (
    <div style={{ padding:10, display:'flex', flexDirection:'column', gap:8, overflowY:'auto', height:'100%' }}>
      {/* Symbol header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', background:'var(--bg3)', borderRadius:4, border:'1px solid var(--border)' }}>
        <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:13, fontWeight:700 }}>{sym}</span>
        {pd && <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:12, color: (pd.changePct??0)>=0?'var(--bull)':'var(--bear)' }}>${fp(price)}</span>}
        {pd && <span style={{ fontSize:9, color: (pd.changePct??0)>=0?'var(--bull)':'var(--bear)', marginLeft:'auto' }}>{(pd.changePct??0)>=0?'+':''}{pd.changePct?.toFixed(2)}%</span>}
      </div>

      {/* BUY / SELL toggle */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
        {(['BUY','SELL'] as const).map(s => (
          <button key={s} onClick={() => setSide(s)}
            style={{ padding:'8px 0', borderRadius:4, border:`1px solid ${s==='BUY'?'var(--bull)':'var(--bear)'}${side===s?'':'44'}`,
              background: side===s ? (s==='BUY'?'rgba(0,255,136,.15)':'rgba(255,34,68,.15)') : 'transparent',
              color: s==='BUY'?'var(--bull)':'var(--bear)', fontWeight:700, fontSize:12, cursor:'pointer',
              fontFamily:'JetBrains Mono,monospace', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
            {s==='BUY'?<TrendingUp size={12}/>:<TrendingDown size={12}/>} {s==='BUY'?'BUY LONG':'SELL SHORT'}
          </button>
        ))}
      </div>

      {/* Order type */}
      <div style={{ display:'flex', gap:3 }}>
        {(['MARKET','LIMIT','STOP'] as const).map(t => (
          <button key={t} onClick={() => setOtype(t)}
            style={{ flex:1, padding:'4px 0', borderRadius:3, border:`1px solid ${otype===t?'var(--blue)':'var(--border)'}`,
              background: otype===t?'rgba(0,170,255,.12)':'transparent', color:otype===t?'var(--blue)':'var(--muted)',
              fontSize:9, fontWeight:700, cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Quantity */}
      <div>
        <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>QUANTITY</div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width:28, height:28, borderRadius:4, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Minus size={12}/></button>
          <input type="number" value={qty} min={1} onChange={e => setQty(parseInt(e.target.value)||1)}
            className="input" style={{ textAlign:'center', flex:1 }} />
          <button onClick={() => setQty(q => q + 1)} style={{ width:28, height:28, borderRadius:4, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Plus size={12}/></button>
        </div>
        {/* Capital % shortcuts */}
        <div style={{ display:'flex', gap:3, marginTop:4 }}>
          {[10,25,50,100].map(pct => (
            <button key={pct} onClick={() => applyCapPct(pct)}
              style={{ flex:1, padding:'3px 0', fontSize:9, borderRadius:3, border:`1px solid ${capPct===pct?'var(--gold)':'var(--border)'}`, background:capPct===pct?'rgba(255,204,0,.1)':'transparent', color:capPct===pct?'var(--gold)':'var(--muted)', cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Limit/Stop price */}
      {otype !== 'MARKET' && (
        <div>
          <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>{otype === 'LIMIT' ? 'LIMIT PRICE' : 'STOP PRICE'}</div>
          <input type="number" placeholder={fp(price)} value={otype === 'LIMIT' ? limitP : stopP}
            onChange={e => otype === 'LIMIT' ? setLimitP(e.target.value) : setStopP(e.target.value)}
            className="input" />
        </div>
      )}

      {/* Leverage */}
      {maxLev > 1 && (
        <div>
          <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>LEVERAGE: {leverage}×</div>
          <div style={{ display:'flex', gap:3 }}>
            {[1,2,5,10,maxLev].filter((v,i,a) => a.indexOf(v)===i && v<=maxLev).map(lev => (
              <button key={lev} onClick={() => setLeverage(lev)}
                style={{ flex:1, padding:'3px 0', fontSize:9, borderRadius:3, border:`1px solid ${leverage===lev?'var(--orange)':'var(--border)'}`, background:leverage===lev?'rgba(255,136,0,.12)':'transparent', color:leverage===lev?'var(--orange)':'var(--muted)', cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
                {lev}×
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SL / TP */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        <div>
          <div style={{ fontSize:9, color:'var(--bear)', marginBottom:4 }}>STOP LOSS $</div>
          <input type="number" placeholder="Optional" value={sl} onChange={e => setSl(e.target.value)} className="input" style={{ borderColor: sl ? 'var(--bear)' : undefined }} />
        </div>
        <div>
          <div style={{ fontSize:9, color:'var(--bull)', marginBottom:4 }}>TAKE PROFIT $</div>
          <input type="number" placeholder="Optional" value={tp} onChange={e => setTp(e.target.value)} className="input" style={{ borderColor: tp ? 'var(--bull)' : undefined }} />
        </div>
      </div>

      {/* Trailing stop */}
      <div>
        <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>TRAILING STOP $ <span style={{ color:'var(--muted)', fontSize:8 }}>(distance)</span></div>
        <input type="number" placeholder="Optional" value={trailStop} onChange={e => setTrailStop(e.target.value)} className="input" />
      </div>

      {/* RR display */}
      {sl && tp && (
        <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg3)', borderRadius:4, border:'1px solid var(--border)' }}>
          <span style={{ fontSize:9, color:'var(--muted)' }}>Risk: <span style={{ color:'var(--bear)', fontFamily:'JetBrains Mono,monospace' }}>${riskAmt.toFixed(2)}</span></span>
          <span style={{ fontSize:9, color:'var(--muted)' }}>R:R <span style={{ color: rrRatio >= 2 ? 'var(--bull)' : rrRatio >= 1 ? 'var(--gold)' : 'var(--bear)', fontFamily:'JetBrains Mono,monospace', fontWeight:700 }}>1:{rrRatio.toFixed(1)}</span></span>
        </div>
      )}

      {/* Place order button */}
      <button onClick={() => placeMut.mutate()} disabled={placeMut.isPending}
        style={{ padding:'10px 0', borderRadius:4, border:`1px solid ${btnCol}`, background:`${btnCol}20`, color:btnCol, fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'JetBrains Mono,monospace', opacity: placeMut.isPending ? .6 : 1 }}>
        {placeMut.isPending ? 'PLACING...' : `▲ ${isBuy ? 'BUY LONG' : 'SELL SHORT'}`}
      </button>

      {/* Close all */}
      <button onClick={() => closeMut.mutate()} style={{ padding:'6px 0', borderRadius:4, border:'1px solid var(--border2)', background:'transparent', color:'var(--muted)', fontSize:9, cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
        ✕ CLOSE ALL POSITIONS
      </button>
    </div>
  )
}
