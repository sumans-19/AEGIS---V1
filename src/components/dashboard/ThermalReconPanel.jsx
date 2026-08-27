import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Crosshair, Radio, Activity, Map, VideoOff, 
  Wifi, ShieldAlert, Cpu, HardDrive, MapPin, Lock
} from 'lucide-react';
import './ThermalReconPanel.css';

const THERMAL_STREAM_URL = import.meta.env.VITE_THERMAL_STREAM_URL || "http://localhost:5000/thermal-stream";
const HEALTH_URL = import.meta.env.VITE_THERMAL_HEALTH_URL || "http://localhost:5000/health";
const TARGETS_URL = import.meta.env.VITE_THERMAL_TARGETS_URL || "http://localhost:5000/targets";

export default function ThermalReconPanel() {
  const [streamStatus, setStreamStatus] = useState('connecting'); // connecting, live, error
  const [sysTime, setSysTime] = useState('');
  const [liveTargets, setLiveTargets] = useState([]);
  const [telemetry, setTelemetry] = useState({
    alt: '124.5m',
    hdg: '342° NW',
    spd: '18.2 kts',
    gps: '34.0522°N, 118.2437°W',
    signal: 'GOOD',
    targets: '03'
  });
  
  const imgRef = useRef(null);

  // Time updater
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setSysTime(d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Health / Stream checker
  useEffect(() => {
    let checkInterval;
    
    const checkHealth = async () => {
      try {
        const res = await fetch(HEALTH_URL);
        if (res.ok) {
          if (streamStatus !== 'live') setStreamStatus('live');
        } else {
          setStreamStatus('error');
        }
      } catch (err) {
        setStreamStatus('error');
      }
    };

    // Initial check
    checkHealth();
    
    // Poll health every 5s
    checkInterval = setInterval(checkHealth, 5000);
    return () => clearInterval(checkInterval);
  }, [streamStatus]);

  // Fast polling for live targets (every 1s)
  useEffect(() => {
    if (streamStatus !== 'live') return;

    const fetchTargets = async () => {
      try {
        const res = await fetch(TARGETS_URL);
        if (res.ok) {
          const data = await res.json();
          setLiveTargets(data.targets || []);
        }
      } catch (err) {
        // Silently fail for target polling
      }
    };

    const targetInterval = setInterval(fetchTargets, 1000);
    return () => clearInterval(targetInterval);
  }, [streamStatus]);

  const handleStreamError = () => {
    setStreamStatus('error');
  };

  const handleStreamLoad = () => {
    setStreamStatus('live');
  };

  return (
    <div className="thermal-panel">
      {/* ── HEADER ── */}
      <div className="thermal-header">
        <div className="thermal-header__left">
          <Camera size={18} className="thermal-header__icon" />
          <h2>DRONE RECONNAISSANCE</h2>
          <span className="thermal-header__id">UNIT-01 [AERO-X]</span>
        </div>
        <div className="thermal-header__right">
          <div className={`status-indicator ${streamStatus}`}>
            <span className="status-indicator__dot"></span>
            {streamStatus === 'live' && 'LIVE'}
            {streamStatus === 'connecting' && 'CONNECTING...'}
            {streamStatus === 'error' && 'SIGNAL LOST'}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="thermal-content">
        
        {/* ── VIEWPORT (70%) ── */}
        <div className="thermal-viewport-container">
          <div className="thermal-viewport">
            
            {/* The actual stream */}
            {streamStatus !== 'error' ? (
              <img 
                ref={imgRef}
                src={THERMAL_STREAM_URL} 
                alt="Live drone thermal reconnaissance feed"
                className="thermal-viewport__video"
                onError={handleStreamError}
                onLoad={handleStreamLoad}
              />
            ) : (
              <div className="thermal-viewport__offline">
                <VideoOff size={48} />
                <h3>CAMERA OFFLINE</h3>
                <p>Waiting for MJPEG stream from UAV payload...</p>
                <button onClick={() => setStreamStatus('connecting')} className="thermal-btn-retry">
                  INITIALIZE RECONNECTION
                </button>
              </div>
            )}

            {/* ── CINEMATIC OVERLAYS ── */}
            {streamStatus === 'live' && (
              <>
                {/* Subtle vignette */}
                <div className="thermal-overlay__vignette"></div>

                {/* Subtle perspective grid */}
                <div className="thermal-overlay__grid"></div>

                {/* Animated scan line */}
                <div className="thermal-overlay__scanline"></div>

                {/* Center reticle */}
                <div className="thermal-overlay__reticle">
                  <div className="reticle-h"></div>
                  <div className="reticle-v"></div>
                  <div className="reticle-center"></div>
                </div>

                {/* Frame Brackets */}
                <div className="frame-bracket tl"></div>
                <div className="frame-bracket tr"></div>
                <div className="frame-bracket bl"></div>
                <div className="frame-bracket br"></div>

                {/* Top HUD Data */}
                <div className="hud-top-left">
                  <span>REC</span>
                  <span>{sysTime}</span>
                </div>
                <div className="hud-top-right">
                  <span>HDG {telemetry.hdg}</span>
                </div>

                {/* Bottom HUD Data */}
                <div className="hud-bottom-left">
                  <span>ALT {telemetry.alt}</span>
                  <span>SPD {telemetry.spd}</span>
                </div>
                <div className="hud-bottom-right">
                  <span>FOV 72°</span>
                  <span>{telemetry.gps}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── MISSION PANEL (30%) ── */}
        <div className="thermal-mission-panel">
          <h3 className="panel-title">MISSION TELEMETRY</h3>
          
          <div className="mission-grid">
            <div className="mission-stat">
              <span className="stat-label">CAMERA</span>
              <span className={`stat-value ${streamStatus === 'live' ? 'active' : 'alert'}`}>
                {streamStatus === 'live' ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
            <div className="mission-stat">
              <span className="stat-label">SCANNING</span>
              <span className="stat-value active">ACTIVE</span>
            </div>
            <div className="mission-stat">
              <span className="stat-label">TARGETS</span>
              <span className="stat-value highlight">{liveTargets.length.toString().padStart(2, '0')}</span>
            </div>
            <div className="mission-stat">
              <span className="stat-label">SIGNAL</span>
              <span className="stat-value">{telemetry.signal}</span>
            </div>
          </div>

          <div className="mission-divider"></div>

          <h3 className="panel-title">SYSTEM STATUS</h3>
          <div className="system-list">
            <div className="sys-item">
              <Cpu size={14} />
              <span>Edge Compute</span>
              <span className="sys-status ok">NOMINAL</span>
            </div>
            <div className="sys-item">
              <Crosshair size={14} />
              <span>YOLO Tracker</span>
              <span className="sys-status ok">ACTIVE</span>
            </div>
            <div className="sys-item">
              <Activity size={14} />
              <span>Thermal Sensor</span>
              <span className="sys-status ok">NOMINAL</span>
            </div>
            <div className="sys-item">
              <Wifi size={14} />
              <span>Data Link</span>
              <span className="sys-status ok">{telemetry.signal}</span>
            </div>
          </div>

          <div className="mission-divider"></div>

          <h3 className="panel-title">LIVE TARGET INTEL</h3>
          <div className="target-intel-log">
            {liveTargets.length === 0 ? (
              <div className="intel-entry" style={{ justifyContent: 'center', opacity: 0.5 }}>
                <div className="intel-header" style={{ justifyContent: 'center' }}>
                  <span className="intel-time">NO TARGETS IN FOV</span>
                </div>
              </div>
            ) : (
              liveTargets.map((target, idx) => (
                <div key={idx} className={`intel-entry ${idx === 0 ? 'active' : ''}`}>
                  <div className="intel-header">
                    <span className="intel-id" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {idx === 0 ? <Lock size={12} /> : <MapPin size={12} />}
                      {target.id}
                    </span>
                    <span className="intel-time">NOW</span>
                  </div>
                  <div className="intel-details">
                    <div className="intel-row"><span>TYPE:</span> <span className={target.type.includes('SURVIVOR') ? 'highlight' : ''}>{target.type}</span></div>
                    <div className="intel-row"><span>TEMP:</span> <span className="highlight">{target.temp} °C</span></div>
                    <div className="intel-row"><span>CONF:</span> <span className={target.conf > 70 ? 'ok' : 'warn'}>{target.conf}%</span></div>
                    <div className="intel-row"><span>STAT:</span> <span>{target.status}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
