import { useEffect, useRef, useMemo } from 'react'
import { Thermometer } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

function seededRandom(seed) {
  let x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

export default function ThermalView() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)

  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)
  const scenario = useSimStore(s => s.scenario)

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  const { gridSize, spacing, offset } = useMemo(() => {
    switch (scenario) {
      case 'earthquake': return { gridSize: 12, spacing: 22, offset: (12 * 22) / 2 }
      case 'tsunami':    return { gridSize: 16, spacing: 18, offset: (16 * 18) / 2 }
      case 'flood':      return { gridSize: 12, spacing: 32, offset: (12 * 32) / 2 }
      default:           return { gridSize: 14, spacing: 38, offset: (14 * 38) / 2 }
    }
  }, [scenario])

  const buildings = useMemo(() => {
    const result = []
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const typeRand = seededRandom(seed + 10)
        const xDisp = (seededRandom(seed + 1) - 0.5) * (scenario === 'flood' ? 12 : 6)
        const zDisp = (seededRandom(seed + 2) - 0.5) * (scenario === 'flood' ? 12 : 6)
        const cx = gx * spacing - offset + spacing / 2 + xDisp
        const cz = gz * spacing - offset + spacing / 2 + zDisp
        if (typeRand > 0.2 && typeRand < 0.85) {
          result.push({ x: cx, z: cz, w: 8 + rand * 10, h: 8 + rand * 10, seed, rand })
        }
      }
    }
    return result
  }, [scenario, gridSize, spacing, offset])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0

    // Pre-bake static noise field
    const noiseField = Array.from({ length: 80 }, (_, i) =>
      Array.from({ length: 80 }, (_, j) => seededRandom(i * 80 + j))
    )

    const draw = () => {
      tick++
      const t = tick * 0.022
      const { width, height } = canvas
      const store = useSimStore.getState()
      const currentDrone = store.drones.find(d => d.id === selectedDroneId) || store.drones[0]
      const pos = currentDrone?.pos || [0, 50, 0]
      const alt = pos[1] || 50
      const scale = 40 / Math.max(alt, 8)
      const survivors = store.survivors || []
      const detectedSurvivors = survivors.filter(s => s.pos && (s.detected || s.status === 'PENDING'))

      // ── 1. DEEP SPACE BACKGROUND ──────────────────────
      ctx.fillStyle = '#030609'
      ctx.fillRect(0, 0, width, height)

      // Vignette
      const vig = ctx.createRadialGradient(width/2, height/2, height*0.2, width/2, height/2, height*0.75)
      vig.addColorStop(0, 'transparent')
      vig.addColorStop(1, 'rgba(0,0,0,0.6)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, width, height)

      // ── 2. AMBIENT THERMAL NOISE LAYER ────────────────
      // Static noise baked into background — gives "sensor grain" look
      ctx.globalAlpha = 0.03
      for (let ny = 0; ny < 80; ny++) {
        for (let nx = 0; nx < 80; nx++) {
          const val = noiseField[ny][nx]
          const bx = (nx / 80) * width
          const by = (ny / 80) * height
          const pw = width / 80, ph = height / 80
          if (val > 0.82) {
            ctx.fillStyle = `hsl(${20 + val * 30}, 90%, ${30 + val * 40}%)`
            ctx.fillRect(bx, by, pw, ph)
          }
        }
      }
      ctx.globalAlpha = 1

      // ── 3. SCENE ──────────────────────────────────────
      ctx.save()
      ctx.translate(width / 2, height / 2)
      ctx.scale(scale, scale)
      ctx.translate(-pos[0] * 15, -pos[2] * 15)

      const S = offset * 15

      // ── 3a. HEX GRID ──────────────────────────────────
      const hexSize = spacing * 15 / 3.2
      const hexW = hexSize * Math.sqrt(3)
      const hexH = hexSize * 2
      const hexRows = Math.ceil((S * 2) / (hexH * 0.75)) + 2
      const hexCols = Math.ceil((S * 2) / hexW) + 2
      const startX = -S - hexW
      const startZ = -S - hexH

      for (let row = 0; row < hexRows; row++) {
        for (let col = 0; col < hexCols; col++) {
          const hx = startX + col * hexW + (row % 2 === 1 ? hexW / 2 : 0)
          const hz = startZ + row * hexH * 0.75
          const distFromCenter = Math.sqrt(hx * hx + hz * hz)
          const maxDist = S * 1.6
          if (distFromCenter > maxDist) continue

          // Hex path
          ctx.beginPath()
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30)
            const px = hx + hexSize * Math.cos(angle)
            const pz = hz + hexSize * Math.sin(angle)
            i === 0 ? ctx.moveTo(px, pz) : ctx.lineTo(px, pz)
          }
          ctx.closePath()

          // Distance-based fade
          const fade = 1 - distFromCenter / maxDist
          ctx.strokeStyle = `rgba(0, 210, 255, ${0.04 + fade * 0.1})`
          ctx.lineWidth = 0.6
          ctx.stroke()

          // Subtle pulse on some hexes
          const hexSeed = row * 200 + col
          if (seededRandom(hexSeed) > 0.93) {
            const pulseAlpha = Math.abs(Math.sin(t * 1.5 + hexSeed)) * 0.06
            ctx.fillStyle = `rgba(0, 210, 255, ${pulseAlpha})`
            ctx.fill()
          }
        }
      }

      // ── 3b. BUILDINGS — Isometric wireframe ──────────
      buildings.forEach(b => {
        const bx = b.x * 15, bz = b.z * 15
        const bw = b.w * 15, bh = b.h * 15
        const isoH = b.h * 8 // extrusion height give 3D feel

        // Roof (slightly brighter)
        ctx.fillStyle = 'rgba(0, 15, 28, 0.9)'
        ctx.strokeStyle = `rgba(0, 200, 255, ${0.1 + b.rand * 0.08})`
        ctx.lineWidth = 0.7
        ctx.fillRect(bx - bw/2, bz - bh/2, bw, bh)
        ctx.strokeRect(bx - bw/2, bz - bh/2, bw, bh)

        // Isometric side hint (right side drop shadow)
        ctx.fillStyle = 'rgba(0, 30, 50, 0.4)'
        ctx.beginPath()
        ctx.moveTo(bx + bw/2, bz - bh/2)
        ctx.lineTo(bx + bw/2 + isoH*0.3, bz - bh/2 + isoH*0.2)
        ctx.lineTo(bx + bw/2 + isoH*0.3, bz + bh/2 + isoH*0.2)
        ctx.lineTo(bx + bw/2, bz + bh/2)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = `rgba(0, 180, 255, 0.06)`
        ctx.lineWidth = 0.5
        ctx.stroke()

        // Floor face
        ctx.beginPath()
        ctx.moveTo(bx - bw/2, bz + bh/2)
        ctx.lineTo(bx - bw/2 + isoH*0.3, bz + bh/2 + isoH*0.2)
        ctx.lineTo(bx + bw/2 + isoH*0.3, bz + bh/2 + isoH*0.2)
        ctx.lineTo(bx + bw/2, bz + bh/2)
        ctx.closePath()
        ctx.fillStyle = 'rgba(0, 10, 22, 0.7)'
        ctx.fill()
        ctx.strokeStyle = `rgba(0, 180, 255, 0.06)`
        ctx.stroke()

        // Scanline inside roof
        ctx.strokeStyle = `rgba(0, 200, 255, 0.04)`
        ctx.lineWidth = 0.4
        for (let si = 1; si < 4; si++) {
          const lx = bx - bw/2 + (bw/4)*si
          ctx.beginPath(); ctx.moveTo(lx, bz - bh/2); ctx.lineTo(lx, bz + bh/2); ctx.stroke()
          const lz = bz - bh/2 + (bh/4)*si
          ctx.beginPath(); ctx.moveTo(bx - bw/2, lz); ctx.lineTo(bx + bw/2, lz); ctx.stroke()
        }

        // Glint dot at roof corner
        ctx.beginPath()
        ctx.arc(bx + bw/2, bz - bh/2, 1.8, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 229, 255, ${0.2 + b.rand * 0.2})`
        ctx.fill()
      })

      // ── 3c. AMBIENT SHIMMER PATCHES ──────────────────
      // Small cold/warm environmental flickers
      for (let i = 0; i < 6; i++) {
        const px = (seededRandom(i * 7 + 3) - 0.5) * S * 1.5
        const pz = (seededRandom(i * 7 + 4) - 0.5) * S * 1.5
        const pr = 20 + seededRandom(i * 7 + 5) * 30
        const alpha = 0.015 + Math.abs(Math.sin(t * 0.4 + i)) * 0.015
        const shimmerGrad = ctx.createRadialGradient(px, pz, 0, px, pz, pr)
        shimmerGrad.addColorStop(0, `rgba(0, 60, 100, ${alpha * 3})`)
        shimmerGrad.addColorStop(1, 'transparent')
        ctx.beginPath(); ctx.arc(px, pz, pr, 0, Math.PI * 2)
        ctx.fillStyle = shimmerGrad; ctx.fill()
      }

      // ── 3d. THERMAL SURVIVOR SIGNATURES ──────────────
      detectedSurvivors.forEach((s, idx) => {
        const sx = s.pos[0] * 15
        const sz = s.pos[2] * 15

        // Ground truth ripple — heat rising off the ground
        for (let ring = 3; ring >= 0; ring--) {
          const rr = (ring + 1) * 18 + Math.sin(t * 2 + idx + ring) * 4
          const alpha = (0.06 - ring * 0.012) * (0.6 + Math.sin(t * 3 + ring) * 0.4)
          ctx.beginPath(); ctx.arc(sx, sz, rr, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255, ${80 + ring * 40}, 0, ${alpha})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Thermal contour lines (like topographic map)
        const contours = [
          { r: 48, color: 'rgba(160, 30, 0, 0.25)' },
          { r: 36, color: 'rgba(220, 60, 0, 0.35)' },
          { r: 24, color: 'rgba(255, 110, 0, 0.45)' },
          { r: 14, color: 'rgba(255, 180, 40, 0.65)' },
          { r: 7,  color: 'rgba(255, 240, 140, 0.85)' },
        ]
        contours.forEach(({ r, color }) => {
          const wobble = Math.sin(t * 1.8 + idx) * 2
          const fillGrad = ctx.createRadialGradient(sx, sz, 0, sx, sz, r + wobble)
          fillGrad.addColorStop(0, color)
          fillGrad.addColorStop(1, 'transparent')
          ctx.beginPath(); ctx.arc(sx, sz, r + wobble, 0, Math.PI * 2)
          ctx.fillStyle = fillGrad; ctx.fill()
        })

        // Core blaze
        const coreGrad = ctx.createRadialGradient(sx, sz, 0, sx, sz, 8)
        coreGrad.addColorStop(0, 'rgba(255,255,255,1)')
        coreGrad.addColorStop(0.35, 'rgba(255, 240, 180, 0.95)')
        coreGrad.addColorStop(0.7, 'rgba(255, 160, 30, 0.7)')
        coreGrad.addColorStop(1, 'rgba(255, 80, 0, 0)')
        ctx.beginPath(); ctx.arc(sx, sz, 8, 0, Math.PI * 2)
        ctx.fillStyle = coreGrad; ctx.fill()

        // Detection lock-on brackets + rotating arc
        const lockR = 26 + Math.sin(t * 4 + idx) * 2
        ctx.beginPath()
        ctx.arc(sx, sz, lockR, t * 1.2, t * 1.2 + Math.PI * 0.6)
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(sx, sz, lockR, t * 1.2 + Math.PI, t * 1.2 + Math.PI * 1.6)
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)'
        ctx.stroke()

        // Corner target brackets
        const bs = 30
        ctx.strokeStyle = `rgba(0, 255, 136, ${0.55 + Math.sin(t * 4) * 0.25})`
        ctx.lineWidth = 1.5
        ;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([mx, mz]) => {
          ctx.beginPath()
          ctx.moveTo(sx + mx * bs, sz + mz * (bs - 7))
          ctx.lineTo(sx + mx * bs, sz + mz * bs)
          ctx.lineTo(sx + mx * (bs - 7), sz + mz * bs)
          ctx.stroke()
        })
      })

      // ── 3e. RADAR SWEEP ───────────────────────────────
      const sweepAngle = (t * 0.5) % (Math.PI * 2)
      const radarGrad = ctx.createConicalGradient
        ? ctx.createConicalGradient(0, 0, sweepAngle)
        : null
      // Fallback: simple line sweep
      ctx.save()
      ctx.translate(pos[0] * 15, pos[2] * 15) // center on drone
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, S * 0.8, sweepAngle - 0.5, sweepAngle)
      ctx.closePath()
      const sweepFill = ctx.createLinearGradient(0, 0, Math.cos(sweepAngle) * S * 0.8, Math.sin(sweepAngle) * S * 0.8)
      sweepFill.addColorStop(0, 'rgba(0, 229, 255, 0.07)')
      sweepFill.addColorStop(1, 'transparent')
      ctx.fillStyle = sweepFill
      ctx.fill()
      ctx.restore()

      ctx.restore()

      // ── 4. POST-PROCESS OVERLAYS ──────────────────────

      // Horizontal CRT scanlines
      ctx.globalAlpha = 0.04
      for (let ly = 0; ly < height; ly += 3) {
        ctx.fillStyle = 'rgba(0,0,0,1)'
        ctx.fillRect(0, ly, width, 1)
      }
      ctx.globalAlpha = 1

      // Moving scan pulse (top-to-bottom)
      const scanY = ((t * 0.25) % 1) * height
      const scanGrad = ctx.createLinearGradient(0, scanY - 50, 0, scanY + 10)
      scanGrad.addColorStop(0, 'transparent')
      scanGrad.addColorStop(0.6, 'rgba(0, 229, 255, 0.03)')
      scanGrad.addColorStop(1, 'rgba(0, 229, 255, 0.08)')
      ctx.fillStyle = scanGrad
      ctx.fillRect(0, scanY - 50, width, 60)

      // Corner frame brackets (military HUD)
      const fSize = 18
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
      ctx.lineWidth = 1.5
      ;[[0, 0, 1, 1], [width, 0, -1, 1], [0, height, 1, -1], [width, height, -1, -1]].forEach(([fx, fy, dx, dy]) => {
        ctx.beginPath()
        ctx.moveTo(fx + dx * fSize, fy)
        ctx.lineTo(fx, fy)
        ctx.lineTo(fx, fy + dy * fSize)
        ctx.stroke()
      })

      // Centre crosshair
      const cx = width / 2, cy = height / 2
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'
      ctx.lineWidth = 0.7
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 5, cy)
      ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 20, cy)
      ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 5)
      ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 20)
      ctx.stroke()
      ctx.setLineDash([])

      // Thermal scale bar (right edge)
      const barX = width - 14; const barY = 40; const barH = height - 80
      for (let bi = 0; bi < barH; bi++) {
        const frac = 1 - bi / barH
        let r, g, b
        if (frac < 0.25)      { r = 20;  g = 20;  b = 80  }
        else if (frac < 0.5)  { r = 160; g = 30;  b = 30  }
        else if (frac < 0.75) { r = 255; g = 100; b = 0   }
        else                  { r = 255; g = 255; b = 200 }
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(barX, barY + bi, 6, 1)
      }
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(barX, barY, 6, barH)
      ctx.fillStyle = 'rgba(0, 229, 255, 0.4)'
      ctx.font = '6px JetBrains Mono'
      ctx.textAlign = 'center'
      ctx.fillText('HOT', barX + 3, barY - 4)
      ctx.fillText('CLD', barX + 3, barY + barH + 8)

      // Thermal sig badge
      const sigCount = detectedSurvivors.length
      if (sigCount > 0) {
        const bw = 84, bh = 18
        const bx2 = width - bw - 18, by2 = height - bh - 10
        ctx.fillStyle = 'rgba(255, 80, 0, 0.15)'
        ctx.fillRect(bx2, by2, bw, bh)
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.45)'
        ctx.lineWidth = 0.7
        ctx.strokeRect(bx2, by2, bw, bh)
        ctx.fillStyle = '#ff8c00'
        ctx.font = 'bold 7.5px JetBrains Mono'
        ctx.textAlign = 'center'
        ctx.fillText(`⬛ HEAT_SIG ×${sigCount}`, bx2 + bw/2, by2 + 12)
      }

      // Alt/Rng label
      ctx.fillStyle = 'rgba(5, 8, 16, 0.8)'
      ctx.fillRect(10, height - 26, 118, 18)
      ctx.strokeStyle = 'rgba(0,229,255,0.15)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(10, height - 26, 118, 18)
      ctx.fillStyle = 'rgba(0, 229, 255, 0.65)'
      ctx.font = '7.5px JetBrains Mono'
      ctx.textAlign = 'left'
      ctx.fillText(`ALT ${Math.round(currentDrone?.pos?.[1] || 0)}m  RNG ${currentDrone?.scan_radius || 0}m`, 16, height - 13)

      // Film grain
      ctx.globalAlpha = 0.02
      for (let gi = 0; gi < 50; gi++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000'
        ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5)
      }
      ctx.globalAlpha = 1

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animRef.current)
  }, [selectedDroneId, scenario, buildings])

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#030609',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '7px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(3,6,9,0.95) 0%, transparent 100%)',
        zIndex: 10,
        borderBottom: '1px solid rgba(0,229,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Thermometer size={11} color="#ff6000" />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '8.5px', color: '#64748b', letterSpacing: '1.5px' }}>
            IR · {drone?.callsign || 'N/A'} · {scenario.toUpperCase()}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88', display: 'inline-block', boxShadow: '0 0 6px #00ff88' }} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '7.5px', color: 'rgba(0,229,255,0.35)' }}>LIVE</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={500}
        height={430}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  )
}
