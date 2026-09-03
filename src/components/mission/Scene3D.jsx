import React, { useRef, useState, useMemo, useEffect, memo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Sky, PerspectiveCamera, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import Terrain from './Terrain'
import { getForestHeight, getForestDensity, distToStream } from './DenseForestTerrain'
import DroneModel from './DroneModel'
import DroneLabel from '../DroneLabel'
import { PanelRightClose, PanelRightOpen, Target } from 'lucide-react'
import { useEdgeCaseScript } from '../../hooks/useEdgeCaseScript'
import { DRONE_BASE, getDronePosition } from '../../hooks/useDroneMovement'

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
  }
}

// DroneLabel is now in src/components/DroneLabel.jsx — imported above

function DroneLabelFollower({ simDrone, aiDrone }) {
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    const pos = getDronePosition(simDrone)
    if (Number.isNaN(pos.x) || Number.isNaN(pos.y) || Number.isNaN(pos.z)) return
    groupRef.current.position.set(pos.x, pos.y, pos.z)
  })

  const activeDrone = useMemo(() => {
    if (aiDrone) return aiDrone
    // Fallback: use sim drone data (backend offline / mission not started)
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
  // Dense forest daytime: clearer, bluer sky
  dense_forest: { sunPosition: [60, 45, 20], turbidity: 4, rayleigh: 2.2 },
}

const FOG_CONFIG = {
  earthquake: { color: '#1a1814', density: 0.0022 },
  tsunami: { color: '#0c1a2e', density: 0.0018 },
  flood: { color: '#1a1410', density: 0.0028 },
  // Dense forest fog tuned to a subtle sky-blue (not white) for daytime atmospheric horizon
  dense_forest: { color: '#cde9fb', density: 0.0010 },
}

// Procedural Day Sky mesh used only for Dense Forest daytime to guarantee a blue gradient
function DaySky({ sunPosition = [60, 45, 20] }) {
  const sunDir = useMemo(() => {
    const v = new THREE.Vector3(...sunPosition).normalize()
    return v
  }, [sunPosition])

  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color('#70b7ff') },
      bottomColor: { value: new THREE.Color('#dfefff') },
      sunDirection: { value: sunDir },
      sunColor: { value: new THREE.Color('#fff6e0') },
      sunIntensity: { value: 1.2 },
    },
    vertexShader: `varying vec3 vWorldPosition; varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform vec3 sunDirection; uniform vec3 sunColor; uniform float sunIntensity; varying vec3 vWorldPosition; varying vec3 vNormal;
      void main() {
        // blend based on world up (y) component
        float t = smoothstep(-0.2, 0.9, normalize(vNormal).y);
        vec3 sky = mix(bottomColor, topColor, t);
        // sun disc
        float sunFactor = max(dot(normalize(vNormal), normalize(sunDirection)), 0.0);
        float disc = pow(sunFactor, 200.0) * sunIntensity;
        vec3 color = sky + sunColor * disc;
        gl_FragColor = vec4(color, 1.0);
      }`
  }), [])

  return (
    <mesh geometry={new THREE.SphereGeometry(900, 32, 15)} material={mat} />
  )
}

function SceneFog({ scenario }) {
  const { scene } = useThree()
  const theme = useSimStore(s => s.theme)
  const denseFogEnabled = useSimStore(s => s.denseForestFogEnabled)
  useEffect(() => {
    const config = FOG_CONFIG[scenario] || FOG_CONFIG.earthquake
    // If Dense Forest + dark theme, force black background and fog to avoid bright horizon
    if (scenario === 'dense_forest' && theme === 'dark') {
      scene.background = new THREE.Color('#000000')
      scene.fog = new THREE.FogExp2('#000000', config.density)
    } else {
      // Default behavior for other scenarios, but if dense forest fog toggle is enabled,
      // strengthen the fog density so mist is visibly noticeable in the forest.
      scene.background = null
      if (scenario === 'dense_forest' && denseFogEnabled) {
        // Use a modest denser fog for subtle horizon haze; avoid high values that wash out scene
        const denseDensity = Math.max(config.density, 0.008)
        scene.fog = new THREE.FogExp2(config.color, denseDensity)
      } else {
        scene.fog = new THREE.FogExp2(config.color, config.density)
      }
    }
    return () => { scene.fog = null; scene.background = null }
  }, [scene, scenario, theme, denseFogEnabled])
  return null
}

// Dense Forest localized mist component
function DenseForestMist({ scenario }) {
  const denseFogEnabled = useSimStore(s => s.denseForestFogEnabled)
  const { scene, camera } = useThree()
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const COUNT = 16 // conservative: fewer mist regions to avoid overdraw
  // Precompute mist pockets based on terrain low areas
  const pockets = useMemo(() => {
    const out = []
    const WORLD_HALF = 220
    const rng = () => Math.random()
    for (let i = 0; i < COUNT; i++) {
      const x = -WORLD_HALF + rng() * (WORLD_HALF * 2)
      const z = -WORLD_HALF + rng() * (WORLD_HALF * 2)
      const y = getForestHeight(x, z)
      // lower elevation -> stronger base
      const elevFactor = Math.max(0, Math.min(1, (6 - (y + 6)) / 12))
      const stream = distToStream(x, z)
      const streamBoost = Math.max(0, (12 - stream) / 12)
      const density = Math.max(0, Math.min(1, elevFactor * 0.7 + streamBoost * 0.5 + (1 - getForestDensity(x, z)) * 0.15))
      // place mist slightly above ground
      const baseHeight = y + 0.5 + Math.random() * 1.8
      out.push({ x, z, y: baseHeight, density, phase: Math.random() * Math.PI * 2, speed: 0.02 + Math.random() * 0.04, scale: 12 + Math.random() * 36 })
    }
    return out
  }, [])

  // create a soft mist texture
  const mistTex = useMemo(() => {
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    const cx = size/2, cy = size/2, r = size/2
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    // Use a subtle neutral-cool gradient with lower center alpha to avoid bright white cores
    grad.addColorStop(0, 'rgba(200,220,230,0.65)')
    grad.addColorStop(0.55, 'rgba(190,210,220,0.28)')
    grad.addColorStop(1, 'rgba(180,200,210,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0,0,size,size)
    const tex = new THREE.CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.needsUpdate = true
    return tex
  }, [])

  // material shared across instances
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, depthWrite: false, depthTest: true, opacity: 0.0, toneMapped: false, color: new THREE.Color(0xcde9fb) }), [mistTex])

  // progress 0..1 for formation/dissipation
  const progressRef = useRef(0)
  const targetRef = useRef(0)

  useEffect(() => {
    targetRef.current = denseFogEnabled ? 1 : 0
  }, [denseFogEnabled])

  useFrame((state, delta) => {
    // lerp progress towards target (smooth build/dissipate)
    const p = progressRef.current
    const t = targetRef.current
    const speed = 0.5 // controls how many seconds to reach ~1 (1/s)
    progressRef.current = THREE.MathUtils.lerp(p, t, Math.min(1, delta * speed))

    const camY = camera.position.y
    // camera factor: lower camera -> more mist influence
    const camFactor = 1 - Math.min(1, Math.max(0, (camY - 2) / 30))

    const elapsed = state.clock.elapsedTime
    if (!meshRef.current) return
    pockets.forEach((pk, i) => {
      // drifting offsets
      const dx = Math.sin(elapsed * pk.speed + pk.phase) * 0.6
      const dz = Math.cos(elapsed * (pk.speed * 0.8) + pk.phase * 0.7) * 0.4
      const x = pk.x + dx
      const z = pk.z + dz
      const y = pk.y
      // instance scale depends on pocket scale
      // scale conservatively to avoid giant planes; keep low height (flat bank)
      const scale = pk.scale * (0.45 + 0.55 * pk.density) * (0.35 + 0.65 * progressRef.current)
      dummy.position.set(x, y, z)
      // horizontal plane (flat mist bank)
      dummy.rotation.set(-Math.PI/2, 0, 0)
      dummy.scale.set(scale, scale * 0.22, 1)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
      // set per-instance opacity via color alpha (vertexColors unsupported here), instead adjust material.opacity using combined factor averaged
    })
    meshRef.current.instanceMatrix.needsUpdate = true

    // adjust overall opacity by pocket-weighted average * progress * camera factor
    let avgDensity = 0
    for (const pk of pockets) avgDensity += pk.density
    avgDensity = pockets.length ? avgDensity / pockets.length : 0.5
    // cap final opacity to avoid white wash
    const base = THREE.MathUtils.clamp(0.08 + avgDensity * 0.45, 0.02, 0.48)
    mat.opacity = base * progressRef.current * (0.6 + 0.6 * camFactor)
    // subtle color shift with time for natural blending
    const hueShift = Math.sin(elapsed * 0.05) * 0.01
    // keep color near a soft blue-gray, avoid pushing channels >1
    mat.color.setRGB(0.76 + hueShift * 0.2, 0.84 + hueShift * 0.12, 0.9)

    // hide mesh when fully off to avoid any accidental overdraw
    if (meshRef.current) meshRef.current.visible = progressRef.current > 0.005
  })

  // Only render in dense forest scenario (but keep component mounted for smooth dissipation)
  return (
    <group visible={scenario === 'dense_forest'}>
      <instancedMesh ref={meshRef} args={[null, null, COUNT]}>
        {/* horizontal plane used as soft mist billboard; instances are scaled and positioned above */}
        <planeGeometry args={[1, 1]} />
        <primitive object={mat} attach="material" />
      </instancedMesh>
    </group>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DRONE BASE PLATFORM (helipad)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.6} />
          </mesh>
          {/* Inner circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[1.5, 1.8, 32]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.4} />
          </mesh>
          {/* H mark horizontal */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <planeGeometry args={[2, 0.4]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.7} />
          </mesh>
          {/* H mark vertical left */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.7, 0.02, 0]}>
            <planeGeometry args={[0.4, 3]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.7} />
          </mesh>
          {/* H mark vertical right */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.7, 0.02, 0]}>
            <planeGeometry args={[0.4, 3]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {/* Unified Platform Illumination Light */}
      <pointLight color="#00e5ff" intensity={4} distance={35} position={[0, 8, 0]} />

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
      <pointLight position={[0, 13.5, -18]} color="#ff0000" intensity={3} distance={25} />
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
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REGION SELECTION MODE (two clicks)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function RegionSelectMode({ onRegionSelected }) {
  const [firstCorner, setFirstCorner] = useState(null)
  const [hover, setHover] = useState(null)
  const lastUpdate = useRef(0)

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
            // Minimum 30m region
            if (x2 - x1 > 30 && z2 - z1 > 30) {
              onRegionSelected({ x1, z1, x2, z2 })
            }
            setFirstCorner(null)
            setHover(null)
          }
        }}
        onPointerMove={(e) => {
          if (firstCorner) {
            const now = Date.now()
            if (now - lastUpdate.current > 50) {
              setHover({ x: e.point.x, z: e.point.z })
              lastUpdate.current = now
            }
          }
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REGION VISUALIZATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SEED MODE (constrained to region)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SeedMode({ onSeed, searchRegion, scenario }) {
  const ptrDownRef = useRef(null)
  const movedRef = useRef(false)
  const lastWheelRef = useRef(0)

  const onPointerDown = (e) => {
    e.stopPropagation()
    if (e.button !== 0) return
    ptrDownRef.current = { clientX: e.clientX, clientY: e.clientY, point: { x: e.point.x, z: e.point.z } }
    movedRef.current = false
  }

  const onPointerMove = (e) => {
    if (!ptrDownRef.current) return
    const dx = e.clientX - ptrDownRef.current.clientX
    const dy = e.clientY - ptrDownRef.current.clientY
    if (Math.sqrt(dx * dx + dy * dy) > 6) movedRef.current = true
  }

  const onPointerUp = (e) => {
    e.stopPropagation()
    if (e.button !== 0) return
    // Do not place if pointer moved significantly (drag)
    if (movedRef.current) { ptrDownRef.current = null; return }
    // Do not place if recent wheel event (user zoomed)
    if (performance.now() - lastWheelRef.current < 200) { ptrDownRef.current = null; return }

    const { x, z } = e.point
    // Dense forest allows seeding anywhere (no region required)
    if (scenario === 'dense_forest') {
      onSeed(x, z)
      ptrDownRef.current = null
      return
    }
    // For other scenarios, only allow seeding within the search region
    if (searchRegion &&
      x >= searchRegion.x1 && x <= searchRegion.x2 &&
      z >= searchRegion.z1 && z <= searchRegion.z2) {
      onSeed(x, z)
    }
    ptrDownRef.current = null
  }

  const onWheel = (e) => {
    lastWheelRef.current = performance.now()
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.1, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SURVIVOR FIGURE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SurvivorFigure({ pos, status, confidence, alive }) {
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
        <pointLight color="#ff6b2b" intensity={3} distance={8} position={[0, 2.5, 0]} />
      )}
    </group>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CAMERA CONTROLLER (POV Mode)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN SCENE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function Scene3D({ drones = [] }) {
  const scenario = useSimStore(s => s.scenario)
  const missionPhase = useSimStore(s => s.missionPhase)
  const setMissionPhase = useSimStore(s => s.setMissionPhase)
  const denseForestBoundary = useSimStore(s => s.denseForestBoundary)
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
  const seedSurvivor = useSimStore(s => s.seedSurvivor)
  const theme = useSimStore(s => s.theme)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const setRightPanelExpanded = useSimStore(s => s.setRightPanelExpanded)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const povMode = useSimStore(s => s.povMode)
  const setPovMode = useSimStore(s => s.setPovMode)

  const searchRegion = useSimStore(s => s.searchRegion)
  const setSearchRegion = useSimStore(s => s.setSearchRegion)
  const addNotification = useSimStore(s => s.addNotification)

  const isSelectingOrSeeding = ['SELECT_REGION', 'SEED_SURVIVORS'].includes(missionPhase)

  // For dense_forest scenario, start in seed-first flow
  useEffect(() => {
    if (scenario === 'dense_forest' && missionPhase === 'IDLE') {
      setMissionPhase('SEED_SURVIVORS')
    }
  }, [scenario, missionPhase, setMissionPhase])

  const handleRegionSelected = (region) => {
    setSearchRegion(region)
    setMissionPhase('SEED_SURVIVORS')
    addNotification(
      `Search region defined: ${Math.abs(region.x2 - region.x1).toFixed(0)}m Ã— ${Math.abs(region.z2 - region.z1).toFixed(0)}m. Click within the region to place survivors.`,
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
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <PerspectiveCamera makeDefault position={[-80, 100, -80]} fov={50} />
        {!povMode && (
          <OrbitControls
            ref={controlsRef}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={10}
            maxDistance={400}
            makeDefault
            // Allow orbit/pan/zoom during Dense Forest seeding
            enableRotate={!(isSelectingOrSeeding) || (scenario === 'dense_forest' && missionPhase === 'SEED_SURVIVORS')}
            enablePan={!(isSelectingOrSeeding) || (scenario === 'dense_forest' && missionPhase === 'SEED_SURVIVORS')}
            enableZoom={true}
          />
        )}
        <CameraController />

        {/* Atmosphere */}
        <SceneFog scenario={scenario} />

        {/* Enhanced Sky: use custom DaySky for Dense Forest daytime to guarantee blue gradient; keep Sky for other scenarios */}
        {scenario === 'dense_forest' && theme !== 'dark' ? (
          <DaySky sunPosition={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).sunPosition} />
        ) : (
          !(scenario === 'dense_forest' && theme === 'dark') && (
            <Sky
              sunPosition={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).sunPosition}
              turbidity={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).turbidity}
              rayleigh={(SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).rayleigh}
            />
          )
        )}
        <Stars radius={200} depth={80} count={4000} factor={4} saturation={0} fade speed={0.5} />

        {/* Natural lighting */}
        <hemisphereLight
          args={[
            scenario === 'tsunami' ? '#87CEEB' : scenario === 'flood' ? '#8B7355' : scenario === 'dense_forest' ? '#A8C9A0' : '#C4A882',
            '#362a1a',
            theme === 'dark' ? 0.35 : 0.6
          ]}
        />
        <ambientLight intensity={theme === 'dark' ? 0.15 : 0.5} />
        {/* Base directional light used as general fill; for Dense Forest daytime we add a dedicated sun light below */}
        <directionalLight
          position={[50, 80, 30]}
          intensity={theme === 'dark' ? 0.8 : (scenario === 'dense_forest' && theme !== 'dark' ? 0.35 : 1.8)}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
          shadow-camera-left={-250}
          shadow-camera-right={250}
          shadow-camera-top={250}
          shadow-camera-bottom={-250}
          shadow-camera-near={0.5}
          shadow-camera-far={500}
        />

        {/* Moon + moonlight for Dense Forest night mode only */}
        {scenario === 'dense_forest' && theme === 'dark' && (
          <group>
            {/* Visible moon sphere */}
            <mesh position={[60, 110, 20]} renderOrder={1000}>
              <sphereGeometry args={[6, 32, 32]} />
              <meshBasicMaterial color={'#fbf7e6'} toneMapped={false} />
            </mesh>

            {/* Soft moonlight: cool, subtle directional light (no extra expensive shadows) */}
            <directionalLight
              color={'#cfeeff'}
              intensity={0.6}
              position={[60, 110, 20]}
              castShadow={false}
            />

            {/* Very soft fill to keep deep shadows readable, low intensity */}
            <ambientLight intensity={0.08} />
          </group>
        )}

        {/* Sun + sunlight for Dense Forest daytime only */}
        {scenario === 'dense_forest' && theme !== 'dark' && (() => {
          const sunPos = (SKY_CONFIG[scenario] || SKY_CONFIG.earthquake).sunPosition || [60, 45, 20]
          // place sun far away so it appears distant
          const sunVec = new THREE.Vector3(...sunPos).normalize().multiplyScalar(300)
          const sunArr = [sunVec.x, sunVec.y, sunVec.z]
          return (
            <group>
              {/* visible sun */}
              <mesh position={sunArr} renderOrder={1000}>
                <sphereGeometry args={[8, 16, 16]} />
                <meshBasicMaterial color={'#fff7e0'} toneMapped={false} />
              </mesh>

              {/* directional sunlight matching sun position */}
              <directionalLight
                position={sunArr}
                color={'#fff6d9'}
                intensity={1.05}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-bias={-0.0005}
                shadow-camera-left={-180}
                shadow-camera-right={180}
                shadow-camera-top={180}
                shadow-camera-bottom={-180}
                shadow-camera-near={0.5}
                shadow-camera-far={800}
              />
            </group>
          )
        })()}

        {/* Terrain */}
        <Terrain scenario={scenario} />

        {/* Dense Forest localized mist (visual only) */}
        <DenseForestMist scenario={scenario} />

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
          <SeedMode onSeed={handleSeed} searchRegion={scenario === 'dense_forest' ? null : searchRegion} scenario={scenario} />
        )}

        {/* Dense forest boundary visualization */}
        {denseForestBoundary && denseForestBoundary.buffered && (
          <BoundaryPolygon polygon={denseForestBoundary.buffered} />
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

// Render the buffered polygon boundary as a line loop and faint fill
function BoundaryPolygon({ polygon }) {
  const points = useMemo(() => polygon.map(p => new THREE.Vector3(p.x, 0.5, p.z)), [polygon])
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points.concat(points[0])), [points])

  const shape = useMemo(() => {
    const s = new THREE.Shape()
    if (!polygon || polygon.length === 0) return s
    s.moveTo(polygon[0].x, polygon[0].z)
    for (let i = 1; i < polygon.length; i++) s.lineTo(polygon[i].x, polygon[i].z)
    s.closePath()
    return s
  }, [polygon])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#70b7ff" transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>
      <lineLoop geometry={geom} position={[0, 0.5, 0]}>
        <lineBasicMaterial color="#00e5ff" linewidth={2} />
      </lineLoop>
    </group>
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
