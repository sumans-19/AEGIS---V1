import React, { useState } from 'react';
import SensorsHub from './SensorsHub';
import ThermalReconPanel from './ThermalReconPanel';
import UltrasonicRadarPanel from './UltrasonicRadarPanel';
import DHT11Panel from './DHT11Panel';
import INA219Panel from './INA219Panel';

export default function SensorsView() {
  const [activeSensor, setActiveSensor] = useState(null);

  const handleSelectSensor = (sensorId) => {
    if (
      sensorId === 'thermal' ||
      sensorId === 'ultrasonic' ||
      sensorId === 'dht11' ||
      sensorId === 'smoke' ||
      sensorId === 'ina219' ||
      sensorId === 'power' ||
      sensorId === 'battery'
    ) {
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
      ) : (activeSensor === 'dht11' || activeSensor === 'smoke') ? (
        <DHT11Panel onBack={handleBackToHub} />
      ) : (activeSensor === 'ina219' || activeSensor === 'power' || activeSensor === 'battery') ? (
        <INA219Panel onBack={handleBackToHub} />
      ) : (
        <SensorsHub onSelectSensor={handleSelectSensor} />
      )}
    </div>
  );
}
