import { useState, useEffect, useRef } from 'react'
import { Camera, Maximize2, Radio } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

// Realistic muted colors
const GROUND_COLOR = '#1C1C1A'
const ROAD_COLOR = '#2C2C2C'
const DUST_COLOR = 'rgba(122, 122, 106, 0.2)'
const CRACK_COLOR = '#0A0A0A'
const WALL_SHADES = ['#6B6B6B', '#5A5A5A', '#787878', '#4D4D4D', '#636359', '#555550', '#6E6E64', '#7A7A70']
const ROOF_SHADES = ['#3A3A3A', '#484848', '#4F4540', '#353535']

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

export default function DroneView() {
  const canvasRef = useRef(null)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)
  const backendConnected = useSimStore(s => s.backendConnected)

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  // Generate persistent building layout matching Terrain.jsx
  const elementsRef = useRef(null)
  if (!elementsRef.current) {
    const blds = []
    const cracks = []
    const rubble = []
    
    const gridSize = 12
    const spacing = 22
    const offset = (gridSize * spacing) / 2

    // Cracks
    for (let c = 0; c < 25; c++) {
      const sx = (seededRandom(c * 77) - 0.5) * 200
      const sz = (seededRandom(c * 88) - 0.5) * 200
      const len = 15 + seededRandom(c * 99) * 40
      const ang = seededRandom(c * 111) * Math.PI
      cracks.push({
        x1: sx, y1: sz,
        x2: sx + Math.cos(ang) * len, y2: sz + Math.sin(ang) * len,
        width: 0.3 + seededRandom(c * 55) * 1.0,
      })
      if (seededRandom(c * 200) > 0.5) {
        const bx = sx + Math.cos(ang) * len * 0.5
        const bz = sz + Math.sin(ang) * len * 0.5
        const blen = 5 + seededRandom(c * 300) * 15
        const bang = ang + (seededRandom(c * 400) - 0.5) * 1.5
        cracks.push({
          x1: bx, y1: bz,
          x2: bx + Math.cos(bang) * blen, y2: bz + Math.sin(bang) * blen,
          width: 0.2 + seededRandom(c * 66) * 0.4,
        })
      }
    }

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const typeRand = seededRandom(seed + 10)
        
        const cx = gx * spacing - offset + spacing / 2 + (seededRandom(seed + 1) - 0.5) * 3
        const cz = gz * spacing - offset + spacing / 2 + (seededRandom(seed + 2) - 0.5) * 3

        if (typeRand >= 0.12 && typeRand < 0.92) {
          const damageLevel = seededRandom(seed + 3)
          
          if (damageLevel < 0.35) {
            // Fully collapsed
            const chunks = 4 + Math.floor(rand * 5)
            for (let c = 0; c < chunks; c++) {
              const cw = 2 + rand * 5
              const cd = 2 + rand * 5
              blds.push({
                type: 'rubble',
                x: cx + (seededRandom(seed + c) - 0.5) * 8,
                z: cz + (seededRandom(seed + c + 1) - 0.5) * 8,
                w: cw, h: cd,
                color: '#585858'
              })
            }
          } else if (damageLevel < 0.6) {
            // Partially collapsed
            const w = 7 + rand * 5
            const d = 7 + rand * 5
            blds.push({
              type: 'damaged',
              x: cx, z: cz,
              w, h: d,
              color: WALL_SHADES[Math.floor(seededRandom(seed + 5) * WALL_SHADES.length)],
              roofColor: ROOF_SHADES[Math.floor(seededRandom(seed + 6) * ROOF_SHADES.length)],
            })
            blds.push({
              type: 'rubble',
              x: cx + w * 0.7, z: cz + (seededRandom(seed + 8) - 0.5) * 4,
              w: w * 0.8, h: 1.5,
              color: '#4A4A4A'
            })
          } else {
            // Intact
            const w = 7 + rand * 6
            const d = 7 + rand * 6
            blds.push({
              type: 'intact',
              x: cx, z: cz,
              w, h: d,
              color: WALL_SHADES[Math.floor(seededRandom(seed + 5) * WALL_SHADES.length)],
              roofColor: ROOF_SHADES[Math.floor(seededRandom(seed + 6) * ROOF_SHADES.length)],
            })
          }
        } else if (typeRand >= 0.92) {
          // Debris lot
          for (let r = 0; r < 3; r++) {
            rubble.push({
              x: cx + (seededRandom(seed + r * 20) - 0.5) * 10,
              z: cz + (seededRandom(seed + r * 21) - 0.5) * 10,
              s: 0.3 + seededRandom(seed + r * 22) * 0.8
            })
          }
        }
      }
    }
    elementsRef.current = { blds, cracks, rubble }
  }

  // Animate the canvas
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
      
      // Calculate realistic zoom level. 
      // Altitude 50 should equal roughly a 1x scale at these coordinates.
      const scaleFactor = 45 / Math.max(alt, 10) 

      ctx.clearRect(0, 0, width, height)

      // Ground
      ctx.fillStyle = GROUND_COLOR
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.translate(width / 2, height / 2)
      // Apply the scale factor
      ctx.scale(scaleFactor, scaleFactor)
      
      // Since world coords are scaled by 15 for the canvas drawing, translate them
      ctx.translate(-pos[0] * 15, -pos[2] * 15)

      const { blds, cracks, rubble } = elementsRef.current

      // Cracks
      ctx.strokeStyle = CRACK_COLOR
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      cracks.forEach(c => {
        ctx.lineWidth = c.width * 15
        ctx.beginPath()
        ctx.moveTo(c.x1 * 15, c.y1 * 15)
        ctx.lineTo(c.x2 * 15, c.y2 * 15)
        ctx.stroke()
      })

      // Roads
      const gridSize = 12
      const spacing = 22
      const offset = (gridSize * spacing) / 2
      ctx.strokeStyle = ROAD_COLOR
      ctx.lineWidth = 60 // 4 * 15
      for (let i = 0; i <= gridSize; i++) {
        const p = i * spacing - offset
        ctx.beginPath()
        ctx.moveTo(p * 15, (-offset - 45) * 15)
        ctx.lineTo(p * 15, (offset + 45) * 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo((-offset - 45) * 15, p * 15)
        ctx.lineTo((offset + 45) * 15, p * 15)
        ctx.stroke()
      }
      ctx.strokeStyle = '#4A4A3A'
      ctx.lineWidth = 3 
      for (let i = 0; i <= gridSize; i++) {
        const p = i * spacing - offset
        ctx.beginPath()
        ctx.moveTo(p * 15, (-offset - 45) * 15)
        ctx.lineTo(p * 15, (offset + 45) * 15)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo((-offset - 45) * 15, p * 15)
        ctx.lineTo((offset + 45) * 15, p * 15)
        ctx.stroke()
      }

      // Draw buildings
      blds.forEach(b => {
        const bx = b.x * 15
        const bz = b.z * 15
        const bw = b.w * 15
        const bh = b.h * 15

        if (b.type === 'rubble') {
          ctx.fillStyle = b.color
          ctx.fillRect(bx - bw / 2, bz - bh / 2, bw, bh)
        } else {
          // Shadow
          ctx.fillStyle = 'rgba(0,0,0,0.4)'
          ctx.fillRect(bx - bw / 2 + 18, bz - bh / 2 + 18, bw, bh)
          
          // Wall
          ctx.fillStyle = b.color
          ctx.fillRect(bx - bw / 2, bz - bh / 2, bw, bh)
          
          if (b.type === 'intact') {
            // Roof
            ctx.fillStyle = b.roofColor || '#3A3A3A'
            ctx.fillRect(bx - bw / 2 + 2, bz - bh / 2 + 2, bw - 4, bh - 4)
          } else if (b.type === 'damaged') {
            // Damaged Roof
            ctx.fillStyle = b.roofColor || '#3A3A3A'
            ctx.beginPath()
            ctx.moveTo(bx - bw / 2 + 2, bz - bh / 2 + 2)
            ctx.lineTo(bx + bw / 2 - 2, bz - bh / 2 + 2)
            ctx.lineTo(bx + bw / 2 - 2, bz + bh / 4)
            ctx.lineTo(bx, bz + bh / 2 - 2)
            ctx.lineTo(bx - bw / 2 + 2, bz + bh / 2 - 2)
            ctx.fill()
            
            // Damage debris
            ctx.fillStyle = '#2A2A2A'
            ctx.fillRect(bx + bw / 4, bz + bh / 4, bw / 4, bh / 4)
          }
        }
      })

      // Draw other drones from bird's-eye
      droneState.drones.forEach(d => {
        if (d.id === selectedDroneId) return
        const dp = d.pos || [0, 0, 0]
        const dx = dp[0] * 15
        const dz = dp[2] * 15
        
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(dx - 5, dz - 5, 24, 24)
        
        ctx.fillStyle = d.status === 'SCANNING' ? '#00e5ff' : '#aaaaaa'
        ctx.fillRect(dx - 8, dz - 8, 16, 16)
        
        // Scan ring
        if (d.scan_radius) {
          ctx.strokeStyle = d.status === 'SCANNING' ? 'rgba(0,229,255,0.7)' : 'rgba(170,170,170,0.4)'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(dx, dz, d.scan_radius * 15 * 0.8, 0, Math.PI * 2)
          ctx.stroke()
        }
      })

      ctx.restore()

      // Crosshair center
      const cx = width / 2
      const cy = height / 2
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(cx - 25, cy); ctx.lineTo(cx - 10, cy)
      ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 25, cy)
      ctx.moveTo(cx, cy - 25); ctx.lineTo(cx, cy - 10)
      ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 25)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(cx, cy, 35, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)'
      ctx.stroke()

      // Compass
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(cx - 40, height - 30, 80, 20)
      ctx.fillStyle = '#00ff88'
      ctx.font = '12px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(`HDG ${(currentDrone?.heading || 0).toFixed(0)}°`, cx, height - 15)

      ctx.fillStyle = 'rgba(0, 229, 255, 0.5)'
      ctx.font = '10px JetBrains Mono'
      ctx.textAlign = 'left'
      ctx.fillText(`LAT: ${(currentDrone?.pos?.[0] || 0).toFixed(2)}`, 16, height - 55)
      ctx.fillText(`LNG: ${(currentDrone?.pos?.[2] || 0).toFixed(2)}`, 16, height - 40)

      // Scanlines effect
      ctx.fillStyle = 'rgba(0,0,0,0.1)'
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1)
      }

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
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 10,
        borderBottom: '1px solid rgba(0, 229, 255, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Camera size={14} color="#00e5ff" />
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: '#e2e8f0',
            letterSpacing: '1px',
          }}>
            LIVE FEED: {drone?.callsign || 'N/A'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="blink-rec" style={{ width: 8, height: 8, background: '#ff2929', borderRadius: '50%' }} />
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#ff2929', fontWeight: 600 }}>REC ●</span>
          </div>
          <Maximize2 size={12} color="#94a3b8" style={{ cursor: 'pointer' }} />
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(0.2) contrast(1.1)' }}
      />
      
      <div className="hud-corners" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }} />

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        color: '#00e5ff',
      }}>
        <div>DRONE_ID: 0{drone?.id}</div>
        <div>ALT: {drone?.pos?.[1]?.toFixed(1) || '0.0'}m</div>
        <div>SPD: {drone?.vel ? Math.sqrt(drone.vel[0] ** 2 + drone.vel[2] ** 2).toFixed(1) : '0.0'}m/s</div>
        <div>BAT: {drone?.battery?.toFixed(1) || '100'}%</div>
      </div>
    </div>
  )
}
