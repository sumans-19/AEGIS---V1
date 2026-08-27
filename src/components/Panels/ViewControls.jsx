import React, { useState } from 'react';
import { IconRotate, IconZoom, IconPan, IconReset } from '../Common/Icons';
import './ViewControls.css';

const CONTROLS = [
  { id: 'rotate', label: 'ROTATE', IconComp: IconRotate },
  { id: 'zoom', label: 'ZOOM', IconComp: IconZoom },
  { id: 'pan', label: 'PAN', IconComp: IconPan },
  { id: 'reset', label: 'RESET', IconComp: IconReset },
];

export default function ViewControls({ onReset }) {
  const [activeControl, setActiveControl] = useState('rotate');

  const handleClick = (id) => {
    if (id === 'reset') {
      onReset?.();
    } else {
      setActiveControl(id);
    }
  };

  return (
    <div className="view-controls">
      <h3 className="view-controls__title">VIEW CONTROLS</h3>
      <div className="view-controls__grid">
        {CONTROLS.map(ctrl => (
          <button
            key={ctrl.id}
            className={`view-controls__btn ${activeControl === ctrl.id && ctrl.id !== 'reset' ? 'view-controls__btn--active' : ''}`}
            onClick={() => handleClick(ctrl.id)}
          >
            <span className="view-controls__btn-icon">
              <ctrl.IconComp size={18} />
            </span>
            <span className="view-controls__btn-label">{ctrl.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
