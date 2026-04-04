import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Sky, PerspectiveCamera, Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useSimStore } from '../../store/useSimStore'
import Terrain from './Terrain'
import DroneModel from './DroneModel'
import { Maximize2, Minimize2, PanelRightClose, PanelRightOpen, Target } from 'lucide-react'

function SeedMode({ onSeed }) {
  const { raycaster, mouse, camera } = useThree()
  
  return (
    <mesh 
      rotation={[-Math.PI/2, 0, 0]} 
      position={[0, 0, 0]} 
      visible={true}
      onPointerDown={(e) => {
        if (e.button === 0) { // left click
           onSeed(e.point.x, e.point.z)
        }
      }}
    >
      <planeGeometry args={[500, 500]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function SurvivorFigure({ pos, status, confidence, alive }) {
  const isDead = !alive
  const isRecovering = status === 'RESCUED'
  const isCritical = confidence < 0.3 && !isRecovering
  
  const color = isDead ? '#475569' : (isRecovering ? '#00ff88' : (isCritical ? '#ff6b2b' : '#c4906a'))
  
  return (
    <group position={pos} rotation={isDead ? [Math.PI/2, 0, 0] : [0, 0, 0]}>
      {/* Body: Capsule */}
      <mesh position={[0, 0.8, 0]}>
        <capsuleGeometry args={[0.25, 1.1, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head: Sphere */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

export default function Scene3D() {
  const controlsRef = useRef()
  const drones = useSimStore(s => s.drones)
  const survivors = useSimStore(s => s.survivors)
  const seedSurvivor = useSimStore(s => s.seedSurvivor)
  const scenario = useSimStore(s => s.scenario)
  const theme = useSimStore(s => s.theme)
  const rightPanelExpanded = useSimStore(s => s.rightPanelExpanded)
  const setRightPanelExpanded = useSimStore(s => s.setRightPanelExpanded)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const seedModeActive = useSimStore(s => s.seedModeActive)
  const setSeedModeActive = useSimStore(s => s.setSeedModeActive)

  const handleRecenter = () => {
    if (controlsRef.current) {
      controlsRef.current.reset()
      // Transition back to default home view
      new THREE.Vector3(60, 45, 60)
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas shadows gl={{ antialias: true, logarithmicDepthBuffer: true }}>
        <PerspectiveCamera makeDefault position={[60, 45, 60]} fov={45} />
        <OrbitControls 
          ref={controlsRef}
          maxPolarAngle={Math.PI / 2.1} 
          minDistance={10} 
          maxDistance={300} 
          makeDefault 
        />
        
        {/* Environment */}
        <Sky sunPosition={[100, 20, 100]} />
        <Stars radius={150} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        <ambientLight intensity={theme === 'dark' ? 0.3 : 0.8} />
        <directionalLight 
           position={[10, 20, 10]} 
           intensity={theme === 'dark' ? 0.6 : 1.5} 
           castShadow 
           shadow-mapSize={[2048, 2048]}
        />

        {/* Scene Entities */}
        <Terrain scenario={scenario} />
        
        {drones.map((drone, index) => (
          <DroneModel key={drone.id} drone={drone} index={index} />
        ))}
        
        {survivors.map(survivor => (
          <SurvivorFigure 
            key={survivor.id} 
            pos={survivor.pos} 
            status={survivor.status} 
            confidence={survivor.confidence || 1.0}
            alive={survivor.body_temp > 35}
          />
        ))}

        {/* Interaction */}
        {seedModeActive && <SeedMode onSeed={(x, z) => {
          seedSurvivor(x, z)
          setSeedModeActive(false)
        }} />}
      </Canvas>

      {/* Floating UI Overlay */}
      <div style={{
         position: 'absolute',
         bottom: 24,
         right: 24,
         display: 'flex',
         gap: '12px',
         zIndex: 10,
      }}>
         {selectedDroneId && (
            <button
               onClick={() => setRightPanelExpanded(!rightPanelExpanded)}
               style={floatingBtnStyle}
               title={rightPanelExpanded ? "Show Sidebar" : "Hide Sidebar / Full View"}
            >
               {rightPanelExpanded ? <PanelRightOpen size={20} /> : <PanelRightClose size={20} />}
            </button>
         )}
         
         <button
            onClick={handleRecenter}
            style={floatingBtnStyle}
            title="Recenter Camera"
         >
            <Target size={20} />
         </button>
      </div>

      {seedModeActive && (
         <div style={{
            position: 'absolute',
            top: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--red)',
            padding: '10px 24px',
            borderRadius: '40px',
            fontFamily: 'JetBrains Mono',
            fontSize: '12px',
            color: 'white',
            letterSpacing: '2px',
            boxShadow: '0 0 20px rgba(255,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 20,
         }}>
           SELECT COORDS TO SEED SURVIVOR SIGNATURE
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
