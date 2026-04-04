import { useEffect, useRef, useState, useCallback } from 'react'
import { useSimStore } from '../store/useSimStore'

export const useBackend = () => {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [latency, setLatency] = useState(0)
  
  const applyState = useSimStore(s => s.applyBackendState)
  const scenario = useSimStore(s => s.scenario)

  // Memoize send command so it doesn't trigger re-renders
  const sendCommand = useCallback((action, payload = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'command', action, ...payload }))
    }
  }, [])

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket('ws://localhost:8000/ws')
      
      ws.onopen = () => {
        setConnected(true)
        useSimStore.setState({ backendConnected: true })
        console.log('%c[AEGIS SYSTEM] BACKEND CONNECTED', 'color: #00e5ff; font-weight: bold')
        // Automatically start current scenario in backend on connect
        ws.send(JSON.stringify({ 
           type: 'command', 
           action: 'start_simulation', 
           scenario: scenario 
        }))
      }
      
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'state') {
            applyState(msg)
          }
        } catch (err) {
          console.error("Message error:", err)
        }
      }
      
      ws.onclose = () => {
        setConnected(false)
        useSimStore.setState({ backendConnected: false })
        console.warn('[AEGIS SYSTEM] BACKEND DISCONNECTED. RECONNECTING...')
        setTimeout(connect, 3000)
      }
      
      socketRef.current = ws
    }
    
    connect()
    return () => socketRef.current?.close()
  }, [applyState, scenario])

  return { connected, sendCommand, latency }
}
