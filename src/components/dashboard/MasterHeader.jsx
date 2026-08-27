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

/* Realistic Glossy Liquid Paint / Water Drips with Specular Highlights & Physics on the Right End */
function RealisticLiquidDrips() {
  return (
    <svg
      className="master-header__realistic-drips"
      viewBox="0 0 450 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="liquidGradRight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#20292B" />
          <stop offset="60%" stopColor="#172124" />
          <stop offset="100%" stopColor="#0F1618" />
        </linearGradient>

        <radialGradient id="dropHighlightRight" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.55)" />
          <stop offset="40%" stopColor="rgba(255, 255, 255, 0.08)" />
          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.6)" />
        </radialGradient>
      </defs>

      {/* Main Flowing Dripping Silhouette with multiple drops matching reference image */}
      <path
        d="M0 0 H450 
           C440 0 435 3 430 6 C425 10 422 15 418 15 C414 15 412 8 408 4 C404 0 398 0 392 0
           C384 0 380 6 376 12 C372 19 370 26 366 26 C362 26 360 15 356 8 C352 2 344 0 336 0
           C328 0 324 7 320 15 C316 23 314 31 310 31 C306 31 304 18 300 10 C296 2 288 0 280 0
           C272 0 268 6 264 13 C260 20 260 27 256 27 C252 27 250 16 246 9 C242 2 234 0 226 0
           C218 0 214 8 210 18 C206 28 204 35 200 35 C196 35 194 20 190 12 C186 3 178 0 170 0
           C162 0 158 7 154 16 C150 25 148 32 144 32 C140 32 138 18 134 10 C130 2 122 0 114 0
           C106 0 102 6 98 13 C94 20 92 26 88 26 C84 26 82 16 78 9 C74 2 66 0 58 0
           C50 0 46 5 42 11 C38 18 36 24 32 24 C28 24 26 14 22 7 C18 1 12 0 0 0 Z"
        fill="url(#liquidGradRight)"
      />

      {/* Hanging Liquid Teardrops with Specular Highlights */}
      <circle cx="200" cy="34" r="3.2" fill="#172124" />
      <circle cx="199.2" cy="33.2" r="1.4" fill="url(#dropHighlightRight)" />

      <circle cx="144" cy="31" r="3.0" fill="#172124" />
      <circle cx="143.2" cy="30.2" r="1.3" fill="url(#dropHighlightRight)" />

      <circle cx="310" cy="30" r="2.8" fill="#172124" />
      <circle cx="309.2" cy="29.3" r="1.2" fill="url(#dropHighlightRight)" />

      <circle cx="366" cy="25" r="2.4" fill="#172124" />
      <circle cx="365.3" cy="24.3" r="1.0" fill="url(#dropHighlightRight)" />

      <circle cx="256" cy="26" r="2.2" fill="#172124" />
      <circle cx="255.3" cy="25.3" r="0.9" fill="url(#dropHighlightRight)" />

      {/* Separated Falling Micro Droplets */}
      <circle cx="200" cy="40" r="1.4" fill="#172124" />
      <circle cx="144" cy="37" r="1.2" fill="#172124" />
      <circle cx="310" cy="35.5" r="1.1" fill="#172124" />
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

      {/* Main Light Header Area with Realistic Liquid Drips on the Right Side */}
      <div className="master-header__main-area">
        {/* Realistic Liquid Dripping Design along the top-right end of the header */}
        <RealisticLiquidDrips />

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
