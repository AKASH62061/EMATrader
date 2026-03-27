import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mktApi, fp, fpct, MKTCOLORS, MKTMETA } from '../services/api'
import { useStore } from '../store/useStore'
import { TrendingUp, TrendingDown, Minus, Search } from 'lucide-react'

const MARKET_TYPES = ['ALL','US_STOCK','UK_STOCK','CRYPTO','COMMODITY','FUTURES','IN_STOCK','IN_INDEX']

export default function MarketsPage() {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort]     = useState<'change'|'price'|'signal'>('change')
  const { setSelectedSymbol, emaSignals } = useStore()
  const navigate = useNavigate()

  const { data: instruments = [], isLoading } = useQuery({
    queryKey: ['markets'], queryFn: mktApi.getAll, refetchInterval: 5000
  })

  const filtered = instruments
    .filter((i: any) => filter === 'ALL' || i.marketType === filter)
    .filter((i: any) => !search || i.sym.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      if (sort === 'change') return Math.abs(b.changePct||0) - Math.abs(a.changePct||0)
      if (sort === 'price')  return (b.currentPrice||0) - (a.currentPrice||0)
      if (sort === 'signal') {
        const sa = emaSignals[a.sym]?.strength || 0
        const sb = emaSignals[b.sym]?.strength || 0
        return sb - sa
      }
      return 0
    })

  function goTrading(sym: string) {
    setSelectedSymbol(sym)
    navigate(`/trading/${sym}`)
  }

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Filter bar */}
      <div style={{ padding:'8px 12px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
        <div style={{ position:'relative', marginRight:8 }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            style={{ background:'var(--bg3)', border:'1px solid var(--border2)', borderRadius:4, padding:'4px 8px 4px 24px', color:'var(--text)', fontSize:11, outline:'none', width:160, fontFamily:'JetBrains Mono,monospace' }} />
        </div>
        {MARKET_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            style={{ padding:'3px 10px', fontSize:9, fontWeight:700, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
              border:`1px solid ${filter===t?'var(--bull)':'var(--border)'}`,
              background:filter===t?'rgba(0,255,136,.1)':'transparent',
              color:filter===t?'var(--bull)':'var(--muted)' }}>
            {t.replace('_',' ')}
          </button>
        ))}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {(['change','price','signal'] as const).map(s => (
            <button key={s} onClick={() => setSort(s)}
              style={{ padding:'3px 8px', fontSize:9, borderRadius:3, cursor:'pointer', fontFamily:'JetBrains Mono,monospace',
                border:`1px solid ${sort===s?'var(--gold)':'var(--border)'}`,
                background:sort===s?'rgba(255,204,0,.1)':'transparent',
                color:sort===s?'var(--gold)':'var(--muted)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table header */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr 1fr 1fr 1.2fr 80px', gap:0, padding:'5px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        {['SYMBOL','NAME','PRICE','CHANGE','MARKET','EMA SIGNAL','ACTION'].map(h => (
          <span key={h} style={{ fontSize:8, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:.8, fontFamily:'JetBrains Mono,monospace' }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {isLoading ? (
          <div style={{ padding:24, textAlign:'center', color:'var(--muted)' }}>Loading markets...</div>
        ) : filtered.map((inst: any) => {
          const isUp   = (inst.changePct||0) >= 0
          const col    = isUp ? 'var(--bull)' : 'var(--bear)'
          const sig    = emaSignals[inst.sym] || inst.emaSignal
          const sigCol = sig?.direction === 'BUY' ? 'var(--bull)' : sig?.direction === 'SELL' ? 'var(--bear)' : 'var(--muted)'
          const mktCol = MKTCOLORS[inst.marketType] || 'var(--muted)'
          const DirIcon = sig?.direction === 'BUY' ? TrendingUp : sig?.direction === 'SELL' ? TrendingDown : Minus

          return (
            <div key={inst.sym}
              onClick={() => goTrading(inst.sym)}
              style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr 1fr 1fr 1fr 1.2fr 80px', gap:0, padding:'7px 12px',
                borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .1s' }}
              onMouseEnter={e => (e.currentTarget as any).style.background = 'var(--card)'}
              onMouseLeave={e => (e.currentTarget as any).style.background = 'transparent'}>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700 }}>{inst.sym}</span>
              <span style={{ fontSize:10, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inst.name}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, color:'var(--text)' }}>${fp(inst.currentPrice)}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:col }}>
                {isUp?'+':''}{(inst.changePct||0).toFixed(2)}%
              </span>
              <span style={{ fontSize:9, color:mktCol, display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:mktCol, display:'inline-block' }}/>
                {inst.marketType?.replace('_',' ')}
              </span>
              {/* EMA Signal */}
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {sig && sig.direction !== 'NEUTRAL' ? (
                  <>
                    <DirIcon size={10} color={sigCol} />
                    <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:9, fontWeight:700, color:sigCol }}>{sig.direction}</span>
                    <span style={{ fontSize:8, color:'var(--muted)' }}>{sig.angle?.toFixed(0)}°</span>
                    {sig.strength != null && (
                      <div style={{ width:30, height:3, background:'var(--border)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${sig.strength}%`, background:sigCol, borderRadius:2 }}/>
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize:8, color:'var(--muted)' }}>SIDEWAYS</span>
                )}
              </div>
              <button onClick={e => { e.stopPropagation(); goTrading(inst.sym) }}
                style={{ padding:'3px 8px', fontSize:9, borderRadius:3, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer', fontFamily:'JetBrains Mono,monospace' }}>
                TRADE
              </button>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ padding:'5px 12px', background:'var(--bg2)', borderTop:'1px solid var(--border)', fontSize:8, color:'var(--muted)', flexShrink:0 }}>
        {filtered.length} instruments · EMA 9/15 strategy · Prices update every second
      </div>
    </div>
  )
}
