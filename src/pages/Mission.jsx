import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSimStore } from '../store/useSimStore'
import { useSimulation } from '../hooks/useSimulation'
import TopBar from '../components/mission/TopBar'
import LeftPanel from '../components/mission/LeftPanel'
import Scene3D from '../components/mission/Scene3D'
import RightPanel from '../components/mission/RightPanel'
import BottomBar from '../components/mission/BottomBar'

export default function Mission() {
  const [searchParams] = useSearchParams()
  const setScenario = useSimStore(s => s.setScenario)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const leftPanelCollapsed = useSimStore(s => s.leftPanelCollapsed)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)

  const fullMapMode = useSimStore(s => s.fullMapMode)

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
      {/* HEADER CONTAINER */}
      <div style={{ 
        height: '60px', 
        width: '100%', 
        zIndex: 9999,
        background: '#0d1117',
        borderBottom: '2px solid #00e5ff',
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'block'
      }}>
        <TopBar />
      </div>

      <div style={{ 
        flex: 1, 
        display: 'flex', 
        width: '100%',
        marginTop: '60px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {!leftPanelCollapsed && !fullMapMode && (
          <div style={{ 
            width: '320px', 
            minWidth: '320px',
            flexShrink: 0,
            height: '100%', 
            borderRight: '1px solid #1e293b' 
          }}>
            <LeftPanel />
          </div>
        )}
        
        <div style={{ 
          flex: 1, 
          height: '100%', 
          position: 'relative',
          overflow: 'hidden'
        }}>
          <Scene3D />
        </div>

        {showRight && (
          <div style={{ 
            width: '360px', 
            minWidth: '360px',
            flexShrink: 0,
            height: '100%', 
            borderLeft: '1px solid #1e293b' 
          }}>
            <RightPanel />
          </div>
        )}
      </div>

      {!fullMapMode && (
        <div style={{ 
          height: '140px', 
          width: '100%', 
          borderTop: '1px solid #1e293b', 
          background: '#0a0a0f',
          flexShrink: 0,
          zIndex: 10
        }}>
          <BottomBar />
        </div>
      )}
    </div>
  )
}
