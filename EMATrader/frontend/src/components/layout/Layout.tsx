import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import { fm, fpct } from '../../services/api'
import {
  BarChart2, TrendingUp, Activity, Briefcase, Clock,
  PieChart, Shield, FlaskConical, Flag, GitBranch, Settings, Wifi, WifiOff
} from 'lucide-react'

const NAV = [
  { to: '/trading',      icon: TrendingUp,   label: 'Trading'      },
  { to: '/markets',      icon: BarChart2,     label: 'Markets'      },
  { to: '/signals',      icon: Activity,      label: 'EMA Signals'  },
  { to: '/heatmap',      icon: PieChart,      label: 'Heat Map'     },
  { to: '/portfolio',    icon: Briefcase,     label: 'Portfolio'    },
  { to: '/history',      icon: Clock,         label: 'History'      },
  { to: '/analytics',    icon: GitBranch,     label: 'Analytics'    },
  { to: '/risk',         icon: Shield,        label: 'Risk'         },
  { to: '/chartlab',     icon: FlaskConical,  label: 'Chart Lab'    },
  { to: '/india',        icon: Flag,          label: 'IN India'     },
  { to: '/options',      icon: Activity,      label: 'Option Chain' },
  { to: '/settings',     icon: Settings,      label: 'Settings'     },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { metrics, wsConnected, openPositions, selectedSymbol, prices } = useStore()
  const equity  = metrics?.totalEquity ?? 100000
  const dayPnl  = metrics?.dayPnl ?? 0
  const retPct  = metrics?.totalReturnPct ?? 0
  const pd      = prices[selectedSymbol]

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden', background:'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{ width:52, background:'var(--bg2)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', padding:'8px 0', gap:2, flexShrink:0, zIndex:10 }}>
        {/* Logo */}
        <div style={{ width:36, height:36, borderRadius:6, background:'rgba(0,255,136,.1)', border:'1px solid rgba(0,255,136,.3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, flexShrink:0 }}>
          <TrendingUp size={18} color="var(--bull)" />
        </div>

        {/* Nav links */}
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} title={label}
            style={({ isActive }) => ({
              width: 36, height: 36, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center',
              color: isActive ? 'var(--bull)' : 'var(--muted)',
              background: isActive ? 'rgba(0,255,136,.08)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(0,255,136,.2)' : 'transparent'}`,
              transition: 'all .15s', textDecoration:'none',
            })}>
            <Icon size={15} />
          </NavLink>
        ))}

        {/* WS status at bottom */}
        <div style={{ marginTop:'auto', marginBottom:4 }}>
          {wsConnected
            ? <Wifi size={13} color="var(--bull)" />
            : <WifiOff size={13} color="var(--bear)" />
          }
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {/* Top bar */}
        <header style={{ height:38, background:'var(--bg2)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:0, padding:'0 12px', flexShrink:0 }}>
          {/* Brand */}
          <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:'var(--bull)', letterSpacing:1, marginRight:16 }}>EMA TRADER</span>
          <span style={{ fontSize:9, color:'var(--muted)', marginRight:20, fontFamily:'JetBrains Mono,monospace' }}>EMA 9/15 · 30° Strategy</span>

          {/* Equity */}
          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginRight:16 }}>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:16, fontWeight:700, color: retPct >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              ${Math.round(equity).toLocaleString()}
            </span>
            <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:10, color: retPct >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              {retPct >= 0 ? '+' : ''}{retPct?.toFixed(2)}%
            </span>
          </div>

          {/* Metrics strip */}
          {[
            { label:'DAY P&L',   val: fm(dayPnl),                               col: dayPnl >= 0 ? 'var(--bull)' : 'var(--bear)' },
            { label:'WIN RATE',  val: metrics ? `${metrics.winRate?.toFixed(0) ?? 0}%` : '—', col:'var(--gold)' },
            { label:'SHARPE',    val: metrics?.sharpeRatio?.toFixed(2) ?? '—',  col:'var(--blue)' },
            { label:'DRAWDOWN',  val: metrics ? `${metrics.maxDrawdown?.toFixed(1) ?? 0}%` : '—', col:'var(--bear)' },
            { label:'POSITIONS', val: String(openPositions?.length ?? 0),        col:'var(--gold)' },
          ].map(({ label, val, col }) => (
            <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0 10px', borderLeft:'1px solid var(--border)' }}>
              <span style={{ fontSize:7, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.8px' }}>{label}</span>
              <span style={{ fontFamily:'JetBrains Mono,monospace', fontSize:11, fontWeight:700, color:col }}>{val}</span>
            </div>
          ))}

          {/* WS + Live indicator */}
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            <div className={wsConnected ? 'pulse-dot' : ''} style={{ width:6, height:6, borderRadius:'50%', background: wsConnected ? 'var(--bull)' : 'var(--bear)' }} />
            <span style={{ fontSize:8, color: wsConnected ? 'var(--bull)' : 'var(--bear)', fontFamily:'JetBrains Mono,monospace' }}>{wsConnected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex:1, overflow:'hidden', minHeight:0 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
