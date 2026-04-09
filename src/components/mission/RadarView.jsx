import { useEffect, useRef, useMemo } from 'react'
import { Radio } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

function seededRandom(seed) {
  let x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

export default function RadarView() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)
  const scenario = useSimStore(s => s.scenario)
  const survivors = useSimStore(s => s.survivors || [])

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0

    const draw = () => {
      tick++
      const { width, height } = canvas
      const centerX = width / 2
      const centerY = height / 2
      const radius = Math.min(width, height) * 0.45
      
      const store = useSimStore.getState()
      const currentDrone = store.drones.find(d => d.id === selectedDroneId) || store.drones[0]
      const pos = currentDrone?.pos || [0, 50, 0]
      const heading = (currentDrone?.heading || 0) * (Math.PI / 180)
      
      // ── 1. BACKGROUND ────────────────────────────────
      ctx.fillStyle = '#05080a'
      ctx.fillRect(0, 0, width, height)

      // Gradient background
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      bgGrad.addColorStop(0, '#0a1218')
      bgGrad.addColorStop(1, '#05080a')
      ctx.fillStyle = bgGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      ctx.fill()

      // ── 2. GRID RINGS ────────────────────────────────
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)'
      ctx.lineWidth = 1
      for (let r = 1; r <= 4; r++) {
        ctx.beginPath()
        ctx.arc(centerX, centerY, (radius / 4) * r, 0, Math.PI * 2)
        ctx.stroke()
        
        // Distance labels
        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)'
        ctx.font = '8px JetBrains Mono'
        ctx.textAlign = 'center'
        ctx.fillText(`${r * 25}m`, centerX, centerY - (radius / 4) * r + 10)
      }

      // Crosshair lines
      ctx.beginPath()
      ctx.moveTo(centerX - radius, centerY)
      ctx.lineTo(centerX + radius, centerY)
      ctx.moveTo(centerX, centerY - radius)
      ctx.lineTo(centerX, centerY + radius)
      ctx.stroke()

      // ── 3. RADAR SWEEP ───────────────────────────────
      const sweepAngle = (tick * 0.04) % (Math.PI * 2)
      
      ctx.save()
      ctx.translate(centerX, centerY)
      
      // Trail
      const trailGrad = ctx.createConicGradient
        ? ctx.createConicGradient(-Math.PI / 2 + sweepAngle, 0, 0)
        : null
      
      if (trailGrad) {
        trailGrad.addColorStop(0, 'rgba(0, 229, 255, 0.3)')
        trailGrad.addColorStop(0.2, 'rgba(0, 229, 255, 0)')
        ctx.fillStyle = trailGrad
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, sweepAngle - 0.8, sweepAngle)
        ctx.fill()
      } else {
        // Fallback for older browsers
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, radius, sweepAngle - 0.3, sweepAngle)
        ctx.fillStyle = 'rgba(0, 229, 255, 0.1)'
        ctx.fill()
      }

      // Sweep Line
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(sweepAngle) * radius, Math.sin(sweepAngle) * radius)
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'
      ctx.lineWidth = 2
      ctx.stroke()
      
      // Outer Glow
      ctx.shadowBlur = 10
      ctx.shadowColor = 'rgba(0, 255, 255, 0.5)'
      ctx.stroke()
      ctx.shadowBlur = 0
      
      ctx.restore()

      // ── 4. BLIPS (Drones & Survivors) ────────────────
      const maxRange = 100 // mapped to radius
      
      // Other Drones
      store.drones.forEach(d => {
        if (d.id === selectedDroneId) return
        
        const dx = (d.pos[0] - pos[0])
        const dz = (d.pos[2] - pos[2])
        const dist = Math.sqrt(dx * dx + dz * dz)
        
        if (dist < maxRange) {
          const angle = Math.atan2(dz, dx)
          const bx = centerX + (dist / maxRange) * radius * Math.cos(angle)
          const by = centerY + (dist / maxRange) * radius * Math.sin(angle)
          
          // Check if sweep is near
          const angleToBlip = (angle + Math.PI * 2) % (Math.PI * 2)
          const angleDiff = Math.abs(angleToBlip - sweepAngle)
          const opacity = Math.max(0.1, 1 - angleDiff * 2)
          
          ctx.fillStyle = `rgba(0, 229, 255, ${opacity})`
          ctx.beginPath()
          ctx.arc(bx, by, 4, 0, Math.PI * 2)
          ctx.fill()
          
          if (opacity > 0.5) {
            ctx.strokeStyle = `rgba(0, 229, 255, ${opacity * 0.5})`
            ctx.beginPath()
            ctx.arc(bx, by, 8 * (1 - opacity), 0, Math.PI * 2)
            ctx.stroke()
            
            ctx.font = '7px JetBrains Mono'
            ctx.fillText(d.callsign, bx, by - 8)
          }
        }
      })

      // Survivors
      const detectedSurvivors = store.survivors?.filter(s => s.pos && (s.detected || s.status === 'PENDING')) || []
      detectedSurvivors.forEach((s, idx) => {
        const dx = (s.pos[0] - pos[0])
        const dz = (s.pos[2] - pos[2])
        const dist = Math.sqrt(dx * dx + dz * dz)
        
        if (dist < maxRange) {
          const angle = Math.atan2(dz, dx)
          const bx = centerX + (dist / maxRange) * radius * Math.cos(angle)
          const by = centerY + (dist / maxRange) * radius * Math.sin(angle)
          
          const angleToBlip = (angle + Math.PI * 2) % (Math.PI * 2)
          const angleDiff = Math.abs(angleToBlip - sweepAngle)
          const opacity = Math.max(0, 1 - angleDiff * 3)
          
          if (opacity > 0) {
            ctx.fillStyle = `rgba(255, 80, 0, ${opacity})`
            ctx.beginPath()
            ctx.rect(bx - 3, by - 3, 6, 6)
            ctx.fill()
            
            ctx.strokeStyle = `rgba(255, 80, 0, ${opacity * 0.4})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(bx, by, 10 * (1 - opacity), 0, Math.PI * 2)
            ctx.stroke()
          }
        }
      })

      // ── 5. HUD OVERLAYS ──────────────────────────────
      ctx.fillStyle = 'rgba(0, 229, 255, 0.7)'
      ctx.font = '10px JetBrains Mono'
      ctx.textAlign = 'left'
      
      // Top Left Info
      ctx.fillText(`HDG: ${Math.round(currentDrone?.heading || 0)}°`, 15, 60)
      ctx.fillText(`ALT: ${Math.round(pos[1])}m`, 15, 75)
      
      // Bottom Left Info
      ctx.fillText(`LAT: ${pos[0].toFixed(4)}`, 15, height - 35)
      ctx.fillText(`LNG: ${pos[2].toFixed(4)}`, 15, height - 20)
      
      // Right Side Status
      ctx.textAlign = 'right'
      ctx.fillText(`SCAN_RAD: ${currentDrone?.scan_radius || 0}m`, width - 15, 60)
      ctx.fillText(`SIG_STR: 98%`, width - 15, 75)

      // Range Indicator
      ctx.textAlign = 'center'
      ctx.fillText('100m RANGE', centerX, centerY + radius + 20)

      // Post-process: Vignette & Scanlines
      const vig = ctx.createRadialGradient(centerX, centerY, radius * 0.8, centerX, centerY, radius * 1.2)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(0,0,0,0.8)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, width, height)
      
      // CRT Scanlines
      ctx.globalAlpha = 0.05
      for (let i = 0; i < height; i += 3) {
        ctx.fillStyle = '#000'
        ctx.fillRect(0, i, width, 1)
      }
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [selectedDroneId])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#05080a',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '7px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(5,8,10,0.95) 0%, transparent 100%)',
        zIndex: 10,
        borderBottom: '1px solid rgba(0,229,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Radio size={11} color="#00e5ff" />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '8.5px', color: '#64748b', letterSpacing: '1.5px' }}>
            RADAR · {drone?.callsign || 'N/A'} · TRK_04
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5ff', display: 'inline-block', boxShadow: '0 0 6px #00e5ff' }} className="blink" />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '7.5px', color: 'rgba(0,229,255,0.35)' }}>ACTIVE</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={430}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .blink {
          animation: blink 1.5s infinite;
        }
      `}</style>
    </div>
  )
}
