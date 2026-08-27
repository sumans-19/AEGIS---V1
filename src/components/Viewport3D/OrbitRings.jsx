import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function OrbitRings() {
  const outerRotRef = useRef();
  const innerRotRef = useRef();
  const pulseRef = useRef();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (outerRotRef.current) outerRotRef.current.rotation.z = t * 0.04;
    if (innerRotRef.current) innerRotRef.current.rotation.z = -t * 0.06;
    // Pulse the scanner ring opacity
    if (pulseRef.current) {
      pulseRef.current.material.opacity = 0.12 + Math.sin(t * 1.5) * 0.06;
    }
  });

  const rings = useMemo(() => [
    { radius: 1.6, opacity: 0.22, width: 0.008 },
    { radius: 2.4, opacity: 0.16, width: 0.007 },
    { radius: 3.2, opacity: 0.12, width: 0.006 },
    { radius: 4.0, opacity: 0.08, width: 0.005 },
    { radius: 4.8, opacity: 0.05, width: 0.004 },
  ], []);

  return (
    <group position={[0, -0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>

      {/* Static Concentric Rings */}
      {rings.map((ring, idx) => (
        <mesh key={`ring-${idx}`}>
          <ringGeometry args={[ring.radius - ring.width, ring.radius + ring.width, 128]} />
          <meshBasicMaterial color="#79B9C1" transparent opacity={ring.opacity} />
        </mesh>
      ))}

      {/* Cross-Hair Lines (N-S-E-W Axes) */}
      {[0, Math.PI / 2].map((rot, i) => (
        <mesh key={`crosshair-${i}`} rotation={[0, 0, rot]}>
          <planeGeometry args={[0.003, 9.6]} />
          <meshBasicMaterial color="#79B9C1" transparent opacity={0.06} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Diagonal Cross-Hair Lines (45° Axes) */}
      {[Math.PI / 4, -Math.PI / 4].map((rot, i) => (
        <mesh key={`diag-${i}`} rotation={[0, 0, rot]}>
          <planeGeometry args={[0.002, 9.6]} />
          <meshBasicMaterial color="#79B9C1" transparent opacity={0.04} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Outer Rotating Dotted Ring (64 dots) */}
      <group ref={outerRotRef}>
        {Array.from({ length: 64 }).map((_, i) => {
          const angle = (i / 64) * Math.PI * 2;
          const r = 3.2;
          return (
            <mesh key={`odot-${i}`} position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]}>
              <circleGeometry args={[0.018, 8]} />
              <meshBasicMaterial color="#79B9C1" transparent opacity={i % 2 === 0 ? 0.28 : 0.14} />
            </mesh>
          );
        })}
      </group>

      {/* Inner Rotating Tick Marks Ring (32 ticks) */}
      <group ref={innerRotRef}>
        {Array.from({ length: 32 }).map((_, i) => {
          const angle = (i / 32) * Math.PI * 2;
          const r = 2.4;
          const isLong = i % 4 === 0;
          return (
            <mesh
              key={`tick-${i}`}
              position={[Math.cos(angle) * r, Math.sin(angle) * r, 0]}
              rotation={[0, 0, angle + Math.PI / 2]}
            >
              <planeGeometry args={[isLong ? 0.16 : 0.08, 0.004]} />
              <meshBasicMaterial color="#79B9C1" transparent opacity={isLong ? 0.22 : 0.12} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>

      {/* Pulsing Scanner Ring */}
      <mesh ref={pulseRef}>
        <ringGeometry args={[2.38, 2.42, 128]} />
        <meshBasicMaterial color="#8ACBD2" transparent opacity={0.12} />
      </mesh>

      {/* Cardinal Direction Labels (N, E, S, W markers) */}
      {[
        { label: 'N', angle: Math.PI / 2, r: 4.4 },
        { label: 'E', angle: 0, r: 4.4 },
        { label: 'S', angle: -Math.PI / 2, r: 4.4 },
        { label: 'W', angle: Math.PI, r: 4.4 },
      ].map((dir) => (
        <mesh
          key={dir.label}
          position={[Math.cos(dir.angle) * dir.r, Math.sin(dir.angle) * dir.r, 0]}
        >
          <circleGeometry args={[0.04, 12]} />
          <meshBasicMaterial color="#79B9C1" transparent opacity={0.20} />
        </mesh>
      ))}

      {/* Center Target Dot */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[0.05, 16]} />
        <meshBasicMaterial color="#79B9C1" transparent opacity={0.18} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <ringGeometry args={[0.04, 0.06, 16]} />
        <meshBasicMaterial color="#79B9C1" transparent opacity={0.25} />
      </mesh>

    </group>
  );
}
