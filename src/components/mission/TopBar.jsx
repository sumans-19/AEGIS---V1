import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, LayoutPanelTop, PanelLeftClose, PanelLeftOpen,
  PanelBottomClose, PanelBottomOpen,
  MapPin, Rocket, RotateCcw, Maximize, RefreshCw, Sun, Moon, CheckCircle2, X
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
  IDLE: '#6C7F84',
  SELECT_REGION: '#79B9C1',
  SEED_SURVIVORS: '#D4A844',
  READY_TO_DEPLOY: '#58ba8a',
  DEPLOYING: '#3b82f6',
  SEARCHING: '#79B9C1',
  ALL_FOUND: '#58ba8a',
  RETURNING: '#f59e0b',
  COMPLETED: '#58ba8a',
}

export default function TopBar({ onClose }) {
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
  const phaseColor = PHASE_COLORS[missionPhase] || '#6C7F84'

  // ── Action Handlers ──
  const handleSelectRegion = () => {
    setMissionPhase('SELECT_REGION')
    addNotification('Click two points on the terrain to define the search area.', 'guide')
  }

  const handleStartMission = async () => {
    if (!searchRegion) return
    
    // Build survivors payload for the backend (only seeded survivors with SURV- prefix)
    const survivorsPayload = seededSurvivors.map(s => ({
      id: s.id,
      pos: s.pos || [0, 0, 0],
      x: s.pos?.[0] || 0,
      z: s.pos?.[2] || 0,
    }))
    
    // Notify the backend to start its mission engine with our region and survivors
    try {
      const res = await fetch('http://localhost:8000/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenario, 
          searchRegion,
          survivors: survivorsPayload,
        })
      })
      if (!res.ok) throw new Error('Backend returned ' + res.status)
      
      addNotification(`Mission deployed. AEGIS AI Engine active. ${survivorsPayload.length} survivor(s) seeded.`, 'system')
      
      // Also kick off the frontend visual deploy animation
      const { computeDeployPaths } = await import('../../hooks/useDroneMovement')
      const deployPaths = computeDeployPaths(searchRegion)
      startDeploy(deployPaths)
      
    } catch (e) {
      console.error('Failed to start backend engine:', e)
      addNotification('Error connecting to AEGIS backend. Check that backend is running on port 8000.', 'error')
      // Fall back: start frontend-only simulation anyway
      const { computeDeployPaths } = await import('../../hooks/useDroneMovement')
      const deployPaths = computeDeployPaths(searchRegion)
      startDeploy(deployPaths)
    }
  }

  const handleFinishSeedingAndDeploy = () => {
    handleStartMission()
  }

  const handleEndTask = async () => {
    try {
      await fetch('http://localhost:8000/api/simulation/stop', { method: 'POST' })

      addNotification('Return to base initiated. Mission complete.', 'system')
      setMissionPhase('RETURNING')
    } catch (e) {
      console.error('Failed to stop backend engine:', e)
    }
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
      padding: '0 16px',
      background: '#20292B',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      position: 'relative',
      zIndex: 1000,
      userSelect: 'none',
    }}>
      {/* ── Left: Nav + Logo ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => onClose ? onClose() : navigate('/disasters')}
          style={{
            ...navBtnStyle,
            padding: '5px 10px',
            gap: '6px',
            fontSize: '9.5px',
            fontWeight: 800,
            fontFamily: 'var(--font-primary)',
            color: '#DCE6E8',
          }}
          title="Return to Dashboard / Overview"
          onMouseOver={e => { e.currentTarget.style.borderColor = '#79B9C1'; e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#DCE6E8'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
        >
          <ArrowLeft size={14} /> RETURN
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)' }} />

        <button
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          style={{ ...navBtnStyle, color: leftPanelCollapsed ? '#8A9A9E' : '#79B9C1' }}
          title={leftPanelCollapsed ? "Open Fleet Panel" : "Close Fleet Panel"}
        >
          {leftPanelCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        <button
          onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
          style={{ ...navBtnStyle, color: bottomPanelCollapsed ? '#8A9A9E' : '#79B9C1' }}
          title={bottomPanelCollapsed ? "Show Bottom Panel" : "Hide Bottom Panel"}
        >
          {bottomPanelCollapsed ? <PanelBottomOpen size={14} /> : <PanelBottomClose size={14} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '6px' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '5px',
            background: 'rgba(121, 185, 193, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(121, 185, 193, 0.4)',
          }}>
            <LayoutPanelTop size={14} color="#79B9C1" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-primary)',
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: '#FFFFFF',
              lineHeight: 1.1,
            }}>
              AEGIS SWARMSYNC
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '7.5px',
              color: '#79B9C1',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              SYSTEM // {scenario}
            </span>
          </div>
        </div>
      </div>

      {/* ── Center: Phase Badge ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 14px',
          borderRadius: '12px',
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: phaseColor,
            boxShadow: `0 0 6px ${phaseColor}`,
            animation: ['DEPLOYING', 'SEARCHING', 'RETURNING'].includes(missionPhase)
              ? 'pulse 1.5s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '8.5px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#DCE6E8',
            textTransform: 'uppercase',
          }}>
            {PHASE_LABELS[missionPhase] || missionPhase}
          </span>
        </div>
      </div>

      {/* ── Right: Action Buttons + Theme/FullView + Backend Status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        
        {/* Theme and full view controls */}
        <div style={{ display: 'flex', gap: '6px', marginRight: '4px' }}>
          <button onClick={toggleTheme} style={iconBtnStyle} title="Toggle Day/Night View">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button onClick={() => setFullMapMode(!fullMapMode)} style={iconBtnStyle} title="Toggle Full View">
            <Maximize size={13} color={fullMapMode ? "#79B9C1" : "currentColor"} />
          </button>
          <button onClick={handleReset} style={iconBtnStyle} title="Reset Mission">
            <RefreshCw size={13} />
          </button>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Phase-specific action buttons */}
        {missionPhase === 'IDLE' && (
          <ActionButton
            onClick={handleSelectRegion}
            icon={MapPin}
            label="SELECT SEARCH REGION"
            color="#79B9C1"
          />
        )}

        {missionPhase === 'SEED_SURVIVORS' && seededSurvivors.length > 0 && (
          <ActionButton
            onClick={handleFinishSeedingAndDeploy}
            icon={Rocket}
            label="DEPLOY DRONES"
            color="#58ba8a"
          />
        )}

        {missionPhase === 'ALL_FOUND' && (
          <ActionButton
            onClick={handleEndTask}
            icon={RotateCcw}
            label="END TASK"
            color="#f59e0b"
          />
        )}

        <button
          type="button"
          onClick={() => navigate('/ai-dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(121, 185, 193, 0.4)',
            background: 'rgba(121, 185, 193, 0.15)',
            color: '#79B9C1',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            fontSize: '8px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            boxShadow: '0 2px 6px rgba(121, 185, 193, 0.2)',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(121, 185, 193, 0.4)'
            e.currentTarget.style.background = '#79B9C1'
            e.currentTarget.style.color = '#172124'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = '0 2px 6px rgba(121, 185, 193, 0.2)'
            e.currentTarget.style.background = 'rgba(121, 185, 193, 0.15)'
            e.currentTarget.style.color = '#79B9C1'
          }}
        >
          VIEW AI DECISIONS
        </button>

        {/* Backend status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          paddingLeft: '10px',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: backendConnected ? '#58ba8a' : '#f59e0b', boxShadow: `0 0 5px ${backendConnected ? '#58ba8a' : '#f59e0b'}` }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8.5px', color: '#8A9A9E', fontWeight: 600 }}>
            {backendConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Exit Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              ...navBtnStyle,
              background: 'rgba(220, 53, 69, 0.15)',
              border: '1px solid rgba(220, 53, 69, 0.4)',
              color: '#ff8080',
              padding: '4px 10px',
              fontSize: '9.5px',
              fontWeight: 800,
              fontFamily: 'var(--font-primary)',
              gap: '6px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginLeft: '6px',
            }}
            title="Exit Fullscreen Mission View"
            onMouseOver={e => { e.currentTarget.style.background = 'rgba(220, 53, 69, 0.3)'; e.currentTarget.style.color = '#FFFFFF' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(220, 53, 69, 0.15)'; e.currentTarget.style.color = '#ff8080' }}
          >
            <X size={13} /> EXIT
          </button>
        )}
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
        gap: '6px',
        padding: '5px 14px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.4)',
        background: '#79B9C1',
        color: '#172124',
        cursor: 'pointer',
        fontFamily: 'var(--font-primary)',
        fontSize: '8px',
        fontWeight: 800,
        letterSpacing: '0.08em',
        boxShadow: '0 2px 8px rgba(121, 185, 193, 0.35)',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        textTransform: 'uppercase',
      }}
      onMouseOver={e => {
        e.currentTarget.style.background = '#96CCD3'
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(121, 185, 193, 0.5)'
      }}
      onMouseOut={e => {
        e.currentTarget.style.background = '#79B9C1'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(121, 185, 193, 0.35)'
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  )
}

const navBtnStyle = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#8A9A9E',
  cursor: 'pointer',
  padding: '5px',
  borderRadius: '5px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.18s ease',
}

const iconBtnStyle = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#8A9A9E',
  cursor: 'pointer',
  padding: '5px',
  borderRadius: '5px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.18s ease',
}
