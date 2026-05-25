import React, { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// ── Procedural Texture Generators ──
const textureCache = {}

export function getProceduralTexture(type = 'concrete', size = 512) {
  if (textureCache[type]) return textureCache[type]

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const imgData = ctx.createImageData(size, size)
  const data = imgData.data

  for (let i = 0; i < data.length; i += 4) {
    let r, g, b
    const noise = Math.random()
    if (type === 'concrete') {
      // Rough gray with high frequency
      const val = 120 + noise * 60
      r = g = b = val
    } else if (type === 'asphalt') {
      // Dark rough
      const val = 40 + noise * 40
      r = g = b = val
    } else if (type === 'dirt') {
      // Brownish patchy
      r = 90 + noise * 50
      g = 70 + noise * 40
      b = 50 + noise * 30
    } else if (type === 'bump') {
      // General bump map based on pure noise
      const val = noise * 255
      r = g = b = val
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  
  ctx.putImageData(imgData, 0, 0)
  
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  
  if (type === 'concrete') texture.repeat.set(4, 4)
  if (type === 'asphalt' || type === 'dirt' || type === 'bump') texture.repeat.set(10, 10)
  
  textureCache[type] = texture
  return texture
}

export function getBuildingTexture(width = 512, height = 512, isDark = false) {
  const key = `building-${width}-${height}-${isDark}`
  if (textureCache[key]) return textureCache[key]

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  // Base concrete color (light enough to be tinted by mesh color)
  ctx.fillStyle = '#cccccc'
  ctx.fillRect(0, 0, width, height)

  // Draw windows
  const cols = 6
  const rows = 12
  const paddingX = width * 0.1
  const paddingY = height * 0.05
  const winW = (width - paddingX * 2) / cols * 0.7
  const winH = (height - paddingY * 2) / rows * 0.7
  const spacingX = (width - paddingX * 2) / cols
  const spacingY = (height - paddingY * 2) / rows

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = paddingX + c * spacingX + (spacingX - winW) / 2
      const py = paddingY + r * spacingY + (spacingY - winH) / 2

      // Subtle random light reflection for glass (very few windows lit for realism)
      const isLit = Math.random() > 0.95
      const gradient = ctx.createLinearGradient(px, py, px, py + winH)
      
      if (isLit) {
        gradient.addColorStop(0, '#ffffdd')
        gradient.addColorStop(1, '#ffaa00')
      } else {
        gradient.addColorStop(0, isDark ? '#111' : '#222')
        gradient.addColorStop(1, isDark ? '#000' : '#111')
      }

      ctx.fillStyle = gradient
      ctx.fillRect(px, py, winW, winH)

      // Add a subtle glass reflection line
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + winW * 0.5, py)
      ctx.lineTo(px, py + winH * 0.5)
      ctx.fill()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  textureCache[key] = texture
  return texture
}

export function getParticleTexture(type = 'fire') {
  if (textureCache[type]) return textureCache[type]

  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  
  const center = 32
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)

  if (type === 'fire') {
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.2, 'rgba(255, 200, 0, 1)')
    gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.6)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  } else if (type === 'smoke') {
    gradient.addColorStop(0, 'rgba(150, 150, 150, 0.3)')
    gradient.addColorStop(0.5, 'rgba(100, 100, 100, 0.05)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
  } else if (type === 'leaf') {
    // A blotchy green texture for tree canopies
    const noise = Math.random()
    ctx.fillStyle = `rgb(${20 + noise * 30}, ${60 + noise * 60}, ${20 + noise * 20})`
    ctx.fillRect(0, 0, 64, 64)
    // Draw some leaf shapes
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgb(${10 + Math.random() * 20}, ${50 + Math.random() * 50}, ${10 + Math.random() * 20})`
      ctx.beginPath()
      ctx.arc(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 6, 0, Math.PI * 2)
      ctx.fill()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    textureCache[type] = texture
    return texture
  }

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  textureCache[type] = texture
  return texture
}

// ── Realistic Props ──
function RealisticTree({ position, scale = 1, seed = 0 }) {
  const isDead = seededRandom(seed) > 0.8
  const height = 3 + seededRandom(seed + 1) * 3
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Trunk */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, height, 5]} />
        <meshStandardMaterial color="#4A3B2C" roughness={0.9} roughnessMap={getProceduralTexture('dirt')} bumpMap={getProceduralTexture('bump')} bumpScale={0.05} />
      </mesh>
      {/* Canopy */}
      {!isDead && (
        <group position={[0, height, 0]}>
          <mesh castShadow>
            <dodecahedronGeometry args={[2, 1]} />
            <meshStandardMaterial map={getParticleTexture('leaf')} roughness={0.8} bumpMap={getProceduralTexture('bump')} bumpScale={0.1} />
          </mesh>
          <mesh position={[1, 0.5, 0]} castShadow>
            <dodecahedronGeometry args={[1.5, 1]} />
            <meshStandardMaterial map={getParticleTexture('leaf')} roughness={0.8} bumpMap={getProceduralTexture('bump')} bumpScale={0.1} />
          </mesh>
          <mesh position={[-0.8, -0.5, 1]} castShadow>
            <dodecahedronGeometry args={[1.8, 1]} />
            <meshStandardMaterial map={getParticleTexture('leaf')} roughness={0.8} bumpMap={getProceduralTexture('bump')} bumpScale={0.1} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function StreetLight({ position, rotation = [0, 0, 0], seed = 0 }) {
  const isWorking = seededRandom(seed) > 0.6
  const materialRef = useRef()
  useFrame((state) => {
    if (isWorking && materialRef.current) {
      // Flickering effect for broken lights
      const flicker = seededRandom(seed + 1) > 0.5 ? (Math.random() > 0.95 ? 0 : 1) : 1
      materialRef.current.emissiveIntensity = 2 * flicker
    }
  })
  return (
    <group position={position} rotation={rotation}>
      {/* Pole */}
      <mesh position={[0, 4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 8, 8]} />
        <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Arm */}
      <mesh position={[0.8, 8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.6, 8]} />
        <meshStandardMaterial color="#444" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lamp Head */}
      <mesh position={[1.6, 8, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.2]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Emissive Bulb */}
      <mesh position={[1.6, 7.94, 0]}>
        <planeGeometry args={[0.3, 0.15]} />
        <meshStandardMaterial ref={materialRef} color="#fff" emissive={isWorking ? "#ffddaa" : "#000"} emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

function AbandonedVehicle({ position, rotation = [0, 0, 0], seed = 0 }) {
  const color = ['#A32C2C', '#2C4FA3', '#A3A3A3', '#323232', '#A38B2C'][Math.floor(seededRandom(seed) * 5)]
  return (
    <group position={position} rotation={rotation} castShadow>
      {/* Chassis */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[2, 0.8, 4.5]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} bumpMap={getProceduralTexture('bump')} bumpScale={0.02} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 1.2, -0.2]} castShadow>
        <boxGeometry args={[1.8, 0.8, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Windows */}
      <mesh position={[0, 1.2, 0.95]}>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>
      <mesh position={[0, 1.2, -1.35]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.6, 0.6]} />
        <meshStandardMaterial color="#111" roughness={0.1} metalness={0.9} />
      </mesh>
    </group>
  )
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

// ── Particle Fire Effect ──
function Fire({ position, intensity = 1, spread = null }) {
  const meshRef = useRef()
  const flickerRef = useRef()
  const particleCount = spread ? 60 : 20
  
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particles = useMemo(() => {
    const [w, d] = spread || [2, 2]
    return Array.from({ length: particleCount }).map(() => ({
      x: (Math.random() - 0.5) * w,
      y: Math.random() * 4 * intensity,
      z: (Math.random() - 0.5) * d,
      speed: 1.5 + Math.random() * 2,
      scale: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2
    }))
  }, [spread, particleCount, intensity])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    particles.forEach((p, i) => {
      p.y += p.speed * 0.05
      p.x += Math.sin(t * 2 + p.phase) * 0.02
      if (p.y > 6 * intensity) {
        p.y = 0
        const [w, d] = spread || [2, 2]
        p.x = (Math.random() - 0.5) * w
      }
      dummy.position.set(position[0] + p.x, position[1] + p.y, position[2] + p.z)
      
      // Calculate scale based on height (smaller as it goes up)
      const heightPercent = p.y / (6 * intensity)
      const currentScale = p.scale * Math.max(0.1, 1 - heightPercent)
      dummy.scale.setScalar(currentScale * intensity)
      
      // Billboard rotation (facing camera)
      dummy.rotation.y = Math.atan2(state.camera.position.x - dummy.position.x, state.camera.position.z - dummy.position.z)
      
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true

    if (flickerRef.current) {
      flickerRef.current.intensity = intensity * (3 + Math.sin(t * 15 + position[0] * 3) * 2.0 + Math.cos(t * 22) * 1.5)
    }
  })

  return (
    <group>
      <instancedMesh ref={meshRef} args={[null, null, particleCount]}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial 
          map={getParticleTexture('fire')} 
          transparent 
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
      <pointLight ref={flickerRef} color="#FF5500" intensity={4} distance={spread ? 60 * intensity : 35 * intensity} position={[position[0], position[1] + (spread ? 5 : 3), position[2]]} />
    </group>
  )
}

// ── Billboard Smoke ──
function Smoke({ position, scale = 1 }) {
  const meshRef = useRef()
  const particleCount = 10
  
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }).map(() => ({
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 20,
      z: (Math.random() - 0.5) * 2,
      speed: 0.5 + Math.random() * 1.5,
      rotSpeed: (Math.random() - 0.5) * 0.05,
      rot: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2
    }))
  }, [particleCount])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    particles.forEach((p, i) => {
      p.y += p.speed * 0.05
      p.x += Math.sin(t * 0.5 + p.phase) * 0.02
      p.rot += p.rotSpeed
      if (p.y > 25 * scale) {
        p.y = 0
        p.x = (Math.random() - 0.5) * 2
      }
      dummy.position.set(position[0] + p.x, position[1] + p.y, position[2] + p.z)
      
      // Expand as it goes up
      const heightPercent = p.y / (25 * scale)
      const currentScale = (1.5 + heightPercent * 3.5) * scale
      dummy.scale.setScalar(currentScale)
      
      // Face camera but keep rotation
      dummy.rotation.set(0, 0, 0)
      dummy.lookAt(state.camera.position)
      dummy.rotateZ(p.rot)
      
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, particleCount]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial 
        map={getParticleTexture('smoke')} 
        transparent 
        opacity={0.35}
        depthWrite={false}
      />
    </instancedMesh>
  )
}

// ── Dust Particles ──
function DustParticles({ count = 200, area = [200, 20, 200] }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.random() - 0.5) * area[0],
      y: Math.random() * area[1],
      z: (Math.random() - 0.5) * area[2],
      speed: 0.1 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2
    }))
  }, [count, area])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    particles.forEach((p, i) => {
      p.x += Math.sin(t * p.speed + p.phase) * 0.02
      p.y += Math.cos(t * p.speed * 0.5) * 0.01
      p.z += Math.sin(t * p.speed * 0.8) * 0.02
      dummy.position.set(p.x, p.y, p.z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <sphereGeometry args={[0.2, 4, 4]} />
      <meshBasicMaterial color="#94a3b8" transparent opacity={0.3} />
    </instancedMesh>
  )
}

// ── Emergency Lights (Flickering Blue/Red) ──
function EmergencyLight({ position }) {
  const lightRef = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime * 10
    if (lightRef.current) {
      const isRed = Math.sin(t) > 0
      lightRef.current.color.setHex(isRed ? 0xff0000 : 0x0000ff)
      lightRef.current.intensity = Math.sin(t * 2) > 0.5 ? 5 : 0
    }
  })
  return <pointLight ref={lightRef} position={position} distance={15} intensity={5} />
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
      <meshStandardMaterial color="#0A0A0A" roughness={1} roughnessMap={getProceduralTexture('dirt')} bumpMap={getProceduralTexture('bump')} bumpScale={0.05} />
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
        <meshStandardMaterial color="#2C2C2C" roughness={0.95} roughnessMap={getProceduralTexture('asphalt')} bumpMap={getProceduralTexture('bump')} bumpScale={0.02} />
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

  const { buildings, rubble, nature, roads, fires, smokes, cracks, emergencyLights, streetLights, vehicles } = useMemo(() => {
    const buildings = []
    const rubble = []
    const nature = []
    const roads = []
    const fires = []
    const smokes = []
    const cracks = []
    const emergencyLights = []
    const streetLights = []
    const vehicles = []
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

        // Spawn Street Lights along roads
        if (seededRandom(seed + 30) > 0.5) {
          streetLights.push({ position: [x + 8, 0, z + 8], rotation: [0, (seededRandom(seed + 31) > 0.5 ? 0 : Math.PI / 2), 0], seed })
        }
        
        // Spawn Abandoned Vehicles on roads
        if (seededRandom(seed + 40) > 0.7) {
          vehicles.push({
            position: [x + (seededRandom(seed + 41) - 0.5) * 10, 0, z + (seededRandom(seed + 42) - 0.5) * 10],
            rotation: [0, seededRandom(seed + 43) * Math.PI * 2, 0],
            seed
          })
        }

        const typeRand = seededRandom(seed + 10)

        if (typeRand < 0.12) {
          // Sparse vegetation (dead/damaged trees)
          const items = 1 + Math.floor(rand * 3)
          for (let i = 0; i < items; i++) {
            const nx = x + (seededRandom(seed + i * 10) - 0.5) * 12
            const nz = z + (seededRandom(seed + i * 11) - 0.5) * 12
            nature.push({ position: [nx, 0, nz], scale: 0.8 + seededRandom(seed + i * 12) * 0.5, seed: seed + i })
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
            // Fire and emergency light at some collapse sites
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
              if (seededRandom(seed + 35) > 0.5) {
                emergencyLights.push({ position: [x + 5, 0.5, z + 5] })
              }
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
    return { buildings, rubble, nature, roads, fires, smokes, cracks, emergencyLights, streetLights, vehicles }
  }, [])

  const isDark = theme === 'dark'

  // ── Export obstacle bounding data so drones can avoid buildings & trees ──
  useEffect(() => {
    const bObstacles = buildings.map((b, index) => ({
      id: `building-${index}-${Math.round(b.position[0])}-${Math.round(b.position[2])}`,
      type: 'building',
      x: b.position[0],
      z: b.position[2],
      halfX: b.scale[0] / 2,
      halfZ: b.scale[2] / 2,
      radius: Math.sqrt(b.scale[0] ** 2 + b.scale[2] ** 2) / 2 + 2
    }))
    const tObstacles = nature.map((n, index) => ({
      id: `tree-${index}-${Math.round(n.position[0])}-${Math.round(n.position[2])}`,
      type: 'tree',
      x: n.position[0],
      z: n.position[2],
      radius: 2.0 * n.scale
    }))
    const vObstacles = vehicles.map((v, index) => ({
      id: `vehicle-${index}-${Math.round(v.position[0])}-${Math.round(v.position[2])}`,
      type: 'vehicle',
      x: v.position[0],
      z: v.position[2],
      radius: 3
    }))
    useSimStore.getState().setObstacles([...bObstacles, ...tObstacles, ...vObstacles])
  }, [buildings, nature, vehicles])

  return (
    <group>
      <DustParticles count={180} area={[300, 30, 300]} />
      
      {/* Ground — dusty/cracked earth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial
          color={isDark ? '#1C1C1A' : '#6B6B60'}
          roughness={1}
          roughnessMap={getProceduralTexture('dirt')}
          bumpMap={getProceduralTexture('bump')}
          bumpScale={0.1}
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

      {/* Realistic Trees */}
      {nature.map((n, i) => (
        <RealisticTree key={`tree-${i}`} position={n.position} scale={n.scale} seed={n.seed} />
      ))}

      {/* Street Lights */}
      {streetLights.map((s, i) => (
        <StreetLight key={`sl-${i}`} position={s.position} rotation={s.rotation} seed={s.seed} />
      ))}

      {/* Abandoned Vehicles */}
      {vehicles.map((v, i) => (
        <AbandonedVehicle key={`veh-${i}`} position={v.position} rotation={v.rotation} seed={v.seed} />
      ))}

      {/* Buildings */}
      {buildings.map((b, i) => (
        <group key={`b-${i}`} position={b.position} rotation={b.rotation || [0, 0, 0]}>
          {/* Main structure */}
          <mesh castShadow receiveShadow>
            <boxGeometry args={b.scale} />
            <meshStandardMaterial
              color={b.color}
              map={getBuildingTexture(512, 512, isDark)}
              roughness={0.9}
              metalness={0.05}
              bumpMap={getProceduralTexture('bump')}
              bumpScale={0.05}
            />
          </mesh>

          {/* Roof slab */}
          {!b.isBroken && (
            <mesh position={[0, b.scale[1] / 2 + 0.2, 0]} castShadow>
              <boxGeometry args={[b.scale[0] + 0.4, 0.4, b.scale[2] + 0.4]} />
              <meshStandardMaterial color={b.roofColor} roughness={0.9} roughnessMap={getProceduralTexture('concrete')} bumpMap={getProceduralTexture('bump')} bumpScale={0.05} />
            </mesh>
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
          <dodecahedronGeometry args={[r.scale, 0]} />
          <meshStandardMaterial color="#505050" roughness={0.95} roughnessMap={getProceduralTexture('concrete')} bumpMap={getProceduralTexture('bump')} bumpScale={0.08} />
        </mesh>
      ))}

      {/* Dead/damaged trees */}
      {nature.map((n, i) => (
        <DeadTree key={`t-${i}`} position={n.position} seed={n.seed} />
      ))}

      {/* Fires & Smoke */}
      {fires.map((f, i) => (
        <Fire key={`fire-${i}`} position={f.position} intensity={f.intensity} spread={f.spread} />
      ))}
      {smokes.map((s, i) => (
        <Smoke key={`smoke-${i}`} position={s.position} scale={s.scale} />
      ))}
      {emergencyLights.map((e, i) => (
        <EmergencyLight key={`em-${i}`} position={e.position} />
      ))}
    </group>
  )
}

// ── Tsunami components ──
function Water({ level = 0 }) {
  const waterRef = useRef()
  const geoRef = useRef()
  
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (waterRef.current) {
      waterRef.current.position.y = level + Math.sin(t * 0.5) * 0.2
      waterRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.3) * 0.01
      waterRef.current.rotation.y = Math.cos(t * 0.2) * 0.01
    }
    if (geoRef.current) {
      const posAttribute = geoRef.current.attributes.position
      const v = new THREE.Vector3()
      for (let i = 0; i < posAttribute.count; i++) {
        v.fromBufferAttribute(posAttribute, i)
        // Note: plane is rotated, so z is height locally
        v.z = Math.sin(v.x * 0.1 + t * 2) * Math.cos(v.y * 0.1 + t * 2) * 1.5
        posAttribute.setZ(i, v.z)
      }
      posAttribute.needsUpdate = true
    }
  })

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry ref={geoRef} args={[1000, 1000, 64, 64]} />
      <meshStandardMaterial
        color="#0c2c4d" // Deep Oceanic Navy
        transparent
        opacity={0.8}
        roughness={0.1}
        metalness={0.6}
        roughnessMap={getProceduralTexture('bump')}
        bumpMap={getProceduralTexture('bump')}
        bumpScale={0.02}
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

  useEffect(() => {
    const bObstacles = buildings.map((b, index) => ({
      id: `building-${index}-${Math.round(b.position[0])}-${Math.round(b.position[2])}`,
      type: 'building',
      x: b.position[0],
      z: b.position[2],
      halfX: b.scale[0] / 2,
      halfZ: b.scale[2] / 2,
      radius: Math.sqrt(b.scale[0] ** 2 + b.scale[2] ** 2) / 2 + 2,
    }))
    const dObstacles = debris.map((d, index) => ({
      id: `debris-${index}-${Math.round(d.position[0])}-${Math.round(d.position[2])}`,
      type: 'debris',
      x: d.position[0],
      z: d.position[2],
      radius: 2 + (d.scale || 1),
    }))
    useSimStore.getState().setObstacles([...bObstacles, ...dObstacles])
  }, [buildings, debris])

  return (
    <group>
      {/* Seabed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color={isDark ? '#050a14' : '#14213d'}
          roughness={1}
          roughnessMap={getProceduralTexture('dirt')}
          bumpMap={getProceduralTexture('bump')}
          bumpScale={0.1}
        />
      </mesh>

      {/* Layered Water Effect */}
      <Water level={waterLevel} />
      <Water level={waterLevel - 0.5} />

      {/* Underwater "ground" haze patches */}
      {Array.from({ length: 20 }).map((_, i) => (
        <mesh key={`uw-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[(seededRandom(i) - 0.5) * 400, 0.1, (seededRandom(i + 1) - 0.5) * 400]}>
          <circleGeometry args={[20 + seededRandom(i + 2) * 20, 16]} />
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
              map={getBuildingTexture(512, 512, isDark)}
              roughness={0.7}
              metalness={0.2}
              bumpMap={getProceduralTexture('bump')}
              bumpScale={0.05}
            />
          </mesh>
          {/* Submersion Mark line */}
          <mesh position={[0, -b.scale[1] / 2 + waterLevel, 0]}>
            <boxGeometry args={[b.scale[0] + 0.1, 0.1, b.scale[2] + 0.1]} />
            <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={2} transparent opacity={0.5} />
          </mesh>

          {/* Windows */}
          {b.height > 12 && (
            <mesh position={[0, b.height / 6, b.scale[2] / 2 + 0.1]}>
              <planeGeometry args={[b.scale[0] * 0.7, b.height * 0.5]} />
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
  const geoRef = useRef()

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (waterRef.current) {
      waterRef.current.position.y = level + Math.sin(t * 0.4) * 0.15
      waterRef.current.rotation.x = -Math.PI / 2 + Math.sin(t * 0.2) * 0.005
    }
    if (geoRef.current) {
      const posAttribute = geoRef.current.attributes.position
      const v = new THREE.Vector3()
      for (let i = 0; i < posAttribute.count; i++) {
        v.fromBufferAttribute(posAttribute, i)
        // Turbulent muddy surface
        v.z = (Math.sin(v.x * 0.15 + t * 1.5) + Math.cos(v.y * 0.15 + t * 1.5)) * 0.6
        posAttribute.setZ(i, v.z)
      }
      posAttribute.needsUpdate = true
    }
  })

  return (
    <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, level, 0]} receiveShadow>
      <planeGeometry ref={geoRef} args={[1000, 1000, 48, 48]} />
      <meshStandardMaterial
        color="#4a3f35" // Muted silt/mud
        transparent
        opacity={0.9}
        roughness={0.8}
        metalness={0.1}
        roughnessMap={getProceduralTexture('bump')}
        bumpMap={getProceduralTexture('bump')}
        bumpScale={0.05}
      />
    </mesh>
  )
}

function RainSystem({ count = 2000, area = [300, 150, 300] }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  
  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => ({
      x: (Math.random() - 0.5) * area[0],
      y: Math.random() * area[1],
      z: (Math.random() - 0.5) * area[2],
      speed: 1.5 + Math.random() * 1.5,
    }))
  }, [count, area])

  useFrame((state) => {
    particles.forEach((p, i) => {
      p.y -= p.speed
      p.x -= p.speed * 0.2 // wind slant
      if (p.y < 0) {
        p.y = area[1]
        p.x = (Math.random() - 0.5) * area[0]
      }
      dummy.position.set(p.x, p.y, p.z)
      // Slant the rain based on wind
      dummy.rotation.z = Math.PI / 12
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <cylinderGeometry args={[0.02, 0.02, 1.5, 3]} />
      <meshBasicMaterial color="#7a9bbc" transparent opacity={0.4} />
    </instancedMesh>
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
            sandbags.push({ position: [x + w / 2 + 2, 0, z], rotation: [0, Math.PI / 2, 0] })
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

  useEffect(() => {
    const bObstacles = buildings.map((b, index) => ({
      id: `building-${index}-${Math.round(b.position[0])}-${Math.round(b.position[2])}`,
      type: 'building',
      x: b.position[0],
      z: b.position[2],
      halfX: b.scale[0] / 2,
      halfZ: b.scale[2] / 2,
      radius: Math.sqrt(b.scale[0] ** 2 + b.scale[2] ** 2) / 2 + 2,
    }))
    const jObstacles = junk.map((j, index) => ({
      id: `vehicle-${index}-${Math.round(j.position[0])}-${Math.round(j.position[2])}`,
      type: j.type || 'debris',
      x: j.position[0],
      z: j.position[2],
      radius: 4,
    }))
    const tObstacles = nature.map((n, index) => ({
      id: `tree-${index}-${Math.round(n.position[0])}-${Math.round(n.position[2])}`,
      type: 'tree',
      x: n.position[0],
      z: n.position[2],
      radius: 4,
    }))
    useSimStore.getState().setObstacles([...bObstacles, ...jObstacles, ...tObstacles])
  }, [buildings, junk, nature])

  return (
    <group>
      <RainSystem count={1600} area={[400, 150, 400]} />
      {/* Ground (Mud) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1000, 1000]} />
        <meshStandardMaterial
          color={isDark ? '#1a1410' : '#2d241c'}
          roughness={1}
          roughnessMap={getProceduralTexture('dirt')}
          bumpMap={getProceduralTexture('bump')}
          bumpScale={0.1}
        />
      </mesh>

      {/* Flood Water */}
      <MuddyWater level={waterLevel} />
      <MuddyWater level={waterLevel - 0.2} />

      {/* Buildings */}
      {buildings.map((b, i) => (
        <mesh key={`fb-${i}`} position={b.position} castShadow receiveShadow>
          <boxGeometry args={b.scale} />
          <meshStandardMaterial 
            color={b.color}
            map={getBuildingTexture(512, 512, isDark)}
            roughness={0.8} 
            bumpMap={getProceduralTexture('bump')}
            bumpScale={0.05}
          />
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

export default React.memo(function Terrain({ scenario }) {
  switch (scenario) {
    case 'earthquake': return <EarthquakeTerrain />
    case 'tsunami': return <TsunamiTerrain />
    case 'flood': return <FloodTerrain />
    default: return <EarthquakeTerrain />
  }
})
