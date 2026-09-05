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

  return (
    <group>
      {/* Cold ground in thermal — very dark with slight warmth near roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshBasicMaterial color="#050d08" />
      </mesh>

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
      const drone = store.drones.find(d => d.id === selectedDroneId)
      if (!drone?.pos) return
      smoothPos.current.set(...drone.pos)
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
