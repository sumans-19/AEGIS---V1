import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import { getDronePosition, getDroneAltitude, getDroneSpeed } from '../../hooks/useDroneMovement'

// Each drone gets a unique color for its scan region
const DRONE_COLORS = [
  '#00e5ff', // cyan
  '#ff6b2b', // orange
  '#00ff88', // green
  '#a855f7', // purple
  '#ffb300', // amber
]

export default function DroneModel({ drone, index }) {
  const groupRef = useRef()
  const rotorRefs = useRef([])
  const lightRef = useRef()
  const scanRingRef = useRef()
  const crosshairRef = useRef()
  const dropRingsRef = useRef([])
  const dropLinesRef = useRef()
  
  const theme = useSimStore(s => s.theme)
  const selectedDrone = useSimStore(s => s.selectedDrone)
  const simulationRunning = useSimStore(s => s.simulationRunning)
  const simulationTime = useSimStore(s => s.simulationTime)
  const isSelected = selectedDrone === drone.id

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
      linewidth: 1, // keeping it subtle
    })
    return { trailGeometry: geom, trailLine: new THREE.Line(geom, mat) }
  }, [scanColor])

  // 4 thin vertical dashed lines dropping to target area
  const { dropLinesGeom, dropLinesMesh } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(24) // 4 lines * 2 vertices * 3 coords
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
    const time = simulationRunning ? state.clock.elapsedTime : simulationTime
    const pos = getDronePosition(drone, time)
    
    // Guard against NaN values to ensure drone never vanishes
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) return
    
    groupRef.current.position.set(pos.x, pos.y, pos.z)

    // Smooth banking rotation
    const nextPos = getDronePosition(drone, time + 0.1)
    const mv = new THREE.Vector3().subVectors(nextPos, pos)
    if (mv.lengthSq() > 0.001) {
      const dir = mv.normalize()
      groupRef.current.rotation.x = dir.z * 0.25
      groupRef.current.rotation.z = -dir.x * 0.25
      groupRef.current.rotation.y = Math.atan2(dir.x, dir.z)
    }

    // Store updates
    useSimStore.getState().updateDrone(drone.id, {
      altitude: getDroneAltitude(pos) || 0,
      speed: getDroneSpeed(drone, time) || 0,
      pos: [pos.x, pos.y, pos.z]
    })

    // Rotor animation
    rotorRefs.current.forEach(r => r && (r.rotation.y += 1.5))

    // Beacon blink
    if (lightRef.current) {
      lightRef.current.intensity = Math.sin(time * 8) > 0.5 ? 6 : 1
    }

    const scanR = (drone.scan_radius || 15) * 0.8

    if (drone.status !== 'CHARGING') {
      // Rotating Ground Crosshair / Grid
      if (crosshairRef.current) {
        crosshairRef.current.position.set(pos.x, 0.2, pos.z)
        crosshairRef.current.scale.set(scanR, scanR, 1)
        crosshairRef.current.rotation.z = time * 0.5 // slowly rotate
      }

      // Main segmented ground ring pulsing
      if (scanRingRef.current) {
        scanRingRef.current.position.set(pos.x, 0.25, pos.z)
        scanRingRef.current.scale.set(scanR, scanR, 1)
        scanRingRef.current.material.opacity = isSelected ? 0.7 + Math.sin(time * 5) * 0.3 : 0.4
      }
      
      // Professional Radar Descent Rings
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

      // Update vertical drop lines
      if (dropLinesMesh) {
        const arr = dropLinesGeom.attributes.position.array
        const R = scanR * 0.7
        const targetCorners = [[-R, -R], [R, -R], [R, R], [-R, R]]
        let idx = 0
        targetCorners.forEach(([dx, dz]) => {
          arr[idx++] = pos.x; arr[idx++] = pos.y - 1; arr[idx++] = pos.z
          arr[idx++] = pos.x + dx; arr[idx++] = 0; arr[idx++] = pos.z + dz
        })
        dropLinesGeom.attributes.position.needsUpdate = true
        dropLinesMesh.computeLineDistances()
      }
    }

    // Trail logic
    if (drone.status !== 'CHARGING') {
      trailPositions.current.push([pos.x, pos.y, pos.z])
      if (trailPositions.current.length > 250) trailPositions.current.shift()

      const arr = trailGeometry.attributes.position.array
      trailPositions.current.forEach((p, i) => {
        arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]
      })
      trailGeometry.attributes.position.needsUpdate = true
      trailGeometry.setDrawRange(0, trailPositions.current.length)
    }
  })

  const primaryColor = theme === 'dark' ? scanColor : '#0891b2'
  const bodyColor = '#f1f5f9'
  const darkDetail = '#0f172a'

  const droneScale = 4.5 

  return (
    <group>
      <group ref={groupRef}>
        <group scale={[droneScale, droneScale, droneScale]}>
          {/* Aerodynamic Lower Chassis (Carbon Fiber style) */}
          <mesh castShadow scale={[1.2, 0.4, 1.4]} position={[0, 0, 0]}>
            <sphereGeometry args={[0.5, 32, 16]} />
            <meshStandardMaterial color={darkDetail} metalness={0.8} roughness={0.4} />
          </mesh>

          {/* Sleek Upper Canopy (Bright visibility shell) */}
          <mesh castShadow scale={[1.15, 0.5, 1.35]} position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={bodyColor} metalness={0.4} roughness={0.2} />
          </mesh>

          {/* Rear heat sinks / grilles */}
          <mesh position={[0, 0, -0.6]} scale={[0.6, 0.2, 0.2]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#111" metalness={0.9} roughness={0.6} />
          </mesh>

          {/* Tactical Central Sensor Core */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.5, 32]} />
            <meshStandardMaterial color={scanColor} emissive={scanColor} emissiveIntensity={isSelected ? 4 : 2} />
          </mesh>

          {/* High-fidelity 4 Quadcopter Arms */}
          {[0, 1, 2, 3].map(i => {
            // angles for an "X" configuration
            const angle = (i * Math.PI) / 2 + Math.PI / 4
            const isFront = (i === 0 || i === 3) // front-left, front-right based on Z
            const isLeft = (i === 1 || i === 2) // assuming simple split
            
            const ax = Math.cos(angle)
            const az = Math.sin(angle)
            
            return (
              <group key={i} position={[ax * 0.8, 0, az * 0.8]}>
                {/* Slanted aerodynamic carbon-fiber arm */}
                <mesh rotation={[0, -angle, Math.PI / 12]} position={[-ax * 0.3, 0.05, -az * 0.3]} castShadow>
                  <boxGeometry args={[1.2, 0.08, 0.15]} />
                  <meshStandardMaterial color={darkDetail} metalness={0.9} roughness={0.3} />
                </mesh>

                {/* Motor housing */}
                <mesh position={[0, 0.15, 0]} castShadow>
                  <cylinderGeometry args={[0.15, 0.18, 0.3, 24]} />
                  <meshStandardMaterial color="#aaa" metalness={1} roughness={0.2} />
                  {/* Motor top cap */}
                  <mesh position={[0, 0.16, 0]}>
                    <cylinderGeometry args={[0.08, 0.08, 0.05, 16]} />
                    <meshStandardMaterial color="#333" metalness={0.8} />
                  </mesh>
                </mesh>

                {/* Realistic propeller blur discs */}
                <mesh ref={el => rotorRefs.current[i] = el} position={[0, 0.35, 0]}>
                  {/* Subtle dark transparent disc representing blades moving fast */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.01, 32]} />
                    <meshStandardMaterial color="#111" transparent opacity={0.25} depthWrite={false} />
                  </mesh>
                  {/* Very faint white highlight rim for blade tips */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.77, 0.8, 32]} />
                    <meshBasicMaterial color="#fff" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
                  </mesh>
                </mesh>

                {/* Nav LEDs under motors (Red port, Green starboard, White rear) */}
                <pointLight 
                  color={i === 0 || i === 1 ? "#ff0000" : (i === 2 || i === 3 ? "#00ff00" : "#ffffff")} 
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

          {/* Underbelly 3-Axis Camera Gimbal */}
          <group position={[0, -0.2, 0.5]}>
            {/* Gimbal Mount */}
            <mesh position={[0, -0.1, -0.1]} castShadow>
              <boxGeometry args={[0.15, 0.2, 0.15]} />
              <meshStandardMaterial color={darkDetail} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Camera Body */}
            <mesh position={[0, -0.3, 0]} castShadow>
              <sphereGeometry args={[0.18, 24, 24]} />
              <meshStandardMaterial color="#333" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* High-Reflectivity Glass Lens pointing down and forward */}
            <mesh position={[0, -0.35, 0.1]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.15, 16]} />
              <meshStandardMaterial color="#000" metalness={1} roughness={0} />
            </mesh>
          </group>
        </group>

        <Html position={[0, 5, 0]} center zIndexRange={[100, 0]}>
          <div style={{
            background: isSelected ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.6)',
            border: `1px solid ${isSelected ? primaryColor : 'rgba(255,255,255,0.1)'}`,
            padding: '5px 10px',
            borderRadius: '2px',
            color: isSelected ? '#fff' : '#888',
            fontFamily: 'JetBrains Mono',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textShadow: isSelected ? `0 0 5px ${primaryColor}` : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textTransform: 'uppercase'
          }}>
            <div style={{ width: 8, height: 8, background: primaryColor, boxShadow: `0 0 8px ${primaryColor}` }} />
            {drone.callsign}
          </div>
        </Html>

        <pointLight ref={lightRef} color={scanColor} distance={30} intensity={4} position={[0, -2, 0]} />
      </group>

      {drone.status !== 'CHARGING' && (
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
      )}

      <primitive object={trailLine} />
    </group>
  )
}
