import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Bell, MapPin, Users, Rocket, Search, Flag, 
  RotateCcw, CheckCircle2, Info, AlertTriangle, 
  Crosshair, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

const PHASE_STEPS = [
  { phase: 'IDLE', label: 'Initialize', icon: Info },
  { phase: 'SELECT_REGION', label: 'Select Region', icon: MapPin },
  { phase: 'SEED_SURVIVORS', label: 'Place Survivors', icon: Users },
  { phase: 'DEPLOYING', label: 'Deploy Drones', icon: Rocket },
  { phase: 'SEARCHING', label: 'Search Operation', icon: Search },
  { phase: 'ALL_FOUND', label: 'All Detected', icon: Flag },
  { phase: 'RETURNING', label: 'Return to Base', icon: RotateCcw },
  { phase: 'COMPLETED', label: 'Mission Complete', icon: CheckCircle2 },
]

const PHASE_ORDER = PHASE_STEPS.map(s => s.phase)

function getTypeColor(type) {
  switch (type) {
    case 'success': return '#00ff88'
    case 'detection': return '#ffb300'
    case 'warning': return '#ff6b2b'
    case 'critical': return '#ff2929'
    case 'error': return '#ff2929'
    case 'guide': return '#00e5ff'
    case 'system': return '#a855f7'
    default: return '#94a3b8'
  }
}

function getTypeIcon(type) {
  switch (type) {
    case 'success': return <CheckCircle2 size={11} />
    case 'detection': return <Crosshair size={11} />
    case 'warning': return <AlertTriangle size={11} />
    case 'critical': return <AlertTriangle size={11} />
    case 'guide': return <Sparkles size={11} />
    default: return <Info size={11} />
  }
}

export default function NotificationPanel() {
  const notifications = useSimStore(s => s.notifications)
  const missionPhase = useSimStore(s => s.missionPhase)
  const survivors = useSimStore(s => s.survivors)
  const logEndRef = useRef(null)
  const [collapsed, setCollapsed] = useState(false)

  const seededCount = survivors.filter(s => String(s.id).startsWith('SURV-')).length
  const detectedCount = survivors.filter(s => String(s.id).startsWith('SURV-') && (s.detected || s.status === 'DETECTED')).length

  useEffect(() => {
    if (!collapsed) logEndRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [notifications, collapsed])

  const currentIdx = PHASE_ORDER.indexOf(missionPhase)
  // Only show last 8 notifications to keep compact
  const visibleNotifications = notifications.slice(-8)

  return (
    <div style={{
      width: '100%',
      height: '180px',
      background: 'var(--bg-panel, #0a0a0f)',
      display: 'grid',
      gridTemplateColumns: 'minmax(300px, 1fr) 340px',
      gap: '24px',
      padding: '16px 24px',
      overflow: 'hidden',
    }}>
      {/* LEFT COL: Notifications Log */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid rgba(0, 229, 255, 0.1)',
          paddingBottom: '8px',
        }}>
          <Bell size={14} color="#00e5ff" />
          <span style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: '#e2e8f0',
          }}>
            MISSION LOG
          </span>
        </div>
        
        {/* Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '12px',
        }}>
          <AnimatePresence initial={false}>
            {visibleNotifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255,255,255,0.015)',
                  borderLeft: `2px solid ${getTypeColor(notif.type)}`,
                }}
              >
                <span style={{ color: getTypeColor(notif.type), marginTop: '2px', flexShrink: 0 }}>
                  {getTypeIcon(notif.type)}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono',
                  fontSize: '11px',
                  color: '#cbd5e1',
                  lineHeight: '1.4',
                }}>
                  {notif.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={logEndRef} />
        </div>
      </div>

      {/* RIGHT COL: Mission Progress Steps */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
        paddingLeft: '24px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}>
          <span style={{ fontSize: '11px', color: '#00e5ff', fontWeight: 600, letterSpacing: '2px', fontFamily: 'JetBrains Mono' }}>
            MISSION_PROGRESS
          </span>
          {seededCount > 0 && (
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '10px',
              color: detectedCount === seededCount ? '#00ff88' : '#ffb300',
              background: detectedCount === seededCount ? 'rgba(0,255,136,0.1)' : 'rgba(255,179,0,0.1)',
              padding: '2px 8px',
              borderRadius: '8px',
            }}>
              {detectedCount}/{seededCount} FOUND
            </span>
          )}
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '4px 0',
        }}>
          {PHASE_STEPS.map((step, idx) => {
            if (idx % 2 !== 0 && idx !== PHASE_STEPS.length - 1) return null; // Skip some steps for compactness if needed, or render all compactly
            
            const isComplete = idx < currentIdx
            const isCurrent = step.phase === missionPhase
            return (
              <div key={step.phase} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: (isComplete || isCurrent) ? 1 : 0.3 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    width: 8, height: 8, borderRadius: '50%', 
                    background: isComplete ? '#00ff88' : (isCurrent ? '#00e5ff' : '#475569'),
                    boxShadow: isCurrent ? '0 0 10px #00e5ff' : 'none'
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: isCurrent ? '#00e5ff' : '#e2e8f0', letterSpacing: '1px', fontFamily: 'JetBrains Mono' }}>
                    {step.label.toUpperCase()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
