import React from 'react'
import { AlertTriangle, Zap } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

const STATUS_COLORS = {
  IDLE: '#64748b',
  SCANNING: '#00e5ff',
  DEPLOYING: '#a855f7',
  RETURNING: '#ff6b2b',
  SEARCHING: '#ffb300',
  STANDBY: '#64748b',
  TAKEOVER: '#00ff88',
  FAILED_RTB: '#ff2929',
  FAILED_DOCKED: '#ff6b2b',
  CHARGING: '#00ff88',
  HOVER: '#94a3b8',
}

const DRONE_COLORS = [
  '#00e5ff', '#ff6b2b', '#00ff88', '#a855f7', '#ffb300',
]

export default React.memo(function DroneCard({ drone, onInjectFailure }) {
  const selectedDrone    = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const missionPhase     = useSimStore(s => s.missionPhase)
  const hardwareFailures = useSimStore(s => s.hardwareFailures)
  const isSelected       = selectedDrone === drone.id

  const statusColor  = STATUS_COLORS[drone.status] || 'var(--text-dim)'
  const droneColor   = DRONE_COLORS[(drone.id - 1) % DRONE_COLORS.length]
  const batteryColor = drone.battery < 20 ? 'var(--red)' : drone.battery < 50 ? 'var(--orange)' : 'var(--green)'

  const canInjectFailure = ['DEPLOYING', 'SEARCHING', 'ALL_FOUND'].includes(missionPhase)
  const existingFailure  = hardwareFailures?.[drone.id]
  const droneHasFailure  = !!(existingFailure && existingFailure.status !== 'CLEARED')

  return (
    <div
      onClick={() => setSelectedDrone(isSelected ? null : drone.id)}
      style={{
        padding: '12px 14px',
        marginBottom: '8px',
        background: isSelected ? 'var(--cyan-dim)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? 'var(--cyan)' : 'var(--border-color)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: isSelected ? 'var(--cyan-glow)' : 'none',
        borderRadius: '6px',
      }}
      onMouseOver={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--cyan-dim)'
          e.currentTarget.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseOut={e => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.transform = 'none'
        }
      }}
    >
      {/* Top row: Name + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <span style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '1px',
          }}>
            {drone.name}
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: 'var(--text-dim)',
            marginLeft: '8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: droneColor, boxShadow: `0 0 6px ${droneColor}`,
            }} />
            {drone.callsign}
          </span>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '9px',
          fontFamily: 'JetBrains Mono, monospace',
          color: statusColor,
          letterSpacing: '0.5px',
          fontWeight: 700,
        }}>
          <div className="pulse-dot" style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
          }} />
          {drone.status}
        </div>
      </div>

      {/* Battery bar */}
      <div style={{
        width: '100%',
        height: '4px',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        marginBottom: '8px',
        overflow: 'hidden',
        borderRadius: '4px',
      }}>
        <div style={{
          width: `${drone.battery}%`,
          height: '100%',
          background: batteryColor,
          transition: 'width 0.3s, background 0.3s',
        }} />
      </div>

      {/* Failure label — shown when a failure is active */}
      {drone.failureLabel && (
        <div style={{
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '9px',
          color: drone.failureSeverity === 'critical' ? 'var(--red)' : 'var(--orange)',
          letterSpacing: '0.5px',
          padding: '4px 8px',
          background: drone.failureSeverity === 'critical' ? 'rgba(255,48,48,0.08)' : 'rgba(255,179,0,0.07)',
          border: `1px solid ${drone.failureSeverity === 'critical' ? 'rgba(255,48,48,0.25)' : 'rgba(255,179,0,0.2)'}`,
          borderRadius: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          <AlertTriangle size={10} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            FAILURE: {drone.failureLabel}
          </span>
          {drone.status === 'FAILED_RTB'    && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>RTB</span>}
          {drone.status === 'FAILED_DOCKED' && <span style={{ marginLeft: 'auto', flexShrink: 0 }}>DOCKED</span>}
        </div>
      )}

      {/* Bottom row: Alt, Speed, Battery % */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: 'var(--text-secondary)',
        letterSpacing: '0.5px',
        fontWeight: 500,
        marginBottom: canInjectFailure ? '10px' : '0',
      }}>
        <span>ALT {Math.round(drone.pos?.[1] || 0)}m</span>
        <span>SPD {Math.round(drone.speed || 0)}m/s</span>
        <span style={{ color: batteryColor, fontWeight: 700 }}>{Math.round(drone.battery || 0)}%</span>
      </div>

      {/* ── Inject Failure button ── visible only during active mission phases */}
      {canInjectFailure && (
        <button
          onClick={e => {
            e.stopPropagation()
            if (onInjectFailure) onInjectFailure(drone.id)
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '6px 10px',
            background: droneHasFailure ? 'rgba(71,85,105,0.1)' : 'rgba(255,48,48,0.07)',
            border: `1px solid ${droneHasFailure ? 'rgba(71,85,105,0.2)' : 'rgba(255,48,48,0.28)'}`,
            borderRadius: '4px',
            cursor: droneHasFailure ? 'not-allowed' : 'pointer',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '1px',
            color: droneHasFailure ? 'var(--text-dim)' : '#ff6060',
            opacity: droneHasFailure ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
          onMouseOver={e => {
            if (!droneHasFailure) {
              e.currentTarget.style.background = 'rgba(255,48,48,0.15)'
              e.currentTarget.style.borderColor = 'rgba(255,48,48,0.5)'
            }
          }}
          onMouseOut={e => {
            if (!droneHasFailure) {
              e.currentTarget.style.background = 'rgba(255,48,48,0.07)'
              e.currentTarget.style.borderColor = 'rgba(255,48,48,0.28)'
            }
          }}
        >
          <Zap size={10} />
          {droneHasFailure ? 'FAILURE ACTIVE' : '⚡ INJECT FAILURE'}
        </button>
      )}
    </div>
  )
})
