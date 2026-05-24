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
const LOOKAHEAD_M       = 35   // metres ahead to probe for buildings (increased)
const DETECT_XZ_RADIUS  = 14   // metres from building XZ edge to trigger detection (wider)
const TALL_THRESHOLD    = 30   // only buildings taller than this trigger detection
const STALL_SECS        = 0.25 // seconds drone holds position on obstacle detect
const POPUP_SECS        = 2.5  // seconds popup stays visible then auto-hides
const AVOID_SECS        = 5.5  // seconds avoidance offset active (longer to fully clear)
const COOLDOWN_SECS     = 10.0 // min seconds between detections per drone

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
  const obstacleActive       = useRef(false)
  const obstaclePopupVisible = useRef(false)
  const obstaclePopupTimer   = useRef(0)
  const avoidOffset          = useRef({ x: 0, z: 0 })
  const avoidTarget          = useRef({ x: 0, z: 0 })
  const popupEl              = useRef(null)
  const isStalling           = useRef(false)
  const stallEndTime         = useRef(0)
  const detectionCooldown    = useRef(0)         // don't detect before this time
  const lastStablePos        = useRef(new THREE.Vector3())
  const lastFrameTime        = useRef(0)         // for real delta-time popup timer
  const detectedBuilding     = useRef(null)      // store which building triggered

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

    // ── Obstacle Detection & Avoidance ─────────────────────────────────────
    if (isActivelyFlying) {

      // Compute heading direction for look-ahead
      const nextPos = getDronePosition(drone, 0.08)
      const hdx = nextPos.x - pos.x
      const hdz = nextPos.z - pos.z
      const hdlen = Math.sqrt(hdx * hdx + hdz * hdz)
      const dirX  = hdlen > 0.001 ? hdx / hdlen : 0
      const dirZ  = hdlen > 0.001 ? hdz / hdlen : 0

      // Sample MULTIPLE look-ahead points to catch buildings sooner
      const probePoints = [
        { x: pos.x + dirX * LOOKAHEAD_M * 0.4, z: pos.z + dirZ * LOOKAHEAD_M * 0.4 },
        { x: pos.x + dirX * LOOKAHEAD_M * 0.7, z: pos.z + dirZ * LOOKAHEAD_M * 0.7 },
        { x: pos.x + dirX * LOOKAHEAD_M,       z: pos.z + dirZ * LOOKAHEAD_M       },
      ]

      // Check look-ahead against real building bounding boxes
      if (!obstacleActive.current && now > detectionCooldown.current) {
        outerLoop:
        for (const probe of probePoints) {
          for (const b of BUILDING_OBSTACLES) {
            if (b.height < TALL_THRESHOLD) continue   // only significant buildings
            // Check if drone altitude would intersect the building vertically
            if (pos.y > b.height + 4) continue        // flying well above, skip
            const ex = Math.max(0, Math.abs(probe.x - b.cx) - b.hw)
            const ez = Math.max(0, Math.abs(probe.z - b.cz) - b.hd)
            if (Math.sqrt(ex * ex + ez * ez) < DETECT_XZ_RADIUS) {
              // ── Building detected ahead! ─────────────────────────────────
              obstacleActive.current       = true
              obstaclePopupVisible.current = true
              obstaclePopupTimer.current   = 0
              detectedBuilding.current     = b

              // Brief stall: hold position for STALL_SECS
              isStalling.current  = true
              stallEndTime.current = now + STALL_SECS

              // Perpendicular lateral avoidance — larger magnitude to fully clear building
              const side = (Math.sin(drone.id * 7.3 + now * 0.1) > 0) ? 1 : -1
              const mag  = Math.max(b.hw, b.hd) * 2.2 + 12  // scaled to building size
              avoidTarget.current = {
                x: -dirZ * mag * side,
                z:  dirX * mag * side,
              }

              // Emit to obstacle log store
              const simTime = Math.floor(useSimStore.getState().simulationTime)
              useSimStore.getState().addObstacleLog(drone.id, {
                id: Date.now() + drone.id,
                time: simTime,
                timestamp: now,
                message: `Obstacle detected — height ${Math.round(b.height)}m. Rerouting ${side > 0 ? 'RIGHT' : 'LEFT'} (+${Math.round(mag)}m offset).`,
                pos: [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)],
                severity: b.height > 50 ? 'HIGH' : 'MED',
              })

              break outerLoop
            }
          }
        }
      }

      // Advance obstacle popup/avoidance timers using REAL delta time
      if (obstacleActive.current) {
        obstaclePopupTimer.current += realDt
        // Hide popup after POPUP_SECS
        if (obstaclePopupTimer.current > POPUP_SECS) obstaclePopupVisible.current = false
        // Clear avoidance after AVOID_SECS
        if (obstaclePopupTimer.current > AVOID_SECS) {
          obstacleActive.current  = false
          avoidTarget.current     = { x: 0, z: 0 }
          detectionCooldown.current = now + COOLDOWN_SECS   // prevent rapid re-triggering
          detectedBuilding.current  = null
        }
      }

      // Stall: freeze rendered position while holdind
      if (isStalling.current && now < stallEndTime.current) {
        groupRef.current.position.copy(lastStablePos.current)
      } else {
        if (isStalling.current) isStalling.current = false

        // Normal: set computed path position then apply lateral offset
        groupRef.current.position.set(pos.x, pos.y, pos.z)

        // Smoothly lerp avoidOffset toward its current target (faster response to clear buildings)
        avoidOffset.current.x += (avoidTarget.current.x - avoidOffset.current.x) * 0.09
        avoidOffset.current.z += (avoidTarget.current.z - avoidOffset.current.z) * 0.09
        groupRef.current.position.x += avoidOffset.current.x
        groupRef.current.position.z += avoidOffset.current.z

        lastStablePos.current.copy(groupRef.current.position)
      }

      // Update popup DOM element (no React re-render needed)
      if (popupEl.current) {
        popupEl.current.style.opacity   = obstaclePopupVisible.current ? '1' : '0'
        popupEl.current.style.transform = obstaclePopupVisible.current
          ? 'translateX(-50%) translateY(0px)'
          : 'translateX(-50%) translateY(8px)'
      }

    } else {
      // Not flying — reset all avoidance state
      groupRef.current.position.set(pos.x, pos.y, pos.z)
      avoidOffset.current          = { x: 0, z: 0 }
      avoidTarget.current          = { x: 0, z: 0 }
      obstacleActive.current       = false
      obstaclePopupVisible.current = false
      isStalling.current           = false
      if (popupEl.current) popupEl.current.style.opacity = '0'
      lastStablePos.current.set(pos.x, pos.y, pos.z)
    }

    // ── Banking / heading from movement direction ───────────────────────────
    const nextPos2 = getDronePosition(drone, 0.05)
    const mv = new THREE.Vector3(nextPos2.x - pos.x, nextPos2.y - pos.y, nextPos2.z - pos.z)
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
    const rotorSpeed = isFlying ? 1.5 : (isIdle ? 0.05 : 0.3)
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

  const primaryColor = scanColor
  const bodyColor    = '#f1f5f9'
  const darkDetail   = '#0f172a'
  const droneScale   = 2.8

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

        {/* ── Obstacle Detection Popup ─────────────────────────────────────── */}
        {/* Always mounted; shown/hidden via ref→DOM style (no re-render) */}
        <Html position={[0, 7.5, 0]} center zIndexRange={[200, 0]} style={{ pointerEvents: 'none' }}>
          <div
            ref={popupEl}
            style={{
              opacity: 0,
              transform: 'translateX(-50%) translateY(8px)',
              transition: 'opacity 0.22s ease, transform 0.22s ease',
              background: 'rgba(8, 2, 1, 0.94)',
              border: '1px solid #ff4500',
              borderRadius: '7px',
              padding: '7px 14px',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 22px rgba(255,69,0,0.65), inset 0 0 10px rgba(255,69,0,0.06)',
              fontFamily: 'JetBrains Mono, monospace',
              userSelect: 'none',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              fontSize: '10px', fontWeight: 700, color: '#ff6b2b',
              letterSpacing: '1.5px',
              animation: 'aegisObstaclePulse 0.5s ease-in-out infinite alternate',
            }}>
              <span style={{ fontSize: '13px' }}>⚠</span>
              OBSTACLE DETECTED
            </div>
            <div style={{
              fontSize: '8px', color: '#ffb300', letterSpacing: '1px',
              marginTop: '4px', textAlign: 'center',
            }}>
              REROUTING...
            </div>
          </div>
        </Html>

        <pointLight ref={lightRef} color={scanColor} distance={30} intensity={4} position={[0, -2, 0]} />
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
