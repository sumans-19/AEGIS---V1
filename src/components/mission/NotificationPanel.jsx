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
    case 'success': return '#58ba8a'
    case 'detection': return '#f59e0b'
    case 'warning': return '#D4A844'
    case 'error': return '#dc3545'
    case 'guide': return '#79B9C1'
    case 'system': return '#8b5cf6'
    default: return '#6C7F84'
  }
}

function getTypeIcon(type) {
  switch (type) {
    case 'success': return <CheckCircle2 size={11} />
    case 'detection': return <Crosshair size={11} />
    case 'warning': return <AlertTriangle size={11} />
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
    if (!collapsed) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notifications, collapsed])

  const currentIdx = PHASE_ORDER.indexOf(missionPhase)

  return (
    <div style={{
      width: '100%',
      height: '170px',
      background: 'transparent',
      display: 'grid',
      gridTemplateColumns: 'minmax(300px, 1fr) 300px',
      gap: '20px',
      padding: '12px 20px',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* LEFT COL: Notifications Log */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          paddingBottom: '4px',
        }}>
          <Bell size={12} color="#79B9C1" />
          <span style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#172124',
            textTransform: 'uppercase',
          }}>
            MISSION EVENT LOG
          </span>
        </div>
        
        {/* Feed */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          paddingRight: '8px',
        }}>
          <AnimatePresence initial={false}>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.7)',
                  borderLeft: `2.5px solid ${getTypeColor(notif.type)}`,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
                }}
              >
                <span style={{ color: getTypeColor(notif.type), marginTop: '1px', flexShrink: 0 }}>
                  {getTypeIcon(notif.type)}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9.5px',
                  color: '#1F282B',
                  lineHeight: '1.35',
                  fontWeight: 500,
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
        gap: '4px',
        borderLeft: '1px solid rgba(0, 0, 0, 0.06)',
        paddingLeft: '16px',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2px',
        }}>
          <span style={{ fontSize: '9px', color: '#1a565e', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'var(--font-primary)', textTransform: 'uppercase' }}>
            MISSION PROGRESS
          </span>
          {seededCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '8px',
              fontWeight: 800,
              color: detectedCount === seededCount ? '#2e7d5a' : '#92610d',
              background: detectedCount === seededCount ? 'rgba(88, 186, 138, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              padding: '2px 6px',
              borderRadius: '4px',
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
          padding: '2px 0',
        }}>
          {PHASE_STEPS.map((step, idx) => {
            if (idx % 2 !== 0 && idx !== PHASE_STEPS.length - 1) return null;
            
            const isComplete = idx < currentIdx
            const isCurrent = step.phase === missionPhase
            return (
              <div key={step.phase} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: (isComplete || isCurrent) ? 1 : 0.4 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ 
                    width: 6, height: 6, borderRadius: '50%', 
                    background: isComplete ? '#58ba8a' : (isCurrent ? '#79B9C1' : '#AAB5B8'),
                    boxShadow: isCurrent ? '0 0 6px #79B9C1' : 'none'
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '8.5px', fontWeight: 700, color: isCurrent ? '#1a565e' : '#55666B', letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>
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
