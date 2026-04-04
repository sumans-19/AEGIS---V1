import { useSimStore } from '../../store/useSimStore'
import DroneCard from './DroneCard'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function LeftPanel() {
  const drones = useSimStore(s => s.drones)
  const parametersOpen = useSimStore(s => s.parametersOpen)
  const toggleParameters = useSimStore(s => s.toggleParameters)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-panel)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Title */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '10px',
          color: 'var(--text-dim)',
          letterSpacing: '2px',
          marginBottom: '4px',
        }}>
          // FLEET STATUS
        </div>
        <div style={{
          fontFamily: 'Rajdhani, sans-serif',
          fontSize: '16px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '2px',
        }}>
          DRONE FLEET SWARM
        </div>
      </div>

      {/* Drone list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {drones.map(drone => (
          <DroneCard key={drone.id} drone={drone} />
        ))}
      </div>

      {/* Mission Parameters */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <button
          onClick={toggleParameters}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '2px',
          }}
        >
          MISSION PARAMETERS
          {parametersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {parametersOpen && (
          <div style={{
            padding: '0 16px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
          }}>
            {[
              { label: 'Zone radius', value: '5.2km' },
              { label: 'Search pattern', value: 'Adaptive Swarm' },
              { label: 'Thermal threshold', value: '36.5°C' },
              { label: 'Network link', value: 'L-BAND / AES-256' },
            ].map(param => (
              <div key={param.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
              }}>
                <span style={{ color: 'var(--text-dim)' }}>{param.label}</span>
                <span style={{ color: 'var(--cyan)' }}>{param.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
