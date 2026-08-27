import React, { useState } from 'react';
import {
  IconViewPreset1, IconViewPreset2, IconViewPreset3,
  IconViewPreset4, IconViewPreset5, IconViewPreset6,
} from '../Common/Icons';
import { VIEW_PRESETS } from '../../data/sensorData';
import './ViewPoints.css';

const ICONS = [
  IconViewPreset1,
  IconViewPreset2,
  IconViewPreset3,
  IconViewPreset4,
  IconViewPreset5,
  IconViewPreset6,
];

export default function ViewPoints({ onViewChange }) {
  const [activeView, setActiveView] = useState(0);

  const handleClick = (preset, index) => {
    setActiveView(index);
    onViewChange?.(preset);
  };

  return (
    <div className="view-points">
      <h3 className="view-points__title">VIEW POINT</h3>
      <div className="view-points__grid">
        {VIEW_PRESETS.map((preset, i) => {
          const IconComp = ICONS[i] || IconViewPreset1;
          const isActive = activeView === i;
          return (
            <button
              key={preset.name}
              className={`view-points__item ${isActive ? 'view-points__item--active' : ''}`}
              onClick={() => handleClick(preset, i)}
              title={preset.name}
            >
              <IconComp size={24} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
