import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function Globe() {
  const globeRef = useRef()
  const dotsRef = useRef([])

  useFrame((state) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += 0.002
    }
    dotsRef.current.forEach((dot, i) => {
      if (dot) {
        const t = state.clock.elapsedTime
        const angle = t * 0.3 + (i * Math.PI * 2) / 4
        const orbitRadius = 4.5 + i * 0.3
        dot.position.x = Math.cos(angle) * orbitRadius
        dot.position.z = Math.sin(angle) * orbitRadius
        dot.position.y = Math.sin(angle * 0.5 + i) * 1.5
      }
    })
  })

  const wireframeMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#00e5ff',
    wireframe: true,
    transparent: true,
    opacity: 0.08,
  }), [])

  const solidMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#080c1a',
    transparent: true,
    opacity: 0.4,
  }), [])

  return (
    <group ref={globeRef}>
      {/* Solid globe */}
      <mesh>
        <sphereGeometry args={[3.5, 48, 48]} />
        <primitive object={solidMaterial} />
      </mesh>
      {/* Wireframe overlay */}
      <mesh>
        <sphereGeometry args={[3.52, 32, 32]} />
        <primitive object={wireframeMaterial} />
      </mesh>
      {/* Grid lines - latitude */}
      {[...Array(8)].map((_, i) => {
        const lat = ((i + 1) / 9) * Math.PI - Math.PI / 2
        const radius = Math.cos(lat) * 3.55
        const y = Math.sin(lat) * 3.55
        return (
          <mesh key={`lat-${i}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius - 0.01, radius + 0.01, 64]} />
            <meshBasicMaterial color="#00e5ff" transparent opacity={0.06} />
          </mesh>
        )
      })}

      {/* Orbiting drone dots */}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`dot-${i}`}
          ref={(el) => (dotsRef.current[i] = el)}
          position={[4 + i, 0, 0]}
        >
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#00e5ff" />
          {/* Glow */}
          <pointLight color="#00e5ff" intensity={0.5} distance={3} />
        </mesh>
      ))}
    </group>
  )
}

export default function HeroGlobe() {
  return (
    <Canvas
      camera={{ position: [0, 2, 10], fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.1} color="#1a1a2e" />
      <Globe />
    </Canvas>
  )
}
