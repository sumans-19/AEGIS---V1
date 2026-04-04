import { useSimStore } from '../../store/useSimStore'

const STATUS_COLORS = {
  SCANNING: '#00e5ff',
  RETURNING: '#ff6b2b',
  SEARCHING: '#ffb300',
  CHARGING: '#00ff88',
}

export default function DroneCard({ drone }) {
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const isSelected = selectedDrone === drone.id

  const statusColor = STATUS_COLORS[drone.status] || 'var(--text-dim)'
  const batteryColor = drone.battery < 20 ? 'var(--red)' : drone.battery < 50 ? 'var(--orange)' : 'var(--green)'

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
          }}>
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
            width: 6,
            height: 6,
            borderRadius: '50%',
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
        borderRadius: '4px'
      }}>
        <div style={{
          width: `${drone.battery}%`,
          height: '100%',
          background: batteryColor,
          transition: 'width 0.3s, background 0.3s',
        }} />
      </div>

      {/* Bottom row: Alt, Speed, Battery % */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        color: 'var(--text-secondary)',
        letterSpacing: '0.5px',
        fontWeight: 500,
      }}>
        <span>ALT {Math.round(drone.pos?.[1] || 0)}m</span>
        <span>SPD {Math.round(drone.speed || 0)}m/s</span>
        <span style={{ color: batteryColor, fontWeight: 700 }}>{Math.round(drone.battery || 0)}%</span>
      </div>
    </div>
  )
}
