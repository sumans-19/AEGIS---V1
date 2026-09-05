import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import { getDronePosition, getDroneAltitude, getDroneSpeed } from '../../hooks/useDroneMovement'
import { setDronePosition } from '../../hooks/dronePositionRegistry'
import DetailedDroneModel from '../Viewport3D/DroneModel'

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
  const uncertaintyHaloRef = useRef()

  const theme = useSimStore(s => s.theme)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const missionPhase = useSimStore(s => s.missionPhase)
  const isSelected = selectedDrone === drone.id
  const isFlying = ['DEPLOYING', 'SEARCHING', 'RETURNING', 'ALL_FOUND'].includes(missionPhase)

  const trailPositions = useRef([])
  const scanColor = DRONE_COLORS[(drone.id - 1) % DRONE_COLORS.length]

  const { trailGeometry, trailLine } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(300 * 3)
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setDrawRange(0, 0)
    const mat = new THREE.LineBasicMaterial({
      color: scanColor,
      transparent: true,
      opacity: 0.4,
      linewidth: 1,
    })
    return { trailGeometry: geom, trailLine: new THREE.Line(geom, mat) }
  }, [scanColor])

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

  // Pre-allocate reusable vectors outside the render loop
  const _mv = useRef(new THREE.Vector3())
  const _lastPos = useRef(new THREE.Vector3())
  const _targetPos = useRef(new THREE.Vector3())
  const _firstFrame = useRef(true)

  // Lerp factor: higher = snappier, lower = smoother
  // Previous values (0.04-0.06) were WAY too low \u2014 drone appeared frozen
  // at 60fps: lerpF=0.04 means only 4% per frame \u2192 half-way in ~17 frames (~0.28s)
  // New values give smooth but clearly visible movement
  const getLerpFactor = () => {
    switch (missionPhase) {
      case 'DEPLOYING': return 0.12   // smooth cruise to region
      case 'SEARCHING': return 0.10   // smooth scanning sweep
      case 'RETURNING': return 0.14   // slightly snappier return
      default: return 1.0             // instant snap when idle
    }
  }

  // Minimum altitude per phase to keep drones above buildings (~33m tallest)
  const MIN_ALT = {
    DEPLOYING: 8,
    SEARCHING: 40,
    ALL_FOUND: 40,
    RETURNING: 8,
  }

  useFrame((state) => {
    if (!groupRef.current) return

    // ── NATIVELY TRACK BACKEND SIMULATION POSITION ──
    // The backend AI engine provides the real 3D position [x, y, z] via WebSocket telemetry
    if (!drone.pos || drone.pos.length < 3) return
    const targetPos = { x: drone.pos[0], y: drone.pos[1], z: drone.pos[2] }

    // Enforce a tiny minimum altitude just to prevent clipping the very bottom of the terrain
    const safeY = Math.max(targetPos.y, 2)

    // ── Lerp to target position for smooth visual motion ──
    _targetPos.current.set(targetPos.x, safeY, targetPos.z)
    const lerpF = getLerpFactor()
    groupRef.current.position.lerp(_targetPos.current, lerpF)
    const cur = groupRef.current.position

    // ── Smooth banking / heading from actual movement delta ──
    if (_firstFrame.current) {
      _lastPos.current.copy(cur)
      _firstFrame.current = false
    }
    _mv.current.set(
      cur.x - _lastPos.current.x,
      cur.y - _lastPos.current.y,
      cur.z - _lastPos.current.z
    )
    _lastPos.current.copy(cur)

    if (_mv.current.lengthSq() > 0.00005) {
      const dir = _mv.current.clone().normalize()
      const targetBankX = dir.z * 0.28
      const targetBankZ = -dir.x * 0.28
      groupRef.current.rotation.x += (targetBankX - groupRef.current.rotation.x) * 0.1
      groupRef.current.rotation.z += (targetBankZ - groupRef.current.rotation.z) * 0.1

      const targetYaw = Math.atan2(dir.x, dir.z)
      let diff = targetYaw - groupRef.current.rotation.y
      while (diff < -Math.PI) diff += Math.PI * 2
      while (diff > Math.PI) diff -= Math.PI * 2
      groupRef.current.rotation.y += diff * 0.1
    }

<<<<<<< HEAD
    // ── Store position back (THROTTLED to 1Hz) ──
    // Updating Zustand state in useFrame causes massive re-renders. Throttle to 1Hz.
    const nowMs = performance.now()
    if (!groupRef.current._lastUpdate || nowMs - groupRef.current._lastUpdate > 1000) {
      groupRef.current._lastUpdate = nowMs
      const storeDrone = useSimStore.getState().drones.find(d => d.id === drone.id)
      if (storeDrone) {
        const lastP = storeDrone.pos
        if (!lastP || Math.abs(lastP[0] - pos.x) > 0.5 || Math.abs(lastP[2] - pos.z) > 0.5) {
          useSimStore.getState().updateDrone(drone.id, {
            altitude: getDroneAltitude(pos) || 0,
            speed: getDroneSpeed(drone) || 0,
            pos: [pos.x, pos.y, pos.z],
          })
        }
      }
    }
=======
    // ── Write live position to registry (for camera views) ──
    setDronePosition(drone.id, groupRef.current.position, _mv.current.lengthSq() > 0.00005 ? _mv.current : null)
>>>>>>> origin/threejsimplementation

    // ── Rotor animation ──
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
        crosshairRef.current.position.set(cur.x, 0.2, cur.z)
        crosshairRef.current.scale.set(scanR, scanR, 1)
        crosshairRef.current.rotation.z = time * 0.5
      }
      if (scanRingRef.current) {
        scanRingRef.current.position.set(cur.x, 0.25, cur.z)
        scanRingRef.current.scale.set(scanR, scanR, 1)
        scanRingRef.current.material.opacity = isSelected ? 0.7 + Math.sin(time * 5) * 0.3 : 0.4
      }

      dropRingsRef.current.forEach((ring, i) => {
        if (!ring) return
        const ringCount = 4
        let dropPct = ((time * 0.3) + (i / ringCount)) % 1.0
        const ringY = cur.y * (1 - dropPct)
        ring.position.set(cur.x, Math.max(ringY, 0), cur.z)
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
          arr[idx++] = cur.x; arr[idx++] = cur.y - 1; arr[idx++] = cur.z
          arr[idx++] = cur.x + dx; arr[idx++] = 0; arr[idx++] = cur.z + dz
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

    // ── GPS Uncertainty Halo ──
    if (uncertaintyHaloRef.current) {
      if (drone.gps_status === false && drone.pos_uncertainty > 0) {
        const uR = drone.pos_uncertainty
        uncertaintyHaloRef.current.position.set(cur.x, 0.3, cur.z)
        uncertaintyHaloRef.current.scale.set(uR, uR, 1)
        uncertaintyHaloRef.current.material.opacity = 0.2 + Math.sin(time * 6) * 0.1
      } else {
        uncertaintyHaloRef.current.position.set(0, -100, 0)
      }
    }

    // ── Trail ──
    if (isFlying) {
      trailPositions.current.push([cur.x, cur.y, cur.z])
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
  const bodyColor = '#f1f5f9'
  const darkDetail = '#0f172a'
  const droneScale = 2.8

  return (
    <group>
      <group ref={groupRef}>
<<<<<<< HEAD
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
                <mesh position={[0, -0.05, 0]}>
                  <sphereGeometry args={[0.05, 8, 8]} />
                  <meshBasicMaterial color={i === 0 || i === 1 ? "#ff2222" : "#00ff66"} />
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
=======
        <group scale={[0.6, 0.6, 0.6]}>
          <DetailedDroneModel propellersRunning={isFlying} />
>>>>>>> origin/threejsimplementation
        </group>

        <pointLight ref={lightRef} color={scanColor} distance={20} intensity={2.5} position={[0, -2, 0]} />
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
        
        {/* GPS Uncertainty Halo */}
        <mesh ref={uncertaintyHaloRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 1, 32]} />
          <meshBasicMaterial color="#dc3545" transparent opacity={0.3} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      <primitive object={trailLine} />
    </group>
  )
}
