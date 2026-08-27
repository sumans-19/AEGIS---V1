import React, { useMemo } from 'react';
import {
  Home, Box, Target, Cpu, Share2, Globe, Settings, Activity
} from 'lucide-react';
import { DRONE_INFO } from '../../data/sensorData';
import './MasterSidebar.css';

const NAV_ITEMS = [
  { id: 'overview', label: 'OVERVIEW', Icon: Home },
  { id: 'drone-3d', label: '3D DRONE', Icon: Box },
  { id: 'mission', label: 'MISSION', Icon: Target },
  { id: 'ai-decisions', label: 'AI DECISIONS', Icon: Cpu },
  { id: 'swarm', label: 'SWARM', Icon: Share2 },
  { id: 'disasters', label: 'DISASTERS', Icon: Globe },
  { id: 'settings', label: 'SETTINGS', Icon: Settings },
];

export default function MasterSidebar({ activeTab, onTabChange }) {
  const wavePoints = useMemo(() => [
    '0,7', '4,7', '8,2', '12,12', '16,0', '20,14', '24,7', '28,7', '32,4', '36,10', '40,7', '48,7'
  ].join(' '), []);

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

      {/* Bottom System Status Section */}
      <div className="master-sidebar__status">
        <span className="master-sidebar__status-title">SYSTEM STATUS</span>
        <div className="master-sidebar__status-row">
          <span className="master-sidebar__status-dot" />
          <span className="master-sidebar__status-label">SWARM MESH</span>
        </div>
        <span className="master-sidebar__status-value">NOMINAL</span>

        {/* Real-time Heartbeat Waveform */}
        <div className="master-sidebar__waveform">
          <svg width="48" height="14" viewBox="0 0 48 14" fill="none">
            <polyline
              points={wavePoints}
              fill="none"
              stroke="#79B9C1"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </aside>
  );
}
