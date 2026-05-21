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

export default function Mission() {
  const [searchParams] = useSearchParams()
  const setScenario = useSimStore(s => s.setScenario)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const leftPanelCollapsed = useSimStore(s => s.leftPanelCollapsed)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const fullMapMode = useSimStore(s => s.fullMapMode)
  const coordinationPanelOpen = useSimStore(s => s.coordinationPanelOpen)
  const setCoordinationPanelOpen = useSimStore(s => s.setCoordinationPanelOpen)
  const scriptId = searchParams.get('script')

  useSimulation()

  useEffect(() => {
    const scenario = searchParams.get('scenario') || 'earthquake'
    setScenario(scenario)
  }, [searchParams, setScenario])

  const showRight = selectedDrone && !rightPanelExpanded && !fullMapMode

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

      {/* MAIN CONTENT */}
      <div style={{
        flex: 1,
        display: 'flex',
        width: '100%',
        marginTop: '60px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Left Panel */}
        {!leftPanelCollapsed && !fullMapMode && !scriptId && (
          <div style={{
            width: '320px',
            minWidth: '320px',
            flexShrink: 0,
            height: '100%',
            borderRight: '1px solid #1e293b',
          }}>
            <LeftPanel />
          </div>
        )}

        {/* Central Content Column */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 3D Scene */}
          <div style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <Scene3D />
            {scriptId && <EdgeCaseOverlay scriptId={scriptId} />}
          </div>

          {/* Notification Panel as Bottom Bar */}
          {!scriptId && (
            <div style={{
              height: 'auto',
              borderTop: '1px solid #1e293b',
              background: '#0a0a0f',
              position: 'relative',
              zIndex: 100,
            }}>
              <NotificationPanel />
            </div>
          )}
        </div>

        {/* Right Panel */}
        {showRight && !scriptId && (
          <div style={{
            width: '360px',
            minWidth: '360px',
            flexShrink: 0,
            height: '100%',
            borderLeft: '1px solid #1e293b',
          }}>
            <RightPanel />
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
