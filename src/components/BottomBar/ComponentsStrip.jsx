import React from 'react';
import {
  IconGPS, IconIMU, IconThermal, IconLidar,
  IconAltitude, IconSmoke, IconBattery, IconCamera,
  ThermalCameraGraphic,
} from '../Common/Icons';
import './ComponentsStrip.css';

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

const LEGEND = [
  { status: 'active', label: 'ACTIVE', color: '#8ACBD2' },
  { status: 'idle', label: 'IDLE', color: '#7E8F94' },
  { status: 'warning', label: 'WARNING', color: '#E5B842' },
  { status: 'error', label: 'ERROR', color: '#D95858' },
];

export default function ComponentsStrip({ sensors, selectedSensor, onSensorSelect }) {
  return (
    <div className="components-strip">
      {/* Header with Title & Legend */}
      <div className="components-strip__header">
        <h3 className="components-strip__title">COMPONENTS & SENSORS</h3>

        <div className="components-strip__legend">
          {LEGEND.map(item => (
            <div key={item.status} className="components-strip__legend-item">
              <span className="components-strip__legend-dot" style={{ background: item.color }} />
              <span className="components-strip__legend-label">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row of 8 Component Cards */}
      <div className="components-strip__cards">
        {sensors.map(sensor => {
          const SIcon = SENSOR_ICONS[sensor.id] || IconGPS;
          const isActive = selectedSensor?.id === sensor.id;
          return (
            <button
              key={sensor.id}
              className={`components-strip__card ${isActive ? 'components-strip__card--active' : ''}`}
              onClick={() => onSensorSelect(sensor.id)}
            >
              {/* Card top right status dot */}
              <span className={`components-strip__card-dot components-strip__card-dot--${sensor.status}`} />

              {/* Graphic Icon */}
              <div className="components-strip__icon-wrap">
                {sensor.id === 'thermal' ? (
                  <ThermalCameraGraphic size={48} />
                ) : (
                  <SIcon size={26} />
                )}
              </div>

              {/* Component Label */}
              <span className="components-strip__card-name">{sensor.name}</span>

              {/* Status and Telemetry */}
              <div className="components-strip__status-row">
                <span className="components-strip__status-text">{sensor.status}</span>
                {sensor.id === 'battery' && (
                  <span className="components-strip__battery-val">82%</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
