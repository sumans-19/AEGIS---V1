import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Activity, AlertTriangle, Battery, Crosshair, MapPin, Navigation, Radio, Route, ScrollText, Send, WifiOff } from 'lucide-react'
import { useSimStore } from '../store/useSimStore'
import { useSimulation } from '../hooks/useSimulation'
import { HARDWARE_FAILURE_TYPES, triggerHardwareFailure } from '../hooks/useDroneMovement'

const DRONE_COLORS = {
  1: '#00e5ff',
  2: '#ff6b2b',
  3: '#00ff88',
  4: '#e040fb',
  5: '#f9e23c',
}

const LOG_COLORS = {
  system: '#94a3b8',
  standby: '#64748b',
  path: '#00e5ff',
  object: '#00ff88',
  relay: '#a855f7',
  warning: '#ffb300',
  critical: '#ff2929',
  drone: '#00e5ff',
}

const FAILURE_ICONS = {
  battery_failure: Battery,
  sensor_failure: Radio,
  motor_failure: AlertTriangle,
  comms_failure: WifiOff,
  gps_failure: Navigation,
}

function overrideDisplayPath(override) {
  if (!override) return null
  if (override.mode === 'return-to-base') return override.path
  if (override.mode === 'takeover') return [
    ...(override.entryPath || []),
    ...(override.operationPath || []),
  ]
  return null
}

function applyOverridePaths(paths = {}, overrides = {}) {
  const nextPaths = { ...paths }
  Object.entries(overrides || {}).forEach(([droneId, override]) => {
    const overridePath = overrideDisplayPath(override)
    if (overridePath?.length > 1) nextPaths[droneId] = overridePath
  })
  return nextPaths
}

function getActivePaths(state) {
  const phase = state.missionPhase
  const withOverrides = paths => applyOverridePaths(paths, state.dronePathOverrides)
  if (phase === 'RETURNING') return { label: 'RETURN', paths: withOverrides(state.returnPaths) }
  if (phase === 'DEPLOYING') return { label: 'DEPLOY', paths: withOverrides(state.deployPaths) }
  if (phase === 'SEARCHING' || phase === 'ALL_FOUND') return { label: 'SEARCH', paths: withOverrides(state.searchPaths) }
  if (Object.keys(state.searchPaths || {}).length) return { label: 'SEARCH', paths: withOverrides(state.searchPaths) }
  if (Object.keys(state.deployPaths || {}).length) return { label: 'DEPLOY', paths: withOverrides(state.deployPaths) }
  return { label: 'STANDBY', paths: withOverrides({}) }
}

function pathDistance(path = []) {
  let distance = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x
    const dz = path[i].z - path[i - 1].z
    distance += Math.sqrt(dx * dx + dz * dz)
  }
  return distance
}

function formatTime(seconds = 0) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function PathCanvas({ selectedDroneId }) {
  const canvasRef = useRef(null)
  const missionPhase = useSimStore(s => s.missionPhase)
  const drones = useSimStore(s => s.drones)
  const searchRegion = useSimStore(s => s.searchRegion)
  const detectedObjects = useSimStore(s => s.detectedObjects)
  const deployPaths = useSimStore(s => s.deployPaths)
  const searchPaths = useSimStore(s => s.searchPaths)
  const returnPaths = useSimStore(s => s.returnPaths)
  const dronePathOverrides = useSimStore(s => s.dronePathOverrides)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let frame

    const toCanvas = (x, z) => ({
      x: ((x + 230) / 460) * canvas.width,
      y: ((z + 230) / 460) * canvas.height,
    })

    const drawPath = (path, color, selected, tick) => {
      if (!path || path.length < 2) return
      ctx.beginPath()
      path.forEach((point, idx) => {
        const p = toCanvas(point.x, point.z)
        if (idx === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.strokeStyle = selected ? color : `${color}55`
      ctx.lineWidth = selected ? 3 : 1.5
      ctx.lineJoin = 'round'
      ctx.shadowBlur = selected ? 12 : 0
      ctx.shadowColor = color
      ctx.setLineDash(selected ? [10, 6] : [4, 6])
      ctx.lineDashOffset = -tick * 0.5
      ctx.stroke()
      ctx.setLineDash([])
      ctx.shadowBlur = 0
    }

    let tick = 0
    const render = () => {
      tick += 1
      const state = { missionPhase, deployPaths, searchPaths, returnPaths, dronePathOverrides }
      const active = getActivePaths(state)

      ctx.fillStyle = '#04080d'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.strokeStyle = 'rgba(0,229,255,0.08)'
      ctx.lineWidth = 1
      for (let i = -200; i <= 200; i += 40) {
        const a = toCanvas(i, -220)
        const b = toCanvas(i, 220)
        const c = toCanvas(-220, i)
        const d = toCanvas(220, i)
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.moveTo(c.x, c.y)
        ctx.lineTo(d.x, d.y)
        ctx.stroke()
      }

      if (searchRegion) {
        const p1 = toCanvas(searchRegion.x1, searchRegion.z1)
        const p2 = toCanvas(searchRegion.x2, searchRegion.z2)
        ctx.fillStyle = 'rgba(0,229,255,0.045)'
        ctx.strokeStyle = 'rgba(0,229,255,0.35)'
        ctx.lineWidth = 1.5
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
      }

      drones.forEach(drone => {
        const color = DRONE_COLORS[drone.id] || '#94a3b8'
        const path = active.paths?.[drone.id] || active.paths?.[String(drone.id)]
        drawPath(path, color, drone.id === selectedDroneId, tick)
      })

      detectedObjects.forEach(object => {
        const [x, , z] = object.pos || [0, 0, 0]
        const p = toCanvas(x, z)
        const color = object.relayedTo?.length ? '#a855f7' : '#00ff88'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 7 + Math.sin(tick * 0.08) * 2, 0, Math.PI * 2)
        ctx.strokeStyle = `${color}aa`
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })

      drones.forEach(drone => {
        const p = toCanvas(drone.pos?.[0] || 0, drone.pos?.[2] || 0)
        const color = DRONE_COLORS[drone.id] || '#94a3b8'
        const selected = drone.id === selectedDroneId
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(((drone.heading || 0) * Math.PI) / 180)
        ctx.beginPath()
        ctx.moveTo(0, -10)
        ctx.lineTo(-7, 8)
        ctx.lineTo(7, 8)
        ctx.closePath()
        ctx.fillStyle = selected ? color : `${color}aa`
        ctx.shadowBlur = selected ? 14 : 0
        ctx.shadowColor = color
        ctx.fill()
        ctx.restore()
        ctx.fillStyle = selected ? color : '#64748b'
        ctx.font = `${selected ? 'bold ' : ''}11px JetBrains Mono`
        ctx.textAlign = 'center'
        ctx.fillText(drone.callsign, p.x, p.y - 16)
      })

      ctx.fillStyle = 'rgba(4,8,13,0.82)'
      ctx.fillRect(18, 18, 170, 38)
      ctx.strokeStyle = 'rgba(0,229,255,0.22)'
      ctx.strokeRect(18, 18, 170, 38)
      ctx.fillStyle = '#00e5ff'
      ctx.font = 'bold 12px JetBrains Mono'
      ctx.textAlign = 'left'
      ctx.fillText(`ACTIVE PATH: ${active.label}`, 34, 42)

      frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [missionPhase, drones, searchRegion, detectedObjects, deployPaths, searchPaths, returnPaths, dronePathOverrides, selectedDroneId])

  return <canvas ref={canvasRef} width={1000} height={620} style={{ width: '100%', height: '100%', display: 'block' }} />
}

export default function DronePathfinding() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const setScenario = useSimStore(s => s.setScenario)
  const missionPhase = useSimStore(s => s.missionPhase)
  const simulationRunning = useSimStore(s => s.simulationRunning)
  const drones = useSimStore(s => s.drones)
  const droneLogs = useSimStore(s => s.droneLogs)
  const detectedObjects = useSimStore(s => s.detectedObjects)
  const deployPaths = useSimStore(s => s.deployPaths)
  const searchPaths = useSimStore(s => s.searchPaths)
  const returnPaths = useSimStore(s => s.returnPaths)
  const dronePathOverrides = useSimStore(s => s.dronePathOverrides)
  const hardwareFailures = useSimStore(s => s.hardwareFailures)
  const [selectedDroneId, setSelectedDroneId] = useState(1)

  useSimulation()

  useEffect(() => {
    const scenario = searchParams.get('scenario')
    if (scenario) setScenario(scenario)
  }, [searchParams, setScenario])

  const selectedDrone = drones.find(d => d.id === selectedDroneId) || drones[0]
  const selectedLogs = droneLogs?.[selectedDroneId] || droneLogs?.[String(selectedDroneId)] || []
  const activeFailure = selectedDrone ? hardwareFailures?.[selectedDrone.id] : null
  const activePaths = getActivePaths({ missionPhase, deployPaths, searchPaths, returnPaths, dronePathOverrides })

  const droneStats = useMemo(() => drones.map(drone => {
    const path = activePaths.paths?.[drone.id] || activePaths.paths?.[String(drone.id)] || []
    const relays = detectedObjects.filter(object => object.relayedTo?.includes(drone.id)).length
    const detections = detectedObjects.filter(object => object.detectedBy === drone.id).length
    return {
      drone,
      path,
      distance: pathDistance(path),
      relays,
      detections,
      logs: droneLogs?.[drone.id] || droneLogs?.[String(drone.id)] || [],
    }
  }), [drones, activePaths.paths, droneLogs, detectedObjects])

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: '#03070c',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      <div style={{
        height: 58,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px',
        borderBottom: '1px solid rgba(0,229,255,0.22)',
        background: '#071019',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate(`/mission?scenario=${searchParams.get('scenario') || 'earthquake'}`)}
            style={iconButtonStyle}
            title="Back to mission"
          >
            <ArrowLeft size={17} />
          </button>
          <Route size={21} color="#00e5ff" />
          <div>
            <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 19, fontWeight: 700, letterSpacing: 2 }}>
              DRONE PATHFINDING CONTROL
            </div>
            <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1 }}>
              {activePaths.label} ROUTES · {missionPhase} · {simulationRunning ? 'LIVE SIMULATION' : 'SIMULATION PAUSED'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {drones.map(drone => {
            const color = DRONE_COLORS[drone.id] || '#94a3b8'
            const selected = drone.id === selectedDroneId
            return (
              <button
                key={drone.id}
                onClick={() => setSelectedDroneId(drone.id)}
                style={{
                  ...droneTabStyle,
                  color: selected ? color : '#64748b',
                  borderColor: selected ? color : 'rgba(100,116,139,0.25)',
                  background: selected ? `${color}18` : 'transparent',
                }}
              >
                {drone.callsign}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 430px' }}>
        <div style={{ position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(0,229,255,0.12)' }}>
          <PathCanvas selectedDroneId={selectedDroneId} />
          <div style={{
            position: 'absolute',
            left: 22,
            bottom: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))',
            gap: 10,
            width: 'calc(100% - 44px)',
            pointerEvents: 'none',
          }}>
            {droneStats.map(({ drone, path, distance, detections, relays }) => {
              const color = DRONE_COLORS[drone.id] || '#94a3b8'
              const selected = drone.id === selectedDroneId
              return (
                <div key={drone.id} style={{
                  padding: '11px 12px',
                  background: selected ? 'rgba(0,229,255,0.12)' : 'rgba(3,7,12,0.78)',
                  border: `1px solid ${selected ? color : 'rgba(100,116,139,0.22)'}`,
                  borderRadius: 6,
                  boxShadow: selected ? `0 0 22px ${color}22` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color, fontWeight: 700, fontSize: 12 }}>{drone.callsign}</span>
                    <span style={{ color: '#64748b', fontSize: 9 }}>{drone.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 10, color: '#94a3b8' }}>
                    <span>WP <b style={{ color: '#e2e8f0' }}>{path.length}</b></span>
                    <span>DIST <b style={{ color: '#e2e8f0' }}>{distance.toFixed(0)}m</b></span>
                    <span>DETECT <b style={{ color: '#00ff88' }}>{detections}</b></span>
                    <span>RELAY <b style={{ color: '#a855f7' }}>{relays}</b></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', minHeight: 0, background: '#050b12' }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Navigation size={17} color={DRONE_COLORS[selectedDrone?.id] || '#00e5ff'} />
              <div>
                <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700, letterSpacing: 1.5 }}>
                  {selectedDrone?.callsign || 'DRONE'}
                </div>
                <div style={{ color: '#64748b', fontSize: 10 }}>
                  {selectedDrone?.name || 'UNIT'} · {selectedDrone?.status || 'UNKNOWN'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
              <Metric icon={MapPin} label="Position" value={`${(selectedDrone?.pos?.[0] || 0).toFixed(0)}, ${(selectedDrone?.pos?.[2] || 0).toFixed(0)}`} />
              <Metric icon={Activity} label="Battery" value={`${Math.round(selectedDrone?.battery || 0)}%`} />
              <Metric icon={Crosshair} label="Objects" value={detectedObjects.filter(o => o.detectedBy === selectedDroneId).length} color="#00ff88" />
              <Metric icon={Send} label="Relays" value={detectedObjects.filter(o => o.relayedTo?.includes(selectedDroneId)).length} color="#a855f7" />
            </div>

            <HardwareFailureControls drone={selectedDrone} activeFailure={activeFailure} />
          </div>

          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
            <div style={sectionTitleStyle}><Radio size={13} /> DETECTED OBJECT RELAYS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto', paddingRight: 4 }}>
              {detectedObjects.length ? detectedObjects.slice(-6).reverse().map(object => {
                const [x, , z] = object.pos || [0, 0, 0]
                const detector = drones.find(d => d.id === object.detectedBy)
                const relayedNames = (object.relayedTo || [])
                  .map(id => drones.find(d => d.id === id)?.callsign)
                  .filter(Boolean)
                  .join(', ')
                return (
                  <div key={`${object.id}-${object.time}`} style={objectRowStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ color: '#00ff88', fontWeight: 700 }}>{object.type} {String(object.id).slice(-8)}</span>
                      <span style={{ color: '#64748b' }}>{formatTime(object.time)}</span>
                    </div>
                    <div style={{ color: '#94a3b8', marginTop: 5 }}>
                      [{x.toFixed(0)}, {z.toFixed(0)}] · detected by {detector?.callsign || object.detectedByCallsign}
                    </div>
                    <div style={{ color: '#a855f7', marginTop: 4 }}>
                      relayed to: {relayedNames || 'no nearby drones'}
                    </div>
                  </div>
                )
              }) : (
                <div style={{ color: '#475569', fontSize: 11, padding: '10px 0' }}>No objects detected yet.</div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, padding: '16px 20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={sectionTitleStyle}><ScrollText size={13} /> {selectedDrone?.callsign || 'DRONE'} LOG</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7, paddingRight: 4 }}>
              {selectedLogs.length ? selectedLogs.slice().reverse().map(log => (
                <div key={log.id} style={{
                  borderLeft: `2px solid ${LOG_COLORS[log.type] || '#64748b'}`,
                  background: 'rgba(255,255,255,0.025)',
                  padding: '8px 10px',
                  borderRadius: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: LOG_COLORS[log.type] || '#94a3b8', fontWeight: 700, fontSize: 10 }}>
                      {String(log.type).toUpperCase()}
                    </span>
                    <span style={{ color: '#475569', fontSize: 10 }}>{formatTime(log.time)}</span>
                  </div>
                  <div style={{ color: '#cbd5e1', fontSize: 11, lineHeight: 1.5 }}>{log.message}</div>
                </div>
              )) : (
                <div style={{ color: '#475569', fontSize: 11, padding: '14px 0' }}>No log entries for this drone.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function HardwareFailureControls({ drone, activeFailure }) {
  if (!drone) return null
  const locked = Boolean(activeFailure && activeFailure.status !== 'CLEARED')

  return (
    <div style={{
      marginTop: 14,
      paddingTop: 14,
      borderTop: '1px solid rgba(100,116,139,0.18)',
    }}>
      <div style={{
        ...sectionTitleStyle,
        color: locked ? '#ffb300' : '#00e5ff',
        marginBottom: 9,
      }}>
        <AlertTriangle size={13} /> HARDWARE CONSTRAINTS
      </div>

      {locked && (
        <div style={{
          color: activeFailure.severity === 'critical' ? '#ff2929' : '#ffb300',
          fontSize: 10,
          lineHeight: 1.45,
          marginBottom: 9,
        }}>
          {activeFailure.label} active. Replacement: {activeFailure.replacementDroneId ? `DRONE-0${activeFailure.replacementDroneId}` : 'none available'}.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {HARDWARE_FAILURE_TYPES.map(failure => {
          const Icon = FAILURE_ICONS[failure.id] || AlertTriangle
          const color = failure.severity === 'critical' ? '#ff2929' : '#ffb300'
          return (
            <button
              key={failure.id}
              disabled={locked}
              onClick={() => triggerHardwareFailure(drone.id, failure.id)}
              title={`Trigger ${failure.label}`}
              style={{
                minHeight: 34,
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                border: `1px solid ${locked ? 'rgba(71,85,105,0.24)' : color + '55'}`,
                background: locked ? 'rgba(15,23,42,0.22)' : color + '10',
                color: locked ? '#475569' : color,
                cursor: locked ? 'not-allowed' : 'pointer',
                borderRadius: 5,
                padding: '7px 8px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
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

function Metric({ icon: Icon, label, value, color = '#00e5ff' }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(100,116,139,0.16)',
      borderRadius: 5,
      padding: '9px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 9, marginBottom: 5 }}>
        <Icon size={12} /> {label.toUpperCase()}
      </div>
      <div style={{ color, fontFamily: 'Rajdhani, sans-serif', fontSize: 18, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const iconButtonStyle = {
  height: 34,
  width: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(0,229,255,0.28)',
  background: 'rgba(0,229,255,0.08)',
  color: '#00e5ff',
  borderRadius: 5,
  cursor: 'pointer',
}

const droneTabStyle = {
  height: 32,
  padding: '0 13px',
  border: '1px solid rgba(100,116,139,0.25)',
  borderRadius: 5,
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1,
  cursor: 'pointer',
}

const sectionTitleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  color: '#00e5ff',
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 1.5,
  marginBottom: 11,
}

const objectRowStyle = {
  background: 'rgba(168,85,247,0.055)',
  border: '1px solid rgba(168,85,247,0.18)',
  borderRadius: 5,
  padding: '9px 10px',
  fontSize: 10,
  lineHeight: 1.35,
}
