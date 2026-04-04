import { useRef, useEffect } from 'react'
import { useSimStore } from '../../store/useSimStore'

const TYPE_COLORS = {
  info: '#94a3b8',
  drone: '#00e5ff',
  survivor: '#00ff88',
  warning: '#ff6b2b',
  critical: '#ff2929',
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function EventLog() {
  const eventLog = useSimStore(s => s.eventLog)
  const containerRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [eventLog.length])

  const recentEvents = eventLog.slice(-50)

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 12px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        lineHeight: 1.7,
      }}
    >
      {recentEvents.map((event, idx) => {
        const color = TYPE_COLORS[event.type] || '#94a3b8'
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '8px',
              opacity: idx < recentEvents.length - 5 ? 0.6 : 1,
              transition: 'opacity 0.3s',
            }}
          >
            <span style={{ color: '#334155', flexShrink: 0 }}>
              [{formatTime(event.time)}]
            </span>
            <span style={{ color }}>
              {event.message}
            </span>
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: '4px', color: '#475569', marginTop: '2px' }}>
        <span className="blink">_</span>
        <span style={{ opacity: 0.5 }}>awaiting next transmission...</span>
      </div>
    </div>
  )
}
