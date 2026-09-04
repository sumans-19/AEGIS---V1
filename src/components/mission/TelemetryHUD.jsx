import { useEffect, useState, useRef } from 'react'
import { Activity, MapPin } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

// Throttled telemetry — only updates at 10fps to reduce CPU load
export default function TelemetryHUD({ drone }) {
  const [telemetry, setTelemetry] = useState({
    agl: 0,
    lat: 34.052235,
    lng: -118.243683,
    pitch: 0,
    roll: 0,
    airQuality: 100,
  })

  const prevPosRef = useRef(null)
  const lastUpdateRef = useRef(0)

  useEffect(() => {
    if (!drone) return

    const interval = setInterval(() => {
      if (!drone.pos) return

      const [dx, dy, dz] = drone.pos
      const now = performance.now()
      const dt = (now - lastUpdateRef.current) / 1000
      lastUpdateRef.current = now

      const agl = Math.max(0, dy)
      const lat = 34.052235 + (dz * 0.000008)
      const lng = -118.243683 + (dx * 0.000008)

      let pitch = 0
      let roll = 0

      if (prevPosRef.current && dt > 0) {
        const velX = (dx - prevPosRef.current.x) / Math.max(dt, 0.016)
        const velZ = (dz - prevPosRef.current.z) / Math.max(dt, 0.016)
        const speed = Math.sqrt(velX * velX + velZ * velZ)
        pitch = Math.min(15, speed * 1.2)
        roll = (velX > 0.1 ? 5 : velX < -0.1 ? -5 : 0)
      }
      prevPosRef.current = { x: dx, y: dy, z: dz }

      const noise = Math.sin(dx * 0.1) * Math.cos(dz * 0.1) * 20
      const airQuality = Math.min(100, Math.max(0, (dy * 2) + 40 + noise))

      setTelemetry({ agl, lat, lng, pitch, roll, airQuality })
    }, 100) // 10fps update rate

    return () => clearInterval(interval)
  }, [drone])

  if (!drone) return null

  return (
    <div style={{
      padding: '8px 12px',
      background: '#040709',
      borderTop: '1px solid rgba(0,229,255,0.1)',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      color: '#00e5ff',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '10px',
      flexShrink: 0,
    }}>
      {/* GPS & Altitude */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
          <MapPin size={9} />
          <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px' }}>SPATIAL</span>
        </div>
        <div>AGL: {telemetry.agl.toFixed(1)}m</div>
        <div>LAT: {telemetry.lat.toFixed(6)}°</div>
        <div>LNG: {telemetry.lng.toFixed(6)}°</div>
      </div>

      {/* IMU & Env */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
          <Activity size={9} />
          <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '1px' }}>SENSORS</span>
        </div>
        <div>PTCH: {telemetry.pitch.toFixed(1)}°</div>
        <div>ROLL: {telemetry.roll.toFixed(1)}°</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>AQI:</span>
          <div style={{ flex: 1, height: '3px', background: '#1c2528', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${telemetry.airQuality}%`,
              height: '100%',
              background: telemetry.airQuality < 50 ? '#ff4444' : telemetry.airQuality < 80 ? '#ffaa00' : '#00e5ff',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <span>{Math.round(telemetry.airQuality)}</span>
        </div>
      </div>

      {/* RL Advisory Badge */}
      {drone.action === 'RL_ADVISORY' && (
        <div style={{
          gridColumn: '1 / -1',
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid #a855f7',
          color: '#a855f7',
          padding: '4px',
          textAlign: 'center',
          fontWeight: 'bold',
          letterSpacing: '1px',
          borderRadius: '2px',
          marginTop: '4px'
        }}>
          🧠 RL ADVISORY
        </div>
      )}

      {/* GPS Denied Badge */}
      {drone.gps_status === false && (
        <div style={{
          gridColumn: '1 / -1',
          background: 'rgba(220, 53, 69, 0.15)',
          border: '1px solid #dc3545',
          color: '#dc3545',
          padding: '4px',
          textAlign: 'center',
          fontWeight: 'bold',
          letterSpacing: '1px',
          borderRadius: '2px',
          marginTop: '4px'
        }}>
          ⚠ GPS DENIED — DEAD RECKONING
        </div>
      )}
    </div>
  )
}
