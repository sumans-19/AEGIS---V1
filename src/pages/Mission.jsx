import { useEffect } from 'react'
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
import { PanelLeftOpen, ChevronUp, ChevronDown } from 'lucide-react'

export default function Mission() {
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

  useSimulation()

  useEffect(() => {
    const scenario = searchParams.get('scenario') || 'earthquake'
    setScenario(scenario)
  }, [searchParams, setScenario])

  const showRight = selectedDrone && !rightPanelExpanded && !fullMapMode
  const showLeftPanel = !leftPanelCollapsed && !fullMapMode && !scriptId
  const showBottomPanel = !scriptId

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* HEADER */}
      <div style={{
        height: '60px',
        width: '100%',
        zIndex: 9999,
        background: '#0d1117',
        borderBottom: '2px solid #00e5ff',
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'block',
      }}>
        <TopBar />
      </div>

      {/* MAIN CONTENT — column: top row + bottom panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        marginTop: '60px',
        overflow: 'hidden',
      }}>

        {/* ── TOP ROW: Left Panel | 3D Scene | Right Panel ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* Left Panel — animated slide */}
          {!fullMapMode && !scriptId && (
            <div style={{
              width: showLeftPanel ? '320px' : '0px',
              minWidth: showLeftPanel ? '320px' : '0px',
              flexShrink: 0,
              height: '100%',
              borderRight: showLeftPanel ? '1px solid #1e293b' : 'none',
              overflow: 'hidden',
              transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              <div style={{
                width: '320px',
                height: '100%',
                opacity: showLeftPanel ? 1 : 0,
                transition: 'opacity 0.2s ease',
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
                background: 'rgba(13, 17, 23, 0.85)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '8px',
                padding: '10px 6px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: '#00e5ff',
                transition: 'all 0.3s ease',
                boxShadow: '0 0 15px rgba(0, 229, 255, 0.08)',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = '#00e5ff'
                e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.2)'
                e.currentTarget.style.background = 'rgba(13, 17, 23, 0.95)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)'
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.08)'
                e.currentTarget.style.background = 'rgba(13, 17, 23, 0.85)'
              }}
            >
              <PanelLeftOpen size={18} />
              <span style={{
                writingMode: 'vertical-rl',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '2px',
                color: '#94a3b8',
              }}>
                FLEET
              </span>
            </button>
          )}

          {/* Center: 3D Scene */}
          <div style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <Scene3D />
            {scriptId && <EdgeCaseOverlay scriptId={scriptId} />}
          </div>

          {/* Right Panel — sits above bottom, not full height */}
          {showRight && !scriptId && (
            <div style={{
              width: '360px',
              minWidth: '360px',
              flexShrink: 0,
              height: '100%',
              borderLeft: '1px solid #1e293b',
              background: '#0a0a0f',
            }}>
              <RightPanel />
            </div>
          )}
        </div>

        {/* ── BOTTOM: Notification Panel (full width, below everything) ── */}
        {showBottomPanel && (
          <div style={{
            position: 'relative',
            borderTop: '1px solid #1e293b',
            background: '#0a0a0f',
            zIndex: 100,
            flexShrink: 0,
          }}>
            {/* Toggle Button */}
            <button
              onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
              title={bottomPanelCollapsed ? 'Show Mission Log' : 'Hide Mission Log'}
              style={{
                position: 'absolute',
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 200,
                background: 'rgba(13, 17, 23, 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: '20px',
                padding: '2px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#00e5ff',
                transition: 'all 0.3s ease',
                boxShadow: '0 -2px 12px rgba(0, 229, 255, 0.06)',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = '#00e5ff'
                e.currentTarget.style.boxShadow = '0 -2px 20px rgba(0, 229, 255, 0.15)'
                e.currentTarget.style.background = 'rgba(13, 17, 23, 0.98)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)'
                e.currentTarget.style.boxShadow = '0 -2px 12px rgba(0, 229, 255, 0.06)'
                e.currentTarget.style.background = 'rgba(13, 17, 23, 0.9)'
              }}
            >
              {bottomPanelCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '2px',
                color: '#94a3b8',
              }}>
                {bottomPanelCollapsed ? 'LOG' : 'HIDE'}
              </span>
            </button>

            {/* Panel Content — animated collapse */}
            <div style={{
              maxHeight: bottomPanelCollapsed ? '0px' : '220px',
              overflow: 'hidden',
              transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
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
