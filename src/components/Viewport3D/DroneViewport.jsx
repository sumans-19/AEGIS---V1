import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import DroneModel from './DroneModel';
import SensorHotspot from './SensorHotspot';
import OrbitRings from './OrbitRings';
import { IconInfo } from '../Common/Icons';
import './DroneViewport.css';

// Hotspot placements corresponding to physical components on the drone
const HOTSPOTS = [
  { id: 'gps',          name: 'GPS MODULE',      position: [ 0.0,  0.60, -0.15] },
  { id: 'imu',          name: 'IMU SENSOR',      position: [ 0.0,  0.46,  0.10] },
  { id: 'thermal',      name: 'THERMAL CAMERA',  position: [ 0.0, -0.24,  0.84] },
  { id: 'lidar',        name: 'OBSTACLE LIDAR',  position: [ 0.0,  0.16,  0.98] },
  { id: 'altitude',     name: 'ALTITUDE SENSOR', position: [ 0.0, -0.22,  0.00] },
  { id: 'smoke',        name: 'SMOKE SENSOR',    position: [ 0.42, 0.28,  0.38] },
  { id: 'battery',      name: 'BATTERY PACK',    position: [ 0.0,  0.46, -0.48] },
  { id: 'camera',       name: 'FPV CAMERA',      position: [ 0.0, -0.06,  1.04] },
];

// Play/Pause SVG Icons
function IconPlay({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

export default function DroneViewport({
  sensors,
  selectedSensor,
  onSensorSelect,
  wireframe,
  xrayView,
  showSensorZones,
  showLabels,
  controlsRef,
}) {
  const [activeSegment, setActiveSegment] = useState('EXPLORE');
  const [propellersRunning, setPropellersRunning] = useState(true);

  const handleControlsRef = useCallback((ref) => {
    if (ref && controlsRef) {
      controlsRef.current = ref;
    }
  }, [controlsRef]);

  const togglePropellers = useCallback(() => {
    setPropellersRunning(prev => !prev);
  }, []);

  return (
    <div className="drone-viewport">
      {/* Instruction tooltip with descending vertical guide line */}
      <div className="drone-viewport__instruction-container">
        <div className="drone-viewport__tooltip">
          <IconInfo size={14} />
          <span>Click on a component to view details</span>
        </div>
        <div className="drone-viewport__guide-line" />
      </div>

      {/* Propeller Play/Pause Toggle Button */}
      <button
        className={`drone-viewport__prop-toggle ${propellersRunning ? 'drone-viewport__prop-toggle--running' : ''}`}
        onClick={togglePropellers}
        title={propellersRunning ? 'Pause Propellers' : 'Start Propellers'}
      >
        <span className="drone-viewport__prop-toggle-icon">
          {propellersRunning ? <IconPause size={14} /> : <IconPlay size={14} />}
        </span>
        <span className="drone-viewport__prop-toggle-label">
          {propellersRunning ? 'MOTORS ON' : 'MOTORS OFF'}
        </span>
        <span className={`drone-viewport__prop-toggle-dot ${propellersRunning ? 'drone-viewport__prop-toggle-dot--on' : ''}`} />
      </button>

      {/* 3D Canvas Scene */}
      <Canvas
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [2.5, 2.0, 3.2], fov: 44 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false }}
        onPointerMissed={() => onSensorSelect && onSensorSelect(null)}
      >
        {/* Studio lighting — soft product render appearance matching reference */}
        <ambientLight intensity={0.75} color="#EEF4F6" />
        {/* Main key light upper-right front */}
        <directionalLight position={[5, 10, 6]} intensity={1.6} color="#FFFFFF" castShadow />
        {/* Soft teal fill from left */}
        <directionalLight position={[-6, 3, 2]} intensity={0.35} color="#C8EFF4" />
        {/* Back rim light */}
        <directionalLight position={[0, 4, -8]} intensity={0.22} color="#D0E8EC" />
        {/* Subtle under fill */}
        <directionalLight position={[0, -4, 4]} intensity={0.12} color="#E2F0F2" />

        <group position={[0, 0, 0]}>
          <DroneModel wireframe={wireframe} xray={xrayView} propellersRunning={propellersRunning} />

          {showSensorZones && HOTSPOTS.map(spot => {
            const matchedSensor = sensors.find(s => s.id === spot.id) || sensors[2];
            const isSelected = selectedSensor?.id === spot.id;
            return (
              <SensorHotspot
                key={spot.id}
                position={spot.position}
                name={spot.name}
                sensor={matchedSensor}
                isActive={isSelected}
                onClick={() => onSensorSelect(matchedSensor.id)}
                showLabels={showLabels}
              />
            );
          })}
        </group>

        {/* Ground Concentric Orbit Rings */}
        <OrbitRings />

        {/* Soft Circular Ground Shadow (No rectangular edges!) */}
        <mesh position={[0, -0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 3.2, 64]} />
          <meshBasicMaterial color="#1C272B" transparent opacity={0.08} />
        </mesh>

        {/* Orbit Controls */}
        <OrbitControls
          ref={handleControlsRef}
          enablePan
          enableZoom
          enableRotate
          minDistance={1.8}
          maxDistance={10}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2 + 0.1}
          dampingFactor={0.06}
          enableDamping
          rotateSpeed={0.55}
          zoomSpeed={0.75}
          target={[0, 0, 0]}
        />
      </Canvas>

      {/* Bottom Segmented Controls: EXPLORE | ANALYZE | DIAGNOSTICS */}
      <div className="drone-viewport__segmented-bar">
        {['EXPLORE', 'ANALYZE', 'DIAGNOSTICS'].map(tab => (
          <button
            key={tab}
            className={`drone-viewport__seg-btn ${activeSegment === tab ? 'drone-viewport__seg-btn--active' : ''}`}
            onClick={() => setActiveSegment(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
