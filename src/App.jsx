import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSimStore } from './store/useSimStore'
import { useBackend } from './hooks/useBackend'
import MasterDashboard from './pages/MasterDashboard'

export default function App() {
  const theme = useSimStore(s => s.theme)
  useBackend() // Initialize WebSocket connection

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'light')
  }, [theme])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MasterDashboard />} />
        <Route path="/mission" element={<MasterDashboard />} />
        <Route path="/ai-dashboard" element={<MasterDashboard />} />
        <Route path="/disasters" element={<MasterDashboard />} />
        <Route path="/drone-inspection" element={<MasterDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
