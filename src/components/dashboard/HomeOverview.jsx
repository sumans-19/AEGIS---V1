import React, { useState, useEffect, useRef } from 'react';
import { useSimStore } from '../../store/useSimStore';
import {
  Scan, Power, Globe, CircuitBoard, Hexagon,
  Crosshair, Flame, RadioTower, HeartPulse, LifeBuoy,
  Waves, Snowflake, AlertTriangle
} from 'lucide-react';
import './HomeOverview.css';

/* ── DATA ────────────────────────────────────────────────── */
const DRONE_FLEET_DATA = [
  { id: 1, name: 'Arjun', role: 'LEAD RECON', battery: 98, altitude: '24.2m', signal: 'Online', icon: Crosshair },
  { id: 2, name: 'Bhima', role: 'HEAVY THERMAL', battery: 92, altitude: '28.0m', signal: 'Online', icon: Flame },
  { id: 3, name: 'Karna', role: 'MESH RELAY', battery: 89, altitude: '22.4m', signal: 'Online', icon: RadioTower },
  { id: 4, name: 'Krishna', role: 'NEURAL TRIAGE', battery: 95, altitude: '26.8m', signal: 'Online', icon: HeartPulse },
  { id: 5, name: 'Ram', role: 'PERIMETER SAR', battery: 91, altitude: '25.0m', signal: 'Online', icon: LifeBuoy },
];

const SCENARIOS = [
  { id: 'earthquake', title: 'Kahramanmaraş', type: 'COLLAPSE', accuracy: '8 DETECTED', icon: AlertTriangle },
  { id: 'tsunami', title: 'Indian Ocean', type: 'FLOOD', accuracy: '6 DETECTED', icon: Waves },
  { id: 'wildfire', title: 'Maui Plume', type: 'THERMAL', accuracy: '5 DETECTED', icon: Flame },
  { id: 'avalanche', title: 'Hindu Kush', type: 'SUB-ZERO', accuracy: '4 DETECTED', icon: Snowflake },
];

/* ── Interactive Radar ── */
function RadarCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    let animId;
    let angle = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      angle += 0.04;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = w * 0.4;

      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(121, 185, 193, 0.3)';
      ctx.lineWidth = 1;
      [0.33, 0.66, 1].forEach(pct => {
        ctx.beginPath(); ctx.arc(cx, cy, r * pct, 0, Math.PI * 2); ctx.stroke();
      });

      const sweepX = cx + Math.cos(angle) * r;
      const sweepY = cy + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle - 0.5, angle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(121, 185, 193, 0.1)';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(sweepX, sweepY);
      ctx.strokeStyle = '#79B9C1'; ctx.lineWidth = 2; ctx.stroke();

      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} width={240} height={240} style={{ margin: '0 auto', display: 'block' }} />;
}


/* ── Mini Drone Cursor ── */
const QuadcopterIcon = () => (
  <div className="quadcopter-cursor">
    <svg width="32" height="32" viewBox="0 0 32 32">
      {/* Central Hub */}
      <rect x="12" y="12" width="8" height="8" rx="2" fill="#79B9C1" />
      {/* Arms */}
      <line x1="8" y1="8" x2="16" y2="16" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="8" x2="16" y2="16" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="24" x2="16" y2="16" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="24" x2="16" y2="16" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div className="quadcopter-propeller prop-tl" />
    <div className="quadcopter-propeller prop-tr" />
    <div className="quadcopter-propeller prop-bl" />
    <div className="quadcopter-propeller prop-br" />
  </div>
);

export default function HomeOverview({ onNavigate }) {
  const setScenario = useSimStore(s => s.setScenario);
  const setSelectedDrone = useSimStore(s => s.setSelectedDrone);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [dronePos, setDronePos] = useState({ x: 50, y: 0 });
  const [waypoints, setWaypoints] = useState([]);

  const scrollContainerRef = useRef(null);
  const pathRef = useRef(null);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const maxScroll = scrollHeight - clientHeight;
    const progress = maxScroll > 0 ? (scrollTop / maxScroll) : 0;
    const clampedProgress = Math.min(1, Math.max(0, progress));
    setScrollProgress(clampedProgress);

    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      const pt = pathRef.current.getPointAtLength(len * clampedProgress);
      setDronePos({ x: pt.x, y: pt.y });
    }
  };

  useEffect(() => {
    // Initialize drone position and calculate precision waypoints
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      const pt = pathRef.current.getPointAtLength(0);
      setDronePos({ x: pt.x, y: pt.y });

      const thresholds = [0.05, 0.15, 0.40, 0.50, 0.70];
      const calculatedWaypoints = thresholds.map(pct => {
        const point = pathRef.current.getPointAtLength(len * pct);
        return { x: point.x, y: point.y, pct };
      });
      setWaypoints(calculatedWaypoints);
    }
  }, []);

  const handleLaunchScenario = (scenId) => {
    setScenario(scenId);
    if (onNavigate) onNavigate('mission');
  };

  const handleDroneFocus = (droneId) => {
    setSelectedDrone(droneId);
    if (onNavigate) onNavigate('drone-3d');
  };

  return (
    <div className="home-overview" onScroll={handleScroll} ref={scrollContainerRef}>

      <div className="obsidian-layout">

        {/* ── THE CURVED SPINE (Central Line) ── */}
        <div className="spine-container">

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: '100%', height: '100%', overflow: 'visible', position: 'absolute' }}
          >
            {/* Dynamic Mask to perfectly sync the fill to the drone's Y coordinate */}
            <mask id="drone-mask">
              <rect x="0" y="0" width="100" height={`${dronePos.y}`} fill="white" />
            </mask>

            {/* Base Path (Faded) */}
            <path
              d="M 50 0 C 50 15, 80 20, 80 35 S 20 50, 20 65 S 80 80, 80 95 S 50 98, 50 100"
              fill="none"
              stroke="var(--light-cyan-fade)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            {/* Highlighted Path (Perfectly masked by drone position) */}
            <path
              ref={pathRef}
              d="M 50 0 C 50 15, 80 20, 80 35 S 20 50, 20 65 S 80 80, 80 95 S 50 98, 50 100"
              fill="none"
              stroke="var(--light-cyan)"
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              mask="url(#drone-mask)"
            />
          </svg>

          {/* Render Premium Waypoints */}
          {waypoints.map((wp, i) => {
            const isActive = scrollProgress >= wp.pct;
            const isLeft = i === 0 || i === 2 || i === 4;
            return (
              <div 
                key={i} 
                className={`spine-waypoint ${isLeft ? 'left' : 'right'} ${isActive ? 'active' : ''}`}
                style={{ left: `${wp.x}%`, top: `${wp.y}%` }}
              >
                <div className="waypoint-branch" />
                <div className="waypoint-ring" />
                <div className="waypoint-core" />
              </div>
            );
          })}


          <div className="spine-drone-cursor" style={{ top: `${dronePos.y}%`, left: `${dronePos.x}%` }}>
            <QuadcopterIcon />
          </div>
        </div>

        {/* ── HERO ── */}
        <div className="obsidian-hero">
          <h1 className="hero-title">AEGIS Interface</h1>
          <p className="hero-desc">
            Autonomous Emergency & Guardian Intervention Swarm. Next-generation decentralized drone platform utilizing 3D LiDAR SLAM, edge neural biometric heat classification, and A* repulsion fields.
          </p>
        </div>

        {/* ── LEFT COLUMN ── */}
        <div className="obsidian-col-left">

          {/* Card 1: Radar */}
          <div className={`obsidian-card ${scrollProgress > 0.05 ? 'active' : ''}`}>
            <div className="card-header">
              <div className="icon-box"><Scan size={18} strokeWidth={2.5} /></div>
              Tactical Holo-Radar
            </div>
            <div className="obsidian-radar-container">
              <RadarCanvas />
            </div>
            <div className="stats-grid" style={{ marginTop: 16 }}>
              <div className="stat-box">
                <div className="stat-label">Coverage</div>
                <div className="stat-value cyan">360°</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Scans/sec</div>
                <div className="stat-value">120 Hz</div>
              </div>
            </div>
          </div>

          {/* Card 2: Contingency Reactor */}
          <div className={`obsidian-card ${scrollProgress > 0.40 ? 'active' : ''}`}>
            <div className="card-header">
              <div className="icon-box"><Power size={18} strokeWidth={2.5} /></div>
              Contingency Reactor
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="stat-label">Power Output</span>
                  <span className="stat-value cyan" style={{ fontSize: 16, marginTop: 0 }}>98.7%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: 'var(--light-cyan-fade)', borderRadius: 3 }}>
                  <div style={{ width: '98.7%', height: '100%', background: 'var(--light-cyan)', borderRadius: 3 }} />
                </div>
              </div>
              <div className="stats-grid">
                <div className="stat-box">
                  <div className="stat-label">Wind Shear</div>
                  <div className="stat-value">15.8 m/s</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Comms Loss</div>
                  <div className="stat-value">0.0 ms</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Scenarios Grid */}
          <div className={`obsidian-card ${scrollProgress > 0.70 ? 'active' : ''}`}>
            <div className="card-header">
              <div className="icon-box"><Globe size={18} strokeWidth={2.5} /></div>
              Mission Theaters
            </div>
            <div className="scen-grid">
              {SCENARIOS.map(scen => (
                <div key={scen.id} className="scen-card" onClick={() => handleLaunchScenario(scen.id)}>
                  <div className="icon-box" style={{ width: 44, height: 44, marginBottom: 16, margin: '0 auto 16px auto' }}>
                    <scen.icon size={22} strokeWidth={2.5} />
                  </div>
                  <div className="scen-title">{scen.title}</div>
                  <div className="scen-sub">{scen.type}</div>
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: 'var(--light-cyan)' }}>
                    {scen.accuracy}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="obsidian-col-right">

          {/* Card 4: Neural Pipeline */}
          <div className={`obsidian-card ${scrollProgress > 0.15 ? 'active' : ''}`}>
            <div className="card-header">
              <div className="icon-box"><CircuitBoard size={18} strokeWidth={2.5} /></div>
              Neural Edge Pipeline
            </div>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-label">Thermal AI</div>
                <div className="stat-value cyan">2.8 ms</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">A* Avoidance</div>
                <div className="stat-value">0.6 ms</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Mesh Relay</div>
                <div className="stat-value">12 ms</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">Object Detect</div>
                <div className="stat-value cyan">1.4 ms</div>
              </div>
            </div>
          </div>

          {/* Card 5: Drone Fleet */}
          <div className={`obsidian-card ${scrollProgress > 0.50 ? 'active' : ''}`}>
            <div className="card-header">
              <div className="icon-box"><Hexagon size={18} strokeWidth={2.5} /></div>
              Active Swarm Fleet
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {DRONE_FLEET_DATA.map(drone => (
                <div key={drone.id} className="drone-row" onClick={() => handleDroneFocus(drone.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div className="icon-box cyan" style={{ width: 44, height: 44, borderRadius: 12 }}>
                      <drone.icon size={22} strokeWidth={2.5} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{drone.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--light-muted)', marginTop: 4, fontWeight: 600 }}>{drone.role}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{drone.battery}%</div>
                    <div style={{ fontSize: 11, color: 'var(--light-cyan)', marginTop: 4, fontWeight: 700 }}>{drone.altitude}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
