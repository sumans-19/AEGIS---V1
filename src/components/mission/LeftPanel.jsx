import { useState } from 'react'
import { useSimStore } from '../../store/useSimStore'
import DroneCard from './DroneCard'
import FailureModal from './FailureModal'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { getActiveDronesCount } from '../../hooks/useDroneMovement'

const DRONE_COLORS = ['#00e5ff', '#ff6b2b', '#00ff88', '#a855f7', '#ffb300']

export default function LeftPanel() {
  const drones                 = useSimStore(s => s.drones)
  const parametersOpen         = useSimStore(s => s.parametersOpen)
  const toggleParameters       = useSimStore(s => s.toggleParameters)
  const searchRegion           = useSimStore(s => s.searchRegion)
  const setCoordinationPanelOpen = useSimStore(s => s.setCoordinationPanelOpen)

  const [showZones, setShowZones] = useState(false)
  // Track which drone's failure modal is open (null = closed)
  const [failureModalDroneId, setFailureModalDroneId] = useState(null)

  const activeCount = searchRegion ? getActiveDronesCount(searchRegion) : 0

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-panel)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
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
          <DroneCard
            key={drone.id}
            drone={drone}
            onInjectFailure={(id) => setFailureModalDroneId(id)}
          />
        ))}
      </div>

      {/* Mapped Zones Info Board */}
      {showZones && (
        <div style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-color)',
          padding: '12px 16px',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          <div style={{ color: 'var(--cyan)', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={12} /> SPATIAL ZONE TOPOLOGY
          </div>

          {searchRegion ? (
            <>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>BOUNDS: </span>
                [{Math.round(searchRegion.x1)}, {Math.round(searchRegion.z1)}] TO [{Math.round(searchRegion.x2)}, {Math.round(searchRegion.z2)}]
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                <span style={{ color: 'var(--text-dim)' }}>ACTIVE UNITS: </span>
                {activeCount} DRONES DEPLOYED
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const isActive = i < activeCount
                  const zoneChar = String.fromCharCode(65 + i)
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      padding: '4px 6px',
                      background: isActive ? 'rgba(0,0,0,0.3)' : 'transparent',
                      borderLeft: isActive ? `2px solid ${DRONE_COLORS[i]}` : '2px solid transparent',
                      color: isActive ? 'var(--text-secondary)' : 'var(--text-dim)',
                    }}>
                      <span>ZONE {zoneChar}</span>
                      <span>{isActive ? `DRONE-0${i + 1}` : 'STANDBY'}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '10px', color: 'var(--orange)', fontStyle: 'italic', padding: '10px 0' }}>
              No active region mapped. Please outline a target perimeter.
            </div>
          )}
        </div>
      )}

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
              { label: 'Zone radius',      value: '5.2km' },
              { label: 'Search pattern',   value: 'Adaptive Swarm' },
              { label: 'Thermal threshold', value: '36.5°C' },
              { label: 'Network link',     value: 'L-BAND / AES-256' },
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

      {/* Auxiliary Actions */}
      <div style={{
        borderTop: '1px solid var(--border-color)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button
          onClick={() => {
            if (!showZones) setShowZones(true)
            setCoordinationPanelOpen(true)
          }}
          style={{
            background: showZones ? 'var(--cyan)' : 'var(--cyan-dim)',
            border: '1px solid var(--cyan)',
            padding: '8px 12px',
            color: showZones ? '#000' : 'var(--cyan)',
            fontFamily: 'JetBrains Mono',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '4px',
            cursor: 'pointer',
            letterSpacing: '1px',
            display: 'flex',
            justifyContent: 'center',
            transition: 'background 0.2s, color 0.2s',
          }}
          onMouseOver={e => {
            if (!showZones) e.currentTarget.style.background = 'rgba(0, 229, 255, 0.2)'
          }}
          onMouseOut={e => {
            if (!showZones) e.currentTarget.style.background = 'var(--cyan-dim)'
          }}
        >
          OPEN MISSION DASHBOARD
        </button>
      </div>

      {/* ── Hardware Failure Modal ── */}
      {failureModalDroneId !== null && (
        <FailureModal
          droneId={failureModalDroneId}
          onClose={() => setFailureModalDroneId(null)}
        />
      )}
    </div>
  )
}
