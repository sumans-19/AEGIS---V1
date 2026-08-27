import { useState, useEffect, useCallback } from 'react';
import { SENSORS } from '../data/sensorData';

export function useSensorData() {
  const [sensors, setSensors] = useState(SENSORS);
  const [selectedSensor, setSelectedSensor] = useState(
    () => SENSORS.find(s => s.id === 'thermal') || SENSORS[2]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSensors(prev =>
        prev.map(sensor => {
          const newHistory = [...sensor.history.slice(1)];
          let newValue;

          switch (sensor.id) {
            case 'thermal': {
              const base = 34.6;
              newValue = (base + (Math.sin(Date.now() / 1500) * 0.8)).toFixed(1);
              newHistory.push(parseFloat(newValue));
              break;
            }
            case 'lidar': {
              const base = 4.7;
              newValue = (base + (Math.cos(Date.now() / 1200) * 0.4)).toFixed(1);
              newHistory.push(parseFloat(newValue));
              break;
            }
            case 'altitude': {
              const base = 12.4;
              newValue = (base + (Math.sin(Date.now() / 2000) * 0.2)).toFixed(1);
              newHistory.push(parseFloat(newValue));
              break;
            }
            case 'smoke': {
              const base = 23;
              newValue = Math.round(base + (Math.sin(Date.now() / 3000) * 2));
              newHistory.push(newValue);
              break;
            }
            case 'battery': {
              newValue = '82';
              newHistory.push(82);
              break;
            }
            case 'imu': {
              const roll = (0.2 + Math.sin(Date.now() / 1000) * 0.1).toFixed(1);
              const pitch = (-0.5 + Math.cos(Date.now() / 1000) * 0.1).toFixed(1);
              newValue = `Roll: ${roll}° Pitch: ${pitch}°`;
              newHistory.push(parseFloat(roll) + 10);
              break;
            }
            case 'camera': {
              newValue = '4K 30fps';
              newHistory.push(30);
              break;
            }
            default: {
              newValue = sensor.liveReading.value;
              const lastH = sensor.history[sensor.history.length - 1];
              newHistory.push(lastH);
              break;
            }
          }

          return {
            ...sensor,
            liveReading: {
              ...sensor.liveReading,
              value: typeof newValue === 'number' ? String(newValue) : newValue,
            },
            history: newHistory,
          };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const selectSensor = useCallback((sensorId) => {
    if (sensorId === null) {
      setSelectedSensor(null);
    } else {
      const found = sensors.find(s => s.id === sensorId);
      setSelectedSensor(found || null);
    }
  }, [sensors]);

  return { sensors, selectedSensor, selectSensor };
}
