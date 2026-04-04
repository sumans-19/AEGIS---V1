import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useSimStore } from './store/useSimStore'
import { useBackend } from './hooks/useBackend'
import Landing from './pages/Landing'
import Mission from './pages/Mission'

export default function App() {
  const theme = useSimStore(s => s.theme)
  useBackend() // Initialize WebSocket connection

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/mission" element={<Mission />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}
