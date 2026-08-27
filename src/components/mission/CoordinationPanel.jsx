import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Navigation, Zap, AlertTriangle, Radio,
  Target, RotateCcw, Shield, Activity, MapPin,
  ChevronRight, Wifi, Battery, ArrowUpRight, Clock, ArrowLeft
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

// ── Drone color registry ────────────────────────────────────────────────────
const DRONE_COLORS = {
  Arjun: '#79B9C1', Bhima: '#f59e0b', Karna: '#58ba8a',
  Krishna: '#8b5cf6', Ram: '#D4A844',
  ARJUN: '#79B9C1', BHIMA: '#f59e0b', KARNA: '#58ba8a',
  KRISHNA: '#8b5cf6', RAM: '#D4A844',
  FALCON: '#79B9C1', HAWK: '#f59e0b', OSPREY: '#58ba8a',
  KESTREL: '#8b5cf6', MERLIN: '#D4A844',
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

      // Light aerospace canvas background
      ctx.fillStyle = '#EDF3F4'
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
      const cols = 5
      for (let i = 0; i < cols; i++) {
        const x1 = (i / cols) * width
        const w = width / cols
        
        // Zone Background
        ctx.fillStyle = i % 2 === 0 ? 'rgba(121, 185, 193, 0.08)' : 'rgba(121, 185, 193, 0.03)'
        ctx.fillRect(x1, 0, w, height)

        // Zone Separator Line
        if (i > 0) {
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 6])
          ctx.beginPath()
          ctx.moveTo(x1, 0)
          ctx.lineTo(x1, height)
          ctx.stroke()
          ctx.setLineDash([])
        }

        // Zone Label at top center of column
        ctx.fillStyle = 'rgba(23, 33, 36, 0.15)'
        ctx.font = '800 24px Space Grotesk, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`ZONE ${ZONE_NAMES[i]}`, x1 + w / 2, Math.max(36, height * 0.14))
      }

      // ── Selected Drone Column Highlight ──
      liveDrones.forEach((d, i) => {
        const color = DRONE_COLORS[d.callsign] || '#79B9C1'
        if (d.id === selectedId) {
          const colW = width / 5
          const colX = i * colW
          ctx.fillStyle = 'rgba(185, 220, 225, 0.35)'
          ctx.fillRect(colX, 0, colW, height)
          
          ctx.strokeStyle = '#79B9C1'
          ctx.lineWidth = 1.5
          ctx.strokeRect(colX, 0, colW, height)
          
          ctx.fillStyle = '#1a565e'
          ctx.font = '800 11px Inter, sans-serif'
          ctx.textAlign = 'left'
          ctx.fillText(`SECTOR ${d.callsign} ACTIVE`, colX + 10, 22)
        }
      })

      // ── Drone-to-drone comms links ──
      liveDrones.forEach((d1, i) => {
        liveDrones.slice(i + 1).forEach(d2 => {
          if (!d1.pos || !d2.pos) return
          const dx = d1.pos[0] - d2.pos[0], dz = d1.pos[2] - d2.pos[2]
          const sep = Math.sqrt(dx * dx + dz * dz)
          if (sep > 80) return
          const p1 = toCanvas(d1.pos[0], d1.pos[2])
          const p2 = toCanvas(d2.pos[0], d2.pos[2])
          const isCollision = sep < 8
          ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = isCollision ? `rgba(220,53,69,${0.6 + Math.sin(t * 6) * 0.4})` : 'rgba(121,185,193,0.45)'
          ctx.lineWidth = isCollision ? 2 : 1
          ctx.setLineDash(isCollision ? [2, 3] : [])
          ctx.stroke()
          ctx.setLineDash([])

          if (isCollision) {
            ctx.fillStyle = '#dc3545'
            ctx.font = 'bold 9px IBM Plex Mono'
            ctx.textAlign = 'center'
            ctx.fillText(`${sep.toFixed(0)}m`, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 4)
          }
        })
      })

      // ── Survivor markers ──
      const liveSurvivors = store.survivors.filter(s => s.detected && s.pos)
      liveSurvivors.forEach(s => {
        const { x, y } = toCanvas(s.pos[0], s.pos[2])
        const pulse = 4 + Math.sin(t * 4) * 1.5
        ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2)
        ctx.fillStyle = `#58ba8a`; ctx.fill()
        ctx.beginPath(); ctx.arc(x, y, pulse + 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(88,186,138,${0.4 + Math.sin(t * 4) * 0.4})`
        ctx.lineWidth = 1.2; ctx.stroke()
      })

      // ── Drone icons ──
      liveDrones.forEach(d => {
        if (!d.pos) return
        const { x, y } = toCanvas(d.pos[0], d.pos[2])
        const color = DRONE_COLORS[d.callsign] || '#79B9C1'
        const isSelected = d.id === selectedId

        // Scan radius circle
        const scanWorldR = d.scan_radius || 15
        const scanCanvasR = (scanWorldR / (WORLD * 2)) * width
        ctx.beginPath(); ctx.arc(x, y, scanCanvasR, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected ? color + '80' : color + '40'
        ctx.lineWidth = isSelected ? 1.5 : 0.8
        ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([])

        // Glow
        if (isSelected) {
          ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(121, 185, 193, 0.35)'; ctx.fill()
        }

        // Drone triangle
        ctx.save(); ctx.translate(x, y)
        ctx.rotate(((d.heading || 0) * Math.PI) / 180)
        ctx.beginPath()
        ctx.moveTo(0, -8); ctx.lineTo(-6, 6); ctx.lineTo(6, 6); ctx.closePath()
        ctx.fillStyle = isSelected ? '#172124' : color
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fill()
        ctx.restore()

        // Callsign label
        ctx.fillStyle = isSelected ? '#172124' : '#55666B'
        ctx.font = `${isSelected ? '800 ' : '700 '}10px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(d.callsign, x, y - 14)
      })

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [selectedId])

  return (
    <canvas ref={canvasRef} width={600} height={350}
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

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

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
  const droneColor = DRONE_COLORS[drone?.callsign] || '#79B9C1'
  const droneIdx = drones.findIndex(d => d.id === drone?.id)
  const zoneLabel = ZONE_NAMES[droneIdx] ?? 'A'
  
  // Safe zone calculation: fallback if backend data is missing or malformed
  const getZonePct = () => {
    if (coordData?.zone_pcts && coordData.zone_pcts[droneIdx] !== undefined) {
      return coordData.zone_pcts[droneIdx]
    }
    return Math.min(100, (simulationTime / 600) * 100 * 0.9)
  }
  const zonePct = getZonePct()

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
      await fetch('http://localhost:8000/api/drone/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drone_id: drone?.id, action, ...extra }),
      })
    } catch {}
    setTimeout(() => setActiveCmd(null), 2000)
  }, [drone, simulationTime])

  const battery = drone?.battery || 0
  const batteryColor = battery < 20 ? '#dc3545' : battery < 50 ? '#f59e0b' : '#58ba8a'
  const statusColor = { SCANNING: '#79B9C1', RETURNING: '#f59e0b', SEARCHING: '#79B9C1', CHARGING: '#58ba8a' }[drone?.status] || '#8A9A9E'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(23, 33, 36, 0.96)',
        backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        fontFamily: 'var(--font-primary)',
        userSelect: 'none',
      }}
    >
      {/* ── HEADER ────────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '12px 24px',
        background: '#20292B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(121, 185, 193, 0.15)',
              border: '1px solid rgba(121, 185, 193, 0.4)',
              color: '#79B9C1',
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-primary)',
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              transition: 'all 0.18s ease',
              textTransform: 'uppercase',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#79B9C1'; e.currentTarget.style.color = '#172124' }}
            onMouseOut={e => { e.currentTarget.style.background = 'rgba(121, 185, 193, 0.15)'; e.currentTarget.style.color = '#79B9C1' }}
          >
            <ArrowLeft size={13} /> EXIT DASHBOARD
          </button>
          
          <div style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.1)' }} />

          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#FFFFFF', letterSpacing: '0.08em', fontFamily: 'var(--font-display)' }}>
              SWARM COORDINATION // {drone?.callsign || '—'}
            </div>
            <div style={{ fontSize: '9px', color: '#8A9A9E', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              MULTI-DRONE OPS // {scenario.toUpperCase()} // T+{simulationTime.toFixed(0)}s
            </div>
          </div>
        </div>

        {/* Drone selector pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {drones.map((d, i) => {
            const c = DRONE_COLORS[d.callsign] || '#8A9A9E'
            const isSel = d.id === selectedDroneId
            return (
              <button key={d.id} onClick={() => setSelectedDrone(d.id)} style={{
                padding: '5px 12px', border: `1px solid ${isSel ? '#79B9C1' : 'rgba(255, 255, 255, 0.1)'}`,
                background: isSel ? '#B9DCE1' : 'rgba(255, 255, 255, 0.06)',
                color: isSel ? '#172124' : '#8A9A9E',
                fontWeight: isSel ? 800 : 700,
                borderRadius: '6px', cursor: 'pointer', fontSize: '9px', letterSpacing: '0.04em',
                transition: 'all 0.18s ease',
              }}>
                {d.callsign}
              </button>
            )
          })}
        </div>

        <button onClick={onClose} style={{
          background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#8A9A9E', cursor: 'pointer', padding: '6px', borderRadius: '6px',
          display: 'flex', transition: 'all 0.18s ease', alignSelf: 'center'
        }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#dc3545'; e.currentTarget.style.color = '#dc3545'; e.currentTarget.style.background = 'rgba(220, 53, 69, 0.1)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.color = '#8A9A9E'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)' }}
        ><X size={15} /></button>
      </div>

      {/* ═══════ BODY ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gridTemplateRows: '1fr', overflow: 'hidden', gap: '1px', background: 'rgba(0, 0, 0, 0.08)' }}>

        {/* ── LEFT: Swarm map + telemetry ──────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#DCE6E8' }}>

          {/* Telemetry strip */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0, 0, 0, 0.08)', background: 'rgba(235, 243, 245, 0.9)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
            {[
              { icon: Activity, label: 'STATUS', value: drone?.status || '—', color: statusColor },
              { icon: MapPin, label: 'POSITION', value: drone?.pos ? `${drone.pos[0].toFixed(0)}, ${drone.pos[2].toFixed(0)}` : '—', color: '#172124' },
              { icon: ArrowUpRight, label: 'ALTITUDE', value: `${Math.round(drone?.pos?.[1] || 0)}m`, color: '#1a565e' },
              { icon: Zap, label: 'SPEED', value: `${Math.round(drone?.speed || 0)} m/s`, color: '#1a565e' },
              { icon: Battery, label: 'BATTERY', value: `${Math.round(battery)}%`, color: batteryColor },
              { icon: Shield, label: 'SCAN_R', value: `${drone?.scan_radius || 0}m`, color: droneColor },
              { icon: Target, label: 'ZONE', value: zoneLabel, color: '#172124' },
              { icon: Activity, label: 'COVERAGE', value: `${Math.min(99, zonePct).toFixed(0)}%`, color: '#2e7d5a' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{
                flex: 1, padding: '10px 14px', borderRight: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex', flexDirection: 'column', gap: '3px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Icon size={11} color='#55666B' />
                  <span style={{ fontSize: '8.5px', color: '#55666B', letterSpacing: '0.04em', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{label}</span>
                </div>
                <span style={{ fontSize: '13px', color, fontWeight: 800, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Swarm constellation */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 12, left: 16,
              fontSize: '8.5px', color: '#55666B', letterSpacing: '0.06em', zIndex: 2,
              fontFamily: 'var(--font-mono)', fontWeight: 700,
              background: 'rgba(255, 255, 255, 0.8)', padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.06)'
            }}>
              SWARM CONSTELLATION // ZONE {zoneLabel} SELECTED // {drones.length} AGENTS ACTIVE
            </div>
            <SwarmCanvas drones={drones} selectedId={selectedDroneId} survivors={survivors} />
          </div>

          {/* Collision proximity table */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', padding: '12px 18px', background: 'rgba(235, 243, 245, 0.95)', flexShrink: 0 }}>
            <div style={{ fontSize: '9px', color: '#55666B', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: 800, fontFamily: 'var(--font-primary)' }}>
              SEPARATION MATRIX // {drone?.callsign} ↔ ALL AGENTS
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {myPairs.map((p, i) => {
                const partner = p.pair.find(c => c !== drone?.callsign)
                const color = DRONE_COLORS[partner] || '#55666B'
                const isWarn = p.separation < 12
                const isDanger = p.separation < 8
                return (
                  <div key={i} style={{
                    padding: '8px 12px', borderRadius: '6px',
                    background: isDanger ? 'rgba(220, 53, 69, 0.1)' : isWarn ? 'rgba(212, 168, 68, 0.12)' : '#FFFFFF',
                    border: `1px solid ${isDanger ? 'rgba(220, 53, 69, 0.4)' : isWarn ? 'rgba(212, 168, 68, 0.4)' : 'rgba(0, 0, 0, 0.08)'}`,
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '10px', color: '#172124', fontWeight: 800 }}>{partner}</span>
                      <span style={{ fontSize: '8.5px', color: isDanger ? '#dc3545' : isWarn ? '#8B6B1B' : '#2e7d5a', fontWeight: 800 }}>
                        {isDanger ? '⚠ CLOSE' : isWarn ? '⚡ NEAR' : '✓ OK'}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: isDanger ? '#dc3545' : isWarn ? '#8B6B1B' : '#172124', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                      {p.separation.toFixed(1)}m
                    </div>
                    <div style={{ marginTop: '4px', height: '3px', background: 'rgba(0, 0, 0, 0.06)', borderRadius: 2 }}>
                      <div style={{
                        width: `${Math.min(100, (1 - p.separation / 60) * 100)}%`,
                        height: '100%', borderRadius: 2,
                        background: isDanger ? '#dc3545' : isWarn ? '#f59e0b' : '#79B9C1',
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Commands + Events ──────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(235, 243, 245, 0.98)', borderLeft: '1px solid rgba(0, 0, 0, 0.08)', overflow: 'hidden', width: '380px' }}>

          {/* Zone coverage */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <div style={{ fontSize: '9px', color: '#55666B', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>ZONE {zoneLabel} SCAN PROGRESS</div>
            <div style={{ height: '6px', background: 'rgba(0, 0, 0, 0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '5px' }}>
              <motion.div
                animate={{ width: `${Math.min(99, zonePct)}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ height: '100%', background: '#79B9C1', borderRadius: '3px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: '#55666B', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              <span>Scanned: <span style={{ color: '#172124', fontWeight: 800 }}>{Math.min(99, zonePct).toFixed(1)}%</span></span>
              <span>ETA: <span style={{ color: '#172124', fontWeight: 800 }}>{((100 - zonePct) / 0.18).toFixed(0)}s</span></span>
            </div>
          </div>

          {/* Nearest survivor */}
          {nearestSurvivor && (
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)', background: 'rgba(88, 186, 138, 0.1)' }}>
              <div style={{ fontSize: '8.5px', color: '#2e7d5a', letterSpacing: '0.06em', marginBottom: '4px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>NEAREST SURVIVOR</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#172124', fontWeight: 800, fontFamily: 'var(--font-primary)' }}>SURV #{nearestSurvivor.id}</div>
                  <div style={{ fontSize: '9.5px', color: '#55666B', fontFamily: 'var(--font-mono)' }}>dist: {nearestSurvivor.dist.toFixed(1)}m</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '9.5px', color: '#55666B', fontFamily: 'var(--font-mono)' }}>conf: <span style={{ color: '#2e7d5a', fontWeight: 800 }}>{(nearestSurvivor.confidence * 100).toFixed(0)}%</span></div>
                  <div style={{ fontSize: '9.5px', color: '#55666B', fontFamily: 'var(--font-mono)' }}>temp: <span style={{ color: '#8B6B1B', fontWeight: 800 }}>{nearestSurvivor.body_temp?.toFixed(1)}°C</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── COMMAND PANEL ──────────────────────────────────────────────── */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
            <div style={{ fontSize: '9px', color: '#55666B', letterSpacing: '0.06em', marginBottom: '10px', fontWeight: 800, fontFamily: 'var(--font-primary)' }}>
              COMMAND // {drone?.callsign}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                {
                  action: 'emergency_return', icon: RotateCcw, label: 'EMERGENCY RETURN',
                  sub: 'RTB immediately · abort mission', color: '#dc3545',
                  bg: 'rgba(220, 53, 69, 0.08)', border: 'rgba(220, 53, 69, 0.3)',
                },
                {
                  action: 'divert_survivor', icon: Target, label: nearestSurvivor ? `DIVERT → SURV #${nearestSurvivor.id}` : 'DIVERT TO SURVIVOR',
                  sub: nearestSurvivor ? `${nearestSurvivor.dist.toFixed(0)}m away · verify detection` : 'No survivor in range',
                  color: '#2e7d5a', bg: 'rgba(88, 186, 138, 0.12)', border: 'rgba(88, 186, 138, 0.4)',
                  disabled: !nearestSurvivor,
                },
                {
                  action: 'extend_scan', icon: Radio, label: 'EXPAND SCAN RADIUS',
                  sub: `${drone?.scan_radius || 0}m → ${(drone?.scan_radius || 0) + 5}m (10% battery cost)`,
                  color: '#1a565e', bg: 'rgba(121, 185, 193, 0.15)', border: '#79B9C1',
                },
                {
                  action: 'relay_boost', icon: Wifi, label: 'BOOST COMMS RELAY',
                  sub: 'Increase data link · 30s duration',
                  color: '#6d28d9', bg: 'rgba(109, 40, 217, 0.08)', border: 'rgba(109, 40, 217, 0.25)',
                },
                {
                  action: 'hold_position', icon: Navigation, label: 'HOLD POSITION',
                  sub: 'Hover at current alt · conserve battery',
                  color: '#8B6B1B', bg: 'rgba(212, 168, 68, 0.12)', border: 'rgba(212, 168, 68, 0.35)',
                },
              ].map(cmd => (
                <button
                  key={cmd.action}
                  disabled={cmd.disabled || activeCmd === cmd.action}
                  onClick={() => !cmd.disabled && issueCommand(cmd.action)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', border: `1px solid ${cmd.border}`,
                    background: cmd.disabled ? 'rgba(0, 0, 0, 0.03)' : activeCmd === cmd.action ? '#FFFFFF' : '#FFFFFF',
                    borderRadius: '6px', cursor: cmd.disabled ? 'not-allowed' : 'pointer',
                    opacity: cmd.disabled ? 0.4 : 1, transition: 'all 0.18s ease', textAlign: 'left', width: '100%',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                  }}
                  onMouseOver={e => { if (!cmd.disabled) e.currentTarget.style.background = cmd.bg }}
                  onMouseOut={e => { if (!cmd.disabled) e.currentTarget.style.background = '#FFFFFF' }}
                >
                  <cmd.icon size={15} color={cmd.color} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', color: cmd.color, fontWeight: 800, letterSpacing: '0.04em', fontFamily: 'var(--font-primary)' }}>
                      {activeCmd === cmd.action ? 'SENDING...' : cmd.label}
                    </div>
                    <div style={{ fontSize: '8.5px', color: '#55666B', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>{cmd.sub}</div>
                  </div>
                  {!cmd.disabled && <ChevronRight size={13} color={cmd.color} />}
                </button>
              ))}
            </div>
          </div>

          {/* ── COMMAND LOG ──────────────────────────────────────────────────── */}
          {cmdLog.length > 0 && (
            <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <div style={{ fontSize: '8.5px', color: '#55666B', letterSpacing: '0.06em', marginBottom: '6px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>CMD LOG</div>
              {cmdLog.map((c, i) => (
                <div key={i} style={{ fontSize: '9px', color: '#55666B', marginBottom: '3px', fontFamily: 'var(--font-mono)' }}>
                  <span>[{c.time.toFixed(0)}s] </span>
                  <span style={{ color: '#172124', fontWeight: 700 }}>{c.callsign}</span>
                  <span> → {c.action.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── DRONE EVENT STREAM ───────────────────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            <div style={{ fontSize: '8.5px', color: '#55666B', letterSpacing: '0.06em', marginBottom: '8px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
              EVENT STREAM // {drone?.callsign}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {myEvents.length > 0 ? myEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: '#8A9A9E', minWidth: '32px' }}>{e.time.toFixed(0)}s</span>
                  <span style={{
                    color: e.category === 'survivor' ? '#2e7d5a' : e.category === 'warning' ? '#8B6B1B' : '#172124',
                    lineHeight: 1.4, fontWeight: 600,
                  }}>{e.message}</span>
                </div>
              )) : (
                <div style={{ fontSize: '9.5px', color: '#8A9A9E', padding: '14px 0', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
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
