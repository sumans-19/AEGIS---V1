import { useSimStore } from '../../store/useSimStore'
import { Activity, Battery, Navigation, Signal, Wind, Compass, MapPin } from 'lucide-react'

function DataCard({ title, icon: Icon, value, unit, status = 'normal' }) {
  const colors = {
    normal: '#00e5ff',
    warning: '#f59e0b',
    critical: '#ef4444',
  }
  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: '6px',
      padding: '8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
        <Icon size={10} />
        {title}
      </div>
      <div style={{ color: colors[status], fontSize: '13px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
        {value} <span style={{ color: '#94a3b8', fontSize: '10px' }}>{unit}</span>
      </div>
    </div>
  )
}

export default function SensorLogView({ drone }) {
  const sensorHistory = useSimStore(s => s.sensorHistory)
  const history = sensorHistory[drone.id] || []
  const latest = history[history.length - 1] || null

  if (!latest) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '10px' }}>
        Awaiting high-fidelity sensor telemetry...
      </div>
    )
  }

  // Determine status for UI colors
  const voltageStatus = latest.battery_voltage < 13.5 ? 'critical' : latest.battery_voltage < 14.5 ? 'warning' : 'normal'
  const co2Status = latest.co2_ppm > 1500 ? 'critical' : latest.co2_ppm > 800 ? 'warning' : 'normal'
  const lidarStatus = latest.lidar_dist < 2.0 ? 'critical' : 'normal'

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#111827',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      fontFamily: 'var(--font-primary)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.2)',
        gap: '8px'
      }}>
        <Activity size={16} color="#00e5ff" />
        <span style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>
          VIRTUAL HARDWARE DIAGNOSTICS
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Power System */}
        <section>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>POWER SYSTEM (4S LiPo)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <DataCard title="VOLTAGE" icon={Battery} value={latest.battery_voltage.toFixed(2)} unit="V" status={voltageStatus} />
            <DataCard title="REMAINING" icon={Battery} value={latest.battery} unit="%" status={latest.battery < 20 ? 'critical' : 'normal'} />
          </div>
        </section>

        {/* Environmental */}
        <section>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>ENVIRONMENTAL & SPATIAL</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <DataCard title="BAROMETER" icon={Wind} value={latest.baro_hpa.toFixed(1)} unit="hPa" />
            <DataCard title="DOWNWARD LIDAR" icon={MapPin} value={latest.lidar_dist.toFixed(2)} unit="m" status={lidarStatus} />
            <DataCard title="AIR QUALITY (CO2)" icon={Activity} value={latest.co2_ppm.toFixed(0)} unit="PPM" status={co2Status} />
            <DataCard title="MESH LINK" icon={Signal} value={latest.signal} unit="%" status={latest.signal < 40 ? 'warning' : 'normal'} />
          </div>
        </section>

        {/* IMU */}
        <section>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold' }}>IMU RAW OUTPUT (Noise Active)</div>
          <div style={{ 
            background: 'rgba(0,0,0,0.3)', 
            border: '1px solid rgba(255,255,255,0.05)', 
            borderRadius: '6px', 
            padding: '8px',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: '#00e5ff'
          }}>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <Compass size={12} color="#64748b" /> 
              <span style={{ color: '#64748b' }}>ACCELEROMETER (m/s²)</span>
            </div>
            <div>X: {latest.imu_accel[0].toFixed(3)}</div>
            <div>Y: {latest.imu_accel[1].toFixed(3)}</div>
            <div>Z: {latest.imu_accel[2].toFixed(3)}</div>
            
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />
            
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <Compass size={12} color="#64748b" /> 
              <span style={{ color: '#64748b' }}>GYROSCOPE (rad/s)</span>
            </div>
            <div>P: {latest.imu_gyro[0].toFixed(3)}</div>
            <div>R: {latest.imu_gyro[1].toFixed(3)}</div>
            <div>Y: {latest.imu_gyro[2].toFixed(3)}</div>
          </div>
        </section>

      </div>
    </div>
  )
}
