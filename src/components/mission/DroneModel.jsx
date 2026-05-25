import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import { getDronePosition, getDroneAltitude, getDroneSpeed } from '../../hooks/useDroneMovement'
import { BUILDING_OBSTACLES } from '../../utils/buildingRegistry'

const DRONE_COLORS = [
  '#00e5ff', '#ff6b2b', '#00ff88', '#a855f7', '#ffb300',
]

// Detection config
const POPUP_SECS        = 2.5   // seconds warning icon stays visible
const COOLDOWN_SECS     = 4.0   // min seconds between log entries (not avoidance)
const REPULSE_MARGIN    = 5     // metres of clearance around each building XZ edge
const REPULSE_STRENGTH  = 0.85  // how hard the repulsion pushes per frame
const MAX_REPULSE       = 22    // cap on repulsion offset per axis (metres)
const ABOVE_MARGIN      = 4     // metres above building height where repulsion stops

export default function DroneModel({ drone, index }) {
  const groupRef      = useRef()
  const rotorRefs     = useRef([])
  const lightRef      = useRef()
  const scanRingRef   = useRef()
  const crosshairRef  = useRef()
  const dropRingsRef  = useRef([])
  const dropLinesRef  = useRef()

  const theme        = useSimStore(s => s.theme)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const missionPhase  = useSimStore(s => s.missionPhase)
  const isSelected    = selectedDrone === drone.id
  const addObstacleLog = useSimStore(s => s.addObstacleLog)

  const trailPositions = useRef([])
  const scanColor      = DRONE_COLORS[(drone.id - 1) % DRONE_COLORS.length]

  // ── Obstacle avoidance state (all in refs — zero re-render cost) ──────────
  const obstaclePopupVisible = useRef(false)
  const obstaclePopupTimer   = useRef(0)
  const popupEl              = useRef(null)
  const lastFrameTime        = useRef(0)
  const detectionCooldown    = useRef(0)   // throttle log entries only
  // Persistent repulsion offset applied every frame
  const repulseOffset        = useRef({ x: 0, z: 0 })

  // ── Trail / scan geometry ─────────────────────────────────────────────────
  const { trailGeometry, trailLine } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(300 * 3)
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setDrawRange(0, 0)
    const mat = new THREE.LineBasicMaterial({
      color: scanColor, transparent: true, opacity: 0.4, linewidth: 1,
    })
    return { trailGeometry: geom, trailLine: new THREE.Line(geom, mat) }
  }, [scanColor])

  const { dropLinesGeom, dropLinesMesh } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(24)
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineDashedMaterial({
      color: scanColor, transparent: true, opacity: 0.5, dashSize: 1.5, gapSize: 2,
    })
    const mesh = new THREE.LineSegments(geom, mat)
    mesh.computeLineDistances()
    return { dropLinesGeom: geom, dropLinesMesh: mesh }
  }, [scanColor])

  // ─────────────────────────────────────────────────────────────────────────
  useFrame((state) => {
    if (!groupRef.current) return

    const pos = getDronePosition(drone)
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) return

    const now = state.clock.elapsedTime
    // Real delta-time for accurate popup timer
    const realDt = lastFrameTime.current > 0 ? Math.min(now - lastFrameTime.current, 0.1) : 1/60
    lastFrameTime.current = now

    const isActivelyFlying = ['DEPLOYING', 'SEARCHING'].includes(missionPhase)

    // ── Optional continuous movement for Edge Case Steps 1 & 2 ──────────────
    let scriptOffsetX = 0, scriptOffsetZ = 0
    let scriptNextOffsetX = 0, scriptNextOffsetZ = 0
    
    // Disable wide sweeping patrol for now to prevent building clipping.
    // Drones will just hover with tiny micro-movements.
    if (drone.isScriptOverride) {
      const step = useSimStore.getState().edgeCaseStep
      if (step === 1 || step === 2) {
         const phase = drone.id * Math.PI
         scriptOffsetX = Math.sin(now * 1.5 + phase) * 1.0 // Tiny 1m hover wobble
         scriptOffsetZ = Math.cos(now * 1.5 + phase) * 1.0
         
         scriptNextOffsetX = Math.sin((now + 0.05) * 1.5 + phase) * 1.0
         scriptNextOffsetZ = Math.cos((now + 0.05) * 1.5 + phase) * 1.0
      }
    }

    // Drone's intended position (including patrol sweeps)
    const activeX = pos.x + scriptOffsetX
    const activeZ = pos.z + scriptOffsetZ

    // ── Continuous per-frame building repulsion ───────────────────────────
    let repX = 0, repZ = 0
    let hitAny = false

    for (const b of BUILDING_OBSTACLES) {
      if (pos.y > b.height + ABOVE_MARGIN) continue

      const marginHW = b.hw + REPULSE_MARGIN
      const marginHD = b.hd + REPULSE_MARGIN
      const dx = activeX - b.cx
      const dz = activeZ - b.cz
      const overlapX = marginHW - Math.abs(dx)
      const overlapZ = marginHD - Math.abs(dz)

      if (overlapX <= 0 || overlapZ <= 0) continue

      hitAny = true

      if (overlapX < overlapZ) {
        repX += Math.sign(dx) * overlapX * REPULSE_STRENGTH
      } else {
        repZ += Math.sign(dz) * overlapZ * REPULSE_STRENGTH
      }
    }

    // Clamp repulsion to prevent runaway
    repX = Math.max(-MAX_REPULSE, Math.min(MAX_REPULSE, repX))
    repZ = Math.max(-MAX_REPULSE, Math.min(MAX_REPULSE, repZ))

    // Smoothly integrate repulsion offset each frame
    repulseOffset.current.x += (repX - repulseOffset.current.x) * 0.18
    repulseOffset.current.z += (repZ - repulseOffset.current.z) * 0.18
    // Decay toward zero when no buildings are near
    if (!hitAny) {
      repulseOffset.current.x *= 0.88
      repulseOffset.current.z *= 0.88
    }

    // ── Warning icon: show while inside repulsion zone ────────────────────
    if (hitAny) {
      obstaclePopupVisible.current = true
      obstaclePopupTimer.current   = 0

      // Log (throttled)
      if (isActivelyFlying && now > detectionCooldown.current) {
        detectionCooldown.current = now + COOLDOWN_SECS
        const simTime = Math.floor(useSimStore.getState().simulationTime)
        useSimStore.getState().addObstacleLog(drone.id, {
          id: Date.now() + drone.id,
          time: simTime,
          timestamp: now,
          message: `Obstacle proximity — rerouting around structure.`,
          pos: [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)],
          severity: 'MED',
        })
      }
    } else {
      obstaclePopupTimer.current += realDt
      if (obstaclePopupTimer.current > POPUP_SECS) obstaclePopupVisible.current = false
    }

    // Update icon badge visibility
    // Completely hide it during script override as requested by the user
    if (popupEl.current) {
      const shouldShow = obstaclePopupVisible.current && !drone.isScriptOverride
      popupEl.current.style.opacity   = shouldShow ? '1' : '0'
      popupEl.current.style.transform = shouldShow ? 'scale(1)' : 'scale(0.6)'
    }

    // ── Apply path position + repulsion offset + script patrol offset ──────
    groupRef.current.position.set(
      activeX + repulseOffset.current.x,
      pos.y,
      activeZ + repulseOffset.current.z
    )

    // ── Banking / heading from movement direction ───────────────────────────
    const nextPos2 = getDronePosition(drone, 0.05)
    const nextX = nextPos2.x + scriptNextOffsetX
    const nextZ = nextPos2.z + scriptNextOffsetZ
    
    const mv = new THREE.Vector3(
      nextX - activeX, 
      nextPos2.y - pos.y, 
      nextZ - activeZ
    )
    if (mv.lengthSq() > 0.0001) {
      const dir = mv.normalize()
      groupRef.current.rotation.x = dir.z * 0.2
      groupRef.current.rotation.z = -dir.x * 0.2
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z)
    }

    // ── Store position back (use rendered position, not raw path position) ──
    const rp = groupRef.current.position
    useSimStore.getState().updateDrone(drone.id, {
      altitude: getDroneAltitude({ y: rp.y }) || 0,
      speed:    getDroneSpeed(drone) || 0,
      pos:      [rp.x, rp.y, rp.z],
    })

    // ── Rotor animation ─────────────────────────────────────────────────────
    const isFlying = ['DEPLOYING', 'SEARCHING', 'RETURNING', 'ALL_FOUND'].includes(missionPhase)
    const isIdle   = ['IDLE', 'SELECT_REGION', 'SEED_SURVIVORS', 'COMPLETED'].includes(missionPhase)
    
    // Rotor failure simulation
    let rotorSpeed = isFlying ? 1.5 : (isIdle ? 0.05 : 0.3)
    if (drone.status === 'FAILED' || drone.status === 'FAILED_SYNCING') rotorSpeed = Math.random() * 0.2 // sporadic
    if (drone.status === 'OFFLINE') rotorSpeed = 0 // dead
    if (drone.status === 'RECEIVING') rotorSpeed = 1.0 // hover
    
    rotorRefs.current.forEach(r => r && (r.rotation.y += rotorSpeed))

    // ── Beacon blink ────────────────────────────────────────────────────────
    const time = state.clock.elapsedTime
    if (lightRef.current) {
      lightRef.current.intensity = Math.sin(time * 8) > 0.5 ? 6 : 1
    }

    // ── Scan effects (ground projection) ───────────────────────────────────
    const scanR = (drone.scan_radius || 15) * 0.4
    if (isFlying) {
      const gx = rp.x, gz = rp.z   // use rendered (avoidance-offset) position
      if (crosshairRef.current) {
        crosshairRef.current.position.set(gx, 0.2, gz)
        crosshairRef.current.scale.set(scanR, scanR, 1)
        crosshairRef.current.rotation.z = time * 0.5
      }
      if (scanRingRef.current) {
        scanRingRef.current.position.set(gx, 0.25, gz)
        scanRingRef.current.scale.set(scanR, scanR, 1)
        scanRingRef.current.material.opacity = isSelected ? 0.7 + Math.sin(time * 5) * 0.3 : 0.4
      }
      dropRingsRef.current.forEach((ring, i) => {
        if (!ring) return
        const dropPct = ((time * 0.3) + (i / 4)) % 1.0
        const ringY   = rp.y * (1 - dropPct)
        ring.position.set(gx, Math.max(ringY, 0), gz)
        const ease = 1 - Math.pow(1 - dropPct, 3)
        const currentR = 0.5 + (scanR - 0.5) * ease
        ring.scale.set(currentR, currentR, 1)
        ring.material.opacity = (1 - dropPct) * 0.6
      })
      if (dropLinesMesh) {
        const arr = dropLinesGeom.attributes.position.array
        const R = scanR * 0.7
        let idx = 0
        for (const [dx, dz] of [[-R, -R], [R, -R], [R, R], [-R, R]]) {
          arr[idx++] = gx;      arr[idx++] = rp.y - 1; arr[idx++] = gz
          arr[idx++] = gx + dx; arr[idx++] = 0;        arr[idx++] = gz + dz
        }
        dropLinesGeom.attributes.position.needsUpdate = true
        dropLinesMesh.computeLineDistances()
      }
    } else {
      if (crosshairRef.current) crosshairRef.current.position.set(0, -100, 0)
      if (scanRingRef.current)  scanRingRef.current.position.set(0, -100, 0)
      dropRingsRef.current.forEach(r => r && r.position.set(0, -100, 0))
    }

    // ── Trail ───────────────────────────────────────────────────────────────
    if (isFlying) {
      trailPositions.current.push([rp.x, rp.y, rp.z])
      if (trailPositions.current.length > 250) trailPositions.current.shift()
      const arr = trailGeometry.attributes.position.array
      trailPositions.current.forEach((p, i) => {
        arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]
      })
      trailGeometry.attributes.position.needsUpdate = true
      trailGeometry.setDrawRange(0, trailPositions.current.length)
    }
  })

  const primaryColor = (drone.status === 'FAILED' || drone.status === 'FAILED_SYNCING') ? '#f43f5e' : (drone.status === 'OFFLINE' ? '#475569' : scanColor)
  const bodyColor    = (drone.status === 'OFFLINE') ? '#334155' : '#f1f5f9'
  const darkDetail   = '#0f172a'
  const droneScale   = 2.8

  const isFailedState = drone.status === 'FAILED' || drone.status === 'FAILED_SYNCING'
  const isReceiving = drone.status === 'RECEIVING'
  const isOffline = drone.status === 'OFFLINE'

  return (
    <group>
      <group ref={groupRef}>
        <group scale={[droneScale, droneScale, droneScale]}>
          {/* Aerodynamic Lower Chassis */}
          <mesh castShadow scale={[1.2, 0.4, 1.4]} position={[0, 0, 0]}>
            <sphereGeometry args={[0.5, 32, 16]} />
            <meshStandardMaterial color={darkDetail} metalness={0.8} roughness={0.4} />
          </mesh>

          {/* Upper Canopy */}
          <mesh castShadow scale={[1.15, 0.5, 1.35]} position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.2} />
          </mesh>

          {/* Rear heat sinks */}
          <mesh position={[0, 0, -0.6]} scale={[0.6, 0.2, 0.2]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#111" metalness={0.9} roughness={0.6} />
          </mesh>

          {/* Sensor Core */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.5, 32]} />
            <meshStandardMaterial color={scanColor} emissive={scanColor} emissiveIntensity={isSelected ? 4 : 2} />
          </mesh>

          {/* 4 Arms + Rotors */}
          {[0, 1, 2, 3].map(i => {
            const angle = (i * Math.PI) / 2 + Math.PI / 4
            const ax = Math.cos(angle)
            const az = Math.sin(angle)
            return (
              <group key={i} position={[ax * 0.8, 0, az * 0.8]}>
                <mesh rotation={[0, -angle, Math.PI / 12]} position={[-ax * 0.3, 0.05, -az * 0.3]} castShadow>
                  <boxGeometry args={[1.2, 0.08, 0.15]} />
                  <meshStandardMaterial color={darkDetail} metalness={0.9} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.15, 0]} castShadow>
                  <cylinderGeometry args={[0.15, 0.18, 0.3, 24]} />
                  <meshStandardMaterial color="#aaa" metalness={1} roughness={0.2} />
                  <mesh position={[0, 0.16, 0]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
                    <meshStandardMaterial color="#333" metalness={0.8} />
                  </mesh>
                </mesh>
                <mesh ref={el => rotorRefs.current[i] = el} position={[0, 0.35, 0]}>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.01, 32]} />
                    <meshStandardMaterial color="#111" transparent opacity={0.25} depthWrite={false} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.77, 0.8, 32]} />
                    <meshBasicMaterial color="#fff" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
                  </mesh>
                </mesh>
                <pointLight
                  color={i === 0 || i === 1 ? "#ff0000" : "#00ff00"}
                  distance={2} intensity={1} position={[0, -0.1, 0]}
                />
                <mesh position={[0, -0.05, 0]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                  <meshBasicMaterial color={i === 0 || i === 1 ? "#ff0000" : "#00ff00"} />
                </mesh>
              </group>
            )
          })}

          {/* Camera Gimbal */}
          <group position={[0, -0.2, 0.5]}>
            <mesh position={[0, -0.1, -0.1]} castShadow>
              <boxGeometry args={[0.15, 0.2, 0.15]} />
              <meshStandardMaterial color={darkDetail} metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.3, 0]} castShadow>
              <sphereGeometry args={[0.18, 24, 24]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, -0.35, 0.1]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
              <meshStandardMaterial color="#000" metalness={1} roughness={0} />
            </mesh>
          </group>
        </group>

        {/* Drone colour dot label */}
        <Html position={[0, 4, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            width: 8, height: 8,
            background: primaryColor,
            boxShadow: `0 0 10px ${primaryColor}`,
            borderRadius: '50%',
            opacity: isSelected ? 1 : 0.7,
            transform: isSelected ? 'scale(1.5)' : 'scale(1)',
            transition: 'all 0.2s',
          }} />
        </Html>

        {/* ── Obstacle Detection Icon Badge ─────────────────────────────────── */}
        {/* y=5: sits clearly above the drone body (droneScale=2.8, body ~2u tall) */}
        <Html position={[0, 5, 0]} center zIndexRange={[200, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={popupEl}
            style={{
              opacity: 0,
              transform: 'scale(0.6)',
              transition: 'opacity 0.18s ease, transform 0.18s ease',
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(10, 4, 2, 0.85)',
              border: '1.5px solid #ff4500',
              boxShadow: '0 0 10px rgba(255,69,0,0.8), 0 0 20px rgba(255,69,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'aegisObstaclePulse 0.45s ease-in-out infinite alternate',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}>⚠</span>
          </div>
        </Html>

        {/* ── Status Indicator (Failure / Syncing) ────────────────────────── */}
        {(isFailedState || isReceiving || isOffline) && (
           <Html position={[0, 6.5, 0]} center zIndexRange={[300, 0]} style={{ pointerEvents: 'none' }}>
             <div style={{
               background: isFailedState ? 'rgba(244, 63, 94, 0.2)' : (isReceiving ? 'rgba(0, 229, 255, 0.2)' : 'rgba(71, 85, 105, 0.5)'),
               border: `1px solid ${isFailedState ? '#f43f5e' : (isReceiving ? '#00e5ff' : '#94a3b8')}`,
               color: isFailedState ? '#f43f5e' : (isReceiving ? '#00e5ff' : '#94a3b8'),
               padding: '4px 10px',
               borderRadius: '4px',
               fontSize: '10px',
               fontFamily: 'JetBrains Mono',
               fontWeight: 'bold',
               letterSpacing: '1px',
               backdropFilter: 'blur(4px)',
               animation: (isFailedState || isReceiving) ? 'aegisObstaclePulse 0.5s ease-in-out infinite alternate' : 'none',
             }}>
               {drone.status === 'FAILED' && 'HARDWARE FAULT'}
               {drone.status === 'FAILED_SYNCING' && 'SYNCING...'}
               {drone.status === 'RECEIVING' && 'RECEIVING DATA...'}
               {drone.status === 'OFFLINE' && 'OFFLINE'}
             </div>
           </Html>
        )}

        <pointLight ref={lightRef} color={primaryColor} distance={30} intensity={4} position={[0, -2, 0]} />
      </group>

      {/* ── Scan visuals (ground projection) ──────────────────────────────── */}
      <group>
        {[0, 1, 2, 3].map(i => (
          <mesh key={i} ref={el => dropRingsRef.current[i] = el} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.95, 1.0, 32]} />
            <meshBasicMaterial color={scanColor} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
        <primitive object={dropLinesMesh} />
        <mesh ref={scanRingRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.98, 1.05, 48, 1, 0, 5.5]} />
          <meshBasicMaterial color={scanColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh ref={crosshairRef} rotation={[-Math.PI / 2, 0, 0]}>
          <group>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[1.5, 0.02]} />
              <meshBasicMaterial color={scanColor} transparent opacity={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <planeGeometry args={[0.02, 1.5]} />
              <meshBasicMaterial color={scanColor} transparent opacity={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.4, 0.42, 32]} />
              <meshBasicMaterial color={scanColor} transparent opacity={0.5} />
            </mesh>
          </group>
        </mesh>
      </group>

      <primitive object={trailLine} />
    </group>
  )
}
