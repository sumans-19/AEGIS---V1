import { useRef, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Thermometer } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import { dronePositionRegistry, droneDirectionRegistry } from '../../hooks/dronePositionRegistry'

// Seeded random for consistent generation
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// ── Lightweight Instanced Terrain — Thermal palette ──
function FastTerrainThermal() {
  const meshRef = useRef()

  const { count, matrices, colors } = useMemo(() => {
    const gridSize = 12
    const spacing = 22
    const offset = (gridSize * spacing) / 2

    const tempMatrix = new THREE.Matrix4()
    const tempColor = new THREE.Color()

    const matrices = []
    const colors = []
    let idx = 0

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const typeRand = seededRandom(seed + 10)

        if (typeRand >= 0.12 && typeRand < 0.92) {
          const x = gx * spacing - offset + spacing / 2 + (seededRandom(seed + 1) - 0.5) * 3
          const z = gz * spacing - offset + spacing / 2 + (seededRandom(seed + 2) - 0.5) * 3
          const damageLevel = seededRandom(seed + 3)

          if (damageLevel < 0.35) continue

          let w, h, d
          if (damageLevel < 0.6) {
            w = 7 + seededRandom(seed) * 5
            h = 4 + seededRandom(seed * 2) * 8
            d = 7 + seededRandom(seed * 3) * 5
          } else {
            w = 6 + seededRandom(seed) * 6
            h = 8 + seededRandom(seed * 2) * 10
            d = 6 + seededRandom(seed * 3) * 6
          }

          tempMatrix.identity()
          tempMatrix.makeTranslation(x, h / 2, z)
          const scaleM = new THREE.Matrix4().makeScale(w, h, d)
          tempMatrix.multiply(scaleM)
          matrices.push(tempMatrix.clone())

          // Cold building: dark blue-grey in thermal (low heat signature)
          const coldness = 0.08 + seededRandom(seed * 4) * 0.08
          tempColor.setHSL(0.6, 0.5, coldness)
          colors.push(tempColor.clone())

          idx++
        }
      }
    }
    return { count: idx, matrices, colors }
  }, [])

  // Apply matrices immediately on mount
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i])
      mesh.setColorAt(i, colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, matrices, colors])

<<<<<<< HEAD
    // Pre-bake static noise canvas once
    const noiseCanvas = document.createElement('canvas')
    noiseCanvas.width = 160
    noiseCanvas.height = 120
    const nctx = noiseCanvas.getContext('2d')
    nctx.clearRect(0, 0, 160, 120)
    for (let ny = 0; ny < 40; ny++) {
      for (let nx = 0; nx < 40; nx++) {
        const val = seededRandom(ny * 40 + nx)
        if (val > 0.82) {
          nctx.fillStyle = `hsl(${20 + val * 30}, 90%, ${30 + val * 40}%)`
          nctx.fillRect(nx * 4, ny * 3, 4, 3)
        }
      }
    }
=======
  return (
    <group>
      {/* Cold ground in thermal — very dark with slight warmth near roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial color="#050d08" />
      </mesh>
>>>>>>> origin/threejsimplementation

      {/* Road warmth — slightly warmer than ground (absorbed heat) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial color="#0a1208" transparent opacity={0.6} />
      </mesh>

      {/* Instanced Buildings (cold concrete) */}
      <instancedMesh ref={meshRef} args={[null, null, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  )
}

// ── Thermal heat signatures ──
function ThermalSceneEntities({ selectedDroneId }) {
  const survivors = useSimStore(s => s.survivors) || []
  const drones = useSimStore(s => s.drones) || []
  const scenario = useSimStore(s => s.scenario)

  return (
    <group>
      {survivors.map(s => {
        if (!s.pos) return null
        const temp = s.body_temp || 37.0
        // Hot = white/yellow (alive), Cold = dark blue (deceased)
        const bodyColor = s.alive ? '#ffffff' : '#0a1a3a'
        const glowColor = s.alive ? '#ff4400' : null
        const glowRadius = s.alive ? 2.0 + (temp - 36) * 0.5 : 0

        return (
          <group key={s.id} position={s.pos}>
            {/* Core body heat signature */}
            <mesh position={[0, 0.8, 0]}>
              <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
              <meshBasicMaterial color={bodyColor} />
            </mesh>
            {/* Thermal glow halo (hot body radiates outward) */}
            {s.alive && (
              <>
                <mesh position={[0, 0.8, 0]}>
                  <sphereGeometry args={[glowRadius, 16, 16]} />
                  <meshBasicMaterial color="#ff6600" transparent opacity={0.35} />
                </mesh>
                <mesh position={[0, 0.8, 0]}>
                  <sphereGeometry args={[glowRadius * 1.6, 12, 12]} />
                  <meshBasicMaterial color="#ff2200" transparent opacity={0.12} />
                </mesh>
              </>
            )}
          </group>
        )
      })}

      {/* Other drones — warm motor signatures */}
      {drones.filter(d => d.id !== selectedDroneId).map(d => {
        const livePos = dronePositionRegistry.get(d.id)
        const pos = livePos ? [livePos.x, livePos.y, livePos.z] : (d.pos || [0, 0, 0])
        return (
          <group key={d.id} position={pos}>
            <mesh>
              <boxGeometry args={[1.5, 0.5, 1.5]} />
              <meshBasicMaterial color="#ffaa00" />
            </mesh>
            <mesh>
              <sphereGeometry args={[2.5, 12, 12]} />
              <meshBasicMaterial color="#ff5500" transparent opacity={0.2} />
            </mesh>
          </group>
        )
      })}

      {/* Fire zones — extreme heat signatures */}
      {scenario === 'earthquake' && [
        [20, 0, 15], [-35, 0, 42], [60, 0, -20], [-15, 0, -65], [80, 0, 55],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh>
            <sphereGeometry args={[4, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh>
            <sphereGeometry args={[9, 12, 12]} />
            <meshBasicMaterial color="#ff3300" transparent opacity={0.5} />
          </mesh>
          <mesh>
            <sphereGeometry args={[15, 10, 10]} />
            <meshBasicMaterial color="#ff0000" transparent opacity={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ── First-Person Camera — reads from 60fps registry ──
function FirstPersonCamera({ selectedDroneId }) {
  const { camera } = useThree()
  const smoothPos = useRef(new THREE.Vector3())
  const lookDir = useRef(new THREE.Vector3(0, 0, 1))
  const initialized = useRef(false)

  useFrame(() => {
    if (!selectedDroneId) return

    const livePos = dronePositionRegistry.get(selectedDroneId)
    if (!livePos) {
      const store = useSimStore.getState()
<<<<<<< HEAD
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
      ctx.globalAlpha = 0.04
      ctx.drawImage(noiseCanvas, 0, 0, width, height)
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

      // ── 3e. RADAR SWEEP OVERLAY ────────────────────────
      const sweepAngle = (t * 0.8) % (Math.PI * 2)
      ctx.save()
      ctx.translate(pos[0] * 15, pos[2] * 15) // center on drone
      
      // Radar Rings
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)'
      ctx.setLineDash([5, 15])
      for (let r = 1; r <= 3; r++) {
        ctx.beginPath()
        ctx.arc(0, 0, (S * 0.8 / 3) * r, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.setLineDash([])

      // Sweep Trail
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, S * 0.8, sweepAngle - 0.6, sweepAngle)
      ctx.lineTo(0, 0)
      const sweepGrad = ctx.createRadialGradient(0, 0, S * 0.2, 0, 0, S * 0.8)
      sweepGrad.addColorStop(0, 'rgba(0, 225, 255, 0.08)')
      sweepGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = sweepGrad
      ctx.fill()

      // Active Sweep Line
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(sweepAngle) * S * 0.8, Math.sin(sweepAngle) * S * 0.8)
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      
      // Glint on sweep
      ctx.beginPath()
      ctx.arc(Math.cos(sweepAngle) * S * 0.8, Math.sin(sweepAngle) * S * 0.8, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();

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
=======
      const drone = store.drones.find(d => d.id === selectedDroneId)
      if (!drone?.pos) return
      smoothPos.current.set(...drone.pos)
>>>>>>> origin/threejsimplementation
    }

    const targetPos = livePos || smoothPos.current

    if (!initialized.current) {
      smoothPos.current.copy(targetPos)
      initialized.current = true
    } else {
      smoothPos.current.lerp(targetPos, 0.15)
    }

    const liveDir = droneDirectionRegistry.get(selectedDroneId)
    if (liveDir && liveDir.lengthSq() > 0.001) {
      lookDir.current.lerp(liveDir, 0.08)
      lookDir.current.normalize()
    }

    // Position camera slightly behind and above drone (FPV style)
    const camOffset = lookDir.current.clone().multiplyScalar(-3)
    camOffset.y += 1.5
    const camPos = smoothPos.current.clone().add(camOffset)
    camera.position.copy(camPos)

    // Look ahead and slightly down
    const lookAhead = lookDir.current.clone().multiplyScalar(15)
    const lookTarget = smoothPos.current.clone().add(lookAhead)
    lookTarget.y = smoothPos.current.y - 3
    camera.lookAt(lookTarget)
  })

  return null
}

export default function ThermalView() {
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)
  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#010408', position: 'relative',
      borderRadius: '6px', overflow: 'hidden', border: '1px solid #1c2528',
    }}>
      {/* Slight contrast boost to make heat signatures pop */}
      <div style={{ width: '100%', height: '100%', filter: 'contrast(1.3) saturate(1.2)' }}>
        <Canvas
          camera={{ fov: 72, near: 0.1, far: 1000, position: [0, 20, 10] }}
          gl={{ antialias: false, powerPreference: 'high-performance' }}
        >
          {/* Very dark ambient — thermal cam is not visible-light */}
          <ambientLight intensity={0.05} color="#001020" />

          <FastTerrainThermal />
          <ThermalSceneEntities selectedDroneId={selectedDroneId} />
          <FirstPersonCamera selectedDroneId={selectedDroneId} />
        </Canvas>
      </div>

      {/* CSS Noise overlay for sensor grain effect */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
        opacity: 0.12, zIndex: 4, mixBlendMode: 'overlay'
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.65) 100%)',
        zIndex: 6,
      }} />

      {/* UI Overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '10px', zIndex: 10
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Thermometer size={12} color="#ffaa00" />
            <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>
              THERMAL FLIR // {drone?.callsign || 'UNIT'}
            </span>
          </div>
          <span style={{ color: '#ff4444', fontSize: '9px', fontWeight: 700 }}>● REC</span>
        </div>

        {/* HUD Crosshair */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '48px', height: '48px', border: '1px solid rgba(255,170,0,0.4)', borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: -10, width: 18, height: 1, background: 'rgba(255,170,0,0.8)' }} />
          <div style={{ position: 'absolute', top: '50%', right: -10, width: 18, height: 1, background: 'rgba(255,170,0,0.8)' }} />
          <div style={{ position: 'absolute', left: '50%', top: -10, width: 1, height: 18, background: 'rgba(255,170,0,0.8)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: -10, width: 1, height: 18, background: 'rgba(255,170,0,0.8)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,170,0,0.9)' }} />
        </div>

        {/* Temperature legend */}
        <div style={{
          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'
        }}>
          <span style={{ fontSize: '7px', color: '#fff', fontFamily: 'monospace' }}>HOT</span>
          <div style={{ width: '6px', height: '80px', background: 'linear-gradient(to bottom, #ffffff, #ffaa00, #ff2200, #0a1525)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2px' }} />
          <span style={{ fontSize: '7px', color: '#5577aa', fontFamily: 'monospace' }}>COLD</span>
        </div>

        {/* Bottom telemetry bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#ffaa00', fontFamily: 'monospace', fontSize: '9px' }}>
          <span>MODE: WHOT</span>
          <span>ALT: {Math.round(drone?.pos?.[1] || 0)}m</span>
          <span>AMB: 18°C</span>
        </div>
      </div>
    </div>
  )
}
