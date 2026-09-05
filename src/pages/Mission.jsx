import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSimStore } from '../store/useSimStore'
import { useSimulation } from '../hooks/useSimulation'
import TopBar from '../components/mission/TopBar'
import LeftPanel from '../components/mission/LeftPanel'
import Scene3D from '../components/mission/Scene3D'
import RightPanel from '../components/mission/RightPanel'
import NotificationPanel from '../components/mission/NotificationPanel'
import EdgeCaseOverlay from '../components/mission/EdgeCaseOverlay'
import CoordinationPanel from '../components/mission/CoordinationPanel'

import SimulationPanel from '../components/mission/SimulationPanel'
import { PanelLeftOpen, ChevronUp, ChevronDown } from 'lucide-react'

const missionLogToggleStyle = {
  position: 'absolute',
  top: '-14px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 200,
  background: '#20292B',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(121, 185, 193, 0.4)',
  borderRadius: '20px',
  padding: '2px 16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  color: '#79B9C1',
  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
}

const simToggleStyle = {
  position: 'absolute',
  right: '20px',
  top: '12px',
  zIndex: 500,
  padding: '6px 14px',
  borderRadius: '6px',
  border: '1px solid rgba(121, 185, 193, 0.5)',
  background: 'rgba(121, 185, 193, 0.15)',
  color: '#1a565e',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: '9.5px',
  fontWeight: 800,
  letterSpacing: '1.2px',
  boxShadow: '0 2px 8px rgba(121, 185, 193, 0.2)',
  transition: 'all 0.2s ease',
}

export default function Mission({ isEmbedded, onClose }) {
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true)
  const [showSim, setShowSim] = useState(false)
  const [searchParams] = useSearchParams()
  const setScenario = useSimStore(s => s.setScenario)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const leftPanelCollapsed = useSimStore(s => s.leftPanelCollapsed)
  const setLeftPanelCollapsed = useSimStore(s => s.setLeftPanelCollapsed)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const fullMapMode = useSimStore(s => s.fullMapMode)
  const coordinationPanelOpen = useSimStore(s => s.coordinationPanelOpen)
  const setCoordinationPanelOpen = useSimStore(s => s.setCoordinationPanelOpen)
  const bottomPanelCollapsed = useSimStore(s => s.bottomPanelCollapsed)
  const setBottomPanelCollapsed = useSimStore(s => s.setBottomPanelCollapsed)
  const scriptId = searchParams.get('script')
  const backendDrones = useSimStore((s) => s.liveAiDrones)

  const drones = useSimStore(s => s.drones)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)

  useSimulation()

  useEffect(() => {
    const scenario = searchParams.get('scenario') || 'earthquake'
    setScenario(scenario)
  }, [searchParams, setScenario])

  // Default selectedDrone to first drone (Arjun) if not set, so RightPanel displays immediately
  useEffect(() => {
    if (!selectedDrone && drones.length > 0) {
      setSelectedDrone(drones[0].id)
    }
  }, [selectedDrone, drones, setSelectedDrone])

  const showRight = !rightPanelExpanded && !fullMapMode && !scriptId
  const showLeftPanel = !leftPanelCollapsed && !fullMapMode && !scriptId
  const showBottomPanel = !scriptId

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9000,
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Tactical Mission TopBar */}
      <div style={{
        height: '48px',
        width: '100%',
        zIndex: 50,
        background: '#20292B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative',
        display: 'block',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        flexShrink: 0,
      }}>
        <TopBar onClose={onClose} />
      </div>

      {/* MAIN CONTENT — column: top row + bottom panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        overflow: 'hidden',
        background: '#DCE6E8',
        position: 'relative',
      }}>

        {/* ── TOP ROW: Left Panel | 3D Scene | Right Panel ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          minWidth: 0,
          overflow: 'hidden',
          position: 'relative',
          padding: '8px 10px 6px 10px',
          gap: '10px',
        }}>

          {/* Left Fleet Panel — animated slide */}
          {!fullMapMode && !scriptId && (
            <div style={{
              width: showLeftPanel ? '290px' : '0px',
              minWidth: showLeftPanel ? '290px' : '0px',
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
              transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                width: '290px',
                height: '100%',
                opacity: showLeftPanel ? 1 : 0,
                transition: 'opacity 0.2s ease',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(235, 243, 245, 0.85)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255, 255, 255, 0.95)',
                outline: '1px solid rgba(0, 0, 0, 0.07)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              }}>
                <LeftPanel />
              </div>
            </div>
          )}

          {/* Floating Left Sidebar Toggle — appears when collapsed */}
          {leftPanelCollapsed && !fullMapMode && !scriptId && (
            <button
              onClick={() => setLeftPanelCollapsed(false)}
              title="Open Fleet Panel"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 500,
                background: 'rgba(32, 41, 43, 0.92)',
                backdropFilter: 'blur(12px)',
                border: '1.5px solid #79B9C1',
                borderRadius: '8px',
                padding: '10px 6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: '#79B9C1',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = '#96CCD3'
                e.currentTarget.style.color = '#FFFFFF'
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(121, 185, 193, 0.4)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = '#79B9C1'
                e.currentTarget.style.color = '#79B9C1'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)'
              }}
            >
              <PanelLeftOpen size={18} />
              <span style={{
                writingMode: 'vertical-rl',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '2px',
                color: '#8A9A9E',
              }}>
                FLEET
              </span>
            </button>
          )}

          {/* Center: 3D Scene */}
          <div style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            zIndex: 1,
            overflow: 'hidden',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            outline: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
            background: 'radial-gradient(ellipse at 50% 45%, #E5EFF2 0%, #D8E4E7 60%, #CDD9DC 100%)',
          }}>
            <button
              type="button"
              onClick={() => setShowSim((prev) => !prev)}
              style={simToggleStyle}
              onMouseOver={e => {
                e.currentTarget.style.background = '#79B9C1'
                e.currentTarget.style.color = '#172124'
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'rgba(121, 185, 193, 0.15)'
                e.currentTarget.style.color = '#1a565e'
              }}
            >
              DRONE SIMULATION
            </button>

            {showSim && (
              <div
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '52px',
                  width: '600px',
                  maxWidth: 'calc(100% - 40px)',
                  background: 'rgba(235, 243, 245, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  zIndex: 9999,
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.2), 0 0 16px rgba(121, 185, 193, 0.25)',
                  overflow: 'hidden',
                }}
              >
                <SimulationPanel onClose={() => setShowSim(false)} />
              </div>
            )}

            <Scene3D drones={backendDrones} />
            {scriptId && <EdgeCaseOverlay scriptId={scriptId} />}
          </div>

          {/* Right Telemetry Panel — sits above bottom */}
          {!fullMapMode && !scriptId && (
            <div style={{
              width: showRight ? '330px' : '0px',
              minWidth: showRight ? '330px' : '0px',
              flexShrink: 0,
              height: '100%',
              overflow: 'hidden',
              transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <div style={{
                width: '330px',
                height: '100%',
                opacity: showRight ? 1 : 0,
                transition: 'opacity 0.2s ease',
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(235, 243, 245, 0.85)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
                border: '1px solid rgba(255, 255, 255, 0.95)',
                outline: '1px solid rgba(0, 0, 0, 0.07)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              }}>
                <RightPanel />
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM: Notification Panel / Mission Log strip ── */}
        {showBottomPanel && (
          <div style={{
            position: 'relative',
            borderTop: '1px solid rgba(0, 0, 0, 0.07)',
            background: 'rgba(235, 243, 245, 0.95)',
            backdropFilter: 'blur(12px)',
            zIndex: 100,
            flexShrink: 0,
            boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
          }}>
            {/* Toggle Button */}
            <button
              onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
              title={bottomPanelCollapsed ? 'Show Mission Log' : 'Hide Mission Log'}
              style={missionLogToggleStyle}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = '#79B9C1'
                e.currentTarget.style.boxShadow = '0 -2px 16px rgba(121, 185, 193, 0.35)'
                e.currentTarget.style.background = '#172124'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'rgba(121, 185, 193, 0.4)'
                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)'
                e.currentTarget.style.background = '#20292B'
              }}
            >
              {bottomPanelCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '2px',
                color: '#DCE6E8',
              }}>
                {bottomPanelCollapsed ? 'LOG' : 'HIDE'}
              </span>
            </button>

            {/* Panel Content — animated collapse */}
            <div style={{
              maxHeight: bottomPanelCollapsed ? '0px' : '220px',
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
              <NotificationPanel />
            </div>

          </div>
        )}
      </div>

      {/* Coordination Dashboard Overlay */}
      {coordinationPanelOpen && (
        <CoordinationPanel onClose={() => setCoordinationPanelOpen(false)} />
      )}
    </div>
  )
}
