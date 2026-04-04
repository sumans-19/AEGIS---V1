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
      gridTemplateColumns: '1fr 340px',
      gap: '24px',
      padding: '16px 24px',
      background: 'var(--bg-panel)',
      borderTop: '1px solid var(--border-color)',
      fontFamily: 'JetBrains Mono, monospace',
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
            marginBottom: '8px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
            paddingBottom: '4px',
         }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Terminal size={14} color="#00e5ff" />
               <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '2px' }}>MISSION_LOG</span>
            </div>
            <span style={{ fontSize: '10px', color: '#475569' }}>SESSION_T+{simulationTime.toFixed(1)}s</span>
         </header>

         <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingRight: '12px',
         }}>
            <AnimatePresence initial={false}>
               {eventLog.map((log, idx) => (
                  <motion.div
                    key={`${log.time}-${idx}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                       fontSize: '11px',
                       display: 'flex',
                       gap: '12px',
                       padding: '4px 8px',
                       background: 'rgba(255,255,255,0.01)',
                       alignItems: 'flex-start',
                    }}
                  >
                     <span style={{ color: '#475569', minWidth: '45px' }}>[{log.time.toFixed(1)}s]</span>
                     <LogIcon category={log.category} />
                     <span style={{ 
                        color: log.category === 'critical' ? '#ff2929' : (log.category === 'survivor' ? '#00ff88' : '#e2e8f0'),
                        flex: 1,
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
         gap: '12px',
         borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
         paddingLeft: '24px',
      }}>
         <span style={{ fontSize: '11px', color: '#00e5ff', fontWeight: 600, letterSpacing: '2px' }}>DEPLO_TIMELINE</span>
         <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '8px 0',
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
      case 'survivor': return <Crosshair size={12} color="#00ff88" style={{ marginTop: '2px' }} />
      case 'warning': return <AlertTriangle size={12} color="#ffb300" style={{ marginTop: '2px' }} />
      case 'critical': return <ShieldCheck size={12} color="#ff2929" style={{ marginTop: '2px' }} />
      default: return <Info size={12} color="#00e5ff" style={{ marginTop: '2px' }} />
   }
}

function TimelineStep({ label, time, active, done }) {
   return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', opacity: (done || active) ? 1 : 0.3 }}>
         <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ 
               width: 10, 
               height: 10, 
               borderRadius: '50%', 
               background: done ? '#00ff88' : (active ? '#00e5ff' : '#475569'),
               boxShadow: active ? '0 0 10px #00e5ff' : 'none'
            }} />
         </div>
         <div style={{ display: 'flex', flexDirection: 'column' }}>
             <span style={{ fontSize: '10px', fontWeight: 600, color: '#e2e8f0', letterSpacing: '1px' }}>{label}</span>
             <span style={{ fontSize: '9px', color: '#64748b' }}>{time}</span>
         </div>
      </div>
   )
}
