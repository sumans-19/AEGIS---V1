import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, LayoutPanelTop, PanelLeftClose, PanelLeftOpen,
  PanelBottomClose, PanelBottomOpen,
  MapPin, Rocket, RotateCcw, Maximize, RefreshCw, Sun, Moon, CheckCircle2
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import { computeDeployPaths, computeReturnPaths, DRONE_BASE } from '../../hooks/useDroneMovement'

const PHASE_LABELS = {
  IDLE: 'STANDBY',
  SELECT_REGION: 'SELECTING REGION',
  SEED_SURVIVORS: 'MARKING SURVIVORS',
  READY_TO_DEPLOY: 'READY TO DEPLOY',
  DEPLOYING: 'DEPLOYING',
  SEARCHING: 'SEARCH IN PROGRESS',
  ALL_FOUND: 'ALL DETECTED',
  RETURNING: 'RETURNING TO BASE',
  COMPLETED: 'MISSION COMPLETE',
}

const PHASE_COLORS = {
  IDLE: '#64748b',
  SELECT_REGION: '#00e5ff',
  SEED_SURVIVORS: '#ffb300',
  READY_TO_DEPLOY: '#00ff88',
  DEPLOYING: '#a855f7',
  SEARCHING: '#00e5ff',
  ALL_FOUND: '#00ff88',
  RETURNING: '#ff6b2b',
  COMPLETED: '#00ff88',
}

export default function TopBar() {
  const navigate = useNavigate()
  const missionPhase = useSimStore(s => s.missionPhase)
  const scenario = useSimStore(s => s.scenario)
  const backendConnected = useSimStore(s => s.backendConnected)
  const leftPanelCollapsed = useSimStore(s => s.leftPanelCollapsed)
  const setLeftPanelCollapsed = useSimStore(s => s.setLeftPanelCollapsed)
  const bottomPanelCollapsed = useSimStore(s => s.bottomPanelCollapsed)
  const setBottomPanelCollapsed = useSimStore(s => s.setBottomPanelCollapsed)
  const fullMapMode = useSimStore(s => s.fullMapMode)
  const setFullMapMode = useSimStore(s => s.setFullMapMode)
  const theme = useSimStore(s => s.theme)
  const toggleTheme = useSimStore(s => s.toggleTheme)
  const searchRegion = useSimStore(s => s.searchRegion)
  const survivors = useSimStore(s => s.survivors)
  const drones = useSimStore(s => s.drones)

  const setMissionPhase = useSimStore(s => s.setMissionPhase)
  const startDeploy = useSimStore(s => s.startDeploy)
  const startReturn = useSimStore(s => s.startReturn)
  const addNotification = useSimStore(s => s.addNotification)

  const seededSurvivors = survivors.filter(s => String(s.id).startsWith('SURV-'))
  const phaseColor = PHASE_COLORS[missionPhase] || '#64748b'

  // ── Action Handlers ──
  const handleSelectRegion = () => {
    setMissionPhase('SELECT_REGION')
    addNotification('Click two points on the terrain to define the search area.', 'guide')
  }

  const handleStartSeeding = () => {
    setMissionPhase('READY_TO_DEPLOY')
    addNotification('Seeding complete. Drones are ready for deployment.', 'success')
  }

  const handleStartMission = () => {
    if (!searchRegion) return
    const paths = computeDeployPaths(searchRegion)
    startDeploy(paths)
    addNotification('Launch sequence initiated. Drones departing base.', 'system')
    // Update drone statuses
    drones.forEach(d => {
      useSimStore.getState().updateDrone(d.id, { status: 'DEPLOYING' })
    })
  }

  const handleEndTask = () => {
    // Compute return paths from current drone positions
    const positions = {}
    drones.forEach(d => {
      positions[d.id] = { x: d.pos?.[0] || 0, z: d.pos?.[2] || 0 }
    })
    const paths = computeReturnPaths(positions)
    startReturn(paths)
    addNotification('Return to base initiated. All drones recalling.', 'system')
    drones.forEach(d => {
      useSimStore.getState().updateDrone(d.id, { status: 'RETURNING' })
    })
  }

  const handleReset = () => {
    useSimStore.setState({
      missionPhase: 'IDLE',
      searchRegion: null,
      survivors: [],
      deployPaths: {},
      searchPaths: {},
      returnPaths: {},
      eventLog: [],
      simulationRunning: false,
    })
    
    const INITIAL_DRONES = useSimStore.getState().drones.map((d, i) => {
      const padOffset = [
        { x: -190, y: 2, z: -190 },
        { x: -170, y: 2, z: -190 },
        { x: -190, y: 2, z: -170 },
        { x: -170, y: 2, z: -170 },
        { x: -180, y: 2, z: -180 },
      ][i]
      return { ...d, status: 'IDLE', pos: [padOffset.x, padOffset.y, padOffset.z], battery: 100 }
    })
    useSimStore.setState({ drones: INITIAL_DRONES })
    addNotification('System reset to standby.', 'info')
  }

  return (
    <div style={{
      height: '48px',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: '#0d1117',
      borderBottom: '1px solid #1e293b',
      position: 'relative',
      zIndex: 1000,
    }}>
      {/* ── Left: Nav + Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/disasters')}
          style={navBtnStyle}
          title="Return to Disaster Registry"
          onMouseOver={e => { e.currentTarget.style.borderColor = '#00e5ff'; e.currentTarget.style.color = '#00e5ff' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)' }} />

        <button
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          style={{ ...navBtnStyle, color: '#00e5ff' }}
          title={leftPanelCollapsed ? "Open Left Panel" : "Close Left Panel"}
        >
          {leftPanelCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <button
          onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
          style={{ ...navBtnStyle, color: '#00e5ff' }}
          title={bottomPanelCollapsed ? "Show Bottom Panel" : "Hide Bottom Panel"}
        >
          {bottomPanelCollapsed ? <PanelBottomOpen size={18} /> : <PanelBottomClose size={18} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <LayoutPanelTop size={20} color="#00e5ff" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'Rajdhani',
              fontSize: '15px',
              fontWeight: 700,
              letterSpacing: '2px',
              color: '#e2e8f0',
              lineHeight: 1,
            }}>
              AEGIS MISSION CONTROL
            </span>
            <span style={{
              fontFamily: 'JetBrains Mono',
              fontSize: '9px',
              color: '#00e5ff',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              SYSTEM: {scenario}
            </span>
          </div>
        </div>
      </div>

      {/* ── Center: Phase Badge ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 20px',
          borderRadius: '40px',
          background: `${phaseColor}10`,
          border: `1px solid ${phaseColor}40`,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: phaseColor,
            boxShadow: `0 0 10px ${phaseColor}`,
            animation: ['DEPLOYING', 'SEARCHING', 'RETURNING'].includes(missionPhase)
              ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'JetBrains Mono',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '2px',
            color: phaseColor,
          }}>
            {PHASE_LABELS[missionPhase] || missionPhase}
          </span>
        </div>
      </div>

      {/* ── Right: Action Buttons + Theme/FullView + Backend Status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        
        {/* Theme and full view controls */}
        <div style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
          <button onClick={toggleTheme} style={iconBtnStyle} title="Toggle Day/Night View">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => setFullMapMode(!fullMapMode)} style={iconBtnStyle} title="Toggle Full View">
            <Maximize size={16} color={fullMapMode ? "#00e5ff" : "currentColor"} />
          </button>
          <button onClick={handleReset} style={iconBtnStyle} title="Reset Mission">
            <RefreshCw size={16} />
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />

        {/* Phase-specific action buttons */}
        {missionPhase === 'IDLE' && (
          <ActionButton
            onClick={handleSelectRegion}
            icon={MapPin}
            label="SELECT SEARCH REGION"
            color="#00e5ff"
          />
        )}

        {missionPhase === 'SEED_SURVIVORS' && seededSurvivors.length > 0 && (
          <ActionButton
            onClick={handleStartSeeding}
            icon={CheckCircle2}
            label="START SEEDING"
            color="#ffb300"
          />
        )}

        {missionPhase === 'READY_TO_DEPLOY' && (
          <ActionButton
            onClick={handleStartMission}
            icon={Rocket}
            label="DEPLOY DRONES"
            color="#00ff88"
          />
        )}

        {missionPhase === 'ALL_FOUND' && (
          <ActionButton
            onClick={handleEndTask}
            icon={RotateCcw}
            label="END TASK"
            color="#ff6b2b"
          />
        )}

        {/* Backend status */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          borderLeft: '1px solid rgba(148, 163, 184, 0.1)',
          paddingLeft: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: backendConnected ? '#00ff88' : '#ffb300' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#e2e8f0' }}>
              BACKEND: {backendConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}

function ActionButton({ onClick, icon: Icon, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 20px',
        borderRadius: '6px',
        border: `1px solid ${color}60`,
        background: `${color}15`,
        color: color,
        cursor: 'pointer',
        fontFamily: 'JetBrains Mono',
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        transition: 'all 0.3s',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = `${color}30`
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.boxShadow = `0 0 20px ${color}30`
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = `${color}15`
        e.currentTarget.style.borderColor = `${color}60`
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

const navBtnStyle = {
  background: 'none',
  border: '1px solid var(--border-color)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: '6px',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: '0.2s',
}

const iconBtnStyle = {
  background: 'none',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  padding: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: '0.2s',
}
