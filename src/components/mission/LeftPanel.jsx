import { useState } from 'react'
import { useSimStore } from '../../store/useSimStore'
import DroneCard from './DroneCard'
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react'
import { getActiveDronesCount } from '../../hooks/useDroneMovement'

const DRONE_COLORS = ['#79B9C1', '#f59e0b', '#58ba8a', '#8b5cf6', '#D4A844']

export default function LeftPanel() {
  const drones = useSimStore(s => s.drones)
  const parametersOpen = useSimStore(s => s.parametersOpen)
  const toggleParameters = useSimStore(s => s.toggleParameters)
  const searchRegion = useSimStore(s => s.searchRegion)
  const setCoordinationPanelOpen = useSimStore(s => s.setCoordinationPanelOpen)
  
  const [showZones, setShowZones] = useState(false)
  const activeCount = searchRegion ? getActiveDronesCount(searchRegion) : 0

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Title */}
      <div style={{
        padding: '12px 14px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <div style={{
          fontFamily: 'var(--font-primary)',
          fontSize: '7.5px',
          fontWeight: 800,
          color: '#55666B',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          FLEET STATUS
        </div>
        <div style={{
          fontFamily: 'var(--font-primary)',
          fontSize: '13px',
          fontWeight: 800,
          color: '#172124',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          DRONE FLEET SWARM
        </div>
      </div>

      {/* Drone list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}>
        {drones.map(drone => (
          <DroneCard key={drone.id} drone={drone} />
        ))}
      </div>

      {/* Mapped Zones Info Board */}
      {showZones && (
        <div style={{
          background: 'rgba(235, 243, 245, 0.85)',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)',
          padding: '10px 14px',
          fontFamily: 'var(--font-primary)',
        }}>
          <div style={{ color: '#1a565e', fontSize: '9px', fontWeight: 800, letterSpacing: '0.06em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={11} color="#79B9C1" /> SPATIAL ZONE TOPOLOGY
          </div>
          
          {searchRegion ? (
            <>
              <div style={{ fontSize: '9px', color: '#55666B', marginBottom: '3px' }}>
                <span style={{ color: '#8A9A9E', fontWeight: 700 }}>BOUNDS: </span> 
                [{Math.round(searchRegion.x1)}, {Math.round(searchRegion.z1)}] TO [{Math.round(searchRegion.x2)}, {Math.round(searchRegion.z2)}]
              </div>
              <div style={{ fontSize: '9px', color: '#55666B', marginBottom: '8px' }}>
                <span style={{ color: '#8A9A9E', fontWeight: 700 }}>ACTIVE UNITS: </span> 
                {activeCount} DRONES DEPLOYED
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const isActive = i < activeCount
                  const zoneChar = String.fromCharCode(65 + i)
                  return (
                    <div key={i} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '8px',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      background: isActive ? 'rgba(255, 255, 255, 0.6)' : 'transparent',
                      borderLeft: isActive ? `3px solid ${DRONE_COLORS[i]}` : '3px solid transparent',
                      color: isActive ? '#172124' : '#8A9A9E',
                      fontWeight: 700,
                    }}>
                      <span>ZONE {zoneChar}</span>
                      <span>{isActive ? `DRONE-0${i + 1}` : 'STANDBY'}</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '8.5px', color: '#dc3545', fontStyle: 'italic', padding: '6px 0', fontWeight: 600 }}>
              No active region mapped. Please outline a target perimeter.
            </div>
          )}
        </div>
      )}

      {/* Mission Parameters */}
      <div style={{
        margin: '4px 8px',
        background: 'rgba(235, 243, 245, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.95)',
        outline: '1px solid rgba(0, 0, 0, 0.07)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <button
          onClick={toggleParameters}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: '#172124',
            cursor: 'pointer',
            fontFamily: 'var(--font-primary)',
            fontSize: '8px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            transition: 'background 0.15s ease',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          MISSION PARAMETERS
          {parametersOpen ? <ChevronUp size={12} color="#6C7F84" /> : <ChevronDown size={12} color="#6C7F84" />}
        </button>

        {parametersOpen && (
          <div style={{
            padding: '6px 12px 8px',
            fontFamily: 'var(--font-primary)',
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            background: 'rgba(255, 255, 255, 0.4)',
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
                padding: '3px 0',
                fontSize: '7.5px',
                borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
              }}>
                <span style={{ color: '#6C7F84', fontWeight: 700 }}>{param.label}</span>
                <span style={{ color: '#172124', fontWeight: 800 }}>{param.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auxiliary Actions */}
      <div style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button
          onClick={() => {
            if (!showZones) setShowZones(true)
            setCoordinationPanelOpen(true)
          }}
          style={{
            background: 'rgba(121, 185, 193, 0.2)',
            border: '1px solid #79B9C1',
            padding: '7px 10px',
            color: '#172124',
            fontFamily: 'var(--font-primary)',
            fontSize: '8px',
            fontWeight: 800,
            borderRadius: '6px',
            cursor: 'pointer',
            letterSpacing: '0.08em',
            display: 'flex',
            justifyContent: 'center',
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(121, 185, 193, 0.25)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#79B9C1'
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(121, 185, 193, 0.4)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'rgba(121, 185, 193, 0.2)'
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(121, 185, 193, 0.25)'
          }}
        >
          OPEN MISSION DASHBOARD
        </button>
      </div>
    </div>
  )
}
