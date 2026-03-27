import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/layout/Layout'
import Notifications from './components/common/Notifications'
import { useWebSocket } from './hooks/useWebSocket'
import TradingPage from './pages/TradingPage'
import MarketsPage from './pages/MarketsPage'
import SignalsPage from './pages/SignalsPage'
import OptionChainPage from './pages/OptionChainPage'
import { PortfolioPage, HistoryPage, AnalyticsPage, RiskPage, HeatmapPage, IndiaPage, ChartLabPage, SettingsPage } from './pages/OtherPages'

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 2 } } })

function AppInner() {
  useWebSocket()
  return (
    <Layout>
      <Routes>
        <Route path="/"            element={<Navigate to="/trading" replace />} />
        <Route path="/trading"     element={<TradingPage />} />
        <Route path="/trading/:sym" element={<TradingPage />} />
        <Route path="/markets"     element={<MarketsPage />} />
        <Route path="/signals"     element={<SignalsPage />} />
        <Route path="/heatmap"     element={<HeatmapPage />} />
        <Route path="/portfolio"   element={<PortfolioPage />} />
        <Route path="/history"     element={<HistoryPage />} />
        <Route path="/analytics"   element={<AnalyticsPage />} />
        <Route path="/risk"        element={<RiskPage />} />
        <Route path="/chartlab"    element={<ChartLabPage />} />
        <Route path="/india"       element={<IndiaPage />} />
        <Route path="/options"     element={<OptionChainPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
        <Route path="*"            element={<Navigate to="/trading" replace />} />
      </Routes>
      <Notifications />
    </Layout>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
