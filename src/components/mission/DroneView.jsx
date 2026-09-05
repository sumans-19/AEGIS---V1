import { useRef, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Camera } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import { dronePositionRegistry, droneDirectionRegistry } from '../../hooks/dronePositionRegistry'

// Seeded random for consistent generation
function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// ── Lightweight Instanced Terrain for FPV ──
function FastTerrain() {
  const meshRef = useRef()

  // Generate building matrices once (all data computed synchronously)
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

          if (damageLevel < 0.35) continue // Rubble, skip for fast view

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

          // Realistic concrete gray shade
          const shade = 0.28 + seededRandom(seed * 4) * 0.22
          tempColor.setHSL(0.08, 0.05, shade)
          colors.push(tempColor.clone())

          idx++
        }
      }
    }
    return { count: idx, matrices, colors }
  }, [])

  // Apply matrices immediately after mount using useLayoutEffect
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

  return (
    <group>
      {/* Ground — dirt/concrete */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#4a4a40" roughness={1} />
      </mesh>

      {/* Road grid lines on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color="#2a2a28" roughness={1} transparent opacity={0.5} />
      </mesh>

      {/* Instanced Buildings */}
      <instancedMesh ref={meshRef} args={[null, null, count]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} metalness={0.1} />
      </instancedMesh>
    </group>
  )
}

// ── Survivor entities visible in CAM view ──
function SceneEntities({ selectedDroneId }) {
  const survivors = useSimStore(s => s.survivors) || []
  const drones = useSimStore(s => s.drones) || []

  return (
    <group>
      {survivors.map(s => s.pos && (
        <group key={s.id} position={s.pos}>
          <mesh position={[0, 0.8, 0]}>
            <capsuleGeometry args={[0.3, 1.2, 8, 16]} />
            <meshStandardMaterial color={s.alive ? '#d4956a' : '#475569'} />
          </mesh>
          {s.alive && (
            <pointLight color="#ff8c42" intensity={4} distance={10} position={[0, 2, 0]} />
          )}
        </group>
      ))}

      {drones.filter(d => d.id !== selectedDroneId).map(d => {
        const livePos = dronePositionRegistry.get(d.id)
        const pos = livePos ? [livePos.x, livePos.y, livePos.z] : (d.pos || [0, 0, 0])
        return (
          <group key={d.id} position={pos}>
            <mesh>
              <boxGeometry args={[1.2, 0.4, 1.2]} />
              <meshStandardMaterial color="#00e5ff" emissive="#003c45" />
            </mesh>
            <pointLight color="#00e5ff" intensity={6} distance={12} />
          </group>
        )
      })}
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
      // Fallback: try Zustand store if registry not populated yet
      const store = useSimStore.getState()
      const drone = store.drones.find(d => d.id === selectedDroneId)
      if (!drone || !drone.pos) return
      livePos || smoothPos.current.set(...drone.pos)
    }

    const targetPos = livePos || smoothPos.current

    // On first frame: snap directly to position (no lerp jerk)
    if (!initialized.current) {
      smoothPos.current.copy(targetPos)
      initialized.current = true
    } else {
      // Smooth follow — drone-cam style (not too tight, not too loose)
      smoothPos.current.lerp(targetPos, 0.15)
    }

    // Update look direction from live direction registry
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

    // Look slightly ahead and down (realistic FPV angle)
    const lookAhead = lookDir.current.clone().multiplyScalar(15)
    const lookTarget = smoothPos.current.clone().add(lookAhead)
    lookTarget.y = smoothPos.current.y - 3 // look slightly down
    camera.lookAt(lookTarget)
  })

  return null
}

export default function DroneView() {
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const drones = useSimStore(s => s.drones)

  const drone = drones.find(d => d.id === selectedDroneId) || drones[0]

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0a0f0a', position: 'relative',
      borderRadius: '6px', overflow: 'hidden', border: '1px solid #1c2528',
    }}>
      <Canvas
        camera={{ fov: 72, near: 0.1, far: 1000, position: [0, 20, 10] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        {/* Bright daylight lighting for clear visibility */}
        <ambientLight intensity={0.7} color="#cce8ff" />
        <directionalLight position={[30, 60, 20]} intensity={1.8} color="#fff5e0" castShadow={false} />
        <directionalLight position={[-20, 30, -20]} intensity={0.4} color="#c0d8ff" />
        <fog attach="fog" args={['#2a2a20', 80, 400]} />

        <FastTerrain />
        <SceneEntities selectedDroneId={selectedDroneId} />
        <FirstPersonCamera selectedDroneId={selectedDroneId} />
      </Canvas>

      {/* CSS Scanlines Overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.08) 50%)',
        backgroundSize: '100% 3px', zIndex: 5
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
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
            <Camera size={12} color="#00e5ff" />
            <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', fontFamily: 'monospace' }}>
              LIVE FEED // {drone?.callsign || 'UNIT'}
            </span>
          </div>
          <span style={{ color: '#ff4444', fontSize: '9px', fontWeight: 700 }}>● REC</span>
        </div>

        {/* HUD Crosshair */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '48px', height: '48px', border: '1px solid rgba(0, 229, 255, 0.35)', borderRadius: '50%',
        }}>
          <div style={{ position: 'absolute', top: '50%', left: -10, width: 18, height: 1, background: 'rgba(0, 229, 255, 0.7)' }} />
          <div style={{ position: 'absolute', top: '50%', right: -10, width: 18, height: 1, background: 'rgba(0, 229, 255, 0.7)' }} />
          <div style={{ position: 'absolute', left: '50%', top: -10, width: 1, height: 18, background: 'rgba(0, 229, 255, 0.7)' }} />
          <div style={{ position: 'absolute', left: '50%', bottom: -10, width: 1, height: 18, background: 'rgba(0, 229, 255, 0.7)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 4, height: 4, borderRadius: '50%', background: 'rgba(0,229,255,0.8)' }} />
        </div>

        {/* Bottom telemetry bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#00e5ff', fontFamily: 'monospace', fontSize: '9px' }}>
          <div>UNIT: {drone?.id} · {drone?.callsign}</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <span>ALT: {Math.round(drone?.pos?.[1] || 0)}m</span>
            <span>SPD: {drone?.speed ? Math.round(drone.speed) : 0}m/s</span>
          </div>
          <div>BAT: {Math.round(drone?.battery || 100)}%</div>
        </div>
      </div>
    </div>
  )
}
