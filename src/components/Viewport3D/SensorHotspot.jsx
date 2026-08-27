import React, { useRef } from 'react';
import { Html } from '@react-three/drei';

export default function SensorHotspot({ position, name, isActive, onClick, showLabels }) {
  const meshRef = useRef();

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* 3D Hotspot Button rendered as precise SVG overlay in 3D space */}
      <Html center distanceFactor={7} style={{ pointerEvents: 'auto', userSelect: 'none' }}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Outer glowing pulsing ring */}
          <div
            style={{
              position: 'absolute',
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: `1.5px solid ${isActive ? '#79B9C1' : 'rgba(121, 185, 193, 0.7)'}`,
              background: isActive ? 'rgba(121, 185, 193, 0.25)' : 'rgba(255, 255, 255, 0.5)',
              backdropFilter: 'blur(4px)',
              boxShadow: isActive ? '0 0 10px rgba(121, 185, 193, 0.6)' : '0 0 4px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Center '+' symbol */}
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                fontWeight: 700,
                color: isActive ? '#172124' : '#2A3A3D',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              +
            </span>
          </div>

          {/* Optional Label Tag */}
          {showLabels && isActive && (
            <div
              style={{
                position: 'absolute',
                top: -24,
                background: '#20272B',
                border: '1px solid #79B9C1',
                borderRadius: '4px',
                padding: '2px 6px',
                whiteSpace: 'nowrap',
                fontFamily: 'Inter, sans-serif',
                fontSize: '8px',
                fontWeight: 700,
                color: '#79B9C1',
                letterSpacing: '0.06em',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
              }}
            >
              {name}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
