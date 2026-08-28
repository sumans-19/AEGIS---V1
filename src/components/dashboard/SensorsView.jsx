import React, { useState } from 'react';
import SensorsHub from './SensorsHub';
import ThermalReconPanel from './ThermalReconPanel';
import UltrasonicRadarPanel from './UltrasonicRadarPanel';

export default function SensorsView() {
  const [activeSensor, setActiveSensor] = useState(null);

  const handleSelectSensor = (sensorId) => {
    if (sensorId === 'thermal' || sensorId === 'ultrasonic') {
      setActiveSensor(sensorId);
    } else {
      console.log(`Sensor ${sensorId} selected.`);
    }
  };

  const handleBackToHub = () => {
    setActiveSensor(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {activeSensor === 'thermal' ? (
        <ThermalReconPanel onBack={handleBackToHub} />
      ) : activeSensor === 'ultrasonic' ? (
        <UltrasonicRadarPanel onBack={handleBackToHub} />
      ) : (
        <SensorsHub onSelectSensor={handleSelectSensor} />
      )}
    </div>
  );
}
