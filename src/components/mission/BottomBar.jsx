import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Crosshair, AlertTriangle, Info, Terminal } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function BottomBar() {
  const eventLog = useSimStore(s => s.eventLog) || []
  const simulationTime = useSimStore(s => s.simulationTime)
  const logEndRef = useRef(null)

  useEffect(() => {
     logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [eventLog])

  return (
    <div style={{
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 280px',
      gap: '20px',
      padding: '12px 20px',
      background: 'transparent',
      fontFamily: 'var(--font-mono)',
      userSelect: 'none',
    }}>
      {/* 1. Terminal Event Log */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        overflow: 'hidden',
      }}>
         <header style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '6px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            paddingBottom: '4px',
         }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
               <Terminal size={12} color="#79B9C1" />
               <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#172124', letterSpacing: '0.08em', fontFamily: 'var(--font-primary)' }}>MISSION LOG</span>
            </div>
            <span style={{ fontSize: '9px', color: '#6C7F84', fontWeight: 600 }}>T+{simulationTime.toFixed(1)}s</span>
         </header>

         <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            paddingRight: '8px',
         }}>
            <AnimatePresence initial={false}>
               {eventLog.map((log, idx) => (
                  <motion.div
                    key={`${log.time}-${idx}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                       fontSize: '9.5px',
                       display: 'flex',
                       gap: '8px',
                       padding: '3px 6px',
                       background: 'rgba(255, 255, 255, 0.65)',
                       borderRadius: '4px',
                       alignItems: 'flex-start',
                    }}
                  >
                     <span style={{ color: '#8A9A9E', minWidth: '40px', fontWeight: 600 }}>[{log.time.toFixed(1)}s]</span>
                     <LogIcon category={log.category} />
                     <span style={{ 
                        color: log.category === 'critical' ? '#dc3545'
                          : log.category === 'survivor' ? '#2e7d5a'
                          : log.category === 'ai' ? '#7c3aed'
                          : log.category === 'failover' ? '#d97706'
                          : '#1F282B',
                        flex: 1,
                        fontWeight: 500,
                     }}>
                        {log.message}
                     </span>
                  </motion.div>
               ))}
            </AnimatePresence>
            <div ref={logEndRef} />
         </div>
      </div>

      {/* 2. Mission Timeline (Upgraded) */}
      <div style={{ 
         display: 'flex', 
         flexDirection: 'column', 
         gap: '6px',
         borderLeft: '1px solid rgba(0, 0, 0, 0.06)',
         paddingLeft: '16px',
      }}>
         <span style={{ fontSize: '9px', color: '#1a565e', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'var(--font-primary)', textTransform: 'uppercase' }}>DEPLOYMENT TIMELINE</span>
         <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '4px 0',
         }}>
            <TimelineStep label="PRE_FLIGHT" time="T-00:00" done />
            <TimelineStep label="SWARM_DEPLOY" time="T+00:15" done />
            <TimelineStep label="CELL_SCAN" time="T+00:45" active />
            <TimelineStep label="ID_SURVIVORS" time="T+02:10" />
            <TimelineStep label="RESCUE_DISPATCH" time="T+05:00" />
         </div>
      </div>
    </div>
  )
}

function LogIcon({ category }) {
   switch (category) {
      case 'survivor': return <Crosshair size={11} color="#58ba8a" style={{ marginTop: '1px' }} />
      case 'warning': return <AlertTriangle size={11} color="#f59e0b" style={{ marginTop: '1px' }} />
      case 'critical': return <ShieldCheck size={11} color="#dc3545" style={{ marginTop: '1px' }} />
      case 'ai': return <Terminal size={11} color="#8b5cf6" style={{ marginTop: '1px' }} />
      case 'failover': return <AlertTriangle size={11} color="#f59e0b" style={{ marginTop: '1px' }} />
      default: return <Info size={11} color="#79B9C1" style={{ marginTop: '1px' }} />
   }
}

function TimelineStep({ label, time, active, done }) {
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: (done || active) ? 1 : 0.4 }}>
         <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ 
               width: 6, 
               height: 6, 
               borderRadius: '50%', 
               background: done ? '#58ba8a' : (active ? '#79B9C1' : '#AAB5B8'),
               boxShadow: active ? '0 0 6px #79B9C1' : 'none'
            }} />
         </div>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
             <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#1F282B', letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>{label}</span>
             <span style={{ fontSize: '7.5px', color: '#6C7F84', fontFamily: 'var(--font-mono)' }}>{time}</span>
         </div>
      </div>
   )
}
