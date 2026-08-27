import React from 'react';
import {
  IconClose, IconMonitor, ThermalCameraGraphic,
  IconGPS, IconIMU, IconThermal, IconLidar,
  IconAltitude, IconSmoke, IconBattery, IconCamera,
} from '../Common/Icons';
import MiniChart from '../Common/MiniChart';
import './SensorDetail.css';

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

export default function SensorDetail({ sensor, onClose }) {
  if (!sensor) return null;

  const SensorIcon = SENSOR_ICONS[sensor.id] || IconThermal;

  return (
    <div className="sensor-detail">
      {/* Header with Title & Close */}
      <div className="sensor-detail__header">
        <h3 className="sensor-detail__title">{sensor.name}</h3>
        <button className="sensor-detail__close" onClick={onClose} title="Close">
          <IconClose size={16} />
        </button>
      </div>

      <div className="sensor-detail__content">
        {/* Module Thumbnail & Description */}
        <div className="sensor-detail__module-card">
          <div className="sensor-detail__graphic-box">
            {sensor.id === 'thermal' ? (
              <ThermalCameraGraphic size={56} />
            ) : (
              <div className="sensor-detail__icon-avatar">
                <SensorIcon size={24} />
              </div>
            )}
          </div>
          <p className="sensor-detail__description">{sensor.description}</p>
        </div>

        {/* Status Line */}
        <div className="sensor-detail__row sensor-detail__row--status">
          <span className="sensor-detail__label">STATUS</span>
          <span className="sensor-detail__status-badge">ACTIVE</span>
        </div>

        {/* Live Reading + Sparkline */}
        <div className="sensor-detail__reading-section">
          <span className="sensor-detail__label">LIVE READING</span>
          <div className="sensor-detail__reading-display">
            <div className="sensor-detail__value-group">
              <span className="sensor-detail__value">{sensor.liveReading.value}</span>
              {sensor.liveReading.unit && (
                <span className="sensor-detail__unit">{sensor.liveReading.unit}</span>
              )}
            </div>
            <div className="sensor-detail__sparkline">
              <MiniChart
                data={sensor.history}
                color="#6FAEB6"
                width={100}
                height={36}
              />
            </div>
          </div>
        </div>

        {/* Specifications Table */}
        <div className="sensor-detail__specs-section">
          <span className="sensor-detail__label">SPECIFICATIONS</span>
          <div className="sensor-detail__specs-table">
            {Object.entries(sensor.specs).map(([key, val]) => (
              <div key={key} className="sensor-detail__spec-item">
                <span className="sensor-detail__spec-key">{key}</span>
                <span className="sensor-detail__spec-val">{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Location Info */}
        <div className="sensor-detail__location-section">
          <span className="sensor-detail__label">LOCATION</span>
          <span className="sensor-detail__location-text">{sensor.location}</span>
        </div>

        {/* View Sensor Feed Button */}
        <button className="sensor-detail__feed-btn">
          <IconMonitor size={16} />
          <span>VIEW SENSOR FEED</span>
        </button>
      </div>
    </div>
  );
}
