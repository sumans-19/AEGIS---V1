import { motion, AnimatePresence } from 'framer-motion'
import { Activity, AlertTriangle, ShieldCheck, DownloadCloud, HardDrive, Map, Database, CheckCircle2, Search, UserCheck } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function RecoveryMonitoringPanel({ activeEdgeCase }) {
  const edgeCaseStep = useSimStore(s => s.edgeCaseStep)

  if (activeEdgeCase !== 'drone_failure') return null

  // Map steps to specific panel states
  let title = "SYSTEM NOMINAL"
  let subtitle = "MONITORING ACTIVE NODE"
  let icon = <Activity size={24} />
  let color = "#94a3b8"
  let bg = "rgba(255,255,255,0.05)"
  let logs = []

  if (edgeCaseStep === 1) {
    title = "SEARCH OPERATION"
    subtitle = "SCANNING TERRAIN"
    logs = ["> Search Mission Started", "> Drone statuses = Active", "> Current scan progress: 12%"]
  } else if (edgeCaseStep === 2) {
    title = "DETECTION ALERT"
    subtitle = "TARGET ACQUIRED"
    icon = <UserCheck size={24} />
    color = "#a855f7"
    bg = "rgba(168, 85, 247, 0.1)"
    logs = ["> Survivor detected by Drone 3", "> Terrain segment updated", "> Logging coordinates..."]
  } else if (edgeCaseStep === 3) {
    title = "EMERGENCY RECOVERY"
    subtitle = "DRONE 3 HARDWARE FAULT"
    icon = <AlertTriangle size={24} />
    color = "#f43f5e"
    bg = "rgba(244, 63, 94, 0.1)"
    logs = ["> Critical Failure Detected", "> Drone status: Active → Critical State", "> Halting exploration protocol"]
  } else if (edgeCaseStep === 4) {
    title = "DATA TRANSFER"
    subtitle = "SYNC IN PROGRESS"
    icon = <DownloadCloud size={24} />
    color = "#f59e0b"
    bg = "rgba(245, 158, 11, 0.1)"
    logs = [
      "> Emergency synchronization initiated", 
      "> Nearest drone selected (Drone 4)", 
      "> Transferring collected intelligence..."
    ]
  } else if (edgeCaseStep === 5) {
    title = "DATA MERGE"
    subtitle = "INTEGRATING INTELLIGENCE"
    icon = <Database size={24} />
    color = "#3b82f6"
    bg = "rgba(59, 130, 246, 0.1)"
    logs = ["> Map Merged", "> Combined exploration region created", "> Survivor markers handed over"]
  } else if (edgeCaseStep === 6) {
    title = "REASSIGNMENT"
    subtitle = "HANDOVER COMPLETE"
    icon = <ShieldCheck size={24} />
    color = "#10b981"
    bg = "rgba(16, 185, 129, 0.1)"
    logs = ["> Transfer Successful", "> Drone 3 Offline", "> Mission Reassigned to Drone 4"]
  } else if (edgeCaseStep === 7) {
    title = "MISSION CONTINUATION"
    subtitle = "FAULT TOLERANT EDGE"
    icon = <CheckCircle2 size={24} />
    color = "#00e5ff"
    bg = "rgba(0, 229, 255, 0.1)"
    logs = [
      "> Mission completed successfully", 
      "> No rescue data lost", 
      "> Fault-tolerant edge coordination successful"
    ]
  }

  const showTransferBars = edgeCaseStep >= 4

  return (
    <motion.div
      key={`step-${edgeCaseStep}`}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      drag
      dragMomentum={false}
      style={{
        position: 'absolute',
        top: '80px',
        right: '24px',
        width: '380px',
        background: 'rgba(5, 9, 15, 0.95)',
        border: `1px solid ${color}`,
        borderRadius: '8px',
        padding: '20px',
        boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${bg}`,
        fontFamily: 'JetBrains Mono, monospace',
        zIndex: 9000,
        backdropFilter: 'blur(10px)',
        cursor: 'grab',
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
        <div style={{ padding: '10px', background: bg, color: color, borderRadius: '8px' }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '1px' }}>
            {title}
          </div>
          <div style={{ fontSize: '11px', color: color }}>
            {subtitle}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Transfer Visualization */}
        {showTransferBars && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '6px', border: `1px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: edgeCaseStep >= 6 ? '#475569' : '#f43f5e' }}>
               <HardDrive size={16} />
               <span style={{ fontSize: '12px' }}>SRC: DRONE-3</span>
            </div>
            
            {edgeCaseStep === 4 ? (
               <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                 <DownloadCloud size={18} color="#f59e0b" />
               </motion.div>
            ) : edgeCaseStep >= 5 ? (
               <CheckCircle2 size={18} color="#10b981" />
            ) : null}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00e5ff' }}>
               <span style={{ fontSize: '12px' }}>DEST: DRONE-4</span>
               <HardDrive size={16} />
            </div>
          </div>
        )}

        {/* Data Bars */}
        {showTransferBars && (
          <>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Map size={12}/> TERRAIN MAP DATA</div>
                <div>{edgeCaseStep === 4 ? 'SYNCING...' : '482.0 / 482.0 MB'}</div>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: edgeCaseStep === 4 ? '0%' : '100%' }}
                  animate={{ width: edgeCaseStep === 4 ? '60%' : '100%' }}
                  transition={{ duration: edgeCaseStep === 4 ? 2 : 0.5 }}
                  style={{ height: '100%', background: '#00e5ff' }} 
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '10px', color: '#94a3b8' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Database size={12}/> SURVIVOR METADATA</div>
                <div>{edgeCaseStep === 4 ? 'SYNCING...' : '14 / 14 ENTRIES'}</div>
              </div>
              <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: edgeCaseStep === 4 ? '0%' : '100%' }}
                  animate={{ width: edgeCaseStep === 4 ? '40%' : '100%' }}
                  transition={{ duration: edgeCaseStep === 4 ? 2.5 : 0.5 }}
                  style={{ height: '100%', background: '#a855f7' }} 
                />
              </div>
            </div>
          </>
        )}

        {/* Event Logs */}
        <div style={{ 
          marginTop: '8px', 
          background: bg, 
          borderLeft: `2px solid ${color}`,
          padding: '12px',
          fontSize: '11px',
          color: '#e2e8f0',
          lineHeight: 1.6,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {logs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
                style={{ color: i === 0 ? color : '#94a3b8' }}
              >
                {log}
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  )
}
