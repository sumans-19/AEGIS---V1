import { useSimStore } from '../store/useSimStore'

const textStyle = { color: '#55666B', fontSize: '12px', margin: '4px 0', fontFamily: 'var(--font-primary)', fontWeight: 600 }
const alertStyle = { color: '#dc3545', fontSize: '11px', margin: '6px 0 0', fontWeight: 800, fontFamily: 'var(--font-primary)' }

/** Format 0–100 metrics; scale fractional values (e.g. 0.984 → 98.4). */
function formatMetric(value, decimals = 1) {
  const n = Number(value)
  if (!Number.isFinite(n)) return (0).toFixed(decimals)
  const scaled = n > 0 && n <= 1 ? n * 100 : n
  return scaled.toFixed(decimals)
}

export default function RightPanel() {
  const telemetry = useSimStore((s) => s.telemetry)
  const selectedDrone = useSimStore((s) => s.selectedDrone)

  const drone =
    telemetry?.drones?.find((d) => d.id === selectedDrone) ?? telemetry?.drones?.[0]

  const batteryRaw = telemetry?.battery ?? drone?.battery ?? 0
  const batteryNum = Number(batteryRaw)
  const battery =
    Number.isFinite(batteryNum) && batteryNum > 0 && batteryNum <= 1
      ? batteryNum * 100
      : batteryNum
  const signal = telemetry?.signal_strength ?? drone?.signal ?? drone?.signal_strength ?? 0
  const thermalStatus = telemetry?.thermal_status ?? drone?.thermal_status ?? true
  const propeller = telemetry?.propeller_health ?? drone?.propeller ?? drone?.propeller_health ?? 0
  const cpuTemp = telemetry?.cpu_temp ?? drone?.cpu_temp ?? 0
  const motorTemp = telemetry?.motor_temp ?? drone?.motor_temp ?? 0
  const liveDrone = useSimStore((s) =>
    s.liveAiDrones?.find((d) => d.id === selectedDrone) ?? s.liveAiDrones?.[0],
  )
  const rawAction = liveDrone?.action ?? drone?.action

  let actionText = 'UNKNOWN'
  let reasonText = ''

  try {
    if (typeof rawAction === 'string') {
      const parsed = JSON.parse(rawAction.replace(/'/g, '"'))

      actionText = parsed.action || rawAction
      reasonText = parsed.reason || ''
    } else if (typeof rawAction === 'object' && rawAction !== null) {
      actionText = rawAction.action || 'UNKNOWN'
      reasonText = rawAction.reason || ''
    }
  } catch (e) {
    actionText = rawAction
  }

  return (
    <section style={{ padding: '16px', fontFamily: 'var(--font-primary)' }}>
      <h2 style={{ color: '#1a565e', fontSize: '11px', letterSpacing: '0.08em', fontWeight: 800, textTransform: 'uppercase' }}>
        TELEMETRY PANEL
      </h2>
      <p style={textStyle}>Battery: {formatMetric(batteryRaw, 1)}%</p>
      <p style={textStyle}>Signal: {formatMetric(signal, 1)}</p>
      <p style={textStyle}>Thermal: {thermalStatus ? 'OK' : 'FAIL'}</p>
      <p style={textStyle}>Propeller: {Number(propeller).toFixed(0)}%</p>
      <p style={textStyle}>CPU: {formatMetric(cpuTemp, 1)}°C</p>
      <p style={textStyle}>Motor: {formatMetric(motorTemp, 1)}°C</p>
      <div style={{ marginTop: '10px' }}>
        <div style={{ color: '#172124', fontWeight: 800, fontSize: '12px' }}>AI ACTION: {actionText}</div>
        {reasonText && (
          <div style={{ color: '#55666B', fontSize: '10.5px', marginTop: '2px' }}>
            Reason: {reasonText}
          </div>
        )}
      </div>
      {battery < 20 && <p style={alertStyle}>Battery Critical</p>}
      {!thermalStatus && <p style={alertStyle}>Thermal Failure</p>}
    </section>
  )
}
