import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Pause, FastForward, Settings, UserPlus, 
  Map, Download, ShieldCheck, Database, LayoutPanelTop,
  Menu, Maximize, PanelLeftClose, PanelLeftOpen, ArrowLeft, GitBranch
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import ExportPanel from './ExportPanel'
import CoordinationPanel from './CoordinationPanel'

const toolBtnStyle = {
   display: 'flex',
   alignItems: 'center',
   gap: '8px',
   padding: '8px 16px',
   borderRadius: '4px',
   border: '1px solid var(--border-color)',
   cursor: 'pointer',
   transition: '0.3s',
}

export default function TopBar() {
  const navigate = useNavigate()
  const [showExport, setShowExport] = useState(false)
  const [showCoord, setShowCoord] = useState(false)
  const simulationRunning = useSimStore(s => s.simulationRunning)
  const simulationSpeed = useSimStore(s => s.simulationSpeed || 1)
  const toggleSim = useSimStore(s => s.toggleSimulation)
  const scenario = useSimStore(s => s.scenario)
  const backendConnected = useSimStore(s => s.backendConnected)
  const latency = useSimStore(s => s.latency || 0)
  const leftPanelCollapsed = useSimStore(s => s.leftPanelCollapsed)
  const setLeftPanelCollapsed = useSimStore(s => s.setLeftPanelCollapsed)
  const fullMapMode = useSimStore(s => s.fullMapMode)
  const setFullMapMode = useSimStore(s => s.setFullMapMode)
  const seedModeActive = useSimStore(s => s.seedModeActive)
  const setSeedModeActive = useSimStore(s => s.setSeedModeActive)
  const setSimulationSpeed = useSimStore(s => s.setSimulationSpeed)
  const waterLevel = useSimStore(s => s.waterLevel || 0)

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
      {/* 1. Left Section: Sidebar Toggle & Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
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
          }}
          title="Return to Landing"
          onMouseOver={e => {
             e.currentTarget.style.borderColor = 'var(--cyan)'
             e.currentTarget.style.color = 'var(--cyan)'
          }}
          onMouseOut={e => {
             e.currentTarget.style.borderColor = 'var(--border-color)'
             e.currentTarget.style.color = 'var(--text-dim)'
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ width: '1px', height: '20px', background: 'var(--border-color)', margin: '0 4px' }} />

        <button
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          style={{
            background: 'none',
            border: '1px solid var(--border-color)',
            color: 'var(--cyan)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: '0.2s',
          }}
        >
          {leftPanelCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <LayoutPanelTop size={22} color="#00e5ff" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ 
              fontFamily: 'Rajdhani', 
              fontSize: '16px', 
              fontWeight: 700, 
              letterSpacing: '2px', 
              color: '#e2e8f0',
              lineHeight: 1,
            }}>
              AEGIS MISSION CONTROL
            </span>
            <span style={{ 
              fontFamily: 'JetBrains Mono', 
              fontSize: '10px', 
              color: '#00e5ff', 
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}>
              SYSTEM: {scenario} // LIVE
            </span>
          </div>
        </div>
      </div>

      {/* 2. Center Section: Playback & View Controls */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          background: 'rgba(255,255,255,0.03)',
          padding: '6px 16px',
          borderRadius: '40px',
          border: '1px solid rgba(148, 163, 184, 0.1)',
        }}>
          <SimulationBtn 
             active={simulationRunning} 
             onClick={toggleSim} 
             icon={simulationRunning ? Pause : Play} 
             color={simulationRunning ? '#00e5ff' : '#00ff88'} 
          />
          <div style={{ width: '1px', height: '24px', background: 'rgba(148, 163, 184, 0.1)' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
             {[1, 2, 4].map(speed => (
                <button 
                  key={speed}
                  onClick={() => setSimulationSpeed(speed)}
                  style={{
                    padding: '4px 10px',
                    background: simulationSpeed === speed ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                    border: 'none',
                    color: simulationSpeed === speed ? '#00e5ff' : '#64748b',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    transition: '0.3s',
                  }}
                >
                  {speed}X
                </button>
             ))}
          </div>
        </div>

        <button
          onClick={() => setFullMapMode(!fullMapMode)}
          style={{
            ...toolBtnStyle,
            borderColor: fullMapMode ? 'var(--cyan)' : 'var(--border-color)',
            color: fullMapMode ? 'var(--cyan)' : 'var(--text-dim)',
            background: fullMapMode ? 'rgba(0, 229, 255, 0.05)' : 'transparent',
          }}
        >
          <Maximize size={16} />
          <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', letterSpacing: '1px' }}>
             {fullMapMode ? 'RESTORE_UI' : 'FULL_MAP'}
          </span>
        </button>

        {scenario === 'tsunami' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 14px',
            background: 'rgba(0,102,255,0.1)',
            border: '1px solid rgba(0,102,255,0.3)',
            borderRadius: '4px',
          }}>
            <div style={{
              width: '8px',
              height: '16px',
              background: '#0066ff',
              borderRadius: '2px',
              position: 'relative',
              overflow: 'hidden'
            }}>
               <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${Math.min(100, (waterLevel / 15) * 100)}%`,
                  background: '#00e5ff',
               }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', color: '#64748b', fontFamily: 'JetBrains Mono' }}>WATER_LEVEL</span>
              <span style={{ fontSize: '12px', color: '#00e5ff', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                 {waterLevel.toFixed(1)}m
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Right Section: Tools & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button 
           onClick={() => setSeedModeActive(!seedModeActive)}
           style={{
              ...toolBtnStyle,
              background: seedModeActive ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
              color: seedModeActive ? '#00e5ff' : '#94a3b8',
              borderColor: seedModeActive ? '#00e5ff' : 'var(--border-color)',
           }}
        >
           <UserPlus size={16} />
           <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}>SEED_SURVIVOR</span>
        </button>

        <button
          onClick={() => setShowCoord(true)}
          style={{
            ...toolBtnStyle,
            borderColor: 'rgba(255,107,0,0.3)',
            color: '#ff6b00',
            background: 'rgba(255,107,0,0.06)',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono',
            letterSpacing: '1px',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,107,0,0.12)'; e.currentTarget.style.borderColor = '#ff6b00' }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,107,0,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,107,0,0.3)' }}
        >
          <GitBranch size={14} />
          COORD
        </button>

        <SimulationBtn 
           onClick={() => setShowExport(true)} 
           icon={Database} 
           label="EXPORT" 
        />

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'flex-end', 
          borderLeft: '1px solid rgba(148, 163, 184, 0.1)', 
          paddingLeft: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: 8, height: 8, borderRadius: '50%', background: backendConnected ? '#00ff88' : '#ffb300' }} />
             <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#e2e8f0' }}>BACKEND: {backendConnected ? 'OPERATIONAL' : 'OFFLINE'}</span>
          </div>
          {backendConnected && <span style={{ fontFamily: 'JetBrains Mono', fontSize: '8px', color: '#64748b' }}>SYNCHRONIZED // 20HZ</span>}
        </div>
      </div>

      <AnimatePresence>
        {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
        {showCoord && <CoordinationPanel onClose={() => setShowCoord(false)} />}
      </AnimatePresence>
    </div>
  )
}

function SimulationBtn({ active, onClick, icon: Icon, color = "#94a3b8", label }) {
   return (
      <button 
         onClick={onClick}
         style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: active ? '#00e5ff' : color,
            cursor: 'pointer',
            transition: '0.3s',
            padding: '4px 8px',
         }}
      >
         <Icon size={18} fill={active ? 'rgba(0, 229, 255, 0.2)' : 'none'} />
         {label && <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono' }}>{label}</span>}
      </button>
   )
}
