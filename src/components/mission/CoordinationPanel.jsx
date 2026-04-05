import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Navigation, Zap, AlertTriangle, Radio,
  Target, RotateCcw, Shield, Activity, MapPin,
  ChevronRight, Wifi, Battery, ArrowUpRight, Clock
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

// ── Drone color registry ────────────────────────────────────────────────────
const DRONE_COLORS = {
  FALCON: '#00e5ff', HAWK: '#ff6b2b', OSPREY: '#00ff88',
  KESTREL: '#e040fb', MERLIN: '#f9e23c',
}
const ZONE_NAMES = ['A', 'B', 'C', 'D', 'E']

// ══════════════════════════════════════════════════════════════════════════
// SWARM CONSTELLATION CANVAS — shows live positions + links
// ══════════════════════════════════════════════════════════════════════════
function SwarmCanvas({ drones, selectedId, survivors }) {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0

    const draw = () => {
      tick++
      const t = tick * 0.02
      const { width, height } = canvas

      ctx.fillStyle = '#030608'
      ctx.fillRect(0, 0, width, height)

      const store = useSimStore.getState()
      const liveDrones = store.drones
      const selected = liveDrones.find(d => d.id === selectedId) || liveDrones[0]
      if (!liveDrones.length) { animRef.current = requestAnimationFrame(draw); return }

      // World bounds
      const WORLD = 120
      const toCanvas = (wx, wz) => ({
        x: ((wx + WORLD) / (WORLD * 2)) * width,
        y: ((wz + WORLD) / (WORLD * 2)) * height,
      })

      // ── Background Tactical Zones ──
      // Instead of small grid blocks, map the whole area into 5 operational columns
      const cols = 5
      for (let i = 0; i < cols; i++) {
        const x1 = (i / cols) * width
        const w = width / cols
        
        // Zone Background
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 229, 255, 0.015)' : 'rgba(0, 229, 255, 0.005)'
        ctx.fillRect(x1, 0, w, height)

        // Zone Separator Line
        if (i > 0) {
          ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 8])
          ctx.beginPath()
          ctx.moveTo(x1, 0)
          ctx.lineTo(x1, height)
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Faded Zone Label at top center of column
        ctx.fillStyle = 'rgba(0, 229, 255, 0.08)'
        ctx.font = 'bold 24px Rajdhani'
        ctx.textAlign = 'center'
        ctx.fillText(`ZONE ${ZONE_NAMES[i]}`, x1 + w / 2, Math.max(40, height * 0.15))
      }
      // ── Drone Active Bounds ──
      liveDrones.forEach((d, i) => {
        // Find the drone's zone boundaries map space to canvas space
        const [x1, y1, x2, y2] = d.assigned_zone || [0, 0, 4, 20]
        const wx1 = x1 * 5 - WORLD, wz1 = y1 * 5 - WORLD
        const wx2 = x2 * 5 - WORLD, wz2 = y2 * 5 - WORLD
        const p1 = toCanvas(wx1, wz1), p2 = toCanvas(wx2, wz2)
        
        const color = DRONE_COLORS[d.callsign] || '#94a3b8'
        const w = p2.x - p1.x
        const h = p2.y - p1.y

        if (d.id === selectedId) {
          // Highlight entire column for selected drone
          const colW = width / 5
          const colX = i * colW
          ctx.fillStyle = color + '0a' // very subtle tint for the whole active column
          ctx.fillRect(colX, 0, colW, height)
          
          // Draw the precise boundary box with bright corners
          ctx.strokeStyle = color + '80'
          ctx.lineWidth = 1.5
          ctx.strokeRect(p1.x, p1.y, w, h)
          
          // Add corner brackets for tactical look
          const clen = 10
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.beginPath()
          // Top Left
          ctx.moveTo(p1.x, p1.y + clen); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p1.x + clen, p1.y)
          // Top Right
          ctx.moveTo(p2.x - clen, p1.y); ctx.lineTo(p2.x, p1.y); ctx.lineTo(p2.x, p1.y + clen)
          // Bottom Left
          ctx.moveTo(p1.x, p2.y - clen); ctx.lineTo(p1.x, p2.y); ctx.lineTo(p1.x + clen, p2.y)
          // Bottom Right
          ctx.moveTo(p2.x - clen, p2.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p2.x, p2.y - clen)
          ctx.stroke()
        } else {
          // Inactive boundaries just get dashed outlines
          ctx.strokeStyle = color + '30'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.strokeRect(p1.x, p1.y, w, h)
          ctx.setLineDash([])
        }
        
        // Active label for the box
        ctx.fillStyle = color + (d.id === selectedId ? 'cc' : '60')
        ctx.font = `bold ${d.id === selectedId ? 11 : 9}px JetBrains Mono`
        ctx.textAlign = 'left'
        ctx.fillText(`SECTOR ${d.callsign}`, p1.x + 4, p1.y + (d.id === selectedId ? 14 : 12))
      })

      // ── Drone-to-drone comms links ──
      liveDrones.forEach((d1, i) => {
        liveDrones.slice(i + 1).forEach(d2 => {
          if (!d1.pos || !d2.pos) return
          const dx = d1.pos[0] - d2.pos[0], dz = d1.pos[2] - d2.pos[2]
          const sep = Math.sqrt(dx * dx + dz * dz)
          if (sep > 80) return // only nearby pairs show relay link
          const p1 = toCanvas(d1.pos[0], d1.pos[2])
          const p2 = toCanvas(d2.pos[0], d2.pos[2])
          const isCollision = sep < 8
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = isCollision ? `rgba(255,50,0,${0.3 + Math.sin(t * 6) * 0.3})` : 'rgba(0,229,255,0.08)'
          ctx.lineWidth = isCollision ? 1.5 : 0.7
          ctx.setLineDash(isCollision ? [2, 3] : [])
          ctx.stroke()
          ctx.setLineDash([])
          // Sep label at midpoint for collision pairs
          if (isCollision) {
            ctx.fillStyle = '#ff3200'
            ctx.font = '9px JetBrains Mono'
            ctx.textAlign = 'center'
            ctx.fillText(`${sep.toFixed(0)}m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 4)
          }
        })
      })

      // ── Survivor markers ──
      const liveSurvivors = store.survivors.filter(s => s.detected && s.pos)
      liveSurvivors.forEach(s => {
        const { x, y } = toCanvas(s.pos[0], s.pos[2])
        const pulse = 3 + Math.sin(t * 4) * 1.5
        ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,136,0.7)`; ctx.fill()
        ctx.beginPath(); ctx.arc(x, y, pulse + 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,255,136,${0.2 + Math.sin(t * 4) * 0.2})`
        ctx.lineWidth = 1; ctx.stroke()
      })

      // ── Drone icons ──
      liveDrones.forEach(d => {
        if (!d.pos) return
        const { x, y } = toCanvas(d.pos[0], d.pos[2])
        const color = DRONE_COLORS[d.callsign] || '#94a3b8'
        const isSelected = d.id === selectedId

        // Scan radius circle
        const scanWorldR = d.scan_radius || 15
        const scanCanvasR = (scanWorldR / (WORLD * 2)) * width
        ctx.beginPath(); ctx.arc(x, y, scanCanvasR, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? color + '40' : color + '15'
        ctx.lineWidth = isSelected ? 1 : 0.5
        ctx.setLineDash([2, 4]); ctx.stroke(); ctx.setLineDash([])

        // Glow
        if (isSelected) {
          ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2)
          ctx.fillStyle = color + '20'; ctx.fill()
        }

        // Drone triangle
        ctx.save(); ctx.translate(x, y)
        ctx.rotate(((d.heading || 0) * Math.PI) / 180)
        ctx.beginPath()
        ctx.moveTo(0, -7); ctx.lineTo(-5, 5); ctx.lineTo(5, 5); ctx.closePath()
        ctx.fillStyle = isSelected ? color : color + '70'
        ctx.shadowBlur = isSelected ? 12 : 0; ctx.shadowColor = color
        ctx.fill()
        ctx.shadowBlur = 0; ctx.restore()

        // Callsign label
        ctx.fillStyle = isSelected ? color : color + '80'
        ctx.font = `${isSelected ? 'bold ' : ''}10px JetBrains Mono`
        ctx.textAlign = 'center'
        ctx.fillText(d.callsign, x, y - 13)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [selectedId])

  return (
    <canvas ref={canvasRef} width={440} height={300}
      style={{ width: '100%', height: '100%', display: 'block' }} />
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COORDINATION PANEL
// ══════════════════════════════════════════════════════════════════════════
export default function CoordinationPanel({ onClose }) {
  const drones = useSimStore(s => s.drones)
  const survivors = useSimStore(s => s.survivors)
  const eventLog = useSimStore(s => s.eventLog)
  const simulationTime = useSimStore(s => s.simulationTime)
  const scenario = useSimStore(s => s.scenario)

  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone)

  const [coordData, setCoordData] = useState(null)
  const [activeCmd, setActiveCmd] = useState(null)
  const [cmdLog, setCmdLog] = useState([])

  // Poll backend
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/coordination')
        if (res.ok) setCoordData(await res.json())
      } catch {}
    }
    poll()
    const iv = setInterval(poll, 2000)
    return () => clearInterval(iv)
  }, [])

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]
  const droneColor = DRONE_COLORS[drone?.callsign] || '#00e5ff'
  const droneIdx = drones.findIndex(d => d.id === drone?.id)
  const zoneLabel = ZONE_NAMES[droneIdx] ?? 'A'
  const zonePct = coordData?.zone_pcts?.[droneIdx] ?? ((simulationTime / 600) * 100 * 0.9)

  // All separation pairs involving this drone
  const myPairs = (coordData?.current_separations || drones.flatMap((d1, i) =>
    drones.slice(i + 1).map(d2 => {
      const dx = (d1.pos?.[0] || 0) - (d2.pos?.[0] || 0)
      const dz = (d1.pos?.[2] || 0) - (d2.pos?.[2] || 0)
      return { pair: [d1.callsign, d2.callsign], separation: Math.sqrt(dx * dx + dz * dz), status: Math.sqrt(dx * dx + dz * dz) < 8 ? 'COLLISION' : 'NOMINAL' }
    })
  )).filter(p => p.pair.includes(drone?.callsign))
   .sort((a, b) => a.separation - b.separation)

  // Nearest survivor to this drone
  const nearestSurvivor = survivors
    .filter(s => s.pos && !s.rescued)
    .map(s => {
      const dx = (s.pos[0] - (drone?.pos?.[0] || 0))
      const dz = (s.pos[2] - (drone?.pos?.[2] || 0))
      return { ...s, dist: Math.sqrt(dx * dx + dz * dz) }
    })
    .sort((a, b) => a.dist - b.dist)[0]

  // Drone-specific event log
  const myEvents = eventLog
    .filter(e => e.message?.includes(drone?.callsign) || e.drone_id === drone?.id)
    .slice(-6)

  // Issue command (fires WS message)
  const issueCommand = useCallback(async (action, extra = {}) => {
    setActiveCmd(action)
    const entry = { time: simulationTime, action, callsign: drone?.callsign }
    setCmdLog(prev => [...prev.slice(-4), entry])
    try {
      // Send over fetch for simplicity
      await fetch('http://localhost:8000/api/drone/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drone_id: drone?.id, action, ...extra }),
      })
    } catch {}
    setTimeout(() => setActiveCmd(null), 2000)
  }, [drone, simulationTime])

  const battery = drone?.battery || 0
  const batteryColor = battery < 20 ? '#ff4500' : battery < 50 ? '#ffb300' : '#00ff88'
  const statusColor = { SCANNING: '#00e5ff', RETURNING: '#ff6b2b', SEARCHING: '#ffb300', CHARGING: '#00ff88' }[drone?.status] || '#94a3b8'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(2, 5, 10, 0.96)',
        backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'JetBrains Mono, monospace',
      }}
    >
      {/* ═══════ HEADER ══════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '20px',
        padding: '16px 28px',
        background: '#050d15',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
          <div style={{ width: 3, height: 28, background: droneColor, borderRadius: 2 }} />
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '2px', fontFamily: 'Rajdhani' }}>
              SWARM COORDINATION · {drone?.callsign || '—'}
            </div>
            <div style={{ fontSize: '10px', color: '#475569', letterSpacing: '1px' }}>
              multi-drone ops · {scenario.toUpperCase()} · T+{simulationTime.toFixed(0)}s
            </div>
          </div>
        </div>

        {/* Drone selector pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {drones.map((d, i) => {
            const c = DRONE_COLORS[d.callsign] || '#94a3b8'
            const isSel = d.id === selectedDroneId
            return (
              <button key={d.id} onClick={() => setSelectedDrone(d.id)} style={{
                padding: '6px 14px', border: `1px solid ${isSel ? c : c + '40'}`,
                background: isSel ? c + '18' : 'transparent',
                color: isSel ? c : c + '80',
                borderRadius: '3px', cursor: 'pointer', fontSize: '10px', letterSpacing: '0.5px',
                transition: 'all 0.2s',
              }}>
                {d.callsign}
              </button>
            )
          })}
        </div>

        <button onClick={onClose} style={{
          background: 'none', border: '1px solid rgba(71,85,105,0.4)',
          color: '#475569', cursor: 'pointer', padding: '8px', borderRadius: '4px',
          display: 'flex', transition: '0.2s',
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#ff4500'; e.currentTarget.style.color = '#ff4500' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(71,85,105,0.4)'; e.currentTarget.style.color = '#475569' }}
        ><X size={18} /></button>
      </div>

      {/* ═══════ BODY ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gridTemplateRows: '1fr', overflow: 'hidden', gap: '1px', background: 'rgba(0,0,0,0.4)' }}>

        {/* ── LEFT: Swarm map + telemetry ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#04090f' }}>

          {/* Telemetry strip */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,229,255,0.08)', flexShrink: 0 }}>
            {[
              { icon: Activity, label: 'STATUS', value: drone?.status || '—', color: statusColor },
              { icon: MapPin, label: 'POSITION', value: drone?.pos ? `${drone.pos[0].toFixed(0)}, ${drone.pos[2].toFixed(0)}` : '—', color: '#94a3b8' },
              { icon: ArrowUpRight, label: 'ALTITUDE', value: `${Math.round(drone?.pos?.[1] || 0)}m`, color: '#00e5ff' },
              { icon: Zap, label: 'SPEED', value: `${Math.round(drone?.speed || 0)} m/s`, color: '#00e5ff' },
              { icon: Battery, label: 'BATTERY', value: `${Math.round(battery)}%`, color: batteryColor },
              { icon: Shield, label: 'SCAN_R', value: `${drone?.scan_radius || 0}m`, color: droneColor },
              { icon: Target, label: 'ZONE', value: zoneLabel, color: droneColor },
              { icon: Activity, label: 'COVERAGE', value: `${Math.min(99, zonePct).toFixed(0)}%`, color: '#00ff88' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{
                flex: 1, padding: '12px 14px', borderRight: '1px solid rgba(0,229,255,0.05)',
                display: 'flex', flexDirection: 'column', gap: '4px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon size={12} color='#475569' />
                  <span style={{ fontSize: '9px', color: '#394250', letterSpacing: '0.5px' }}>{label}</span>
                </div>
                <span style={{ fontSize: '15px', color, fontWeight: 700, fontFamily: 'Rajdhani', lineHeight: 1 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Swarm constellation */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 12, left: 16,
              fontSize: '9px', color: 'rgba(0,229,255,0.4)', letterSpacing: '1px', zIndex: 2,
            }}>
              SWARM_CONSTELLATION · ZONE_{zoneLabel}_SELECTED · {drones.length} AGENTS LIVE
            </div>
            <SwarmCanvas drones={drones} selectedId={selectedDroneId} survivors={survivors} />
          </div>

          {/* Collision proximity table */}
          <div style={{ borderTop: '1px solid rgba(0,229,255,0.08)', padding: '16px 20px', flexShrink: 0 }}>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '12px' }}>
              SEPARATION MATRIX · {drone?.callsign} ↔ ALL AGENTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              {myPairs.map((p, i) => {
                const partner = p.pair.find(c => c !== drone?.callsign)
                const color = DRONE_COLORS[partner] || '#94a3b8'
                const isWarn = p.separation < 12
                const isDanger = p.separation < 8
                return (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: '4px',
                    background: isDanger ? 'rgba(255,50,0,0.08)' : isWarn ? 'rgba(255,179,0,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isDanger ? '#ff320030' : isWarn ? '#ffb30025' : 'rgba(71,85,105,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color, fontWeight: 700 }}>{partner}</span>
                      <span style={{ fontSize: '9px', color: isDanger ? '#ff3200' : isWarn ? '#ffb300' : '#475569' }}>
                        {isDanger ? '⚠ CLOSE' : isWarn ? '⚡ NEAR' : '✓ OK'}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', color: isDanger ? '#ff3200' : isWarn ? '#ffb300' : '#64748b', fontFamily: 'Rajdhani', fontWeight: 700 }}>
                      {p.separation.toFixed(1)}m
                    </div>
                    <div style={{ marginTop: '3px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
                      <div style={{
                        width: `${Math.min(100, (1 - p.separation / 60) * 100)}%`,
                        height: '100%', borderRadius: 1,
                        background: isDanger ? '#ff3200' : isWarn ? '#ffb300' : color,
                        transition: 'width 0.5s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Commands + Events ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#030810', borderLeft: '1px solid rgba(0,229,255,0.08)', overflow: 'hidden', width: '380px' }}>

          {/* Zone coverage */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '8px' }}>ZONE_{zoneLabel} SCAN PROGRESS</div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
              <motion.div
                animate={{ width: `${Math.min(99, zonePct)}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ height: '100%', background: droneColor, borderRadius: '3px', boxShadow: `0 0 8px ${droneColor}60` }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#475569' }}>
              <span>Scanned: <span style={{ color: droneColor }}>{Math.min(99, zonePct).toFixed(1)}%</span></span>
              <span>ETA: <span style={{ color: '#94a3b8' }}>{((100 - zonePct) / 0.18).toFixed(0)}s</span></span>
            </div>
          </div>

          {/* Nearest survivor */}
          {nearestSurvivor && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,229,255,0.06)', background: 'rgba(0,255,136,0.03)' }}>
              <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '8px' }}>NEAREST SURVIVOR</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#00ff88', fontWeight: 700 }}>SURV #{nearestSurvivor.id}</div>
                  <div style={{ fontSize: '10px', color: '#475569' }}>dist: {nearestSurvivor.dist.toFixed(1)}m</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>conf: <span style={{ color: '#00ff88' }}>{(nearestSurvivor.confidence * 100).toFixed(0)}%</span></div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>temp: <span style={{ color: '#ff6b00' }}>{nearestSurvivor.body_temp?.toFixed(1)}°C</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── COMMAND PANEL ──────────────────────────────────────────────── */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '12px' }}>
              COMMAND · {drone?.callsign}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                {
                  action: 'emergency_return', icon: RotateCcw, label: 'EMERGENCY RETURN',
                  sub: 'RTB immediately · abort mission', color: '#ff4500',
                  bg: 'rgba(255,69,0,0.08)', border: 'rgba(255,69,0,0.25)',
                },
                {
                  action: 'divert_survivor', icon: Target, label: nearestSurvivor ? `DIVERT → SURV #${nearestSurvivor.id}` : 'DIVERT TO SURVIVOR',
                  sub: nearestSurvivor ? `${nearestSurvivor.dist.toFixed(0)}m away · verify detection` : 'No survivor in range',
                  color: '#00ff88', bg: 'rgba(0,255,136,0.05)', border: 'rgba(0,255,136,0.2)',
                  disabled: !nearestSurvivor,
                },
                {
                  action: 'extend_scan', icon: Radio, label: 'EXPAND SCAN RADIUS',
                  sub: `${drone?.scan_radius || 0}m → ${(drone?.scan_radius || 0) + 5}m (10% battery cost)`,
                  color: '#00e5ff', bg: 'rgba(0,229,255,0.05)', border: 'rgba(0,229,255,0.2)',
                },
                {
                  action: 'relay_boost', icon: Wifi, label: 'BOOST COMMS RELAY',
                  sub: 'Increase data link · 30s duration',
                  color: '#e040fb', bg: 'rgba(224,64,251,0.05)', border: 'rgba(224,64,251,0.2)',
                },
                {
                  action: 'hold_position', icon: Navigation, label: 'HOLD POSITION',
                  sub: 'Hover at current alt · conserve battery',
                  color: '#ffb300', bg: 'rgba(255,179,0,0.05)', border: 'rgba(255,179,0,0.2)',
                },
              ].map(cmd => (
                <button
                  key={cmd.action}
                  disabled={cmd.disabled || activeCmd === cmd.action}
                  onClick={() => !cmd.disabled && issueCommand(cmd.action)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', border: `1px solid ${cmd.border}`,
                    background: cmd.disabled ? 'rgba(0,0,0,0.1)' : activeCmd === cmd.action ? cmd.bg + '80' : cmd.bg,
                    borderRadius: '4px', cursor: cmd.disabled ? 'not-allowed' : 'pointer',
                    opacity: cmd.disabled ? 0.4 : 1, transition: 'all 0.2s', textAlign: 'left', width: '100%',
                  }}
                  onMouseOver={e => { if (!cmd.disabled) e.currentTarget.style.background = cmd.bg + 'cc' }}
                  onMouseOut={e => { if (!cmd.disabled) e.currentTarget.style.background = cmd.bg }}
                >
                  <cmd.icon size={16} color={cmd.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: cmd.color, fontWeight: 700, letterSpacing: '0.5px' }}>
                      {activeCmd === cmd.action ? 'SENDING...' : cmd.label}
                    </div>
                    <div style={{ fontSize: '9px', color: '#394250', marginTop: '2px' }}>{cmd.sub}</div>
                  </div>
                  {!cmd.disabled && <ChevronRight size={14} color={cmd.color + '60'} />}
                </button>
              ))}
            </div>
          </div>

          {/* ── COMMAND LOG ──────────────────────────────────────────────────── */}
          {cmdLog.length > 0 && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
              <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '8px' }}>CMD LOG</div>
              {cmdLog.map((c, i) => (
                <div key={i} style={{ fontSize: '10px', color: '#475569', marginBottom: '4px' }}>
                  <span style={{ color: '#394250' }}>[{c.time.toFixed(0)}s] </span>
                  <span style={{ color: droneColor }}>{c.callsign}</span>
                  <span style={{ color: '#64748b' }}> → {c.action.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── DRONE EVENT STREAM ───────────────────────────────────────────── */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
            <div style={{ fontSize: '9px', color: '#475569', letterSpacing: '1px', marginBottom: '10px' }}>
              EVENT STREAM · {drone?.callsign}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {myEvents.length > 0 ? myEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '10px' }}>
                  <span style={{ color: '#394250', minWidth: '36px' }}>{e.time.toFixed(0)}s</span>
                  <span style={{
                    color: e.category === 'survivor' ? '#00ff88' : e.category === 'warning' ? '#ffb300' : '#475569',
                    lineHeight: 1.5,
                  }}>{e.message}</span>
                </div>
              )) : (
                <div style={{ fontSize: '10px', color: '#2a3340', padding: '16px 0', textAlign: 'center' }}>
                  No events logged for {drone?.callsign}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
