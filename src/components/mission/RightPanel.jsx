import { AnimatePresence, motion } from 'framer-motion'
import { useSimStore } from '../../store/useSimStore'
import { AlertTriangle, Battery, Navigation, Radio, WifiOff, X } from 'lucide-react'
import SidebarTabs from './SidebarTabs'
import DroneView from './DroneView'
import ThermalView from './ThermalView'
import RadarView from './RadarView'
import AreaMap from './AreaMap'
import SurvivorsLog from './SurvivorsLog'
import PathfindingView from './PathfindingView'
import { HARDWARE_FAILURE_TYPES, triggerHardwareFailure } from '../../hooks/useDroneMovement'

const FAILURE_ICONS = {
  battery_failure: Battery,
  sensor_failure: Radio,
  motor_failure: AlertTriangle,
  comms_failure: WifiOff,
  gps_failure: Navigation,
}

export default function RightPanel() {
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const activeSidebarTab = useSimStore(s => s.activeSidebarTab)
  const drones = useSimStore(s => s.drones)
  const hardwareFailures = useSimStore(s => s.hardwareFailures)

  const drone = drones.find(d => d.id === selectedDrone)
  const activeFailure = drone ? hardwareFailures?.[drone.id] : null

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

          <FailureControlPanel drone={drone} activeFailure={activeFailure} />

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

function FailureControlPanel({ drone, activeFailure }) {
  const locked = Boolean(activeFailure && activeFailure.status !== 'CLEARED')

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--border-color)',
      background: locked ? 'rgba(255, 69, 0, 0.06)' : 'rgba(0,0,0,0.18)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '1px',
          color: locked ? '#ff6b2b' : 'var(--text-dim)',
        }}>
          <AlertTriangle size={12} />
          HARDWARE FAILURES
        </div>
        {locked && (
          <span style={{
            color: activeFailure.severity === 'critical' ? '#ff2929' : '#ffb300',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            fontWeight: 700,
          }}>
            {activeFailure.status}
          </span>
        )}
      </div>

      {locked && (
        <div style={{
          marginBottom: '8px',
          color: '#cbd5e1',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          lineHeight: 1.4,
        }}>
          {activeFailure.label} · replacement {activeFailure.replacementDroneId ? `DRONE-0${activeFailure.replacementDroneId}` : 'pending'}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px',
      }}>
        {HARDWARE_FAILURE_TYPES.map(failure => {
          const Icon = FAILURE_ICONS[failure.id] || AlertTriangle
          const isCritical = failure.severity === 'critical'
          const color = isCritical ? '#ff2929' : '#ffb300'
          return (
            <button
              key={failure.id}
              disabled={locked}
              onClick={() => triggerHardwareFailure(drone.id, failure.id)}
              title={`Trigger ${failure.label}`}
              style={{
                minHeight: '34px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                border: `1px solid ${locked ? 'rgba(71,85,105,0.24)' : color + '55'}`,
                background: locked ? 'rgba(15,23,42,0.22)' : color + '10',
                color: locked ? '#475569' : color,
                cursor: locked ? 'not-allowed' : 'pointer',
                borderRadius: '5px',
                padding: '7px 8px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '9px',
                fontWeight: 700,
                textAlign: 'left',
              }}
            >
              <Icon size={13} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {failure.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
