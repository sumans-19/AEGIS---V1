import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'

export default function SurvivorMarker({ survivor }) {
  const ringRef = useRef()
  const [hovered, setHovered] = useState(false)
  const simulationTime = useSimStore(s => s.simulationTime)

  useFrame((state) => {
    if (ringRef.current) {
      const t = state.clock.elapsedTime
      const scale = 1 + Math.sin(t * 3 + survivor.id) * 0.5
      ringRef.current.scale.set(scale, scale, scale)
      ringRef.current.material.opacity = 0.4 - Math.sin(t * 3 + survivor.id) * 0.2
    }
  })

  const timeSinceDetection = Math.max(0, Math.floor(simulationTime - survivor.detectedAt))
  const minutes = Math.floor(timeSinceDetection / 60)
  const seconds = timeSinceDetection % 60

  return (
    <group position={[survivor.position.x, survivor.position.y, survivor.position.z]}>
      {/* Center sphere */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#00ff88" />
      </mesh>

      {/* Pulsing ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Vertical beam */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 10, 4]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.15} />
      </mesh>

      {/* Point light */}
      <pointLight color="#00ff88" intensity={0.5} distance={8} />

      {/* Hover tooltip */}
      {hovered && (
        <Html
          position={[0, 3, 0]}
          center
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            background: 'rgba(10, 10, 15, 0.95)',
            border: '1px solid #00ff8840',
            padding: '12px 16px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            color: '#e2e8f0',
            minWidth: '200px',
            boxShadow: '0 0 12px #00ff8820',
          }}>
            <div style={{ color: '#00ff88', fontWeight: 600, fontSize: '11px', marginBottom: '8px', letterSpacing: '1px' }}>
              ● SURVIVOR DETECTED
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#94a3b8' }}>
              <span>Confidence:</span>
              <span style={{ color: '#00ff88' }}>{survivor.confidence}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#94a3b8' }}>
              <span>Thermal sig:</span>
              <span style={{ color: '#ffb300' }}>{survivor.temperature}°C</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#94a3b8' }}>
              <span>Last ping:</span>
              <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} ago</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#94a3b8' }}>
              <span>Coordinates:</span>
              <span style={{ color: '#00e5ff' }}>{survivor.coordinates.lat}°N {survivor.coordinates.lng}°E</span>
            </div>
          </div>
        </Html>
      )}

      {/* Invisible hover trigger */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}
