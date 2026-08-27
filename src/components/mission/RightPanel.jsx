import { AnimatePresence, motion } from 'framer-motion'
import { useSimStore } from '../../store/useSimStore'
import { X } from 'lucide-react'
import SidebarTabs from './SidebarTabs'
import DroneView from './DroneView'
import ThermalView from './ThermalView'
import RadarView from './RadarView'
import AreaMap from './AreaMap'
import SurvivorsLog from './SurvivorsLog'
import PathfindingView from './PathfindingView'

export default function RightPanel() {
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const activeSidebarTab = useSimStore(s => s.activeSidebarTab)
  const drones = useSimStore(s => s.drones)

  const activeDrone = drones.find(d => d.id === selectedDrone) || drones[0]
  const drone = activeDrone

  const tabContent = {
    droneview: DroneView,
    thermal: ThermalView,
    radar: RadarView,
    areamap: AreaMap,
    survivors: SurvivorsLog,
    pathfinding: PathfindingView,
  }

  const ActiveTab = tabContent[activeSidebarTab] || DroneView

  return (
    <AnimatePresence>
      {drone && (
        <motion.div
          key="right-panel"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 8px 14px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <div style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '8px',
                fontWeight: 700,
                color: '#55666B',
              }}>
                {drone.name}
              </div>
              <div style={{
                fontFamily: 'var(--font-primary)',
                fontSize: '13px',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#1F282B',
              }}>
                {drone.callsign}
              </div>
            </div>
            <button
              onClick={() => setSelectedDrone(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6C7F84',
                cursor: 'pointer',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                borderRadius: '4px',
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'
                e.currentTarget.style.color = '#1F282B'
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = '#6C7F84'
              }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <SidebarTabs />

          {/* Tab content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
            <ActiveTab drone={drone} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
