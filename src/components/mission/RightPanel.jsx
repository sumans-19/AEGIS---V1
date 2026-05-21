import { AnimatePresence, motion } from 'framer-motion'
import { useSimStore } from '../../store/useSimStore'
import { X } from 'lucide-react'
import SidebarTabs from './SidebarTabs'
import DroneView from './DroneView'
import ThermalView from './ThermalView'
import AreaMap from './AreaMap'
import SurvivorsLog from './SurvivorsLog'
import PathfindingView from './PathfindingView'

export default function RightPanel() {
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const activeSidebarTab = useSimStore(s => s.activeSidebarTab)
  const drones = useSimStore(s => s.drones)

  const drone = drones.find(d => d.id === selectedDrone)

  const tabContent = {
    droneview: DroneView,
    thermal: ThermalView,
    areamap: AreaMap,
    survivors: SurvivorsLog,
    pathfinding: PathfindingView,
  }

  const ActiveTab = tabContent[activeSidebarTab] || DroneView

  return (
    <AnimatePresence>
      {selectedDrone && drone && (
        <motion.div
          key="right-panel"
          initial={{ x: 320 }}
          animate={{ x: 0 }}
          exit={{ x: 320 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'relative',
            width: '360px',
            height: '100%',
            background: 'var(--bg-panel)',
            borderLeft: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10,
            boxShadow: 'var(--cyan-glow)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <div>
              <div style={{
                fontFamily: 'Rajdhani, sans-serif',
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '1px',
              }}>
                {drone.name}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                color: 'var(--cyan)',
              }}>
                {drone.callsign} // SESSION_ID_F422
              </div>
            </div>
            <button
              onClick={() => setSelectedDrone(null)}
              style={{
                background: 'none',
                border: '1px solid var(--border-color)',
                color: 'var(--text-dim)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                borderRadius: '4px',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = 'var(--red)'
                e.currentTarget.style.color = 'var(--red)'
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = 'var(--border-color)'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <SidebarTabs />

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <ActiveTab drone={drone} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
