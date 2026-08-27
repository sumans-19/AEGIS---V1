import React from 'react';
import ToggleSwitch from '../Common/ToggleSwitch';
import './ModelOptions.css';

export default function ModelOptions({ options, onToggle }) {
  const toggleItems = [
    { key: 'wireframe', label: 'WIREFRAME' },
    { key: 'xrayView', label: 'X-RAY VIEW' },
    { key: 'sensorZones', label: 'SENSOR ZONES' },
    { key: 'componentLabels', label: 'COMPONENT LABELS' },
  ];

  return (
    <div className="model-options">
      <h3 className="model-options__title">MODEL OPTIONS</h3>
      <div className="model-options__list">
        {toggleItems.map(item => (
          <ToggleSwitch
            key={item.key}
            label={item.label}
            checked={options[item.key]}
            onChange={() => onToggle(item.key)}
          />
        ))}
      </div>
    </div>
  );
}
