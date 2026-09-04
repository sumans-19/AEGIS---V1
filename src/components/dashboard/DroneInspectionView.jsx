import React, { useState, useRef, useCallback } from 'react';
import DroneViewport from '../Viewport3D/DroneViewport';
import ViewControls from '../Panels/ViewControls';
import ViewPoints from '../Panels/ViewPoints';
import ModelOptions from '../Panels/ModelOptions';
import SensorDetail from '../Panels/SensorDetail';
import ComponentsStrip from '../BottomBar/ComponentsStrip';
import { useSensorData } from '../../hooks/useSensorData';

export default function DroneInspectionView() {
  const [modelOptions, setModelOptions] = useState({
    wireframe: false,
    xrayView: false,
    sensorZones: true,
    componentLabels: true,
  });

  const { sensors, selectedSensor, selectSensor } = useSensorData();
  const controlsRef = useRef(null);

  const handleToggle = useCallback((key) => {
    setModelOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleViewChange = useCallback((preset) => {
    selectSensor(null);
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const startPos = controls.object.position.clone();
      const endPos = { x: preset.position[0], y: preset.position[1], z: preset.position[2] };
      const duration = 600;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        controls.object.position.set(
          startPos.x + (endPos.x - startPos.x) * ease,
          startPos.y + (endPos.y - startPos.y) * ease,
          startPos.z + (endPos.z - startPos.z) * ease,
        );
        controls.target.set(preset.target[0], preset.target[1], preset.target[2]);
        controls.update();

        if (t < 1) requestAnimationFrame(animate);
      };
      animate();
    }
  }, []);

  const handleReset = useCallback(() => {
    handleViewChange({ position: [2.5, 2.0, 3.2], target: [0, 0, 0] });
  }, [handleViewChange]);

  const handleSensorSelect = useCallback((sensorId) => {
    selectSensor(sensorId);
  }, [selectSensor]);

  const currentSelectedSensor = selectedSensor
    ? sensors.find(s => s.id === selectedSensor.id) || selectedSensor
    : null;

  return (
    <div className="drone-inspection-view" style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      height: '100%',
      overflow: 'hidden',
      background: '#DCE6E8',
    }}>
      {/* Center 3D Workspace + Floating Panels */}
      <main className="app-workspace" style={{
        flex: 1,
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        padding: '8px 10px 6px 10px',
        gap: '10px',
        minHeight: 0,
      }}>
        {/* Left Control Column */}
        <div className="app-left-panels" style={{
          width: '178px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '7px',
          overflowY: 'auto',
          zIndex: 5,
        }}>
          <ViewControls onReset={handleReset} />
          <ViewPoints onViewChange={handleViewChange} />
          <ModelOptions options={modelOptions} onToggle={handleToggle} />
        </div>

        {/* Central 3D Interactive Drone Viewport */}
        <div className="app-viewport-wrapper" style={{
          flex: 1,
          display: 'flex',
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.9)',
          outline: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.5)',
        }}>
          <DroneViewport
            sensors={sensors}
            selectedSensor={currentSelectedSensor}
            onSensorSelect={handleSensorSelect}
            wireframe={modelOptions.wireframe}
            xrayView={modelOptions.xrayView}
            showSensorZones={modelOptions.sensorZones}
            showLabels={modelOptions.componentLabels}
            controlsRef={controlsRef}
          />
        </div>

        {/* Right Information Panel */}
        <div className="app-right-panel" style={{
          width: '250px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 5,
        }}>
          <SensorDetail
            sensor={currentSelectedSensor}
            onClose={() => handleSensorSelect(null)}
          />
        </div>
      </main>

      {/* Bottom Components & Sensors Panel */}
      <ComponentsStrip
        sensors={sensors}
        selectedSensor={currentSelectedSensor}
        onSensorSelect={handleSensorSelect}
      />
    </div>
  );
}
