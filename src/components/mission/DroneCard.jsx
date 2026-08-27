import { useSimStore } from '../../store/useSimStore'

const STATUS_COLORS = {
  IDLE: '#6C7F84',
  SCANNING: '#79B9C1',
  DEPLOYING: '#3b82f6',
  RETURNING: '#f59e0b',
  SEARCHING: '#79B9C1',
  CHARGING: '#58ba8a',
  HOVER: '#6C7F84',
}

const DRONE_COLORS = [
  '#79B9C1', '#f59e0b', '#58ba8a', '#8b5cf6', '#D4A844',
]

export default function DroneCard({ drone }) {
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)
  const isSelected = selectedDrone === drone.id

  const statusColor = STATUS_COLORS[drone.status] || '#6C7F84'
  const droneColor = DRONE_COLORS[(drone.id - 1) % DRONE_COLORS.length]
  const batteryColor = drone.battery < 20 ? '#dc3545' : drone.battery < 50 ? '#f59e0b' : '#79B9C1'

  return (
    <div
      onClick={() => setSelectedDrone(isSelected ? null : drone.id)}
      style={{
        padding: '10px 12px',
        background: isSelected ? '#B9DCE1' : 'rgba(235, 243, 245, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${isSelected ? '#79B9C1' : 'rgba(255, 255, 255, 0.95)'}`,
        outline: '1px solid rgba(0, 0, 0, 0.07)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: isSelected ? '0 4px 14px rgba(121, 185, 193, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.85)' : '0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
      onMouseOver={e => {
        if (!isSelected) {
          e.currentTarget.style.background = '#FFFFFF'
          e.currentTarget.style.borderColor = 'rgba(121, 185, 193, 0.7)'
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.06), inset 0 1px 0 #FFFFFF'
        }
      }}
      onMouseOut={e => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(235, 243, 245, 0.85)'
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.95)'
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF'
        }
      }}
    >
      {/* Top row: Name + Status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '9.5px',
            fontWeight: 800,
            color: '#172124',
            letterSpacing: '0.04em',
          }}>
            {drone.name}
          </span>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: droneColor, boxShadow: `0 0 5px ${droneColor}`
          }} />
          <span style={{
            fontFamily: 'var(--font-primary)',
            fontSize: '8px',
            fontWeight: 700,
            color: '#55666B',
            letterSpacing: '0.06em',
          }}>
            {drone.callsign}
          </span>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '7.5px',
          fontFamily: 'var(--font-primary)',
          color: '#384A4F',
          letterSpacing: '0.08em',
          fontWeight: 800,
          textTransform: 'uppercase',
        }}>
          <div className="pulse-dot" style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 5px ${statusColor}`,
          }} />
          {drone.status}
        </div>
      </div>

      {/* Battery bar */}
      <div style={{
        width: '100%',
        height: '3.5px',
        background: 'rgba(0, 0, 0, 0.08)',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${drone.battery}%`,
          height: '100%',
          background: batteryColor,
          borderRadius: '2px',
          boxShadow: `0 0 4px ${batteryColor}80`,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Bottom row: Alt, Speed, Battery % */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontFamily: 'var(--font-primary)',
        fontSize: '7px',
        color: '#6C7F84',
        fontWeight: 700,
        paddingTop: '1px',
      }}>
        <span>ALT <strong style={{ color: '#172124', fontSize: '8.5px' }}>{Math.round(drone.pos?.[1] || 0)}m</strong></span>
        <span>SPD <strong style={{ color: '#172124', fontSize: '8.5px' }}>{Math.round(drone.speed || 0)}m/s</strong></span>
        <span>BAT <strong style={{ color: drone.battery < 20 ? '#dc3545' : '#1a565e', fontSize: '8.5px' }}>{Math.round(drone.battery || 0)}%</strong></span>
      </div>
    </div>
  )
}
