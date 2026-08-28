import React from 'react';
import { Html } from '@react-three/drei';
import {
  IconGPS, IconIMU, IconThermal, IconLidar,
  IconAltitude, IconSmoke, IconBattery, IconCamera
} from '../Common/Icons';

const SENSOR_ICONS = {
  gps: IconGPS,
  imu: IconIMU,
  thermal: IconThermal,
  lidar: IconLidar,
  altitude: IconAltitude,
  smoke: IconSmoke,
  battery: IconBattery,
  camera: IconCamera,
};

export default function SensorHotspot({ position, name, sensor, isActive, onClick }) {
  const sensorId = sensor?.id || 'gps';
  const IconComponent = SENSOR_ICONS[sensorId] || IconGPS;
  const liveVal = sensor?.liveReading?.value || '';
  const liveUnit = sensor?.liveReading?.unit || '';

  return (
    <group position={position}>
      {/* 3D Hotspot HTML Callout Marker - Fixed 2D Screen-space Projection (No huge zoom blowout) */}
      <Html
        center
        zIndexRange={[100, 0]}
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
          cursor: 'pointer',
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            transform: 'translateY(-10px)',
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Active / Focused Sensor Callout Card */}
          {isActive ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(235, 243, 245, 0.96)',
                backdropFilter: 'blur(10px)',
                border: '1.5px solid #2D636B',
                borderRadius: '6px',
                padding: '4px 8px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.18), 0 0 10px rgba(121, 185, 193, 0.5)',
                marginBottom: '4px',
                whiteSpace: 'nowrap',
                fontSize: '10px',
              }}
            >
              {/* Sensor Icon */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '4px',
                  background: '#B9DCE1',
                  border: '1px solid #8FC4CC',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#172124',
                  flexShrink: 0,
                }}
              >
                <IconComponent size={11} />
              </div>

              {/* Sensor Title & Live Value */}
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '9px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: '#172124',
                    textTransform: 'uppercase',
                  }}
                >
                  {name}
                </span>
                <span
                  style={{
                    fontFamily: 'Space Grotesk, monospace',
                    fontSize: '8.5px',
                    fontWeight: 700,
                    color: '#1E6B75',
                  }}
                >
                  {liveVal} {liveUnit}
                </span>
              </div>

              {/* Glowing Pulse Dot */}
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#3BAAB6',
                  boxShadow: '0 0 6px #3BAAB6',
                  marginLeft: '2px',
                }}
              />
            </div>
          ) : (
            /* Idle Sensor Micro-Badge */
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(255, 255, 255, 0.90)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(0, 0, 0, 0.14)',
                borderRadius: '12px',
                padding: '2px 6px 2px 4px',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08), inset 0 1px 0 #FFFFFF',
                marginBottom: '3px',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#79B9C1';
                e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.90)';
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.14)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08), inset 0 1px 0 #FFFFFF';
              }}
            >
              {/* Micro Icon */}
              <div
                style={{
                  width: '13px',
                  height: '13px',
                  borderRadius: '50%',
                  background: '#E8F5F7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2D636B',
                }}
              >
                <IconComponent size={8} />
              </div>

              {/* Compact Name */}
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '8px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#2E3E42',
                  textTransform: 'uppercase',
                }}
              >
                {sensor?.shortName || name}
              </span>
            </div>
          )}

          {/* Precision Center Dot Beacon */}
          <div
            style={{
              width: isActive ? '8px' : '5px',
              height: isActive ? '8px' : '5px',
              borderRadius: '50%',
              background: isActive ? '#3BAAB6' : '#79B9C1',
              border: '1px solid #FFFFFF',
              boxShadow: isActive ? '0 0 8px #3BAAB6' : '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'all 0.2s ease',
            }}
          />
        </div>
      </Html>
    </group>
  );
}
