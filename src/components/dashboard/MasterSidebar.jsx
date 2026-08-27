import React, { useMemo } from 'react';
import {
  Home, Box, Target, Cpu, Share2, Globe, Settings, Activity
} from 'lucide-react';
import { DRONE_INFO } from '../../data/sensorData';
import './MasterSidebar.css';

const NAV_ITEMS = [
  { id: 'overview', label: 'OVERVIEW', Icon: Home },
  { id: 'drone-3d', label: '3D DRONE', Icon: Box },
  { id: 'sensors', label: 'SENSORS', Icon: Activity },
  { id: 'mission', label: 'MISSION', Icon: Target },
  { id: 'ai-decisions', label: 'AI DECISIONS', Icon: Cpu },
  { id: 'swarm', label: 'SWARM', Icon: Share2 },
  { id: 'disasters', label: 'DISASTERS', Icon: Globe },
  { id: 'settings', label: 'SETTINGS', Icon: Settings },
];

export default function MasterSidebar({ activeTab, onTabChange }) {

  return (
    <aside className="master-sidebar">
      {/* Navigation Rail */}
      <nav className="master-sidebar__nav">
        {NAV_ITEMS.map(item => {
          const isActive = activeTab === item.id;
          const IconComponent = item.Icon;
          return (
            <button
              key={item.id}
              className={`master-sidebar__item ${isActive ? 'master-sidebar__item--active' : ''}`}
              onClick={() => onTabChange(item.id)}
              title={item.label}
            >
              <span className="master-sidebar__item-icon">
                <IconComponent size={18} />
              </span>
              <span className="master-sidebar__item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom System Status Section - ECG Pulse */}
      <div className="master-sidebar__status">
        <div className="master-sidebar__waveform-animated">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id="ecgGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="60%" stopColor="rgba(255,255,255,0)" />
                <stop offset="95%" stopColor="rgba(255,255,255,1)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <mask id="ecgMask">
                <rect x="-100" y="0" width="100" height="20" fill="url(#ecgGrad)">
                  <animate attributeName="x" from="-100" to="100" dur="2s" repeatCount="indefinite" />
                </rect>
              </mask>
            </defs>
            
            {/* Faint background trace */}
            <path 
              d="M 0 10 L 20 10 L 23 3 L 28 17 L 33 10 L 70 10 L 73 3 L 78 17 L 83 10 L 100 10" 
              fill="none" 
              stroke="#79B9C1" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              opacity="0.15"
            />
            
            {/* Bright sweeping trace */}
            <path 
              d="M 0 10 L 20 10 L 23 3 L 28 17 L 33 10 L 70 10 L 73 3 L 78 17 L 83 10 L 100 10" 
              fill="none" 
              stroke="#79B9C1" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              mask="url(#ecgMask)"
            />
          </svg>
        </div>
      </div>
    </aside>
  );
}
