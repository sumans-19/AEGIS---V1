import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// ── Realistic dead/damaged tree ──
function DeadTree({ position, seed = 0 }) {
  const lean = (seededRandom(seed + 50) - 0.5) * 0.6
  const sc = 0.6 + seededRandom(seed + 51) * 0.5
  return (
    <group position={position} rotation={[lean * 0.3, 0, lean]} scale={[sc, sc, sc]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.08, 0.2, 3, 6]} />
        <meshStandardMaterial color="#3B2F20" roughness={1} />
      </mesh>
      {/* Sparse broken branches */}
      <mesh position={[0.3, 2.5, 0.1]} rotation={[0.3, 0, 0.8]}>
        <cylinderGeometry args={[0.03, 0.06, 1.2, 4]} />
        <meshStandardMaterial color="#3B2F20" roughness={1} />
      </mesh>
      <mesh position={[-0.2, 2.2, -0.1]} rotation={[-0.4, 0, -0.6]}>
        <cylinderGeometry args={[0.03, 0.05, 0.9, 4]} />
        <meshStandardMaterial color="#3B2F20" roughness={1} />
      </mesh>
    </group>
  )
}

// ── Fire effect (glowing emissive pillars + point light) ──
function Fire({ position, intensity = 1, spread = null }) {
  const fireRef = useRef()
  const flickerRef = useRef()

  const subFlames = useMemo(() => {
    if (!spread) return [{ ox: 0, oz: 0, s: 1 }]
    const flames = []
    const [w, d] = spread
    const numFlames = 15 + Math.floor(Math.random() * 8)
    // create a primary cluster
    for (let i = 0; i < numFlames; i++) {
       flames.push({
         ox: (Math.random() - 0.5) * w * 0.7,
         oz: (Math.random() - 0.5) * d * 0.7,
         s: 0.45 + Math.random() * 0.75  // Increased scale
       })
    }
    return flames
  }, [spread])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (fireRef.current) {
      fireRef.current.children.forEach((flame, i) => {
        flame.scale.y = 1 + Math.sin(t * (6 + i%3) + i * 2) * 0.4
        flame.scale.x = 1 + Math.sin(t * (4 + i%2) + i * 3) * 0.25
        flame.scale.z = 1 + Math.cos(t * 5 + i * 4) * 0.25
      })
    }
    if (flickerRef.current) {
      flickerRef.current.intensity = intensity * (3 + Math.sin(t * 15 + position[0] * 3) * 2.0)
    }
  })

  return (
    <group position={position}>
      <group ref={fireRef}>
        {subFlames.map((flm, i) => (
          <group key={i} position={[flm.ox, 0, flm.oz]}>
            {/* Outer Flame Core */}
            <mesh position={[0, 1.2 * flm.s, 0]}>
              <coneGeometry args={[0.75 * intensity * flm.s, 2.8 * intensity * flm.s, 6]} />
              <meshStandardMaterial
                color="#FF4500"
                emissive="#FF2200"
                emissiveIntensity={4}
                transparent
                opacity={0.8}
              />
            </mesh>
            {/* Inner HOT Flame */}
            <mesh position={[0, 1.5 * flm.s, 0]}>
              <coneGeometry args={[0.35 * intensity * flm.s, 1.8 * intensity * flm.s, 5]} />
              <meshStandardMaterial
                color="#FFCC00"
                emissive="#FFD700"
                emissiveIntensity={6}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Fire glow overarching light */}
      <pointLight
        ref={flickerRef}
        color="#FF3300"
        intensity={4}
        distance={spread ? 60 * intensity : 35 * intensity}
        position={[0, spread ? 5 : 3, 0]}
      />
    </group>
  )
}

// ── Smoke cloud ──
function Smoke({ position, scale = 1 }) {
  const smokeRef = useRef()
  useFrame((state) => {
    if (smokeRef.current) {
      smokeRef.current.position.y += 0.003
      smokeRef.current.rotation.y += 0.002
      if (smokeRef.current.position.y > position[1] + 15) {
        smokeRef.current.position.y = position[1]
      }
    }
  })

  return (
    <mesh ref={smokeRef} position={[position[0], position[1] + 3, position[2]]}>
      <sphereGeometry args={[2 * scale, 8, 8]} />
      <meshStandardMaterial
        color="#2A2A2A"
        transparent
        opacity={0.15}
        roughness={1}
      />
    </mesh>
  )
}

// ── Ground crack/fissure ──
function GroundCrack({ start, end, width = 0.4 }) {
  const midX = (start[0] + end[0]) / 2
  const midZ = (start[1] + end[1]) / 2
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)

  return (
    <mesh rotation={[-Math.PI / 2, 0, angle]} position={[midX, 0.06, midZ]} receiveShadow>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial color="#0A0A0A" roughness={1} />
    </mesh>
  )
}

// ── Road ──
function Road({ start, end, width = 4 }) {
  const midX = (start[0] + end[0]) / 2
  const midZ = (start[1] + end[1]) / 2
  const dx = end[0] - start[0]
  const dz = end[1] - start[1]
  const length = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, angle]} position={[midX, 0.04, midZ]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#2C2C2C" roughness={0.95} />
      </mesh>
      {/* Center line */}
      <mesh rotation={[-Math.PI / 2, 0, angle]} position={[midX, 0.05, midZ]}>
        <planeGeometry args={[0.15, length]} />
        <meshStandardMaterial color="#4A4A3A" roughness={0.9} />
      </mesh>
    </group>
  )
}

function EarthquakeTerrain() {
  const theme = useSimStore(s => s.theme)

  // Muted realistic concrete/stone palette
  const WALL_SHADES = [
    '#6B6B6B', // medium gray concrete
    '#5A5A5A', // darker concrete
    '#787878', // lighter concrete
    '#4D4D4D', // dark gray
    '#636359', // warm gray
    '#555550', // brownish gray
    '#6E6E64', // stone gray
    '#7A7A70', // weathered concrete
  ]

  const ROOF_SHADES = [
    '#3A3A3A', // dark flat roof
    '#484848', // medium roof
    '#4F4540', // brownish dark
    '#353535', // very dark
  ]

  const { buildings, rubble, nature, roads, fires, smokes, cracks } = useMemo(() => {
    const buildings = []
    const rubble = []
    const nature = []
    const roads = []
    const fires = []
    const smokes = []
    const cracks = []
    const gridSize = 12
    const spacing = 22
    const offset = (gridSize * spacing) / 2

    // Road grid
    for (let i = 0; i <= gridSize; i++) {
      const pos = i * spacing - offset
      roads.push({ start: [pos, -offset - 15], end: [pos, offset + 15] })
      roads.push({ start: [-offset - 15, pos], end: [offset + 15, pos] })
    }

    // Ground cracks (seismic fissures)
    for (let c = 0; c < 25; c++) {
      const sx = (seededRandom(c * 77) - 0.5) * 200
      const sz = (seededRandom(c * 88) - 0.5) * 200
      const len = 15 + seededRandom(c * 99) * 40
      const ang = seededRandom(c * 111) * Math.PI
      cracks.push({
        start: [sx, sz],
        end: [sx + Math.cos(ang) * len, sz + Math.sin(ang) * len],
        width: 0.3 + seededRandom(c * 55) * 1.0,
      })
      // Branch cracks
      if (seededRandom(c * 200) > 0.5) {
        const bx = sx + Math.cos(ang) * len * 0.5
        const bz = sz + Math.sin(ang) * len * 0.5
        const blen = 5 + seededRandom(c * 300) * 15
        const bang = ang + (seededRandom(c * 400) - 0.5) * 1.5
        cracks.push({
          start: [bx, bz],
          end: [bx + Math.cos(bang) * blen, bz + Math.sin(bang) * blen],
          width: 0.2 + seededRandom(c * 66) * 0.4,
        })
      }
    }

    let topFiresPlaced = 0

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const x = gx * spacing - offset + spacing / 2 + (seededRandom(seed + 1) - 0.5) * 3
        const z = gz * spacing - offset + spacing / 2 + (seededRandom(seed + 2) - 0.5) * 3

        const typeRand = seededRandom(seed + 10)

        if (typeRand < 0.12) {
          // Sparse vegetation (dead/damaged trees)
          const items = 1 + Math.floor(rand * 3)
          for (let i = 0; i < items; i++) {
            const nx = x + (seededRandom(seed + i * 10) - 0.5) * 12
            const nz = z + (seededRandom(seed + i * 11) - 0.5) * 12
            nature.push({ position: [nx, 0, nz], seed: seed + i })
          }
        } else if (typeRand < 0.92) {
          // Urban zone
          const damageLevel = seededRandom(seed + 3)
          const colorIdx = Math.floor(seededRandom(seed + 5) * WALL_SHADES.length)
          const roofIdx = Math.floor(seededRandom(seed + 6) * ROOF_SHADES.length)
          const wallColor = WALL_SHADES[colorIdx]
          const roofColor = ROOF_SHADES[roofIdx]

          if (damageLevel < 0.35) {
            // FULLY COLLAPSED — rubble pile
            const chunks = 4 + Math.floor(rand * 5)
            for (let c = 0; c < chunks; c++) {
              const cw = 2 + rand * 5
              const ch = 0.8 + rand * 3
              const cd = 2 + rand * 5
              const tilt = (seededRandom(seed + c * 3) - 0.5) * 0.8
              buildings.push({
                position: [
                  x + (seededRandom(seed + c) - 0.5) * 8,
                  ch / 2,
                  z + (seededRandom(seed + c + 1) - 0.5) * 8,
                ],
                scale: [cw, ch, cd],
                rotation: [tilt * 0.5, seededRandom(seed + c + 2) * Math.PI, tilt],
                color: '#585858',
                roofColor,
                isBroken: true,
                damageLevel: 1,
              })
            }
            // Scattered small debris
            for (let r = 0; r < 12; r++) {
              rubble.push({
                position: [
                  x + (seededRandom(seed + r * 5) - 0.5) * 12,
                  0.2 + seededRandom(seed + r * 6) * 0.5,
                  z + (seededRandom(seed + r * 7) - 0.5) * 12,
                ],
                scale: 0.3 + seededRandom(seed + r * 8) * 1.5,
                rotation: [
                  seededRandom(seed + r * 9) * Math.PI,
                  seededRandom(seed + r * 10) * Math.PI,
                  seededRandom(seed + r * 11) * Math.PI,
                ],
              })
            }
            // Fire at some collapse sites
            if (seededRandom(seed + 30) > 0.55) {
              fires.push({
                position: [x + (seededRandom(seed + 31) - 0.5) * 4, 0, z + (seededRandom(seed + 32) - 0.5) * 4],
                intensity: 0.6 + seededRandom(seed + 33) * 0.8,
                spread: [8, 8] // Rubble spread
              })
              smokes.push({
                position: [x, 2, z],
                scale: 1 + seededRandom(seed + 34) * 1.5,
              })
            }
          } else if (damageLevel < 0.6) {
            // PARTIALLY COLLAPSED — leaning/broken building
            const height = 8 + rand * 15
            const w = 7 + rand * 5
            const d = 7 + rand * 5
            const lean = (seededRandom(seed + 7) - 0.5) * 0.3

            buildings.push({
              position: [x, height / 2, z],
              scale: [w, height, d],
              rotation: [lean * 0.5, 0, lean],
              color: wallColor,
              roofColor,
              isBroken: true,
              damageLevel: 0.5,
            })

            // Fallen wall section beside it
            buildings.push({
              position: [x + w * 0.7, 1.5, z + (seededRandom(seed + 8) - 0.5) * 4],
              scale: [w * 0.8, 3, 1.5],
              rotation: [0.1, seededRandom(seed + 9) * 0.5, 1.3],
              color: '#4A4A4A',
              roofColor: '#3A3A3A',
              isBroken: true,
              damageLevel: 0.7,
            })

            // Rubble at base
            for (let r = 0; r < 6; r++) {
              rubble.push({
                position: [
                  x + (seededRandom(seed + r * 15) - 0.5) * w,
                  0.3,
                  z + (seededRandom(seed + r * 16) - 0.5) * d,
                ],
                scale: 0.5 + seededRandom(seed + r * 17) * 1.2,
                rotation: [rand * Math.PI, rand * 2, rand * Math.PI],
              })
            }

            // Occasional fire
            if (seededRandom(seed + 40) > 0.7) {
              fires.push({
                position: [x + w * 0.3, height * 0.3, z],
                intensity: 0.4 + seededRandom(seed + 41) * 0.5,
                spread: [w * 0.6, d * 0.6] // Mid-level engulf
              })
              smokes.push({ position: [x, height * 0.5, z], scale: 0.8 })
            }
          } else {
            // INTACT building (damaged but standing)
            const height = 10 + rand * 25
            const w = 7 + rand * 6
            const d = 7 + rand * 6

            buildings.push({
              position: [x, height / 2, z],
              scale: [w, height, d],
              rotation: [0, 0, 0],
              color: wallColor,
              roofColor,
              isBroken: false,
              damageLevel: 0,
            })
            
            // Major Skyscraper Rooftop Fires
            if (topFiresPlaced < 3 && height > 20) {
               fires.push({
                  position: [x, height + 1, z],
                  intensity: 2.2, // Stronger for impact
                  spread: [w, d]  
               })
               smokes.push({
                  position: [x, height + 4, z],
                  scale: 3.5 // Massive smoke plume
               })
               topFiresPlaced++
            }

            // Small cracks on some intact buildings — nearby rubble
            if (seededRandom(seed + 50) > 0.6) {
              rubble.push({
                position: [x + w * 0.5 + 1, 0.3, z],
                scale: 0.5 + seededRandom(seed + 51) * 0.8,
                rotation: [0, rand * Math.PI, 0],
              })
            }
          }
        } else {
          // Empty lot with scattered debris
          for (let r = 0; r < 3; r++) {
            rubble.push({
              position: [
                x + (seededRandom(seed + r * 20) - 0.5) * 10,
                0.2,
                z + (seededRandom(seed + r * 21) - 0.5) * 10,
              ],
              scale: 0.3 + seededRandom(seed + r * 22) * 0.8,
              rotation: [rand * Math.PI, rand, rand * Math.PI],
            })
          }
        }
      }
    }
    return { buildings, rubble, nature, roads, fires, smokes, cracks }
  }, [])

  const isDark = theme === 'dark'

  return (
    <group>
      {/* Ground — dusty/cracked earth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial
          color={isDark ? '#1C1C1A' : '#6B6B60'}
          roughness={1}
        />
      </mesh>

      {/* Dust/dirt patches on ground */}
      {Array.from({ length: 30 }, (_, i) => {
        const px = (seededRandom(i * 200) - 0.5) * 300
        const pz = (seededRandom(i * 201) - 0.5) * 300
        const r = 8 + seededRandom(i * 202) * 15
        return (
          <mesh key={`dust-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[px, 0.03, pz]}>
            <circleGeometry args={[r, 12]} />
            <meshStandardMaterial
              color={isDark ? '#252520' : '#7A7A6A'}
              roughness={1}
              transparent
              opacity={0.5}
            />
          </mesh>
        )
      })}

      {/* Ground cracks / fissures */}
      {cracks.map((c, i) => (
        <GroundCrack key={`crack-${i}`} start={c.start} end={c.end} width={c.width} />
      ))}

      {/* Roads */}
      {roads.map((r, i) => (
        <Road key={`road-${i}`} start={r.start} end={r.end} />
      ))}

      {/* Buildings */}
      {buildings.map((b, i) => (
        <group key={`b-${i}`} position={b.position} rotation={b.rotation || [0, 0, 0]}>
          {/* Main structure */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.scale} />
            <meshStandardMaterial
              color={b.color}
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>

          {/* Roof slab */}
          {!b.isBroken && (
            <mesh position={[0, b.scale[1] / 2 + 0.2, 0]} castShadow>
              <boxGeometry args={[b.scale[0] + 0.4, 0.4, b.scale[2] + 0.4]} />
              <meshStandardMaterial color={b.roofColor} roughness={0.9} />
            </mesh>
          )}

          {/* Window rows - only for standing buildings */}
          {!b.isBroken && b.scale[1] > 8 && (
            <>
              {[0.2, 0.4, 0.6, 0.8].map(h => (
                <mesh
                  key={h}
                  position={[0, b.scale[1] * (h - 0.5), b.scale[2] / 2 + 0.06]}
                >
                  <planeGeometry args={[b.scale[0] * 0.7, b.scale[1] * 0.06]} />
                  <meshStandardMaterial
                    color="#1A1A1A"
                    emissive={isDark ? '#3A3520' : '#000'}
                    emissiveIntensity={isDark ? 0.15 : 0}
                    transparent
                    opacity={0.8}
                  />
                </mesh>
              ))}
            </>
          )}

          {/* Damage marks on partially broken buildings */}
          {b.isBroken && b.damageLevel < 0.8 && b.scale[1] > 5 && (
            <mesh position={[b.scale[0] / 2 + 0.05, 0, 0]}>
              <planeGeometry args={[b.scale[2] * 0.3, b.scale[1] * 0.4]} />
              <meshStandardMaterial
                color="#2A2A2A"
                transparent
                opacity={0.6}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* Rubble / debris */}
      {rubble.map((r, i) => (
        <mesh key={`r-${i}`} position={r.position} rotation={r.rotation} castShadow>
          <boxGeometry args={[r.scale, r.scale * 0.5, r.scale * 0.8]} />
          <meshStandardMaterial color="#505050" roughness={0.95} />
        </mesh>
      ))}

      {/* Dead/damaged trees */}
      {nature.map((n, i) => (
        <DeadTree key={`t-${i}`} position={n.position} seed={n.seed} />
      ))}

      {/* Fires */}
      {fires.map((f, i) => (
        <Fire key={`fire-${i}`} position={f.position} intensity={f.intensity} spread={f.spread} />
      ))}
    </group>
  )
}

// ── Tsunami components ──
function Water({ level = 0 }) {
  const waterRef = useRef()
  useFrame((state) => {
    if (waterRef.current) {
      const t = state.clock.elapsedTime
      waterRef.current.position.y = level + Math.sin(t * 0.5) * 0.2
      // Simple wave offset animation
      waterRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.3) * 0.01
      waterRef.current.rotation.y = Math.cos(t * 0.2) * 0.01
    }
  })

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000, 32, 32]} />
      <meshStandardMaterial
        color="#0c2c4d" // Deep Oceanic Navy
        transparent
        opacity={0.7}
        roughness={0.05}
        metalness={0.2}
      />
    </mesh>

  )
}

function FloatingDebris({ position, scale = 1, seed = 0 }) {
  const meshRef = useRef()
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime
      meshRef.current.position.y += Math.sin(t * 1.2 + seed) * 0.005
      meshRef.current.rotation.x += Math.sin(t * 0.5 + seed) * 0.002
      meshRef.current.rotation.z += Math.cos(t * 0.7 + seed) * 0.002
    }
  })

  return (
    <mesh ref={meshRef} position={position} castShadow>
      <boxGeometry args={[2 * scale, 0.5 * scale, 1 * scale]} />
      <meshStandardMaterial color="#3d2b1f" roughness={0.9} />
    </mesh>
  )
}

function TsunamiTerrain() {
  const theme = useSimStore(s => s.theme)
  const waterLevel = useSimStore(s => s.waterLevel) || 2 

  const { buildings, debris, nature } = useMemo(() => {
    const buildings = []
    const debris = []
    const nature = []
    const gridSize = 16
    const spacing = 18
    const offset = (gridSize * spacing) / 2

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const x = gx * spacing - offset + (seededRandom(seed + 1) - 0.5) * 6
        const z = gz * spacing - offset + (seededRandom(seed + 2) - 0.5) * 6

        const typeRand = seededRandom(seed + 10)

        if (typeRand < 0.15) {
          // Floating debris
          debris.push({
            position: [x, waterLevel + 0.2, z],
            scale: 0.8 + seededRandom(seed) * 2,
            seed: seed
          })
        } else if (typeRand < 0.85) {
          // Urban area
          const height = (gx < 4) ? (5 + rand * 10) : (15 + rand * 35) // Shorter buildings near coast
          const w = 7 + rand * 5
          const d = 7 + rand * 5
          const isOcean = gx < 5

          buildings.push({
            position: [x, height / 2 - (isOcean ? 8 : 0), z],
            scale: [w, height, d],
            color: gx < 7 ? '#4a5568' : '#718096',
            roofColor: '#2d3748',
            height: height
          })
        }
      }
    }
    return { buildings, debris, nature }
  }, [waterLevel])

  const isDark = theme === 'dark'

  return (
    <group>
      {/* Seabed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color={isDark ? '#050a14' : '#14213d'}
          roughness={1}
        />
      </mesh>

      {/* Layered Water Effect */}
      <Water level={waterLevel} />
      <Water level={waterLevel - 0.5} />
      
      {/* Underwater "ground" haze patches */}
      {Array.from({ length: 20 }).map((_, i) => (
         <mesh key={`uw-${i}`} rotation={[-Math.PI/2, 0, 0]} position={[(seededRandom(i)-0.5)*400, 0.1, (seededRandom(i+1)-0.5)*400]}>
            <circleGeometry args={[20 + seededRandom(i+2)*20, 16]} />
            <meshStandardMaterial color="#003366" transparent opacity={0.4} />
         </mesh>
      ))}

      {/* Coastal Buildings */}
      {buildings.map((b, i) => (
        <group key={`tb-${i}`} position={b.position}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.scale} />
            <meshStandardMaterial 
               color={b.color} 
               roughness={0.7}
               metalness={0.2}
            />
          </mesh>
          {/* Submersion Mark line */}
          <mesh position={[0, -b.scale[1]/2 + waterLevel, 0]}>
             <boxGeometry args={[b.scale[0]+0.1, 0.1, b.scale[2]+0.1]} />
             <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2} transparent opacity={0.5} />
          </mesh>
          
          {/* Windows */}
          {b.height > 12 && (
             <mesh position={[0, b.height/6, b.scale[2]/2 + 0.1]}>
                <planeGeometry args={[b.scale[0]*0.7, b.height*0.5]} />
                <meshStandardMaterial color="#000" transparent opacity={0.4} />
             </mesh>
          )}
        </group>
      ))}

      {/* Floating Debris */}
      {debris.map((d, i) => (
        <FloatingDebris key={`d-${i}`} position={d.position} scale={d.scale} seed={d.seed} />
      ))}
    </group>
  )
}

function MuddyWater({ level = 0 }) {
  const waterRef = useRef()
  useFrame((state) => {
    if (waterRef.current) {
      const t = state.clock.elapsedTime
      waterRef.current.position.y = level + Math.sin(t * 0.4) * 0.15
      waterRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.2) * 0.005
    }
  })

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry args={[1000, 1000, 32, 32]} />
      <meshStandardMaterial
        color="#4a3f35" // Muted silt/mud
        transparent
        opacity={0.88}
        roughness={0.9}
        metalness={0.0}
      />

    </mesh>
  )
}

function SandbagWall({ position, rotation = [0, 0, 0] }) {
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, i * 0.4 + 0.2, 0]} castShadow>
          <boxGeometry args={[4, 0.4, 1]} />
          <meshStandardMaterial color="#8b7d6b" roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function FloatingVehicle({ position, seed = 0 }) {
  const meshRef = useRef()
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime
      meshRef.current.position.y += Math.sin(t * 1.5 + seed) * 0.01
      meshRef.current.rotation.z += Math.sin(t * 0.8 + seed) * 0.005
      meshRef.current.rotation.y += 0.001
    }
  })
  return (
    <group ref={meshRef} position={position}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={[4, 1.5, 2]} />
        <meshStandardMaterial color={seededRandom(seed) > 0.5 ? "#550000" : "#223344"} />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.8, 0.8, 1.8]} />
        <meshStandardMaterial color="#000" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function FloodTerrain() {
  const theme = useSimStore(s => s.theme)
  const waterLevel = useSimStore(s => s.waterLevel) || 4.2 

  const { buildings, junk, nature, sandbags } = useMemo(() => {
    const buildings = []
    const junk = []
    const nature = []
    const sandbags = []
    const gridSize = 12
    const spacing = 32
    const offset = (gridSize * spacing) / 2

    for (let gx = 0; gx < gridSize; gx++) {
      for (let gz = 0; gz < gridSize; gz++) {
        const seed = gx * 100 + gz
        const rand = seededRandom(seed)
        const x = gx * spacing - offset + (seededRandom(seed + 1) - 0.5) * 12
        const z = gz * spacing - offset + (seededRandom(seed + 2) - 0.5) * 12

        const typeRand = seededRandom(seed + 10)

        // Only moderate amount of buildings
        if (typeRand < 0.25) {
          const height = (rand < 0.3) ? 4 : (rand < 0.8 ? 12 : 30) // Mix of small houses and taller ones
          const w = 8 + rand * 6
          const d = 8 + rand * 6

          buildings.push({
            position: [x, height / 2, z],
            scale: [w, height, d],
            color: rand > 0.5 ? '#94a3b8' : '#64748b',
          })
          
          if (height > 10 && seededRandom(seed + 5) > 0.6) {
             sandbags.push({ position: [x + w/2 + 2, 0, z], rotation: [0, Math.PI/2, 0] })
          }
        } else if (typeRand < 0.4) {
          // Floating vehicles / junk
          junk.push({ 
            type: 'vehicle', 
            position: [x, waterLevel + 0.3, z], 
            seed: seed 
          })
        } else if (typeRand < 0.6) {
           // Submerged trees
           nature.push({
              position: [x, 0, z],
              seed: seed
           })
        }
      }
    }
    return { buildings, junk, nature, sandbags }
  }, [waterLevel])

  const isDark = theme === 'dark'

  return (
    <group>
      {/* Ground (Mud) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color={isDark ? '#1a1410' : '#2d241c'}
          roughness={1}
        />
      </mesh>

      {/* Flood Water */}
      <MuddyWater level={waterLevel} />
      <MuddyWater level={waterLevel - 0.2} />

      {/* Buildings */}
      {buildings.map((b, i) => (
        <mesh key={`fb-${i}`} position={b.position} castShadow receiveShadow>
           <boxGeometry args={b.scale} />
           <meshStandardMaterial color={b.color} roughness={0.8} />
        </mesh>
      ))}

      {/* Trees */}
      {nature.map((n, i) => (
         <group key={`ft-${i}`} position={n.position}>
            <mesh position={[0, 4, 0]} castShadow>
               <cylinderGeometry args={[0.4, 0.4, 8]} />
               <meshStandardMaterial color="#3d2b1f" />
            </mesh>
            <mesh position={[0, 9, 0]} castShadow>
               <sphereGeometry args={[4]} />
               <meshStandardMaterial color="#1a2e1a" />
            </mesh>
         </group>
      ))}

      {/* Junk / Vehicles */}
      {junk.map((j, i) => (
        <FloatingVehicle key={`j-${i}`} position={j.position} seed={j.seed} />
      ))}

      {/* Sandbags */}
      {sandbags.map((s, i) => (
         <SandbagWall key={`sb-${i}`} position={s.position} rotation={s.rotation} />
      ))}
    </group>
  )
}

export default function Terrain({ scenario }) {
  switch (scenario) {
    case 'earthquake': return <EarthquakeTerrain />
    case 'tsunami': return <TsunamiTerrain />
    case 'flood': return <FloodTerrain />
    default: return <EarthquakeTerrain />
  }
}


