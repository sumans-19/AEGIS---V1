import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import { getDronePosition, getDroneAltitude, getDroneSpeed } from '../../hooks/useDroneMovement'

const DRONE_COLORS = [
  '#00e5ff', '#ff6b2b', '#00ff88', '#a855f7', '#ffb300',
]

export default function DroneModel({ drone, index }) {
  const groupRef = useRef()
  const rotorRefs = useRef([])
  const lightRef = useRef()
  const scanRingRef = useRef()
  const crosshairRef = useRef()
  const dropRingsRef = useRef([])
  const dropLinesRef = useRef()
  const frameCounter = useRef(0)

  const theme = useSimStore(s => s.theme)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const missionPhase = useSimStore(s => s.missionPhase)
  const isSelected = selectedDrone === drone.id

  const scanColor = DRONE_COLORS[(drone.id - 1) % DRONE_COLORS.length]

  const { dropLinesGeom, dropLinesMesh } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(24)
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.LineDashedMaterial({
      color: scanColor,
      transparent: true,
      opacity: 0.5,
      dashSize: 1.5,
      gapSize: 2,
    })
    const mesh = new THREE.LineSegments(geom, mat)
    mesh.computeLineDistances()
    return { dropLinesGeom: geom, dropLinesMesh: mesh }
  }, [scanColor])

  useFrame((state) => {
    if (!groupRef.current) return

    // ── Get position from mission-phase-aware system ──
    const pos = getDronePosition(drone)

    // Guard against NaN
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) return

    groupRef.current.position.set(pos.x, pos.y, pos.z)

    // ── Banking / heading from movement direction ──
    const nextPos = getDronePosition(drone, 0.05)
    const mv = new THREE.Vector3(nextPos.x - pos.x, nextPos.y - pos.y, nextPos.z - pos.z)
    if (mv.lengthSq() > 0.0001) {
      const dir = mv.normalize()
      groupRef.current.rotation.x = dir.z * 0.2
      groupRef.current.rotation.z = -dir.x * 0.2
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z)
    }

    // ── Store position back (throttled to every 6th frame ≈ 10 updates/sec) ──
    // PERF FIX: Writing to zustand every frame caused 300 state updates/sec across
    // 5 drones, triggering a re-render storm that froze the UI.
    frameCounter.current++
    if (frameCounter.current % 6 === 0) {
      useSimStore.getState().updateDrone(drone.id, {
        altitude: getDroneAltitude(pos) || 0,
        speed: getDroneSpeed(drone) || 0,
        pos: [pos.x, pos.y, pos.z],
      })
    }

    // ── Rotor animation ──
    const isFlying = ['DEPLOYING', 'SEARCHING', 'RETURNING', 'ALL_FOUND'].includes(missionPhase)
    const isIdle = ['IDLE', 'SELECT_REGION', 'SEED_SURVIVORS', 'COMPLETED'].includes(missionPhase)
    const rotorSpeed = isFlying ? 1.5 : (isIdle ? 0.05 : 0.3)
    rotorRefs.current.forEach(r => r && (r.rotation.y += rotorSpeed))

    // ── Beacon blink ──
    const time = state.clock.elapsedTime
    if (lightRef.current) {
      lightRef.current.intensity = Math.sin(time * 8) > 0.5 ? 6 : 1
    }

    // ── Scan effects (only when flying/searching) ──
    const scanR = (drone.scan_radius || 15) * 0.4
    if (isFlying) {
      if (crosshairRef.current) {
        crosshairRef.current.position.set(pos.x, 0.2, pos.z)
        crosshairRef.current.scale.set(scanR, scanR, 1)
        crosshairRef.current.rotation.z = time * 0.5
      }
      if (scanRingRef.current) {
        scanRingRef.current.position.set(pos.x, 0.25, pos.z)
        scanRingRef.current.scale.set(scanR, scanR, 1)
        scanRingRef.current.material.opacity = isSelected ? 0.7 + Math.sin(time * 5) * 0.3 : 0.4
      }

      dropRingsRef.current.forEach((ring, i) => {
        if (!ring) return
        const ringCount = 4
        let dropPct = ((time * 0.3) + (i / ringCount)) % 1.0
        const ringY = pos.y * (1 - dropPct)
        ring.position.set(pos.x, Math.max(ringY, 0), pos.z)
        const ease = 1 - Math.pow(1 - dropPct, 3)
        const currentR = 0.5 + (scanR - 0.5) * ease
        ring.scale.set(currentR, currentR, 1)
        ring.material.opacity = (1 - dropPct) * 0.6
      })

      if (dropLinesMesh) {
        const arr = dropLinesGeom.attributes.position.array
        const R = scanR * 0.7
        const corners = [[-R, -R], [R, -R], [R, R], [-R, R]]
        let idx = 0
        corners.forEach(([dx, dz]) => {
          arr[idx++] = pos.x; arr[idx++] = pos.y - 1; arr[idx++] = pos.z
          arr[idx++] = pos.x + dx; arr[idx++] = 0; arr[idx++] = pos.z + dz
        })
        dropLinesGeom.attributes.position.needsUpdate = true
        dropLinesMesh.computeLineDistances()
      }
    } else {
      // Hide scan visuals when idle
      if (crosshairRef.current) crosshairRef.current.position.set(0, -100, 0)
      if (scanRingRef.current) scanRingRef.current.position.set(0, -100, 0)
      dropRingsRef.current.forEach(r => r && r.position.set(0, -100, 0))
    }
  })

  const primaryColor = scanColor
  const bodyColor = '#f1f5f9'
  const darkDetail = '#0f172a'
  const droneScale = 2.8

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
                  distance={2}
                  intensity={1}
                  position={[0, -0.1, 0]}
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

        {/* Drone Label (Color Only) */}
        <Html position={[0, 4, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            width: 8, 
            height: 8, 
            background: primaryColor, 
            boxShadow: `0 0 10px ${primaryColor}`,
            borderRadius: '50%',
            opacity: isSelected ? 1 : 0.7,
            transform: isSelected ? 'scale(1.5)' : 'scale(1)',
            transition: 'all 0.2s',
          }} />
        </Html>

        <pointLight ref={lightRef} color={scanColor} distance={30} intensity={4} position={[0, -2, 0]} />
      </group>

      {/* Scan visuals (only when flying) */}
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
    </group>
  )
}
