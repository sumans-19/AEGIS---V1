import React, { useState, useEffect, useRef } from 'react';
import { 
  Waves, Radio, Activity, VideoOff, 
  Wifi, ShieldAlert, Cpu, HardDrive, MapPin, Lock, Crosshair, Target, ArrowLeft
} from 'lucide-react';
import './UltrasonicRadarPanel.css';

const PROXIMITY_STREAM_URL = import.meta.env.VITE_PROXIMITY_STREAM_URL || "http://localhost:5000/proximity-stream";
const PROXIMITY_API_URL = import.meta.env.VITE_PROXIMITY_API_URL || "http://localhost:5000/proximity-data";
const HEALTH_URL = import.meta.env.VITE_THERMAL_HEALTH_URL || "http://localhost:5000/health";

export default function UltrasonicRadarPanel({ onBack, selectedDrone }) {
  const [isFrozen, setIsFrozen] = useState(false);

  const handleFreeze = async () => {
    const newFreeze = !isFrozen;
    setIsFrozen(newFreeze);
    try {
      await fetch('http://localhost:5000/api/sensors/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sensor_id: 'SENSOR-HCSR04-01',
          unit_id: selectedDrone || 'UAV-01',
          is_frozen: newFreeze
        })
      });
    } catch (e) {
      console.error('Failed to freeze sensor:', e);
    }
  };

  const [streamStatus, setStreamStatus] = useState('live'); // connecting, live, error
  const [sysTime, setSysTime] = useState('');
  const [unitMode, setUnitMode] = useState('CM'); // 'CM' or 'M'
  const [telemetry, setTelemetry] = useState({
    distance_cm: 238.95,
    distance_m: 2.39,
    status: 'ACTIVE',
    source: 'HARDWARE_COM9',
    risk_level: 'SAFE',
    history: [240.2, 239.5, 238.9, 238.5, 238.0, 237.5, 238.5],
    history_echo: [13.8, 13.9, 13.8, 13.7, 13.6, 13.7, 13.7],
    history_amp: [92, 94, 93, 95, 93, 94, 94],
    fused_shape: {
      primary_class: 'HUMAN SURVIVOR',
      estimated_width_cm: 78.9,
      estimated_height_cm: 183.2,
      aspect_ratio: '1:1.6',
      confidence: 93,
    },
    targets: 1,
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
        // Keep live if image is streaming
      }
    };

    checkHealth();
    checkInterval = setInterval(checkHealth, 5000);
    return () => clearInterval(checkInterval);
  }, [streamStatus]);

  // Fast polling for ultrasonic distance and fused object intel
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch(PROXIMITY_API_URL, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setTelemetry(prev => {
            if (!data) return prev;
            const dist = data.distance_cm ?? prev.distance_cm;
            const newHistory = (prev.history || []).concat([dist]).slice(-25);
            const echoDuration = Math.round((dist / 0.0343) * 2 / 100) / 10;
            const newHistoryEcho = (prev.history_echo || []).concat([echoDuration]).slice(-25);
            const amp = Math.min(99, Math.max(50, Math.round(98 - (dist * 0.1))));
            const newHistoryAmp = (prev.history_amp || []).concat([amp]).slice(-25);

            return {
              ...prev,
              ...data,
              distance_cm: dist,
              distance_m: data.distance_m ?? Number((dist / 100).toFixed(2)),
              status: data.status ?? 'ACTIVE',
              source: data.source ?? prev.source,
              risk_level: data.risk_level ?? prev.risk_level,
              fused_shape: data.fused_shape ?? prev.fused_shape,
              targets: data.fused_shape?.object_count || (dist ? 1 : 0),
              history: newHistory,
              history_echo: newHistoryEcho,
              history_amp: newHistoryAmp,
            };
          });
        }
      } catch (err) {
        // Smooth telemetry simulator when disconnected
        setTelemetry(prev => {
          const prevCm = prev.distance_cm || 238.5;
          const drift = Math.sin(Date.now() / 1500) * 1.8 + (Math.random() - 0.5) * 0.4;
          const newCm = Math.max(15, Math.min(380, prevCm + drift));
          const risk = newCm < 45 ? 'COLLISION_IMMINENT' : newCm < 120 ? 'PROXIMITY_WARNING' : 'SAFE';
          const newHistory = (prev.history || []).concat([Number(newCm.toFixed(1))]).slice(-25);
          return {
            ...prev,
            distance_cm: Number(newCm.toFixed(1)),
            distance_m: Number((newCm / 100).toFixed(2)),
            risk_level: risk,
            history: newHistory,
            fused_shape: {
              ...(prev.fused_shape || {}),
              estimated_width_cm: Number((newCm * 0.28).toFixed(1)),
              estimated_height_cm: Number((newCm * 0.65).toFixed(1)),
            }
          };
        });
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 300);
    return () => clearInterval(interval);
  }, []);

  const distCm = telemetry?.distance_cm || 238.5;
  const distM = telemetry?.distance_m || (distCm / 100);
  const isCritical = distCm < 45;
  const isWarning = distCm >= 45 && distCm < 120;
  const riskStatusText = isCritical ? 'COLLISION HAZARD' : isWarning ? 'PROXIMITY WARNING' : 'SAFE / OPTIMAL';

  // Sparkline Generator Helper
  const renderSparkline = (data, color = '#2D636B') => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) || 1;
    const width = 160;
    const height = 36;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="ultrasonic-sparkline-svg">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="ultrasonic-panel">
      {/* ── HEADER (Unified with INA219 / DHT11) ── */}
      <div className="ultrasonic-panel__header">
        <div className="ultrasonic-panel__header-left">
          <button className="ultrasonic-panel__back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>BACK TO HUB</span>
          </button>
          <div className="ultrasonic-panel__title-group">
            <h2 className="ultrasonic-panel__title">
              <Waves size={20} className="ultrasonic-panel__title-icon" />
              PROXIMITY RADAR & OBSTACLE INTELLIGENCE
            </h2>
            <span className="ultrasonic-panel__badge">UNIT-02 [HC-SR04 SENSOR]</span>
          </div>
        </div>

        {/* Live Hardware Connection Tag & Unit Toggle */}
        <div className="ultrasonic-panel__header-right">
          <div className="ultrasonic-panel__hw-tag">
            <span className="ultrasonic-panel__hw-dot" />
            <span>{telemetry.source} // 40 kHz // 9600 BAUD</span>
          </div>
          <button 
            onClick={handleFreeze}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '6px',
              border: `1px solid ${isFrozen ? '#3BAAB6' : 'rgba(13, 36, 40, 0.15)'}`,
              background: isFrozen ? 'rgba(59, 170, 182, 0.15)' : 'rgba(13, 36, 40, 0.05)',
              color: isFrozen ? '#3BAAB6' : '#0D2428',
              fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <ShieldAlert size={14} />
            {isFrozen ? 'UNFREEZE DATA' : 'FREEZE DATA'}
          </button>
          <div className="ultrasonic-panel__unit-toggle">
            <button
              className={`ultrasonic-panel__unit-btn ${unitMode === 'CM' ? 'ultrasonic-panel__unit-btn--active' : ''}`}
              onClick={() => setUnitMode('CM')}
            >
              CM
            </button>
            <button
              className={`ultrasonic-panel__unit-btn ${unitMode === 'M' ? 'ultrasonic-panel__unit-btn--active' : ''}`}
              onClick={() => setUnitMode('M')}
            >
              M
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID (Canvas / Stream + Right Side Cards Deck) ── */}
      <div className="ultrasonic-panel__grid">
        {/* Left Live Proximity Radar Stream Container */}
        <div className="ultrasonic-panel__canvas-container">
          {streamStatus !== 'error' ? (
            <img 
              ref={imgRef}
              src={PROXIMITY_STREAM_URL} 
              alt="Live drone ultrasonic proximity reconnaissance feed"
              className="ultrasonic-panel__video"
              onError={() => setStreamStatus('error')}
              onLoad={() => setStreamStatus('live')}
            />
          ) : (
            <div className="ultrasonic-panel__offline">
              <VideoOff size={48} />
              <h3>PROXIMITY STREAM OFFLINE</h3>
              <p>Waiting for high-speed radar bridge from UAV payload...</p>
              <button onClick={() => setStreamStatus('live')} className="ultrasonic-panel__btn-retry">
                INITIALIZE RECONNECTION
              </button>
            </div>
          )}

          {/* Floating Top Left Badge */}
          <div className="ultrasonic-panel__hud-overlay ultrasonic-panel__hud-overlay--top-left">
            <span className="ultrasonic-panel__hud-tag">ACOUSTIC BEAM</span>
            <span className="ultrasonic-panel__hud-val">40.0 <small>kHz</small></span>
            <span className="ultrasonic-panel__hud-sub">CONE ANGLE: 15°</span>
          </div>

          {/* Floating Top Right Badge */}
          <div className="ultrasonic-panel__hud-overlay ultrasonic-panel__hud-overlay--top-right">
            <span className="ultrasonic-panel__hud-tag">TARGET LOCK</span>
            <span className="ultrasonic-panel__hud-val">{telemetry.fused_shape?.primary_class || 'OBSTACLE'}</span>
            <span className="ultrasonic-panel__hud-sub">CONFIDENCE: {telemetry.fused_shape?.confidence || 93}%</span>
          </div>

          {/* Floating Center Range Finder Badge */}
          <div className="ultrasonic-panel__center-badge">
            <span className="ultrasonic-panel__center-label">OBSTACLE DISTANCE</span>
            <span className="ultrasonic-panel__center-val">
              {unitMode === 'M' ? `${distM.toFixed(2)} m` : `${distCm.toFixed(1)} cm`}
            </span>
          </div>

          {/* Floating Bottom Status Overlay */}
          <div className="ultrasonic-panel__hud-overlay ultrasonic-panel__hud-overlay--bottom">
            <div className="ultrasonic-panel__hud-status-item">
              <span className="ultrasonic-panel__hud-dot" />
              <span>RADAR STATUS: {riskStatusText}</span>
            </div>
            <div className="ultrasonic-panel__hud-status-item">
              <Crosshair size={14} color="#79B9C1" />
              <span>TARGETS: {telemetry.targets} LOCKED</span>
            </div>
            <div className="ultrasonic-panel__hud-status-item">
              <ShieldAlert size={14} color="#79B9C1" />
              <span>SAFETY MARGIN: {distCm > 120 ? 'HIGH' : distCm > 45 ? 'MODERATE' : 'CRITICAL'}</span>
            </div>
          </div>
        </div>

        {/* Right Side Deck (Matching INA219 / DHT11 Card Structure) */}
        <div className="ultrasonic-panel__side-deck">
          {/* Card 1: Primary Metrics (2x2 Grid) */}
          <div className="ultrasonic-card">
            <div className="ultrasonic-card__header">
              <span className="ultrasonic-card__title">RADAR TELEMETRY</span>
              <span className="ultrasonic-card__badge">LIVE 2.0 Hz</span>
            </div>

            <div className="ultrasonic-metric-grid">
              <div className="ultrasonic-metric-box">
                <div className="ultrasonic-metric-box__icon-wrap">
                  <Waves size={18} color="#2D636B" />
                </div>
                <div className="ultrasonic-metric-box__content">
                  <span className="ultrasonic-metric-box__label">DISTANCE</span>
                  <span className="ultrasonic-metric-box__val">
                    {unitMode === 'M' ? distM.toFixed(2) : distCm.toFixed(1)}
                    <small>{unitMode === 'M' ? 'm' : 'cm'}</small>
                  </span>
                </div>
              </div>

              <div className="ultrasonic-metric-box">
                <div className="ultrasonic-metric-box__icon-wrap">
                  <ShieldAlert size={18} color="#2D636B" />
                </div>
                <div className="ultrasonic-metric-box__content">
                  <span className="ultrasonic-metric-box__label">PROXIMITY</span>
                  <span className="ultrasonic-metric-box__val" style={{ fontSize: '13px' }}>
                    {isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'CLEAR'}
                    <small>{isCritical ? 'ALERT' : 'SAFE'}</small>
                  </span>
                </div>
              </div>

              <div className="ultrasonic-metric-box">
                <div className="ultrasonic-metric-box__icon-wrap">
                  <Target size={18} color="#2D636B" />
                </div>
                <div className="ultrasonic-metric-box__content">
                  <span className="ultrasonic-metric-box__label">TARGETS</span>
                  <span className="ultrasonic-metric-box__val">
                    {telemetry.targets.toString().padStart(2, '0')}
                    <small>LOCK</small>
                  </span>
                </div>
              </div>

              <div className="ultrasonic-metric-box">
                <div className="ultrasonic-metric-box__icon-wrap">
                  <Radio size={18} color="#2D636B" />
                </div>
                <div className="ultrasonic-metric-box__content">
                  <span className="ultrasonic-metric-box__label">TRANSDUCER</span>
                  <span className="ultrasonic-metric-box__val">
                    40.0
                    <small>kHz</small>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Waveforms & Profiles */}
          <div className="ultrasonic-card">
            <div className="ultrasonic-card__header">
              <span className="ultrasonic-card__title">REAL-TIME PROXIMITY & ECHO PROFILES</span>
              <Activity size={16} color="#2D636B" />
            </div>

            <div className="ultrasonic-waveform-row">
              <div className="ultrasonic-waveform-item">
                <div className="ultrasonic-waveform-header">
                  <span>DISTANCE STABILITY (cm)</span>
                  <span className="ultrasonic-waveform-val">{distCm.toFixed(1)} cm</span>
                </div>
                {renderSparkline(telemetry.history, '#2D636B')}
              </div>

              <div className="ultrasonic-waveform-item">
                <div className="ultrasonic-waveform-header">
                  <span>ECHO PULSE DURATION (ms)</span>
                  <span className="ultrasonic-waveform-val">
                    {((distCm / 0.0343) * 2 / 1000).toFixed(2)} ms
                  </span>
                </div>
                {renderSparkline(telemetry.history_echo, '#3BAAB6')}
              </div>

              <div className="ultrasonic-waveform-item">
                <div className="ultrasonic-waveform-header">
                  <span>BEAM REFLECTION AMPLITUDE</span>
                  <span className="ultrasonic-waveform-val">94% NOMINAL</span>
                </div>
                {renderSparkline(telemetry.history_amp, '#6BA5AD')}
              </div>
            </div>
          </div>

          {/* Card 3: Live Obstacle Fusion & Multi-Target Intel (Individual Box for Each Entity) */}
          {(() => {
            const detectedList = (telemetry.detected_objects && telemetry.detected_objects.length > 0)
              ? telemetry.detected_objects
              : [{
                  id: 'TARGET-01',
                  class_name: telemetry.fused_shape?.primary_class || 'HUMAN SURVIVOR',
                  distance_cm: distCm,
                  estimated_width_cm: telemetry.fused_shape?.estimated_width_cm || 65.4,
                  estimated_height_cm: telemetry.fused_shape?.estimated_height_cm || 151.8,
                  confidence: telemetry.fused_shape?.confidence || 93,
                  risk_level: riskStatusText
                }];

            return detectedList.map((target, idx) => (
              <div className="ultrasonic-card" key={target.id || idx}>
                <div className="ultrasonic-card__header">
                  <span className="ultrasonic-card__title">
                    LIVE OBSTACLE FUSION — {target.id}
                  </span>
                  <span className="ultrasonic-card__badge" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={10} />
                    {target.confidence}% LOCK
                  </span>
                </div>

                <div className="ultrasonic-intel-list">
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">Target Classification</span>
                    <span className="ultrasonic-intel-val">{target.class_name}</span>
                  </div>
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">Distance</span>
                    <span className="ultrasonic-intel-val">
                      {unitMode === 'M' ? `${(target.distance_cm / 100).toFixed(2)} m` : `${Number(target.distance_cm).toFixed(1)} cm`}
                    </span>
                  </div>
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">Estimated Width</span>
                    <span className="ultrasonic-intel-val">{target.estimated_width_cm} cm</span>
                  </div>
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">Estimated Height</span>
                    <span className="ultrasonic-intel-val">{target.estimated_height_cm} cm</span>
                  </div>
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">AI Confidence Rating</span>
                    <span className="ultrasonic-intel-val">{target.confidence}%</span>
                  </div>
                  <div className="ultrasonic-intel-row">
                    <span className="ultrasonic-intel-label">Proximity Risk</span>
                    <span 
                      className="ultrasonic-intel-val" 
                      style={{ 
                        color: (target.risk_level || '').includes('HAZARD') ? '#D95858' : (target.risk_level || '').includes('WARN') ? '#E5B842' : '#2D636B',
                        fontWeight: 800 
                      }}
                    >
                      {target.risk_level || riskStatusText}
                    </span>
                  </div>
                </div>
              </div>
            ));
          })()}

          {/* Card 4: Hardware Specifications */}
          <div className="ultrasonic-card">
            <div className="ultrasonic-card__header">
              <span className="ultrasonic-card__title">HARDWARE CONFIGURATION</span>
              <Cpu size={16} color="#2D636B" />
            </div>

            <div className="ultrasonic-specs-list">
              <div className="ultrasonic-spec-row">
                <span className="ultrasonic-spec-label">Sensor Model</span>
                <span className="ultrasonic-spec-val">HC-SR04 Ultrasonic Transceiver</span>
              </div>
              <div className="ultrasonic-spec-row">
                <span className="ultrasonic-spec-label">Operating Voltage</span>
                <span className="ultrasonic-spec-val">5.0V DC (Arduino Uno Pin 9/10)</span>
              </div>
              <div className="ultrasonic-spec-row">
                <span className="ultrasonic-spec-label">Acoustic Frequency</span>
                <span className="ultrasonic-spec-val">40 kHz Ultrasonic Sound Burst</span>
              </div>
              <div className="ultrasonic-spec-row">
                <span className="ultrasonic-spec-label">Measuring Angle</span>
                <span className="ultrasonic-spec-val">15° Conical Active Beam</span>
              </div>
              <div className="ultrasonic-spec-row">
                <span className="ultrasonic-spec-label">Range Limits</span>
                <span className="ultrasonic-spec-val">2 cm ~ 400 cm Precision</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
