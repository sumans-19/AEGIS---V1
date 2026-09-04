import React, { useRef, useState, useMemo, useEffect, memo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Sky, PerspectiveCamera, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import Terrain from './Terrain'
import DroneModel from './DroneModel'
import DroneLabel from '../DroneLabel'
import { PanelRightClose, PanelRightOpen, Target } from 'lucide-react'
import { useEdgeCaseScript } from '../../hooks/useEdgeCaseScript'
import { DRONE_BASE, getDronePosition } from '../../hooks/useDroneMovement'
import { dronePositionRegistry } from '../../hooks/dronePositionRegistry'

function normalizeBackendDrone(d) {
  if (!d) return null
  // Normalize action: always a plain string; reason is a separate field
  const action =
    typeof d.action === 'string'
      ? d.action
      : d.action?.action || 'CONTINUE_MISSION'
  const reason =
    typeof d.action === 'object' && d.action !== null
      ? (d.action.reason || '')
      : (d.reason || '')
  return {
    id: d.id,
    callsign: d.callsign || `DRONE-${d.id}`,
    battery: d.battery ?? 100,
    signal: d.signal ?? d.signal_strength ?? 100,
    cpu: d.cpu ?? d.cpu_temp ?? d.cpu_temperature ?? 40,
    cpu_temp: d.cpu ?? d.cpu_temp ?? d.cpu_temperature ?? 40,
    thermal_status: d.thermal_status ?? true,
    obstacle_distance: d.obstacle_distance ?? 10,
    action,
    reason,
    nearby: d.nearby ?? d.nearby_drone_id ?? null,
    mesh_connected: d.mesh_connected ?? true,
    relay_chain: d.relay_chain ?? [],
  }
}

// DroneLabel is now in src/components/DroneLabel.jsx — imported above

function DroneLabelFollower({ simDrone, aiDrone }) {
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    // Read from the position registry — this is the ACTUAL lerped 3D position
    // that DroneModel writes every frame after smoothing.
    // Using getDronePosition() here would compute the RAW target (no lerp),
    // causing the label to jump ahead of the drone body.
    const registryPos = dronePositionRegistry.get(simDrone.id)
    if (registryPos) {
      groupRef.current.position.copy(registryPos)
    } else {
      // Fallback before first frame is rendered
      const pos = getDronePosition(simDrone)
      if (!Number.isNaN(pos.x) && !Number.isNaN(pos.y) && !Number.isNaN(pos.z)) {
        groupRef.current.position.set(pos.x, pos.y, pos.z)
      }
    }
  })

  const activeDrone = useMemo(() => {
    if (aiDrone) return aiDrone
    return {
      id: simDrone.id,
      callsign: simDrone.callsign || `DRONE-${simDrone.id}`,
      battery: simDrone.battery ?? 100,
      signal: simDrone.signal ?? simDrone.signal_strength ?? 100,
      cpu: 40,
      thermal_status: simDrone.thermal_status ?? true,
      obstacle_distance: simDrone.obstacle_distance ?? 10,
      action: 'CONTINUE_MISSION',
      reason: '',
      nearby: null,
    }
  }, [aiDrone, simDrone])

  return (
    <group ref={groupRef}>
      <DroneLabel drone={activeDrone} />
    </group>
  )
}

// ═══════════════════════════════════
// ATMOSPHERE CONFIG
// ═══════════════════════════════════
const SKY_CONFIG = {
  earthquake: { sunPosition: [30, 8, -50], turbidity: 20, rayleigh: 0.5 },
  tsunami: { sunPosition: [100, 40, 50], turbidity: 8, rayleigh: 2 },
  flood: { sunPosition: [50, 5, 30], turbidity: 18, rayleigh: 0.3 },
  war_zone: { sunPosition: [0, 20, -100], turbidity: 50, rayleigh: 3.0 },
}

const FOG_CONFIG = {
  earthquake: { color: '#1a1814', density: 0.0022 },
  tsunami: { color: '#0c1a2e', density: 0.0018 },
  flood: { color: '#1a1410', density: 0.0028 },
  war_zone: { color: '#222325', density: 0.003 },
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
      {/* Invisible click plane */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.1, 0]}
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
            // Minimum 20m region (was 30m — too strict for small test areas)
            if (x2 - x1 > 20 && z2 - z1 > 20) {
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
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
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
// SEED MODE (constrained to region)
// ═══════════════════════════════════
function SeedMode({ onSeed, searchRegion }) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.1, 0]}
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
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// ═══════════════════════════════════
// SURVIVOR FIGURE (memoized, no pointLight)
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
        <meshStandardMaterial color={color} emissive={!isDead && !isDetected ? '#ff6b2b' : '#000000'} emissiveIntensity={!isDead && !isDetected ? 0.6 : 0} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshStandardMaterial color={color} emissive={!isDead && !isDetected ? '#ff6b2b' : '#000000'} emissiveIntensity={!isDead && !isDetected ? 0.6 : 0} />
      </mesh>
      {/* Detection ring */}
      {isDetected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
          <ringGeometry args={[1.5, 2, 16]} />
          <meshBasicMaterial color="#00e5ff" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
})

// ═══════════════════════════════════
// THREAT FIGURE (memoized, no pointLight, no Html)
// ═══════════════════════════════════
const ThreatFigure = memo(function ThreatFigure({ pos, type, severity, confidence }) {
  const isCritical = severity === 'critical'
  const color = isCritical ? '#dc3545' : '#ffc107'

  return (
    <group position={pos}>
      {/* Warning Box */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      
      {/* Alert Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.5, 2, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
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
// MESH NETWORK RELAY LINES
// ═══════════════════════════════════
function MeshNetworkLines({ drones, aiById }) {
  const lineData = useMemo(() => {
    const lines = []
    drones.forEach(d => {
      const ai = aiById.get(d.id)
      if (!ai || !ai.mesh_connected) return
      
      const chain = ai.relay_chain || []
      let startPos = d.pos
      
      if (chain.length > 0) {
        // Line from this drone to its parent
        const parentId = chain[chain.length - 1]
        const parent = drones.find(p => p.id === parentId)
        if (parent && startPos && parent.pos) {
          lines.push([new THREE.Vector3(...startPos), new THREE.Vector3(...parent.pos)])
        }
      } else {
        // Line from this drone to base station
        if (startPos) {
          lines.push([new THREE.Vector3(...startPos), new THREE.Vector3(DRONE_BASE.x, DRONE_BASE.y, DRONE_BASE.z)])
        }
      }
    })
    return lines
  }, [drones, aiById])

  return (
    <group>
      {lineData.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([pts[0].x, pts[0].y, pts[0].z, pts[1].x, pts[1].y, pts[1].z])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#6d28d9" transparent opacity={0.4} linewidth={2} />
        </line>
      ))}
    </group>
  )
}

// ═══════════════════════════════════
// MAIN SCENE
// ═══════════════════════════════════
export default function Scene3D({ drones = [] }) {
  const controlsRef = useRef()
  const rawDrones = useSimStore(s => s.drones)
  const displayDrones = useEdgeCaseScript(rawDrones)
  const stableDrones = useMemo(() => drones, [drones]);

  const aiById = useMemo(() => {
    const map = new Map()
    stableDrones.forEach((d) => {
      const normalized = normalizeBackendDrone(d)
      if (normalized) map.set(d.id, normalized)
    })
    return map
  }, [stableDrones])

  const survivors = useSimStore(s => s.survivors)
  const threats = useSimStore(s => s.threats) // Added threats hook
  const seedSurvivor = useSimStore(s => s.seedSurvivor)
  const scenario = useSimStore(s => s.scenario)
  const theme = useSimStore(s => s.theme)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const setRightPanelExpanded = useSimStore(s => s.setRightPanelExpanded)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const povMode = useSimStore(s => s.povMode)
  const setPovMode = useSimStore(s => s.setPovMode)

  const missionPhase = useSimStore(s => s.missionPhase)
  const searchRegion = useSimStore(s => s.searchRegion)
  const setSearchRegion = useSimStore(s => s.setSearchRegion)
  const setMissionPhase = useSimStore(s => s.setMissionPhase)
  const addNotification = useSimStore(s => s.addNotification)

  const isSelectingOrSeeding = ['SELECT_REGION', 'SEED_SURVIVORS'].includes(missionPhase)

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
    addNotification(`Survivor placed at [${x.toFixed(0)}, ${z.toFixed(0)}].`, 'info')
  }

  const handleRecenter = () => {
    if (controlsRef.current) controlsRef.current.reset()
    setPovMode(false)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
        />
        <Stars radius={200} depth={80} count={2000} factor={4} saturation={0} fade speed={0.5} />

        {/* Natural lighting */}
        <hemisphereLight
          args={[
            scenario === 'tsunami' ? '#87CEEB' : scenario === 'flood' ? '#8B7355' : scenario === 'war_zone' ? '#69747a' : '#C4A882',
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
          shadow-camera-left={-150}
          shadow-camera-right={150}
          shadow-camera-top={150}
          shadow-camera-bottom={-150}
          shadow-camera-near={0.5}
          shadow-camera-far={350}
        />

        {/* Terrain */}
        <Terrain scenario={scenario} />

        {/* Drone Base Platform */}
        <DroneBasePlatform />

        {/* Drones */}
        {useMemo(() => displayDrones.map((drone, index) => (
          <group key={drone.id}>
            <DroneModel drone={drone} index={index} />
            <DroneLabelFollower
              simDrone={drone}
              aiDrone={aiById.get(drone.id)}
            />
          </group>
        )), [displayDrones, aiById])}

        {/* Mesh Network Links */}
        <MeshNetworkLines drones={displayDrones} aiById={aiById} />

        {/* Survivors */}
        {survivors.map(survivor => (
          <SurvivorFigure
            key={survivor.id}
            pos={survivor.pos}
            status={survivor.status}
            confidence={survivor.confidence || 1.0}
            alive={survivor.body_temp > 35}
          />
        ))}

        {/* Threats */}
        {threats.map(threat => (
          <ThreatFigure
            key={`threat-${threat.id}`}
            pos={threat.pos}
            type={threat.type}
            severity={threat.severity}
            confidence={threat.confidence}
          />
        ))}

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
        )}

        {/* Seed mode */}
        {missionPhase === 'SEED_SURVIVORS' && (
          <SeedMode onSeed={handleSeed} searchRegion={searchRegion} />
        )}
      </Canvas>

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
