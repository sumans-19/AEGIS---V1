import { useState, useEffect, useRef } from 'react'
import { Thermometer, Maximize2, ShieldAlert } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Convert temperature to thermal color (blue -> green -> yellow -> orange -> red -> white)
function tempToColor(temp, min = 5, max = 45) {
  const t = Math.max(0, Math.min(1, (temp - min) / (max - min)))

  if (t < 0.2) {
    // Deep blue to blue
    const s = t / 0.2
    return `rgb(${Math.floor(20 + s * 20)}, ${Math.floor(10 + s * 30)}, ${Math.floor(80 + s * 120)})`
  } else if (t < 0.4) {
    // Blue to cyan/green
    const s = (t - 0.2) / 0.2
    return `rgb(${Math.floor(40 - s * 20)}, ${Math.floor(40 + s * 140)}, ${Math.floor(200 - s * 100)})`
  } else if (t < 0.6) {
    // Green to yellow
    const s = (t - 0.4) / 0.2
    return `rgb(${Math.floor(20 + s * 235)}, ${Math.floor(180 + s * 55)}, ${Math.floor(100 - s * 80)})`
  } else if (t < 0.8) {
    // Yellow to orange/red
    const s = (t - 0.6) / 0.2
    return `rgb(${Math.floor(255)}, ${Math.floor(235 - s * 180)}, ${Math.floor(20 - s * 20)})`
  } else {
    // Red to white hot
    const s = (t - 0.8) / 0.2
    return `rgb(${255}, ${Math.floor(55 + s * 200)}, ${Math.floor(s * 200)})`
  }
}

export default function ThermalView() {
  const canvasRef = useRef(null)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)
  const survivors = useSimStore(s => s.survivors)

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  // Generate persistent thermal layout
  const thermalObjectsRef = useRef(null)
  if (!thermalObjectsRef.current) {
    const objects = []
    const gridSize = 14
    const spacing = 38
    const offset = (gridSize * spacing) / 2
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const typeRand = seededRandom(seed + 10)
        const cx = gx * spacing - offset + spacing / 2 + (seededRandom(seed + 1) - 0.5) * 6
        const cz = gz * spacing - offset + spacing / 2 + (seededRandom(seed + 2) - 0.5) * 6

        if (typeRand < 0.2) {
          // Vegetation — cool signature
          const count = 2 + Math.floor(rand * 4)
          for (let t = 0; t < count; t++) {
            objects.push({
              type: 'vegetation',
              x: cx + (seededRandom(seed + t * 7) - 0.5) * 20,
              z: cz + (seededRandom(seed + t * 8) - 0.5) * 20,
              radius: 3 + seededRandom(seed + t * 9) * 3,
              temp: 12 + seededRandom(seed + t) * 6, // 12-18°C
            })
          }
        } else if (typeRand < 0.85) {
          const isCollapsed = seededRandom(seed + 3) < 0.3
          const w = 10 + rand * 12
          const h = 8 + rand * 12
          objects.push({
            type: isCollapsed ? 'rubble' : 'building',
            x: cx,
            z: cz,
            w,
            h,
            temp: isCollapsed ? (18 + rand * 8) : (22 + rand * 8), // Ruins warm from trapped bodies, buildings 22-30°C
          })

          // Heat leak: some buildings have warm spots (people inside / fire)
          if (!isCollapsed && seededRandom(seed + 20) > 0.6) {
            objects.push({
              type: 'hotspot',
              x: cx + (seededRandom(seed + 21) - 0.5) * w * 2,
              z: cz + (seededRandom(seed + 22) - 0.5) * h * 2,
              radius: 2 + seededRandom(seed + 23) * 3,
              temp: 30 + seededRandom(seed + 24) * 10, // 30-40°C
            })
          }
        }
      }
    }
    thermalObjectsRef.current = objects
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    const draw = () => {
      const { width, height } = canvas
      const droneState = useSimStore.getState()
      const currentDrone = droneState.drones.find(d => d.id === selectedDroneId) || droneState.drones[0]
      const pos = currentDrone?.pos || [0, 50, 0]
      const alt = pos[1] || 50
      const scaleFactor = 45 / Math.max(alt, 10)
      const time = Date.now() / 1000

      // Background — cool ambient temperature
      const bgTemp = 8 + Math.sin(time * 0.1) * 2
      ctx.fillStyle = tempToColor(bgTemp)
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(scaleFactor, scaleFactor)
      ctx.translate(-pos[0] * 15, -pos[2] * 15)

      const objects = thermalObjectsRef.current

      // Roads — slightly warmer than ground (asphalt absorbs heat)
      const gridSize = 14
      const spacing = 38
      const offset = (gridSize * spacing) / 2
      ctx.strokeStyle = tempToColor(15)
      ctx.lineWidth = 24
      for (let i = 0; i <= gridSize; i++) {
        const p = i * spacing - offset
        ctx.beginPath()
        ctx.moveTo(p * 15, (-offset - 60) * 15)
        ctx.lineTo(p * 15, (offset + 60) * 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo((-offset - 60) * 15, p * 15)
        ctx.lineTo((offset + 60) * 15, p * 15)
        ctx.stroke()
      }

      // Draw thermal objects
      objects.forEach(obj => {
        const ox = obj.x * 15
        const oz = obj.z * 15

        if (obj.type === 'vegetation') {
          // Cool signature — circular
          const grad = ctx.createRadialGradient(ox, oz, 0, ox, oz, obj.radius * 15)
          grad.addColorStop(0, tempToColor(obj.temp))
          grad.addColorStop(0.7, tempToColor(obj.temp - 2))
          grad.addColorStop(1, tempToColor(bgTemp))
          ctx.beginPath()
          ctx.arc(ox, oz, obj.radius * 16.5, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        } else if (obj.type === 'rubble') {
          // Warm signature with variation
          const bw = obj.w * 15
          const bh = obj.h * 15
          ctx.fillStyle = tempToColor(obj.temp)
          ctx.fillRect(ox - bw / 2, oz - bh / 2, bw, bh)
          // Warm pockets in rubble (possible trapped survivors)
          if (seededRandom(obj.x * 50 + obj.z * 30) > 0.5) {
            const grad = ctx.createRadialGradient(ox, oz, 0, ox, oz, bw / 3)
            grad.addColorStop(0, tempToColor(obj.temp + 12))
            grad.addColorStop(1, tempToColor(obj.temp))
            ctx.beginPath()
            ctx.arc(ox, oz, bw / 3, 0, Math.PI * 2)
            ctx.fillStyle = grad
            ctx.fill()
          }
        } else if (obj.type === 'building') {
          const bw = obj.w * 15
          const bh = obj.h * 15
          // Building thermal — warm body
          ctx.fillStyle = tempToColor(obj.temp)
          ctx.fillRect(ox - bw / 2, oz - bh / 2, bw, bh)
          // Edges slightly different (wall radiation)
          ctx.strokeStyle = tempToColor(obj.temp + 3)
          ctx.lineWidth = 6
          ctx.strokeRect(ox - bw / 2, oz - bh / 2, bw, bh)
        } else if (obj.type === 'hotspot') {
          // Hot spot — radial gradient
          const grad = ctx.createRadialGradient(ox, oz, 0, ox, oz, obj.radius * 18)
          grad.addColorStop(0, tempToColor(obj.temp + 5))
          grad.addColorStop(0.4, tempToColor(obj.temp))
          grad.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(ox, oz, obj.radius * 18, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      })

      // Draw survivors as bright heat signatures
      droneState.survivors.forEach(s => {
        if (!s.pos && !s.position) return
        const sp = s.pos || [s.position?.x || 0, 0, s.position?.z || 0]
        const sx = sp[0] * 15
        const sz = sp[2] * 15
        const bodyTemp = s.body_temp || s.temperature || 37
        const grad = ctx.createRadialGradient(sx, sz, 0, sx, sz, 45)
        grad.addColorStop(0, tempToColor(bodyTemp + 5))
        grad.addColorStop(0.3, tempToColor(bodyTemp))
        grad.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(sx, sz, 45, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
        // Pulsing ring for detected
        if (s.detected || s.status === 'PENDING') {
          ctx.beginPath()
          ctx.arc(sx, sz, 36 + Math.sin(time * 4) * 9, 0, Math.PI * 2)
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'
          ctx.lineWidth = 3
          ctx.stroke()
        }
      })

      ctx.restore()

      // ── HUD Overlays ──

      // Center crosshair
      const cx = width / 2
      const cy = height / 2
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - 25, cy); ctx.lineTo(cx - 8, cy)
      ctx.moveTo(cx + 8, cy); ctx.lineTo(cx + 25, cy)
      ctx.moveTo(cx, cy - 25); ctx.lineTo(cx, cy - 8)
      ctx.moveTo(cx, cy + 8); ctx.lineTo(cx, cy + 25)
      ctx.stroke()

      // Temperature scale bar on right
      const barX = width - 30
      const barY = 50
      const barH = height - 100
      const barW = 10
      for (let i = 0; i < barH; i++) {
        const t = 1 - i / barH
        const temp = 5 + t * 40
        ctx.fillStyle = tempToColor(temp)
        ctx.fillRect(barX, barY + i, barW, 1)
      }
      // Scale labels
      ctx.fillStyle = '#fff'
      ctx.font = '9px JetBrains Mono'
      ctx.textAlign = 'right'
      ctx.fillText('45°C', barX - 3, barY + 5)
      ctx.fillText('25°C', barX - 3, barY + barH / 2)
      ctx.fillText('5°C', barX - 3, barY + barH - 2)
      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(barX, barY, barW, barH)

      // Lightweight noise grain effect (no getImageData)
      ctx.globalAlpha = 0.04
      for (let i = 0; i < 80; i++) {
        const nx = Math.random() * width
        const ny = Math.random() * height
        const ns = 2 + Math.random() * 6
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
        ctx.fillRect(nx, ny, ns, ns)
      }
      ctx.globalAlpha = 1.0

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [selectedDroneId])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0a0a0f',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 10,
        borderBottom: '1px solid #ff450030',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Thermometer size={14} color="#ff4500" />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#e2e8f0',
            letterSpacing: '1px',
          }}>
            THERMAL IMAGING: {drone?.callsign || 'N/A'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="blink-rec" style={{ width: 8, height: 8, background: '#ff4500', borderRadius: '50%' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#ff4500', fontWeight: 600 }}>HOTSPOT_TRACKING ●</span>
          </div>
        </div>
      </div>

      {/* Thermal Canvas */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Overlay: Scan Area Display */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: 16,
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 8px',
        borderRadius: '2px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '9px',
        color: '#ffb300',
        letterSpacing: '1px',
      }}>
        TARGET_RADIUS: {drone?.scan_radius || '15'}m
      </div>
    </div>
  )
}
