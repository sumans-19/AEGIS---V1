import React, { useState } from 'react';
import { useSimStore } from '../../store/useSimStore';
import { Settings, Shield, Wifi, Battery, Activity, Sliders, RefreshCw } from 'lucide-react';

export default function SettingsView() {
  const backendConnected = useSimStore(s => s.backendConnected);
  const scenario = useSimStore(s => s.scenario);
  const setScenario = useSimStore(s => s.setScenario);

  const [repulsionDist, setRepulsionDist] = useState(8);
  const [telemetryRate, setTelemetryRate] = useState(20);
  const [batteryFailThreshold, setBatteryFailThreshold] = useState(20);
  const [soundAlerts, setSoundAlerts] = useState(true);

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '30px 40px',
      background: 'var(--bg-primary)',
      fontFamily: 'var(--font-primary)',
      userSelect: 'none',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: '#1a565e',
            letterSpacing: '0.12em',
            fontWeight: 800,
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}>
            // SYSTEM CONFIGURATION & DIAGNOSTICS
          </div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 800,
            color: '#172124',
            margin: 0,
          }}>
            PLATFORM SETTINGS
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Card 1: Network & Connection */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Wifi size={20} color="#79B9C1" />
              <h3 style={cardTitleStyle}>COMMUNICATION & MESH NETWORK</h3>
            </div>
            
            <div style={rowStyle}>
              <span>Backend AI Engine Status</span>
              <span style={{
                color: backendConnected ? '#2e7d5a' : '#8A9A9E',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
              }}>
                {backendConnected ? '● CONNECTED (localhost:8000)' : '○ AUTONOMOUS CLIENT SIMULATION'}
              </span>
            </div>

            <div style={rowStyle}>
              <span>Telemetry Frequency</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#172124' }}>
                {telemetryRate} Hz
              </span>
            </div>

            <input
              type="range"
              min="5" max="60" step="5"
              value={telemetryRate}
              onChange={e => setTelemetryRate(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#79B9C1', marginTop: '8px' }}
            />
          </div>

          {/* Card 2: Autonomous Safety Rules */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Shield size={20} color="#79B9C1" />
              <h3 style={cardTitleStyle}>SAFETY & REACTION MATRIX</h3>
            </div>

            <div style={rowStyle}>
              <span>A* Dynamic Repulsion Radius</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#172124' }}>
                {repulsionDist}m
              </span>
            </div>
            <input
              type="range"
              min="4" max="25" step="1"
              value={repulsionDist}
              onChange={e => setRepulsionDist(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#79B9C1', marginTop: '8px', marginBottom: '16px' }}
            />

            <div style={rowStyle}>
              <span>Emergency RTB Battery Cutoff</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#dc3545' }}>
                {batteryFailThreshold}%
              </span>
            </div>
            <input
              type="range"
              min="10" max="35" step="1"
              value={batteryFailThreshold}
              onChange={e => setBatteryFailThreshold(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#dc3545', marginTop: '8px' }}
            />
          </div>

          {/* Card 3: Active Mission Parameters */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Activity size={20} color="#79B9C1" />
              <h3 style={cardTitleStyle}>ACTIVE SIMULATION ENVIRONMENT</h3>
            </div>

            <div style={rowStyle}>
              <span>Disaster Preset</span>
              <select
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(0, 0, 0, 0.12)',
                  background: '#FFFFFF',
                  color: '#172124',
                  fontFamily: 'var(--font-primary)',
                  fontWeight: 800,
                  fontSize: '11px',
                }}
              >
                <option value="earthquake">EARTHQUAKE (TÜRKİYE)</option>
                <option value="tsunami">TSUNAMI (INDONESIA)</option>
                <option value="wildfire">WILDFIRE (HAWAII)</option>
                <option value="flood">FLOOD (PAKISTAN)</option>
                <option value="avalanche">AVALANCHE (HINDU KUSH)</option>
                <option value="cyclone">CYCLONE (ODISHA)</option>
              </select>
            </div>
          </div>

          {/* Card 4: Audio-Visual Diagnostics */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Sliders size={20} color="#79B9C1" />
              <h3 style={cardTitleStyle}>USER INTERFACE & AUDIT</h3>
            </div>

            <div style={rowStyle}>
              <span>Audio Tactical Alerts</span>
              <button
                onClick={() => setSoundAlerts(!soundAlerts)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${soundAlerts ? '#58ba8a' : '#8A9A9E'}`,
                  background: soundAlerts ? 'rgba(88, 186, 138, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                  color: soundAlerts ? '#2e7d5a' : '#55666B',
                  fontWeight: 800,
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                {soundAlerts ? 'ENABLED' : 'MUTED'}
              </button>
            </div>

            <div style={rowStyle}>
              <span>Color System Profile</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1a565e', fontSize: '11px' }}>
                AEGIS LIGHT AEROSPACE
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'rgba(235, 243, 245, 0.85)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.95)',
  outline: '1px solid rgba(0, 0, 0, 0.07)',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.03), inset 0 1px 0 #FFFFFF',
};

const cardTitleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '15px',
  fontWeight: 800,
  color: '#172124',
  margin: 0,
  letterSpacing: '0.04em',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 0',
  borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
  fontSize: '12.5px',
  color: '#55666B',
  fontWeight: 600,
};
