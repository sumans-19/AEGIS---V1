import React, { useState, useEffect, useRef } from 'react';
import { useSimStore } from '../../store/useSimStore';
import {
  Target, Box, Cpu, Share2, Shield, Activity,
  Zap, Navigation, Radio, Flame, Waves, Wind,
  Snowflake, AlertTriangle, ArrowRight, CheckCircle2,
  TrendingUp, Play, Layers, Compass, ChevronRight, Eye
} from 'lucide-react';
import './HomeOverview.css';

const DRONE_FLEET_DATA = [
  {
    id: 1,
    name: 'Arjun',
    callsign: 'ARJUN-01',
    role: 'LEAD RECON',
    color: '#79B9C1',
    battery: 98,
    altitude: '24.2m',
    speed: '14.2 m/s',
    signal: '-42 dBm',
    sats: '14 SATS',
    status: 'ACTIVE FLIGHT',
  },
  {
    id: 2,
    name: 'Bhima',
    callsign: 'BHIMA-02',
    role: 'HEAVY THERMAL',
    color: '#f59e0b',
    battery: 92,
    altitude: '28.0m',
    speed: '16.5 m/s',
    signal: '-48 dBm',
    sats: '12 SATS',
    status: 'THERMAL SCAN',
  },
  {
    id: 3,
    name: 'Karna',
    callsign: 'KARNA-03',
    role: 'MESH RELAY',
    color: '#58ba8a',
    battery: 89,
    altitude: '22.4m',
    speed: '12.8 m/s',
    signal: '-39 dBm',
    sats: '16 SATS',
    status: 'MESH LOCKED',
  },
  {
    id: 4,
    name: 'Krishna',
    callsign: 'KRISHNA-04',
    role: 'NEURAL TRIAGE',
    color: '#8b5cf6',
    battery: 95,
    altitude: '26.8m',
    speed: '15.0 m/s',
    signal: '-44 dBm',
    sats: '15 SATS',
    status: 'AI INFERENCE',
  },
  {
    id: 5,
    name: 'Ram',
    callsign: 'RAM-05',
    role: 'PERIMETER SAR',
    color: '#D4A844',
    battery: 91,
    altitude: '25.0m',
    speed: '13.6 m/s',
    signal: '-41 dBm',
    sats: '13 SATS',
    status: 'SURVIVOR LOCK',
  },
];

const SCENARIOS = [
  {
    id: 'earthquake',
    title: 'Kahramanmaraş Earthquake',
    country: 'TÜRKİYE // 7.8M SEISMIC',
    type: 'COLLAPSED STRUCTURES',
    risk: 'CRITICAL',
    riskColor: '#dc3545',
    icon: AlertTriangle,
    survivors: 8,
    wind: '14 km/h',
    temp: '18°C',
    coverage: '94%',
  },
  {
    id: 'tsunami',
    title: 'Indian Ocean Inundation',
    country: 'INDONESIA // 4.2M WAVE',
    type: 'FLOODED COASTLINE',
    risk: 'CRITICAL',
    riskColor: '#dc3545',
    icon: Waves,
    survivors: 6,
    wind: '28 km/h',
    temp: '26°C',
    coverage: '88%',
  },
  {
    id: 'wildfire',
    title: 'Maui Thermal Plume',
    country: 'HAWAII // ZERO VISIBILITY',
    type: 'IR THERMAL PENETRATION',
    risk: 'HIGH RISK',
    riskColor: '#f59e0b',
    icon: Flame,
    survivors: 5,
    wind: '42 km/h',
    temp: '48°C',
    coverage: '91%',
  },
  {
    id: 'flood',
    title: 'Sindh Basin Submersion',
    country: 'PAKISTAN // EXPANSIVE',
    type: 'WATERWAY TRIAGE',
    risk: 'HIGH RISK',
    riskColor: '#f59e0b',
    icon: Waves,
    survivors: 7,
    wind: '18 km/h',
    temp: '31°C',
    coverage: '96%',
  },
  {
    id: 'avalanche',
    title: 'Hindu Kush Ice Burial',
    country: 'SOUTH ASIA // SUB-ZERO',
    type: 'ACOUSTIC TRIANGULATION',
    risk: 'EXTREME',
    riskColor: '#dc3545',
    icon: Snowflake,
    survivors: 4,
    wind: '35 km/h',
    temp: '-14°C',
    coverage: '85%',
  },
  {
    id: 'cyclone',
    title: 'Odisha Super Cyclone',
    country: 'INDIA // 140 KM/H GALE',
    type: 'HIGH-WIND STABILIZATION',
    risk: 'CRITICAL',
    riskColor: '#dc3545',
    icon: Wind,
    survivors: 6,
    wind: '120 km/h',
    temp: '27°C',
    coverage: '89%',
  },
];

const CONTINGENCIES = [
  {
    id: 'battery',
    label: 'Critical Battery Drop (<20%)',
    response: 'Automated Return-To-Base vectoring with seamless sector handover.',
    val: '18.4V LOW',
  },
  {
    id: 'collision',
    label: 'Imminent Mid-Air Intercept',
    response: 'Microsecond 3D repulsion field actuation with A* replan.',
    val: '3.2m DIST',
  },
  {
    id: 'wind',
    label: '15 m/s Wind Shear Surge',
    response: 'Dynamic tilt angle and thrust compensation maintaining hover.',
    val: '15.8 m/s GUST',
  },
  {
    id: 'comms',
    label: 'Base Station Comms Loss',
    response: 'Decentralized peer-to-peer mesh consensus network protocol.',
    val: '0.0ms SYNC',
  },
];

/* ── Realistic 3D Aerospace Drone Visualizer ────────────────── */
function AerospaceDrone3DVisual({ color = '#79B9C1', battery = 98, name }) {
  return (
    <div className="drone-stage">
      {/* Holographic Gyroscopic Orientation Halo */}
      <div
        className="drone-stage__halo"
        style={{ borderColor: `${color}40` }}
      />

      {/* Isometric 3D Drone Graphic */}
      <svg
        className="drone-stage__svg"
        width="90"
        height="90"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`fuselageGrad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#253235" />
            <stop offset="50%" stopColor="#172124" />
            <stop offset="100%" stopColor="#0D1315" />
          </linearGradient>

          <linearGradient id={`rotorGrad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.7" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Diagonal Carbon-Fiber Arms with Depth Shading */}
        <line x1="20" y1="20" x2="80" y2="80" stroke="#12181A" strokeWidth="6" strokeLinecap="round" />
        <line x1="20" y1="20" x2="80" y2="80" stroke="#2C3B3F" strokeWidth="3" strokeLinecap="round" />
        
        <line x1="80" y1="20" x2="20" y2="80" stroke="#12181A" strokeWidth="6" strokeLinecap="round" />
        <line x1="80" y1="20" x2="20" y2="80" stroke="#2C3B3F" strokeWidth="3" strokeLinecap="round" />

        {/* 4 Carbon-Fiber Motor Pods */}
        <circle cx="18" cy="18" r="6" fill="#172124" stroke={color} strokeWidth="1.5" />
        <circle cx="82" cy="18" r="6" fill="#172124" stroke={color} strokeWidth="1.5" />
        <circle cx="18" cy="82" r="6" fill="#172124" stroke={color} strokeWidth="1.5" />
        <circle cx="82" cy="82" r="6" fill="#172124" stroke={color} strokeWidth="1.5" />

        {/* Spinning Rotor Motion Discs */}
        <circle cx="18" cy="18" r="16" stroke={color} strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.5" />
        <ellipse cx="18" cy="18" rx="15" ry="4" fill={`url(#rotorGrad-${name})`} transform="rotate(35 18 18)" />

        <circle cx="82" cy="18" r="16" stroke={color} strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.5" />
        <ellipse cx="82" cy="18" rx="15" ry="4" fill={`url(#rotorGrad-${name})`} transform="rotate(-35 82 18)" />

        <circle cx="18" cy="82" r="16" stroke={color} strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.5" />
        <ellipse cx="18" cy="82" rx="15" ry="4" fill={`url(#rotorGrad-${name})`} transform="rotate(-35 18 82)" />

        <circle cx="82" cy="82" r="16" stroke={color} strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.5" />
        <ellipse cx="82" cy="82" rx="15" ry="4" fill={`url(#rotorGrad-${name})`} transform="rotate(35 82 82)" />

        {/* Central Aerodynamic Fuselage Pod */}
        <path
          d="M42 26 H58 C64 26 66 32 66 40 V62 C66 70 62 74 50 74 C38 74 34 70 34 62 V40 C34 32 36 26 42 26 Z"
          fill={`url(#fuselageGrad-${name})`}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />

        {/* Avionics LiDAR / Heat Camera Dome */}
        <ellipse cx="50" cy="36" rx="6" ry="5" fill={color} />
        <ellipse cx="49" cy="35" rx="2" ry="1.5" fill="#FFFFFF" fillOpacity="0.8" />

        {/* Carbon Core Accents */}
        <line x1="42" y1="50" x2="58" y2="50" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="44" y1="56" x2="56" y2="56" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1" />

        {/* Active Telemetry Beacon LED */}
        <circle cx="50" cy="66" r="3" fill="#58ba8a" />
        <circle cx="50" cy="66" r="5" stroke="#58ba8a" strokeWidth="0.8" strokeOpacity="0.6" />
      </svg>

      {/* Floating Tactical Battery Pill */}
      <div style={{
        position: 'absolute',
        bottom: '2px',
        background: 'rgba(23, 33, 36, 0.95)',
        border: `1.5px solid ${color}`,
        borderRadius: '12px',
        padding: '2px 9px',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: '9.5px',
        fontWeight: 800,
        color: '#FFFFFF',
        boxShadow: `0 3px 10px ${color}40`,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <Zap size={9} color={color} />
        <span>{battery}%</span>
      </div>
    </div>
  );
}

export default function HomeOverview({ onNavigate }) {
  const setScenario = useSimStore(s => s.setScenario);
  const currentScenario = useSimStore(s => s.scenario);
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone);

  const [selectedContingency, setSelectedContingency] = useState(CONTINGENCIES[0]);
  const [testActive, setTestActive] = useState(false);
  const radarCanvasRef = useRef(null);
  const reactorCanvasRef = useRef(null);

  const handleLaunchScenario = (scenId) => {
    setScenario(scenId);
    if (onNavigate) onNavigate('mission');
  };

  const handleDroneFocus = (droneId) => {
    setSelectedDrone(droneId);
    if (onNavigate) onNavigate('drone-3d');
  };

  const handleTriggerTest = (contingency) => {
    setSelectedContingency(contingency);
    setTestActive(true);
    setTimeout(() => setTestActive(false), 2400);
  };

  // 1. Interactive 3D Holographic Radar Canvas
  useEffect(() => {
    let animId;
    let angle = 0;
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      angle += 0.03;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = w * 0.44;

      ctx.clearRect(0, 0, w, h);

      // Radar Concentric Rings
      ctx.strokeStyle = 'rgba(121, 185, 193, 0.25)';
      ctx.lineWidth = 1;
      [0.33, 0.66, 1].forEach(pct => {
        ctx.beginPath();
        ctx.arc(cx, cy, r * pct, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Rotating Scanning Beam
      const sweepX = cx + Math.cos(angle) * r;
      const sweepY = cy + Math.sin(angle) * r;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle - 0.5, angle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(121, 185, 193, 0.15)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = '#79B9C1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Blinking Drone Beacons
      const beacons = [
        { x: cx + 28, y: cy - 24, label: 'Arjun', color: '#79B9C1' },
        { x: cx - 35, y: cy - 18, label: 'Bhima', color: '#f59e0b' },
        { x: cx + 18, y: cy + 32, label: 'Karna', color: '#58ba8a' },
        { x: cx - 22, y: cy + 28, label: 'Krishna', color: '#8b5cf6' },
        { x: cx + 42, y: cy + 12, label: 'Ram', color: '#D4A844' },
      ];

      beacons.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 7.5px Inter, sans-serif';
        ctx.fillText(b.label, b.x + 6, b.y + 2.5);
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  // 2. Interactive Reactor Waveform Canvas
  useEffect(() => {
    let animId;
    let step = 0;
    const canvas = reactorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      step += 0.06;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 16) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // Waveform
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = testActive ? '#58ba8a' : '#79B9C1';

      for (let x = 0; x < w; x += 2) {
        const freq = testActive ? 0.09 : 0.04;
        const amp = testActive ? 22 : 12;
        const y = (h / 2) + Math.sin(x * freq + step) * amp + (Math.sin(x * 0.02 - step * 0.4) * 5);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [testActive]);

  return (
    <div className="home-overview">
      <div className="overview-wrap">

        {/* ── 1. HERO COMMAND HUB ──────────────────────────────── */}
        <section className="hero-hub">
          <div className="hero-hub__left">
            <div className="hero-hub__pill">
              ● SWARM CONSENSUS · 5 NODES OPERATIONAL · MESH ENCRYPTED
            </div>

            <h1 className="hero-hub__title">
              Autonomous Multi-UAV Swarm Defense & <span>Disaster Response</span>
            </h1>

            <p className="hero-hub__desc">
              Next-generation decentralized autonomous drone swarm platform. Utilizing 3D LiDAR SLAM, edge neural biometric heat classification, and dynamic A* repulsion fields to navigate zero-visibility disaster zones and extract survivors.
            </p>

            <div className="hero-hub__btns">
              <button
                className="hub-btn hub-btn--primary"
                onClick={() => onNavigate && onNavigate('mission')}
              >
                <Target size={15} /> Launch 3D Mission Control
              </button>

              <button
                className="hub-btn hub-btn--secondary"
                onClick={() => onNavigate && onNavigate('drone-3d')}
              >
                <Box size={15} /> Inspect 3D Drone
              </button>

              <button
                className="hub-btn hub-btn--secondary"
                onClick={() => onNavigate && onNavigate('ai-decisions')}
              >
                <Cpu size={15} /> AI Decisions
              </button>
            </div>
          </div>

          {/* Holographic Radar Visual Canvas */}
          <div className="hero-hub__radar-box">
            <div className="hero-hub__radar-head">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#79B9C1', letterSpacing: '0.1em' }}>
                LIVE TACTICAL HOLO-RADAR
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: '#58ba8a', fontWeight: 800 }}>
                ● 5 NODES ACTIVE
              </span>
            </div>
            <canvas
              ref={radarCanvasRef}
              width={260}
              height={180}
              style={{ width: '100%', height: '180px', display: 'block' }}
            />
          </div>
        </section>

        {/* ── 2. PREMIUM 3D AEROSPACE DRONE SWARM DECK ───────── */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#1a565e', letterSpacing: '0.12em' }}>
                // AUTONOMOUS SWARM FLEET DECK
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: '#172124', margin: 0 }}>
                Active Swarm Drone Nodes
              </h2>
            </div>
          </div>

          <div className="fleet-deck-grid">
            {DRONE_FLEET_DATA.map(d => (
              <div
                key={d.id}
                className="drone-card-deck"
                onClick={() => handleDroneFocus(d.id)}
                style={{
                  borderTop: `3px solid ${d.color}`,
                }}
              >
                {/* Role Pill */}
                <div
                  className="drone-card-deck__role-tag"
                  style={{
                    background: `${d.color}15`,
                    color: d.color,
                    border: `1px solid ${d.color}40`,
                  }}
                >
                  {d.role}
                </div>

                {/* 3D Drone Isometric Visual Model */}
                <AerospaceDrone3DVisual
                  color={d.color}
                  battery={d.battery}
                  name={d.name}
                />

                {/* Drone Info Block */}
                <div className="drone-card-deck__info">
                  <div className="drone-card-deck__title-row">
                    <span className="drone-card-deck__name">{d.name}</span>
                    <span className="drone-card-deck__callsign">{d.callsign}</span>
                  </div>

                  {/* Telemetry Micro Grid */}
                  <div className="drone-telemetry-grid">
                    <div className="drone-tele-item">
                      <span className="drone-tele-label">ALTITUDE</span>
                      <span className="drone-tele-val">{d.altitude}</span>
                    </div>
                    <div className="drone-tele-item">
                      <span className="drone-tele-label">SPEED</span>
                      <span className="drone-tele-val">{d.speed}</span>
                    </div>
                    <div className="drone-tele-item">
                      <span className="drone-tele-label">SIGNAL</span>
                      <span className="drone-tele-val">{d.signal}</span>
                    </div>
                    <div className="drone-tele-item">
                      <span className="drone-tele-label">GNSS</span>
                      <span className="drone-tele-val">{d.sats}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="drone-card-deck__action-btn">
                    <Eye size={11} /> INSPECT 3D
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. SCENARIOS GRID ───────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#1a565e', letterSpacing: '0.12em' }}>
                // DISASTER TOPOLOGY REGISTRY
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: '#172124', margin: 0 }}>
                Active Disaster Scenarios
              </h2>
            </div>
            <button
              className="hub-btn hub-btn--secondary"
              style={{ padding: '6px 14px', fontSize: '10px' }}
              onClick={() => onNavigate && onNavigate('disasters')}
            >
              All Scenarios <ArrowRight size={12} />
            </button>
          </div>

          <div className="scenario-splash-grid">
            {SCENARIOS.map(scen => {
              const IconComp = scen.icon;
              const isCurrent = currentScenario === scen.id;
              return (
                <div
                  key={scen.id}
                  className="scenario-splash-card"
                  onClick={() => handleLaunchScenario(scen.id)}
                  style={{
                    borderColor: isCurrent ? '#79B9C1' : 'rgba(255, 255, 255, 0.95)',
                    boxShadow: isCurrent ? '0 8px 24px rgba(121, 185, 193, 0.35)' : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'rgba(121, 185, 193, 0.15)', color: '#1a565e',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconComp size={18} />
                    </div>

                    <span
                      className="scenario-splash-badge"
                      style={{
                        background: `${scen.riskColor}18`,
                        color: scen.riskColor,
                        border: `1px solid ${scen.riskColor}40`,
                      }}
                    >
                      {scen.risk}
                    </span>
                  </div>

                  <h3 className="scenario-splash-title">{scen.title}</h3>
                  <div className="scenario-splash-loc">{scen.country}</div>

                  <div className="scenario-splash-metrics">
                    <div className="scenario-splash-stat">
                      <span className="scenario-splash-stat-label">SURVIVORS</span>
                      <span className="scenario-splash-stat-val">{scen.survivors} PINGS</span>
                    </div>
                    <div className="scenario-splash-stat">
                      <span className="scenario-splash-stat-label">WIND GUST</span>
                      <span className="scenario-splash-stat-val">{scen.wind}</span>
                    </div>
                    <div className="scenario-splash-stat">
                      <span className="scenario-splash-stat-label">TEMPERATURE</span>
                      <span className="scenario-splash-stat-val">{scen.temp}</span>
                    </div>
                    <div className="scenario-splash-stat">
                      <span className="scenario-splash-stat-label">COVERAGE</span>
                      <span className="scenario-splash-stat-val">{scen.coverage}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontFamily: 'var(--font-primary)',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      color: '#1a565e',
                      letterSpacing: '0.06em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      DEPLOY FLEET <Play size={10} fill="currentColor" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. FLOWING NEURAL AI INFERENCE PIPELINE ─────────── */}
        <section>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#1a565e', letterSpacing: '0.12em' }}>
              // AUTONOMOUS INFERENCE ARCHITECTURE
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: '#172124', margin: 0 }}>
              Live Neural Edge Pipeline
            </h2>
          </div>

          <div className="neural-flow-container">
            <div className="neural-nodes-row">
              <div className="neural-node-card">
                <span className="neural-node-step">STAGE 01 // INTAKE</span>
                <span className="neural-node-name">3D LiDAR Pointcloud</span>
                <span className="neural-node-metric">1.4ms · 120k pts/sec</span>
              </div>

              <div className="neural-arrow">
                <ChevronRight size={20} />
              </div>

              <div className="neural-node-card">
                <span className="neural-node-step">STAGE 02 // INFERENCE</span>
                <span className="neural-node-name">Thermal Biometric AI</span>
                <span className="neural-node-metric">2.8ms · 94.7% Conf.</span>
              </div>

              <div className="neural-arrow">
                <ChevronRight size={20} />
              </div>

              <div className="neural-node-card">
                <span className="neural-node-step">STAGE 03 // VECTORING</span>
                <span className="neural-node-name">A* Collision Avoidance</span>
                <span className="neural-node-metric">0.6ms · 8m Buffer</span>
              </div>

              <div className="neural-arrow">
                <ChevronRight size={20} />
              </div>

              <div className="neural-node-card">
                <span className="neural-node-step">STAGE 04 // CONSENSUS</span>
                <span className="neural-node-name">Decentralized Mesh Sync</span>
                <span className="neural-node-metric">&lt;8ms · Peer-to-Peer</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. FLUID CONTINGENCY STRESS REACTOR ─────────────── */}
        <section>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#1a565e', letterSpacing: '0.12em' }}>
              // RESILIENCE & FAILURE RECOVERY
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: '#172124', margin: 0 }}>
              Hardware Contingency Stress Reactor
            </h2>
          </div>

          <div className="reactor-box">
            {/* Left: Interactive Test Pads */}
            <div className="reactor-btn-pad">
              {CONTINGENCIES.map(item => {
                const isSelected = selectedContingency.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`reactor-pad ${isSelected ? 'reactor-pad--active' : ''}`}
                    onClick={() => handleTriggerTest(item)}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 800, color: '#79B9C1' }}>
                      {item.val}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#172124' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#55666B' }}>
                      {item.response}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right: Live Dynamic Waveform Stream */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '14px',
              padding: '18px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: '#1a565e', letterSpacing: '0.08em' }}>
                  ACTIVE PROTOCOL // {selectedContingency.id.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 800, color: testActive ? '#58ba8a' : '#8A9A9E' }}>
                  {testActive ? '● STRESS ACTIVE (RECOVERED)' : '○ NOMINAL STREAM'}
                </span>
              </div>

              <canvas
                ref={reactorCanvasRef}
                width={400}
                height={120}
                style={{ width: '100%', height: '120px', borderRadius: '8px', background: '#F0F5F6' }}
              />

              <div style={{ fontSize: '11px', color: '#172124', fontWeight: 600 }}>
                {selectedContingency.response}
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
