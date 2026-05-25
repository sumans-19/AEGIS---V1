import { memo, useRef, useState, useMemo, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Sky, PerspectiveCamera, QuadraticBezierLine } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import Terrain from './Terrain'
import DroneModel from './DroneModel'
import { PanelRightClose, PanelRightOpen, Target } from 'lucide-react'
import { useEdgeCaseScript } from '../../hooks/useEdgeCaseScript'
import { DRONE_BASE, PROXIMITY_THRESHOLD } from \'../../hooks/useDroneMovement\'
import { WebGLErrorBoundary } from \'../WebGLErrorBoundary\'

// ═══════════════════════════════════
// ATMOSPHERE CONFIG
// ═══════════════════════════════════
const SKY_CONFIG = {
  earthquake: { sunPosition: [30, 8, -50], turbidity: 20, rayleigh: 0.5 },
  tsunami: { sunPosition: [100, 40, 50], turbidity: 8, rayleigh: 2 },
  flood: { sunPosition: [50, 5, 30], turbidity: 18, rayleigh: 0.3 },
}

const FOG_CONFIG = {
  earthquake: { color: '#1a1814', density: 0.0022 },
  tsunami: { color: '#0c1a2e', density: 0.0018 },
  flood: { color: '#1a1410', density: 0.0028 },
}

function SceneFog({ scenario }) {
  const { scene } = useThree()
  useEffect(() => {
    const config = FOG_CONFIG[scenario] || FOG_CONFIG.earthquake
    scene.fog = new THREE.FogExp2(config.color, config.density)
    return () => { scene.fog = null }
  }, [scene, scenario])
  return null
}

// ═══════════════════════════════════
// DRONE BASE PLATFORM (helipad)
// ═══════════════════════════════════
function DroneBasePlatform() {
  const padOffsets = [
    { x: -10, z: -10 },
    { x: 10, z: -10 },
    { x: -10, z: 10 },
    { x: 10, z: 10 },
    { x: 0, z: 0 },
  ]

  return (
    <group position={[DRONE_BASE.x, 0, DRONE_BASE.z]}>
      {/* Main concrete platform */}
      <mesh position={[0, 0.4, 0]} receiveShadow castShadow>
        <boxGeometry args={[44, 0.8, 44]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.92} />
      </mesh>

      {/* Platform edge stripe */}
      <mesh position={[0, 0.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[20, 21, 4]} />
        <meshBasicMaterial color="#ffb300" transparent opacity={0.6} />
      </mesh>

      {/* Landing pads */}
      {padOffsets.map((pad, i) => (
        <group key={i} position={[pad.x, 0.9, pad.z]}>
          {/* Pad circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3, 3.5, 32]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} />
          </mesh>
          {/* Inner circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[1.5, 1.8, 32]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.3} />
          </mesh>
          {/* H mark horizontal */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[2, 0.4]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </mesh>
          {/* H mark vertical left */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.7, 0.02, 0]}>
            <planeGeometry args={[0.4, 3]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </mesh>
          {/* H mark vertical right */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.7, 0.02, 0]}>
            <planeGeometry args={[0.4, 3]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </mesh>
          {/* Pad light */}
          <pointLight color="#00e5ff" intensity={2} distance={8} position={[0, 1, 0]} />
        </group>
      ))}

      {/* Control Tower */}
      <mesh position={[0, 5.5, -18]} castShadow>
        <boxGeometry args={[6, 10, 6]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.8} />
      </mesh>
      <mesh position={[0, 11.5, -18]} castShadow>
        <boxGeometry args={[7, 2, 7]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Tower windows */}
      <mesh position={[0, 11.5, -14.4]}>
        <planeGeometry args={[6.5, 1.5]} />
        <meshStandardMaterial color="#0a1628" emissive="#001830" emissiveIntensity={2} />
      </mesh>
      {/* Tower beacon */}
      <pointLight position={[0, 13.5, -18]} color="#ff0000" intensity={5} distance={30} />
      <mesh position={[0, 13, -18]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>

      {/* Perimeter lights */}
      {[[-20, -20], [20, -20], [-20, 20], [20, 20]].map(([px, pz], i) => (
        <group key={`pl-${i}`} position={[px, 0.9, pz]}>
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 1.5, 8]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <pointLight color="#ffb300" intensity={2} distance={12} position={[0, 1, 0]} />
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#ffb300" />
          </mesh>
        </group>
      ))}

      {/* BASE label */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.86, 16]}>
        <planeGeometry args={[12, 2]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

// ═══════════════════════════════════
// REGION SELECTION MODE (two clicks)
// ═══════════════════════════════════
function RegionSelectMode({ onRegionSelected }) {
  const [firstCorner, setFirstCorner] = useState(null)
  const [hover, setHover] = useState(null)

  return (
    <group>
      {/* Invisible click plane (raised above terrain for reliable clicks) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 8, 0]}
        renderOrder={999}
        onPointerDown={(e) => {
          e.stopPropagation()
          const pt = { x: e.point.x, z: e.point.z }
          if (!firstCorner) {
            setFirstCorner(pt)
          } else {
            const x1 = Math.min(firstCorner.x, pt.x)
            const z1 = Math.min(firstCorner.z, pt.z)
            const x2 = Math.max(firstCorner.x, pt.x)
            const z2 = Math.max(firstCorner.z, pt.z)
            // Minimum 30m region
            if (x2 - x1 > 30 && z2 - z1 > 30) {
              onRegionSelected({ x1, z1, x2, z2 })
            }
            setFirstCorner(null)
            setHover(null)
          }
        }}
        onPointerMove={(e) => {
          if (firstCorner) setHover({ x: e.point.x, z: e.point.z })
        }}
      >
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
      </mesh>

      {/* First corner marker */}
      {firstCorner && (
        <mesh position={[firstCorner.x, 0.5, firstCorner.z]}>
          <sphereGeometry args={[1.5, 16, 16]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Preview rectangle */}
      {firstCorner && hover && (
        <RegionRect
          x1={Math.min(firstCorner.x, hover.x)}
          z1={Math.min(firstCorner.z, hover.z)}
          x2={Math.max(firstCorner.x, hover.x)}
          z2={Math.max(firstCorner.z, hover.z)}
          opacity={0.12}
        />
      )}
    </group>
  )
}

// ═══════════════════════════════════
// REGION VISUALIZATION
// ═══════════════════════════════════
function RegionRect({ x1, z1, x2, z2, opacity = 0.08 }) {
  const cx = (x1 + x2) / 2
  const cz = (z1 + z2) / 2
  const w = Math.abs(x2 - x1)
  const d = Math.abs(z2 - z1)

  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 12, d)), [w, d])

  return (
    <group>
      {/* Ground fill */}
      <mesh position={[cx, 0.3, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {/* Wireframe boundary */}
      <lineSegments position={[cx, 6, cz]} geometry={edgesGeo}>
        <lineBasicMaterial color="#00e5ff" transparent opacity={0.4} />
      </lineSegments>
      {/* Corner poles */}
      {[[x1, z1], [x2, z1], [x1, z2], [x2, z2]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 6, pz]}>
          <cylinderGeometry args={[0.2, 0.2, 12, 8]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// ═══════════════════════════════════
// DATA TRANSFER VISUALIZATION
// ═══════════════════════════════════
function DataTransferLink({ drones }) {
  const syncing = drones.find(d => d.status === 'FAILED_SYNCING')
  const receiving = drones.find(d => d.status === 'RECEIVING')
  const matRef = useRef()

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.dashOffset -= 0.05
    }
  })

  if (!syncing || !receiving || !syncing.pos || !receiving.pos) return null

  const p1 = new THREE.Vector3(...syncing.pos)
  const p2 = new THREE.Vector3(...receiving.pos)
  
  // Arch the line up slightly for a nice bezier
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
  mid.y += 10

  return (
    <group>
      <QuadraticBezierLine
        start={p1}
        end={p2}
        mid={mid}
        color="#f43f5e"
        lineWidth={3}
        dashed
        dashScale={50}
        dashSize={4}
        gapSize={2}
        ref={matRef}
        transparent
        opacity={0.8}
      />
      <pointLight position={mid} color="#f43f5e" intensity={5} distance={20} />
    </group>
  )
}

// ═══════════════════════════════════
// SEED MODE (constrained to region)
// ═══════════════════════════════════
function SeedMode({ onSeed, searchRegion }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 8, 0]}
      renderOrder={999}
      onPointerDown={(e) => {
        e.stopPropagation()
        if (e.button !== 0) return
        const { x, z } = e.point
        // Only allow seeding within the search region
        if (searchRegion &&
          x >= searchRegion.x1 && x <= searchRegion.x2 &&
          z >= searchRegion.z1 && z <= searchRegion.z2) {
          onSeed(x, z)
        }
      }}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={2} />
    </mesh>
  )
}

// ═══════════════════════════════════
// SURVIVOR FIGURE
// ═══════════════════════════════════
const SurvivorFigure = memo(function SurvivorFigure({ pos, status, confidence, alive }) {
  const isDead = !alive
  const isRecovering = status === 'RESCUED'
  const isDetected = status === 'DETECTED'
  const isCritical = confidence < 0.3 && !isRecovering

  const color = isDead ? '#475569'
    : isRecovering ? '#00ff88'
    : isDetected ? '#00e5ff'
    : isCritical ? '#ff6b2b'
    : '#c4906a'

  return (
    <group position={pos} rotation={isDead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.25, 1.1, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Detection ring */}
      {isDetected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[1.5, 2, 32]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* SOS pulse for undetected */}
      {!isDetected && !isDead && (
        <mesh position={[0, 2.5, 0]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color="#ff6b2b" emissive="#ff6b2b" emissiveIntensity={2.2} />
        </mesh>
      )}
    </group>
  )
})

// ═══════════════════════════════════
// CAMERA CONTROLLER (POV Mode)
// ═══════════════════════════════════
function CameraController() {
  const povMode = useSimStore(s => s.povMode)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const rawDrones = useSimStore(s => s.drones)
  const displayDrones = useEdgeCaseScript(rawDrones)
  const { camera } = useThree()

  // Track previous position to estimate heading
  const prevPosRef = useRef(new THREE.Vector3())

  useFrame(() => {
    if (povMode && selectedDroneId) {
      const drone = displayDrones.find(d => d.id === selectedDroneId)
      if (drone && drone.pos) {
        const [dx, dy, dz] = drone.pos
        const currentPos = new THREE.Vector3(dx, dy, dz)
        
        // Estimate heading based on movement
        const velocity = currentPos.clone().sub(prevPosRef.current)
        if (velocity.lengthSq() > 0.001) velocity.normalize()
        else velocity.set(0, 0, 1) // default forward

        prevPosRef.current.copy(currentPos)

        // Camera stays behind and slightly above the drone
        const offset = velocity.clone().multiplyScalar(-6).add(new THREE.Vector3(0, 2, 0))
        const targetCamPos = currentPos.clone().add(offset)
        
        camera.position.lerp(targetCamPos, 0.1)
        camera.lookAt(currentPos)
      }
    }
  })
  return null
}

// ═══════════════════════════════════
// PROXIMITY EVASION VISUALIZATION
// ═══════════════════════════════════

function ProximityEvasionLines({ encounter }) {
  if (!encounter) return null
  const { reroutePath1, reroutePath2 } = encounter

  const renderPath = (path, color) => {
    if (!path || path.length < 2) return null
    const points = []
    path.forEach(p => points.push(new THREE.Vector3(p.x, 15, p.z)))
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return (
      <line geometry={geo}>
        <lineBasicMaterial color={color} transparent opacity={0.8} linewidth={3} />
      </line>
    )
  }

  return (
    <group>
      {renderPath(reroutePath1, '#ff3200')}
      {renderPath(reroutePath2, '#ffb300')}
      {/* Draw a subtle cylinder between them representing the threshold */}
      <mesh position={[(encounter.pos1.x + encounter.pos2.x)/2, 15, (encounter.pos1.z + encounter.pos2.z)/2]}>
        <cylinderGeometry args={[PROXIMITY_THRESHOLD, PROXIMITY_THRESHOLD, 4, 32]} />
        <meshBasicMaterial color="#ff3200" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// TAKEOVER PATH VISUALIZATION
// Shows green lines for replacement drone entry paths
// and red pulsing rings for failed drone positions
// ═══════════════════════════════════
function TakeoverPath({ override, drone }) {
  const entryLineRef = useRef()
  const opLineRef    = useRef()
  const ringRef      = useRef()

  const { entryLineMesh, opLineMesh } = useMemo(() => {
    // Entry path (base → intercept point) — bright green dashed
    const entryGeom = new THREE.BufferGeometry()
    const entryMat  = new THREE.LineDashedMaterial({
      color: '#00ff88', transparent: true, opacity: 0.6,
      dashSize: 3, gapSize: 2,
    })
    const entryLine = new THREE.Line(entryGeom, entryMat)

    // Operation path (intercepted route) — amber dashed
    const opGeom = new THREE.BufferGeometry()
    const opMat  = new THREE.LineDashedMaterial({
      color: '#ffb300', transparent: true, opacity: 0.4,
      dashSize: 2, gapSize: 3,
    })
    const opLine = new THREE.Line(opGeom, opMat)

    return { entryLineMesh: entryLine, opLineMesh: opLine }
  }, [])

  useEffect(() => {
    // Build entry path geometry
    const ep = override.entryPath || []
    if (ep.length > 1) {
      const pts = ep.map(p => new THREE.Vector3(p.x, 18, p.z))
      entryLineMesh.geometry.setFromPoints(pts)
      entryLineMesh.computeLineDistances()
    }

    // Build operation path geometry
    const op = override.operationPath || []
    if (op.length > 1) {
      const pts = op.map(p => new THREE.Vector3(p.x, 15, p.z))
      opLineMesh.geometry.setFromPoints(pts)
      opLineMesh.computeLineDistances()
    }
  }, [override, entryLineMesh, opLineMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (entryLineMesh.material) entryLineMesh.material.opacity = 0.4 + Math.sin(t * 2) * 0.2
    if (ringRef.current) {
      ringRef.current.material.opacity = 0.3 + Math.sin(t * 4) * 0.3
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.15)
    }
  })

  const pos = drone?.pos || [0, 0, 0]

  return (
    <group>
      {/* Entry path line */}
      <primitive object={entryLineMesh} />
      {/* Operation path line */}
      <primitive object={opLineMesh} />
      {/* Pulsing ring at replacement drone's target intercept point */}
      {override.entryPath?.length > 0 && (() => {
        const last = override.entryPath[override.entryPath.length - 1]
        return (
          <mesh ref={ringRef} position={[last.x, 0.3, last.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[4, 5, 32]} />
            <meshBasicMaterial color="#00ff88" transparent side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )
      })()}
    </group>
  )
}

function FailedDroneMarker({ drone }) {
  const ringRef  = useRef()
  const ring2Ref = useRef()
  const pos = drone?.pos || [0, 0, 0]

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ringRef.current)  ringRef.current.material.opacity  = 0.2 + Math.sin(t * 5) * 0.4
    if (ring2Ref.current) ring2Ref.current.material.opacity = 0.1 + Math.sin(t * 5 + 1) * 0.2
  })

  if (!pos || pos.length < 3) return null

  return (
    <group position={[pos[0], 0.2, pos[2]]}>
      {/* Inner warning ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3, 4, 32]} />
        <meshBasicMaterial color="#ff3030" transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Outer warning ring */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 7, 32]} />
        <meshBasicMaterial color="#ff3030" transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* Vertical beacon line */}
      <mesh position={[0, pos[1] / 2 + 1, 0]}>
        <cylinderGeometry args={[0.08, 0.08, pos[1] + 2, 8]} />
        <meshBasicMaterial color="#ff3030" transparent opacity={0.25} />
      </mesh>
    </group>
  )
}

function TakeoverPathsLayer() {
  const dronePathOverrides = useSimStore(s => s.dronePathOverrides)
  const drones             = useSimStore(s => s.drones)

  const takeoverOverrides = Object.entries(dronePathOverrides || {})
    .filter(([, ov]) => ov?.mode === 'takeover')
  const failedDrones = drones.filter(d => d.status === 'FAILED_RTB' && d.pos)

  if (!takeoverOverrides.length && !failedDrones.length) return null

  return (
    <>
      {takeoverOverrides.map(([droneId, override]) => {
        const drone = drones.find(d => d.id === Number(droneId))
        return (
          <TakeoverPath key={droneId} override={override} drone={drone} />
        )
      })}
      {failedDrones.map(drone => (
        <FailedDroneMarker key={drone.id} drone={drone} />
      ))}
    </>
  )
}

function DronesLayer() {
  const rawDrones = useSimStore(s => s.drones)
  const displayDrones = useEdgeCaseScript(rawDrones)
  return (
    <>
      {displayDrones.map((drone, index) => (
        <DroneModel key={drone.id} drone={drone} index={index} />
      ))}
    </>
  )
}

function SurvivorsLayer() {
  const survivors = useSimStore(s => s.survivors)
  return (
    <>
      {survivors.map(survivor => (
        <SurvivorFigure
          key={survivor.id}
          pos={survivor.pos}
          status={survivor.status}
          confidence={survivor.confidence || 1.0}
          alive={survivor.body_temp > 35}
        />
      ))}
    </>
  )
}

// ═══════════════════════════════════
// MAIN SCENE
// ═══════════════════════════════════
export default function Scene3D() {
  const controlsRef = useRef()
  
  const seedSurvivor = useSimStore(s => s.seedSurvivor)
  const scenario = useSimStore(s => s.scenario)
  const theme = useSimStore(s => s.theme)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const setRightPanelExpanded = useSimStore(s => s.setRightPanelExpanded)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const povMode = useSimStore(s => s.povMode)
  const setPovMode = useSimStore(s => s.setPovMode)
  const edgeCaseStep = useSimStore(s => s.edgeCaseStep)

  const params = new URLSearchParams(window.location.search)
  const scriptId = params.get('script')

  // Drone Failure edge case strictly uses 2 drones
  const scenarioDrones = scriptId === 'drone_failure' ? displayDrones.slice(2, 4) : displayDrones

  const missionPhase = useSimStore(s => s.missionPhase)
  const searchRegion = useSimStore(s => s.searchRegion)
  const setSearchRegion = useSimStore(s => s.setSearchRegion)
  const setMissionPhase = useSimStore(s => s.setMissionPhase)
  const addNotification = useSimStore(s => s.addNotification)
  const proximityEncounter = useSimStore(s => s.proximityEncounter)

  const isSelectingOrSeeding = missionPhase === 'SELECT_REGION' || missionPhase === 'SEED_SURVIVORS'

  const handleRegionSelected = (region) => {
    setSearchRegion(region)
    setMissionPhase('SEED_SURVIVORS')
    addNotification(
      `Search region defined: ${Math.abs(region.x2 - region.x1).toFixed(0)}m × ${Math.abs(region.z2 - region.z1).toFixed(0)}m. Click within the region to place survivors.`,
      'success'
    )
  }

  const handleSeed = (x, z) => {
    seedSurvivor(x, z)
  }

  const handleRecenter = () => {
    if (controlsRef.current) controlsRef.current.reset()
    setPovMode(false)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
<<<<<<< HEAD
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <PerspectiveCamera makeDefault position={[-80, 100, -80]} fov={50} near={0.5} far={2000} />
        {!povMode && (
          <OrbitControls
            ref={controlsRef}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={10}
            maxDistance={400}
            makeDefault
            enableRotate={!isSelectingOrSeeding}
            enablePan={!isSelectingOrSeeding}
=======
      <WebGLErrorBoundary>
        <Canvas shadows gl={{ antialias: true, logarithmicDepthBuffer: true }}>
          <PerspectiveCamera makeDefault position={[-80, 100, -80]} fov={50} />
          {!povMode && (
            <OrbitControls
              ref={controlsRef}
              maxPolarAngle={Math.PI / 2.1}
              minDistance={10}
              maxDistance={400}
              makeDefault
              enableRotate={!isSelectingOrSeeding}
              enablePan={!isSelectingOrSeeding}
            />
          )}
          <CameraController />

          {/* Atmosphere */}
          <SceneFog scenario={scenario} />

          {/* Enhanced Sky */}
          <Sky
            sunPosition={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).sunPosition}
            turbidity={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).turbidity}
            rayleigh={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).rayleigh}
>>>>>>> c45a5caa079c143bcbfdda32868c3541beeddfd3
          />
          <Stars radius={200} depth={80} count={8000} factor={4} saturation={0} fade speed={0.5} />

        {/* Atmosphere */}
        <SceneFog scenario={scenario} />

        {/* Enhanced Sky */}
        <Sky
          sunPosition={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).sunPosition}
          turbidity={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).turbidity}
          rayleigh={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).rayleigh}
        />
        <Stars radius={200} depth={80} count={2500} factor={4} saturation={0} fade speed={0.35} />

        {/* Natural lighting */}
        <hemisphereLight
          args={[
            scenario === 'tsunami' ? '#87CEEB' : scenario === 'flood' ? '#8B7355' : '#C4A882',
            '#362a1a',
            theme === 'dark' ? 0.35 : 0.6
          ]}
        />
        <ambientLight intensity={theme === 'dark' ? 0.15 : 0.5} />
        <directionalLight
          position={[50, 80, 30]}
          intensity={theme === 'dark' ? 0.8 : 1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-250}
          shadow-camera-right={250}
          shadow-camera-top={250}
          shadow-camera-bottom={-250}
          shadow-camera-near={0.5}
          shadow-camera-far={500}
        />

        {/* Terrain */}
        <Terrain scenario={scenario} />

        {/* Drone Base Platform */}
        <DroneBasePlatform />

        {/* Drones */}
        <DronesLayer />

        {/* Takeover paths & failure markers */}
        <TakeoverPathsLayer />

        {/* Survivors */}
        <SurvivorsLayer />

        {/* Region selection mode */}
        {missionPhase === 'SELECT_REGION' && (
          <RegionSelectMode onRegionSelected={handleRegionSelected} />
        )}

        {/* Show selected region */}
        {searchRegion && missionPhase !== 'SELECT_REGION' && (
          <RegionRect
            x1={searchRegion.x1}
            z1={searchRegion.z1}
            x2={searchRegion.x2}
            z2={searchRegion.z2}

          />

        {/* Seed mode */}
        {missionPhase === \'SEED_SURVIVORS\' && (
          <SeedMode onSeed={handleSeed} searchRegion={searchRegion} />
        )}

        {/* Evasion Lines (visible if behind overlay) */}
        <ProximityEvasionLines encounter={proximityEncounter} />
      </Canvas>
      </WebGLErrorBoundary>

      {/* Floating UI */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        display: 'flex',
        gap: '12px',
        zIndex: 10,
      }}>
        {selectedDroneId && (
          <>
            <button
              onClick={() => setPovMode(!povMode)}
              style={{
                ...floatingBtnStyle,
                background: povMode ? 'var(--cyan)' : 'rgba(0,0,0,0.6)',
                color: povMode ? '#000' : 'var(--cyan)',
                border: `1px solid ${povMode ? 'var(--cyan)' : 'var(--border-color)'}`,
                boxShadow: povMode ? 'var(--cyan-glow)' : 'none',
              }}
              title={povMode ? "Exit POV Mode" : "Enter POV Mode"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.5 12 5.5-3v6l-5.5-3Z"/><rect width="13" height="14" x="2" y="5" rx="2"/></svg>
            </button>
            <button
              onClick={() => setRightPanelExpanded(!rightPanelExpanded)}
              style={floatingBtnStyle}
              title={rightPanelExpanded ? "Hide Sidebar" : "Show Sidebar"}
            >
              {rightPanelExpanded ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
            </button>
          </>
        )}
        <button onClick={handleRecenter} style={floatingBtnStyle} title="Recenter Camera / Global View">
          <Target size={20} />
        </button>
      </div>

      {/* Phase instruction overlay */}
      {missionPhase === 'SELECT_REGION' && (
        <div style={overlayBannerStyle('#00e5ff', '0 0 20px rgba(0,229,255,0.4)')}>
          CLICK TWO POINTS ON THE TERRAIN TO DEFINE SEARCH REGION
        </div>
      )}
      {missionPhase === 'SEED_SURVIVORS' && (
        <div style={overlayBannerStyle('#ffb300', '0 0 20px rgba(255,179,0,0.4)')}>
          CLICK WITHIN THE HIGHLIGHTED REGION TO PLACE SURVIVORS
        </div>
      )}
    </div>
  )
}

const floatingBtnStyle = {
  background: 'rgba(0,0,0,0.6)',
  border: '1px solid var(--border-color)',
  color: '#00e5ff',
  width: '48px',
  height: '48px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backdropFilter: 'blur(8px)',
  transition: '0.3s',
}

function overlayBannerStyle(color, shadow) {
  return {
    position: 'absolute',
    top: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: `${color}20`,
    border: `1px solid ${color}60`,
    padding: '10px 24px',
    borderRadius: '40px',
    fontFamily: 'JetBrains Mono',
    fontSize: '12px',
    color: color,
    letterSpacing: '2px',
    boxShadow: shadow,
    pointerEvents: 'none',
    zIndex: 20,
  }
}
