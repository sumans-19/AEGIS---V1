import React, { useState, useEffect } from 'react';
import { useSimStore } from '../../store/useSimStore';
import { AeroviewLogo } from '../Common/Icons';
import { Clock } from 'lucide-react';
import './MasterHeader.css';

const TAB_TITLES = {
  'overview': { title: 'AEGIS PROJECT OVERVIEW', subtitle: 'AUTONOMOUS MULTI-UAV DISASTER RESPONSE PLATFORM' },
  'drone-3d': { title: '3D DRONE INSPECTION', subtitle: 'AEROVIEW RECON-7 // REAL-TIME HARDWARE TELEMETRY' },
  'mission': { title: 'SWARMSYNC MISSION CONTROL', subtitle: 'AUTONOMOUS DISASTER ZONE MAPPING & RESCUE' },
  'ai-decisions': { title: 'AI DECISION MATRIX', subtitle: 'AUTONOMOUS REASONING ENGINE & ADAPTIVE DEFENSE' },
  'swarm': { title: 'SWARM COORDINATION', subtitle: 'MULTI-DRONE TOPOLOGY & SEPARATION MATRIX' },
  'disasters': { title: 'DISASTER REGISTRY', subtitle: 'GLOBAL CRISIS SCENARIOS & DATASET SIMULATIONS' },
  'settings': { title: 'SYSTEM SETTINGS', subtitle: 'TELEMETRY CONFIGURATION & SIMULATION PARAMETERS' },
};

function WirelessIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="3" fill="#79B9C1" />
      <path d="M9.5 18.5 A6.5 6.5 0 0 1 9.5 9.5" stroke="#79B9C1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18.5 9.5 A6.5 6.5 0 0 1 18.5 18.5" stroke="#79B9C1" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 22 A11.5 11.5 0 0 1 6 6" stroke="#79B9C1" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 6 A11.5 11.5 0 0 1 22 22" stroke="#79B9C1" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function MasterHeader({ activeTab = 'overview' }) {
  const scenario = useSimStore(s => s.scenario);
  const backendConnected = useSimStore(s => s.backendConnected);
  const drones = useSimStore(s => s.drones);
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toUTCString().slice(17, 25) + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const meta = TAB_TITLES[activeTab] || TAB_TITLES['overview'];

  return (
    <header className="master-header">
      {/* Dark Branding Block with sweeping curved corner */}
      <div className="master-header__brand-block">
        <div className="master-header__brand-content">
          <div className="master-header__logo-wrap">
            <AeroviewLogo size={36} />
          </div>
          <div className="master-header__brand-text">
            <span className="master-header__brand-name">AEGIS</span>
            <span className="master-header__brand-sub">COMMAND INTERFACE</span>
          </div>
        </div>

        {/* Seamless sweeping SVG curved corner cutout */}
        <svg className="master-header__brand-curve" viewBox="0 0 50 64" fill="none" preserveAspectRatio="none">
          <path d="M0 0 H50 C32 0 35 64 0 64 V0 Z" fill="#20292B" />
        </svg>
      </div>

      {/* Main Light Header Area */}
      <div className="master-header__main-area">

        <div className="master-header__title-block">
          <h1 className="master-header__title">{meta.title}</h1>
          <span className="master-header__subtitle">{meta.subtitle}</span>
        </div>

        <div className="master-header__right">
          {/* Active Scenario Badge */}
          <div className="master-header__info-group">
            <span className="master-header__info-label">SCENARIO</span>
            <span className="master-header__info-value" style={{ color: '#172124' }}>
              {scenario ? scenario.toUpperCase() : 'EARTHQUAKE'}
            </span>
          </div>

          <div className="master-header__divider" />

          {/* Active Drone Fleet Nodes */}
          <div className="master-header__info-group">
            <span className="master-header__info-label">SWARM FLEET</span>
            <span className="master-header__info-value">
              {drones?.length || 5} NODES ONLINE
            </span>
          </div>

          <div className="master-header__divider" />

          {/* Backend AI Connection */}
          <div className="master-header__info-group">
            <span className="master-header__info-label">AI ENGINE</span>
            <span className="master-header__info-value" style={{ color: backendConnected ? '#2e7d5a' : '#8A9A9E' }}>
              {backendConnected ? '● CONNECTED' : '○ SIMULATED'}
            </span>
          </div>

          <div className="master-header__divider" />

          {/* Live Wireless Telemetry Icon */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <WirelessIcon />
          </div>

          <div className="master-header__divider" />

          {/* Live UTC Clock */}
          <div className="master-header__time-badge">
            <Clock size={13} color="#55666B" />
            <span>{timeStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
