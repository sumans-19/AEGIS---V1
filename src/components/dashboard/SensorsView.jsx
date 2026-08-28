import React, { useState } from 'react';
import SensorsHub from './SensorsHub';
import ThermalReconPanel from './ThermalReconPanel';

export default function SensorsView() {
  const [activeSensor, setActiveSensor] = useState(null);

  const handleSelectSensor = (sensorId) => {
    if (sensorId === 'thermal') {
      setActiveSensor(sensorId);
    } else {
      // Currently, only thermal has a detailed view
      console.log(`Sensor ${sensorId} selected, but no detailed view is implemented yet.`);
    }
  };

  const handleBackToHub = () => {
    setActiveSensor(null);
  };

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {activeSensor === 'thermal' ? (
        <ThermalReconPanel onBack={handleBackToHub} />
      ) : (
        <SensorsHub onSelectSensor={handleSelectSensor} />
      )}
    </div>
  );
}
