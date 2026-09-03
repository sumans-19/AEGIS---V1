import React, { useMemo, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'


const WORLD_HALF = 220
const TERRAIN_SEGMENTS = 96
const SEED = 42

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash2(ix, iz) {
  const n = Math.sin(ix * 127.1 + iz * 311.7 + SEED) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x, z) {
  const x0 = Math.floor(x)
  const z0 = Math.floor(z)
  const fx = x - x0
  const fz = z - z0
  const sx = fx * fx * (3 - 2 * fx)
  const sz = fz * fz * (3 - 2 * fz)
  const a = hash2(x0, z0)
  const b = hash2(x0 + 1, z0)
  const c = hash2(x0, z0 + 1)
  const d = hash2(x0 + 1, z0 + 1)
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
}

function fbm(x, z, octaves = 4) {
  let v = 0
  let amp = 1
  let freq = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, z * freq) * amp
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return v / norm
}

/** Gentle elevation in metres (Y). */
export function getForestHeight(x, z) {
  const n = fbm(x * 0.012, z * 0.012, 5)
  const ridge = fbm(x * 0.006 + 20, z * 0.006 - 10, 3)
  return (n - 0.45) * 9 + (ridge - 0.5) * 4
}

export function streamXAt(z) {
  return Math.sin(z * 0.018) * 28 + Math.sin(z * 0.041 + 1.2) * 12 - 15
}

export function distToStream(x, z) {
  return Math.abs(x - streamXAt(z))
}

function trailFactor(x, z) {
  const t1 = Math.abs((x + z * 0.35 + 40) / 1.05) % 55
  const d1 = Math.min(t1, 55 - t1)
  const d2 = Math.abs(z + 90)
  const d3 = Math.abs(x + 160) + Math.abs(z + 160) * 0.15
  let f = 0
  if (d1 < 4) f = Math.max(f, 1 - d1 / 4)
  if (d2 < 3.5 && x > -40 && x < 100) f = Math.max(f, 1 - d2 / 3.5)
  if (d3 < 8) f = Math.max(f, 1 - d3 / 8)
  return f
}

const CLEARINGS = [
  { x: 30, z: -40, r: 28 },
  { x: -70, z: 50, r: 22 },
  { x: 90, z: 80, r: 20 },
  { x: -40, z: -100, r: 18 },
  { x: 0, z: 0, r: 16 },
]

function clearingFactor(x, z) {
  let best = 0
  for (const c of CLEARINGS) {
    const d = Math.hypot(x - c.x, z - c.z)
    if (d < c.r) best = Math.max(best, 1 - d / c.r)
  }
  return best
}

/** Vegetation density 0..1 for placement and future search planning. */
export function getForestDensity(x, z) {
  const stream = distToStream(x, z)
  if (stream < 6) return 0
  if (stream < 11) return 0.08 * ((stream - 6) / 5)

  const clear = clearingFactor(x, z)
  const trail = trailFactor(x, z)
  const open = Math.max(clear, trail)
  if (open > 0.55) return 0.05 * (1 - open)

  const base = fbm(x * 0.025 + 3, z * 0.025 - 7, 4)
  let d = 0.25 + base * 0.75
  d *= 1 - open * 0.85
  if (stream < 18) d *= 0.35 + 0.65 * ((stream - 11) / 7)
  return Math.max(0, Math.min(1, d))
}

function densityBand(d) {
  if (d < 0.28) return 'low'
  if (d < 0.55) return 'medium'
  return 'high'
}

function createGrassTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    img.data[i] = 55 + n * 40
    img.data[i + 1] = 90 + n * 50
    img.data[i + 2] = 40 + n * 25
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  for (let k = 0; k < 80; k++) {
    const px = Math.random() * size
    const py = Math.random() * size
    ctx.fillStyle = 'rgba(40,70,30,' + (0.15 + Math.random() * 0.2) + ')'
    ctx.beginPath()
    ctx.ellipse(px, py, 8 + Math.random() * 20, 6 + Math.random() * 14, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(40, 40)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createDirtTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    img.data[i] = 95 + n * 45
    img.data[i + 1] = 75 + n * 35
    img.data[i + 2] = 45 + n * 25
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 8)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function ForestGround() {
  const theme = useSimStore((s) => s.theme)
  const isDark = theme === 'dark'

  const { geometry, grassMap, dirtMap } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      WORLD_HALF * 2,
      WORLD_HALF * 2,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS
    )
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      let y = getForestHeight(x, z)
      const sd = distToStream(x, z)
      if (sd < 8) y -= (1 - sd / 8) * 1.4
      pos.setY(i, y)
    }
    geo.computeVertexNormals()
    return {
      geometry: geo,
      grassMap: createGrassTexture(),
      dirtMap: createDirtTexture(),
    }
  }, [])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          color={isDark ? '#2a3d28' : '#4a6b3e'}
          map={grassMap}
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      <TrailMeshes dirtMap={dirtMap} isDark={isDark} />
    </group>
  )
}

function TrailMeshes({ dirtMap, isDark }) {
  const trailGeo = useMemo(() => {
    const pts = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      pts.push([-180 + t * 320, -160 + t * 280])
    }
    return pts
  }, [])

  return (
    <group>
      {trailGeo.map(([x, z], i) => (
        <mesh
          key={'trail-' + i}
          position={[x, getForestHeight(x, z) + 0.05, z]}
          rotation={[-Math.PI / 2, 0, Math.atan2(1, 0.9)]}
          receiveShadow
        >
          <planeGeometry args={[5.5, 9]} />
          <meshStandardMaterial
            color={isDark ? '#3a2e22' : '#8a7355'}
            map={dirtMap}
            roughness={1}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  )
}

function ForestStream() {
  const segments = useMemo(() => {
    const list = []
    for (let i = 0; i <= 48; i++) {
      const z = -WORLD_HALF + (i / 48) * WORLD_HALF * 2
      const x = streamXAt(z)
      const y = getForestHeight(x, z) - 0.55
      const nextZ = -WORLD_HALF + ((i + 1) / 48) * WORLD_HALF * 2
      const nextX = streamXAt(nextZ)
      list.push({ x, y, z, angle: Math.atan2(nextX - x, nextZ - z) })
    }
    return list
  }, [])

  return (
    <group>
      {segments.map((s, i) => (
        <mesh
          key={'stream-' + i}
          position={[s.x, s.y, s.z]}
          rotation={[-Math.PI / 2, 0, s.angle]}
          receiveShadow
        >
          <planeGeometry args={[7.5, 12]} />
          <meshStandardMaterial
            color="#3a7a8c"
            roughness={0.15}
            metalness={0.35}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
    </group>
  )
}

function generateForestLayout(rng) {
  const trees = []
  const bushes = []
  const rocks = []
  const grass = []
  // Reduce grid step to increase sampling density but keep randomized placement
  const step = 6

  for (let gx = -WORLD_HALF + 8; gx < WORLD_HALF - 8; gx += step) {
    for (let gz = -WORLD_HALF + 8; gz < WORLD_HALF - 8; gz += step) {
      const x = gx + (rng() - 0.5) * step * 0.9
      const z = gz + (rng() - 0.5) * step * 0.9
      const dens = getForestDensity(x, z)
      const band = densityBand(dens)
      const y = getForestHeight(x, z)

      // Increase base tree chance significantly for denser forest
      let treeChance = 0.18
      if (band === 'medium') treeChance = 0.6
      if (band === 'high') treeChance = 0.9

      // Allow some trees in lower-density patches to increase understory and fill small gaps
      const allowLowDensity = dens > 0.06 && rng() < 0.12

      if ((dens > 0.08 && rng() < treeChance) || allowLowDensity) {
        // Height distribution: mix of small, medium, tall, very tall
        const r = rng()
        let h
        if (r < 0.12) h = 3 + rng() * 4 // small
        else if (r < 0.55) h = 7 + rng() * 6 // medium
        else if (r < 0.88) h = 14 + rng() * 8 // tall
        else h = 22 + rng() * 12 // very tall

        const trunkR = 0.14 + rng() * 0.42
        const canopyR = Math.max(1.0, h * 0.25 + rng() * (h * 0.2))

        trees.push({
          x, y, z,
          h,
          trunkR,
          canopyR,
          rot: rng() * Math.PI * 2,
          lean: (rng() - 0.5) * 0.14,
        })
      }

      // Increase undergrowth and shrubs for dense understory
      if (dens > 0.03 && dens < 0.95 && rng() < 0.32 + dens * 0.25) {
        bushes.push({
          x: x + (rng() - 0.5) * 3,
          y,
          z: z + (rng() - 0.5) * 3,
          s: 0.6 + rng() * 1.4,
          rot: rng() * Math.PI * 2,
        })
      }

      if (rng() < 0.06 + (1 - dens) * 0.05) {
        rocks.push({
          x: x + (rng() - 0.5) * 4,
          y,
          z: z + (rng() - 0.5) * 4,
          sx: 0.4 + rng() * 1.2,
          sy: 0.25 + rng() * 0.7,
          sz: 0.4 + rng() * 1.1,
          rot: rng() * Math.PI * 2,
        })
      }

      // Increase grass as ground cover in sparser pockets; reduce where very dense canopy exists
      if (dens < 0.55 && rng() < 0.48) {
        grass.push({
          x: x + (rng() - 0.5) * 5,
          y,
          z: z + (rng() - 0.5) * 5,
          s: 0.4 + rng() * 0.8,
          rot: rng() * Math.PI * 2,
        })
      }
    }
  }

  for (const c of CLEARINGS) {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2
      const r = rng() * c.r * 0.85
      const x = c.x + Math.cos(a) * r
      const z = c.z + Math.sin(a) * r
      grass.push({
        x,
        y: getForestHeight(x, z),
        z,
        s: 0.5 + rng() * 1.0,
        rot: rng() * Math.PI * 2,
      })
    }
  }

  // Additional clustering pass: select seed points and add local clusters of trees
  const clusterCount = 160
  for (let ci = 0; ci < clusterCount; ci++) {
    const cx = -WORLD_HALF + rng() * (WORLD_HALF * 2)
    const cz = -WORLD_HALF + rng() * (WORLD_HALF * 2)
    const cd = getForestDensity(cx, cz)
    if (cd < 0.06) continue
    const seeds = 3 + Math.floor(rng() * 6)
    for (let s = 0; s < seeds; s++) {
      const angle = rng() * Math.PI * 2
      const radius = 1 + rng() * 6
      const x = cx + Math.cos(angle) * radius
      const z = cz + Math.sin(angle) * radius
      if (distToStream(x, z) < 6) continue
      const y = getForestHeight(x, z)
      const r = rng()
      let h
      if (r < 0.2) h = 4 + rng() * 5
      else if (r < 0.7) h = 9 + rng() * 7
      else h = 16 + rng() * 12
      trees.push({ x, y, z, h, trunkR: 0.12 + rng() * 0.42, canopyR: Math.max(1.0, h * 0.28 + rng() * (h * 0.18)), rot: rng() * Math.PI * 2, lean: (rng() - 0.5) * 0.14 })
    }
  }

  return { trees, bushes, rocks, grass }
}

function InstancedTrees({ trees }) {
  const trunkRef = useRef()
  const canopyRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!trunkRef.current || !canopyRef.current) return
    trees.forEach((t, i) => {
      dummy.position.set(t.x, t.y + t.h * 0.45, t.z)
      dummy.rotation.set(t.lean, t.rot, t.lean * 0.5)
      dummy.scale.set(t.trunkR / 0.25, t.h / 8, t.trunkR / 0.25)
      dummy.updateMatrix()
      trunkRef.current.setMatrixAt(i, dummy.matrix)

      dummy.position.set(t.x, t.y + t.h * 0.85, t.z)
      dummy.rotation.set(t.lean * 0.5, t.rot * 1.3, 0)
      dummy.scale.set(t.canopyR / 2, t.canopyR / 2.2, t.canopyR / 2)
      dummy.updateMatrix()
      canopyRef.current.setMatrixAt(i, dummy.matrix)
    })
    trunkRef.current.instanceMatrix.needsUpdate = true
    canopyRef.current.instanceMatrix.needsUpdate = true
  }, [trees, dummy])

  if (trees.length === 0) return null

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[null, null, trees.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.25, 0.32, 8, 6]} />
        <meshStandardMaterial color="#4a3728" roughness={0.92} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[null, null, trees.length]} castShadow>
        <coneGeometry args={[2, 4.5, 7]} />
        <meshStandardMaterial color="#2d5a32" roughness={0.85} />
      </instancedMesh>
    </group>
  )
}

function InstancedBushes({ bushes }) {
  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!ref.current) return
    bushes.forEach((b, i) => {
      dummy.position.set(b.x, b.y + b.s * 0.45, b.z)
      dummy.rotation.set(0, b.rot, 0)
      dummy.scale.set(b.s, b.s * 0.7, b.s)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [bushes, dummy])

  if (bushes.length === 0) return null

  return (
    <instancedMesh ref={ref} args={[null, null, bushes.length]} castShadow>
      <sphereGeometry args={[0.9, 6, 5]} />
      <meshStandardMaterial color="#3d6b38" roughness={0.9} />
    </instancedMesh>
  )
}

function InstancedRocks({ rocks }) {
  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!ref.current) return
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y + r.sy * 0.4, r.z)
      dummy.rotation.set(r.rot * 0.3, r.rot, r.rot * 0.2)
      dummy.scale.set(r.sx, r.sy, r.sz)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [rocks, dummy])

  if (rocks.length === 0) return null

  return (
    <instancedMesh ref={ref} args={[null, null, rocks.length]} castShadow receiveShadow>
      <dodecahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#6a6560" roughness={0.95} />
    </instancedMesh>
  )
}

function InstancedGrass({ grass }) {
  const ref = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  useLayoutEffect(() => {
    if (!ref.current) return
    grass.forEach((g, i) => {
      dummy.position.set(g.x, g.y + g.s * 0.35, g.z)
      dummy.rotation.set(0, g.rot, 0)
      dummy.scale.set(g.s * 0.35, g.s, g.s * 0.35)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [grass, dummy])

  if (grass.length === 0) return null

  return (
    <instancedMesh ref={ref} args={[null, null, grass.length]}>
      <coneGeometry args={[0.35, 1.2, 4]} />
      <meshStandardMaterial color="#5a8f45" roughness={1} />
    </instancedMesh>
  )
}

export default function DenseForestTerrain() {
  const layout = useMemo(() => generateForestLayout(mulberry32(SEED * 9973)), [])

  return (
    <group>
      <ForestGround />
      <ForestStream />
      <InstancedTrees trees={layout.trees} />
      <InstancedBushes bushes={layout.bushes} />
      <InstancedRocks rocks={layout.rocks} />
      <InstancedGrass grass={layout.grass} />
    </group>
  )
}
