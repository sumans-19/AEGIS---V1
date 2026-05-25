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
    <>
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

      <Drone3MapPanel step={edgeCaseStep} />
      <Drone4MapPanel step={edgeCaseStep} />
    </>
  )
}

function Drone3MapPanel({ step }) {
  // Only show before step 5
  if (step >= 5) return null

  const isFailed = step >= 3
  const isSyncing = step === 4
  const hasSurvivor = step >= 2

  let badgeText = "SCANNING"
  let badgeColor = "#3b82f6"
  let borderColor = "rgba(59, 130, 246, 0.4)"
  let glowColor = "rgba(59, 130, 246, 0.15)"

  if (isFailed) {
    badgeText = "FAILED"
    badgeColor = "#f43f5e"
    borderColor = "rgba(244, 63, 94, 0.5)"
    glowColor = "rgba(244, 63, 94, 0.25)"
  }
  if (isSyncing) {
    badgeText = "SYNCING"
    badgeColor = "#f59e0b"
    borderColor = "rgba(245, 158, 11, 0.6)"
    glowColor = "rgba(245, 158, 11, 0.3)"
  }

  // Telemetry details based on status
  const altText = step >= 6 ? "0.0 m" : "25.0 m"
  const spdText = isFailed ? "0.0 m/s" : "4.2 m/s"
  const latText = "34.0532° N"
  const lonText = "118.2421° W"

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      style={{
        position: 'absolute',
        top: '80px',
        left: '24px',
        width: '260px',
        background: 'rgba(5, 9, 15, 0.92)',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '16px',
        boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${glowColor}`,
        fontFamily: 'JetBrains Mono, monospace',
        zIndex: 9000,
        backdropFilter: 'blur(10px)',
        cursor: 'grab',
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '0.5px' }}>
          DRONE 3: ACTIVE SEARCH
        </span>
        <span style={{
          fontSize: '9px',
          padding: '2px 6px',
          background: `${badgeColor}20`,
          border: `1px solid ${badgeColor}`,
          color: badgeColor,
          borderRadius: '4px',
          fontWeight: 'bold'
        }}>
          {badgeText}
        </span>
      </div>

      {/* SVG Map Container */}
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
        height: '140px'
      }}>
        <RadarStyles />
        <svg width="100%" height="100%" viewBox="0 0 220 140" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="d3-scan-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Tactical Grid Background */}
          <GridBackground />

          {/* Topographical Contour Lines */}
          <ContourLines />

          {/* Scanned Area Shading (Left side) */}
          <rect x="0" y="0" width="88" height="140" fill="url(#d3-scan-grad)" />

          {/* Flight Search Trajectory Path */}
          <path
            d="M 15,120 L 15,25 L 45,25 L 45,120 L 75,120 L 75,45"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            opacity={isFailed ? 0.6 : 0.9}
          />

          {/* Scanline Sweep Animation */}
          {!isFailed && (
            <line
              x1="5" y1="0" x2="5" y2="140"
              stroke="#f43f5e"
              strokeWidth="1.5"
              opacity="0.5"
              style={{ animation: 'scanner-sweep 3s infinite ease-in-out' }}
            />
          )}

          {/* Survivor Ping (Step 2+) */}
          {hasSurvivor && (
            <g transform="translate(45, 75)">
              <circle r="6" fill="none" stroke="#00ff88" strokeWidth="1.5" />
              <circle r="12" fill="none" stroke="#00ff88" className="radar-ping-circle" />
              <line x1="-10" y1="0" x2="10" y2="0" stroke="#00ff88" strokeWidth="0.8" />
              <line x1="0" y1="-10" x2="0" y2="10" stroke="#00ff88" strokeWidth="0.8" />
              <text x="12" y="3" fill="#00ff88" fontSize="8" fontWeight="bold">SV-01 (94%)</text>
            </g>
          )}

          {/* Drone Position Pointer */}
          {isFailed ? (
            // Drone Hardware Fault Marker
            <g transform="translate(75, 45)">
              <circle r="6" fill="rgba(244, 63, 94, 0.2)" stroke="#f43f5e" strokeWidth="1" />
              <line x1="-4" y1="-4" x2="4" y2="4" stroke="#f43f5e" strokeWidth="1.5" />
              <line x1="4" y1="-4" x2="-4" y2="4" stroke="#f43f5e" strokeWidth="1.5" />
              <text x="-35" y="-10" fill="#f43f5e" fontSize="7" fontWeight="bold">FAULT: MTR4</text>
            </g>
          ) : (
            // Active Drone Cursor
            <g transform="translate(75, 45)">
              <polygon points="0,-6 5,5 -5,5" fill="#3b82f6" stroke="#fff" strokeWidth="0.8" />
              <circle r="8" fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.8" />
            </g>
          )}
        </svg>
      </div>

      {/* Telemetry Readout Box */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '12px',
        fontSize: '9px',
        color: '#94a3b8',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: '10px',
        lineHeight: '1.5'
      }}>
        <div>
          <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px' }}>TELEMETRY</div>
          <div>ALT: {altText}</div>
          <div>SPD: {spdText}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px' }}>COORDINATES</div>
          <div>{latText}</div>
          <div>{lonText}</div>
        </div>
      </div>
    </motion.div>
  )
}

function Drone4MapPanel({ step }) {
  const isMerged = step >= 5
  const isMerging = step === 5
  const isSyncing = step === 4
  const hasContinuation = step === 7

  let title = isMerged ? "DRONE 4: MERGED RADAR" : "DRONE 4: ACTIVE SEARCH"
  let badgeText = isMerged ? (isMerging ? "MERGING" : "MERGED") : (isSyncing ? "SYNCING" : "SCANNING")
  let badgeColor = isMerged ? (isMerging ? "#3b82f6" : "#10b981") : (isSyncing ? "#f59e0b" : "#00e5ff")
  let borderColor = isMerged ? (isMerging ? "rgba(59, 130, 246, 0.5)" : "rgba(16, 185, 129, 0.5)") : `rgba(0, 229, 255, 0.4)`
  let glowColor = isMerged ? (isMerging ? "rgba(59, 130, 246, 0.25)" : "rgba(16, 185, 129, 0.25)") : `rgba(0, 229, 255, 0.15)`

  const coverage = hasContinuation ? "84%" : (isMerged ? "68%" : "32%")
  const dronePos = hasContinuation ? { x: 105, y: 120 } : { x: 155, y: 45 }

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, x: -20 }}
      animate={{ 
        opacity: 1, 
        x: 0,
        y: isMerged ? -280 : 0
      }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      style={{
        position: 'absolute',
        top: '360px',
        left: '24px',
        width: '260px',
        background: 'rgba(5, 9, 15, 0.92)',
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        padding: '16px',
        boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${glowColor}`,
        fontFamily: 'JetBrains Mono, monospace',
        zIndex: 9000,
        backdropFilter: 'blur(10px)',
        cursor: 'grab',
      }}
      whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#e2e8f0', letterSpacing: '0.5px' }}>
          {title}
        </span>
        <span style={{
          fontSize: '9px',
          padding: '2px 6px',
          background: `${badgeColor}20`,
          border: `1px solid ${badgeColor}`,
          color: badgeColor,
          borderRadius: '4px',
          fontWeight: 'bold'
        }}>
          {badgeText}
        </span>
      </div>

      {/* SVG Map Container */}
      <div style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
        height: '140px'
      }}>
        <svg width="100%" height="100%" viewBox="0 0 220 140" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="d4-scan-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="d4-merged-left" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="d4-continuation-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.0" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Background */}
          <GridBackground />

          {/* Topo Lines */}
          <ContourLines />

          {/* Drone 4's Scanned Area Shading (Right side) */}
          <rect x="132" y="0" width="88" height="140" fill="url(#d4-scan-grad)" />

          {/* Drone 3's Scanned Area (Merged in step 5+) */}
          {isMerged && (
            <rect x="0" y="0" width="88" height="140" fill="url(#d4-merged-left)" />
          )}

          {/* Middle scan continuation (Step 7 only) */}
          {hasContinuation && (
            <rect x="88" y="0" width="44" height="140" fill="url(#d4-continuation-grad)" />
          )}

          {/* Sweeper animations */}
          {isMerging ? (
            // Scanning wave for merge phase
            <line
              x1="0" y1="0" x2="0" y2="140"
              stroke="#3b82f6"
              strokeWidth="2"
              opacity="0.7"
              style={{ animation: 'scanner-sweep-merged 2.5s infinite ease-in-out' }}
            />
          ) : isMerged ? (
            // Full radar sweep scanner line
            <line
              x1="0" y1="0" x2="0" y2="140"
              stroke="#10b981"
              strokeWidth="1.2"
              opacity="0.5"
              style={{ animation: 'scanner-sweep-merged 5s infinite ease-in-out' }}
            />
          ) : (
            // Normal scan sweep
            <line
              x1="135" y1="0" x2="135" y2="140"
              stroke="#00e5ff"
              strokeWidth="1.2"
              opacity="0.5"
              style={{ animation: 'scanner-sweep-d4 3s infinite ease-in-out' }}
            />
          )}

          {/* Trajectories */}
          {/* Synced historical trajectory from Drone 3 (Step 5+) */}
          {isMerged && (
            <path
              d="M 15,120 L 15,25 L 45,25 L 45,120 L 75,120 L 75,45"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.2"
              strokeDasharray="2,2"
              opacity="0.35"
            />
          )}

          {/* Drone 4 active trajectory path */}
          <path
            d={hasContinuation 
              ? "M 205,120 L 205,25 L 180,25 L 180,120 L 155,120 L 155,45 L 105,45 L 105,120"
              : "M 205,120 L 205,25 L 180,25 L 180,120 L 155,120 L 155,45"
            }
            fill="none"
            stroke="#00e5ff"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            opacity="0.9"
          />

          {/* Synced Target Ping (Step 5+) */}
          {isMerged && (
            <g transform="translate(45, 75)">
              <circle r="5" fill="none" stroke="#00ff88" strokeWidth="1.2" />
              <circle r="10" fill="none" stroke="#00ff88" className="radar-ping-circle" />
              <line x1="-8" y1="0" x2="8" y2="0" stroke="#00ff88" strokeWidth="0.6" />
              <line x1="0" y1="-8" x2="0" y2="8" stroke="#00ff88" strokeWidth="0.6" />
              <text x="10" y="3" fill="#00ff88" fontSize="7" fontWeight="bold">SV-01 SYNCED</text>
            </g>
          )}

          {/* Drone 4 Position Cursor */}
          <g transform={`translate(${dronePos.x}, ${dronePos.y})`}>
            <polygon points="0,-6 5,5 -5,5" fill="#00e5ff" stroke="#fff" strokeWidth="0.8" />
            <circle r="8" fill="none" stroke="#00e5ff" strokeWidth="0.5" opacity="0.8" />
          </g>
        </svg>
      </div>

      {/* Telemetry Readout Box */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '12px',
        fontSize: '9px',
        color: '#94a3b8',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        paddingTop: '10px',
        lineHeight: '1.5'
      }}>
        <div>
          <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px' }}>TELEMETRY</div>
          <div>ALT: 25.0 m</div>
          <div>SPD: 4.5 m/s</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px' }}>COVERAGE INFO</div>
          <div>SCAN AREA: {coverage}</div>
          <div>GRID: SEC-B4</div>
        </div>
      </div>
    </motion.div>
  )
}

// Utility SVGs & Styles
const RadarStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    @keyframes radar-ping {
      0% { r: 3px; opacity: 1; stroke-width: 1px; }
      100% { r: 12px; opacity: 0; stroke-width: 0.5px; }
    }
    @keyframes scanner-sweep {
      0% { x1: 5; x2: 5; }
      50% { x1: 85; x2: 85; }
      100% { x1: 5; x2: 5; }
    }
    @keyframes scanner-sweep-d4 {
      0% { x1: 135; x2: 135; }
      50% { x1: 215; x2: 215; }
      100% { x1: 135; x2: 135; }
    }
    @keyframes scanner-sweep-merged {
      0% { x1: 5; x2: 5; }
      50% { x1: 215; x2: 215; }
      100% { x1: 5; x2: 5; }
    }
    .radar-ping-circle {
      animation: radar-ping 1.8s infinite ease-out;
    }
  `}} />
)

const GridBackground = () => (
  <>
    {/* Border */}
    <rect x="0" y="0" width="220" height="140" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
    {/* Grid lines */}
    <line x1="0" y1="28" x2="220" y2="28" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="0" y1="56" x2="220" y2="56" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="0" y1="84" x2="220" y2="84" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="0" y1="112" x2="220" y2="112" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="44" y1="0" x2="44" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="88" y1="0" x2="88" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="132" y1="0" x2="132" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
    <line x1="176" y1="0" x2="176" y2="140" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
  </>
)

const ContourLines = () => (
  <>
    <path d="M -10,30 Q 30,10 70,50 T 150,20 T 230,40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <path d="M -10,60 Q 40,40 90,80 T 170,50 T 230,70" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <path d="M -10,90 Q 50,70 110,110 T 190,80 T 230,100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
    <path d="M -10,120 Q 60,100 130,130 T 210,110 T 230,125" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
  </>
)
