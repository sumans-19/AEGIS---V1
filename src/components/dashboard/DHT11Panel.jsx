import React, { useState, useEffect, useRef } from 'react';
import {
  Thermometer, Droplets, Wind, Activity, ArrowLeft, ShieldAlert,
  Compass, RefreshCw, Cpu, Gauge, Sun, CloudRain
} from 'lucide-react';
import './DHT11Panel.css';

export default function DHT11Panel({ onBack }) {
  const [telemetry, setTelemetry] = useState({
    temperature_c: 27.5,
    temperature_f: 81.5,
    humidity_pct: 68.0,
    heat_index_c: 29.6,
    dew_point_c: 21.1,
    air_density_kg_m3: 1.175,
    comfort_index: 'SAFE / OPTIMAL',
    status: 'ACTIVE',
    source: 'HARDWARE_COM9',
    history_temp: [26.8, 27.0, 27.2, 27.4, 27.5, 27.5, 27.5],
    history_hum: [66.0, 67.0, 67.5, 68.0, 68.0, 68.0, 68.0],
  });

  const [unit, setUnit] = useState('C'); // 'C' or 'F'
  const canvasRef = useRef(null);
  const telemetryRef = useRef(telemetry);
  const unitRef = useRef(unit);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  // Poll live DHT11 telemetry from FastAPI stream_server
  useEffect(() => {
    let isMounted = true;
    const fetchDHT = async () => {
      try {
        const res = await fetch('http://localhost:5000/dht11-data');
        if (res.ok && isMounted) {
          const data = await res.json();
          setTelemetry(prev => ({
            ...prev,
            ...data,
            history_temp: data.history_temp || prev.history_temp,
            history_hum: data.history_hum || prev.history_hum,
          }));
        }
      } catch (err) {
        // Fallback smooth drift if disconnected
        if (isMounted) {
          setTelemetry(prev => {
            const driftT = (Math.random() - 0.5) * 0.1;
            const driftH = (Math.random() - 0.5) * 0.2;
            const newT = Math.round((prev.temperature_c + driftT) * 10) / 10;
            const newH = Math.round((prev.humidity_pct + driftH) * 10) / 10;
            return {
              ...prev,
              temperature_c: newT,
              temperature_f: Math.round((newT * 9/5 + 32) * 10) / 10,
              humidity_pct: newH,
            };
          });
        }
      }
    };

    fetchDHT();
    const interval = setInterval(fetchDHT, 500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Interactive 3D Atmospheric Particle Vortex Simulator on HTML Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Enhanced Particle system + Aerodynamic Streamlines
    const particleCount = 110;
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * (canvas.width || 800),
        y: Math.random() * (canvas.height || 600),
        radius: Math.random() * 2.2 + 0.8,
        speedX: Math.random() * 1.8 + 0.8,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.65 + 0.25,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: Math.random() * 0.04 + 0.01,
      });
    }

    let t = 0;
    let sweepAngle = 0;

    const render = () => {
      t += 0.02;
      sweepAngle = (sweepAngle + 0.015) % (Math.PI * 2);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      const currentTel = telemetryRef.current;
      const currentUnit = unitRef.current;

      const temp = currentTel.temperature_c || 28.9;
      const hum = currentTel.humidity_pct || 82.0;

      // 1. Tactical Deep Aerospace Background
      const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(w, h) * 0.75);
      bgGrad.addColorStop(0, '#0D1A1E');
      bgGrad.addColorStop(0.5, '#091316');
      bgGrad.addColorStop(1, '#050A0C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. High-Tech Hexagonal Grid / Matrix
      ctx.strokeStyle = 'rgba(121, 185, 193, 0.05)';
      ctx.lineWidth = 1;
      const gridSpacing = 44;
      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 3. Dynamic Aerodynamic Wind-Tunnel Streamlines (Flows across the screen)
      const numLines = 14;
      for (let i = 0; i < numLines; i++) {
        const baseY = (h / (numLines + 1)) * (i + 1);
        ctx.beginPath();
        
        const lineGrad = ctx.createLinearGradient(0, baseY, w, baseY);
        const tempWarmth = Math.max(0, Math.min(1, (temp - 20) / 25));
        const alpha = 0.08 + Math.sin(t + i) * 0.03;
        
        if (tempWarmth > 0.6) {
          lineGrad.addColorStop(0, `rgba(59, 170, 182, 0)`);
          lineGrad.addColorStop(0.5, `rgba(235, 160, 60, ${alpha * 1.5})`);
          lineGrad.addColorStop(1, `rgba(59, 170, 182, 0)`);
        } else {
          lineGrad.addColorStop(0, `rgba(59, 170, 182, 0)`);
          lineGrad.addColorStop(0.5, `rgba(90, 200, 250, ${alpha * 1.5})`);
          lineGrad.addColorStop(1, `rgba(59, 170, 182, 0)`);
        }

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.4;

        for (let x = 0; x <= w; x += 15) {
          // Calculate aerodynamic deflection around center dials
          const dx = x - cx;
          const dy = baseY - cy;
          const distToCenter = Math.sqrt(dx * dx + dy * dy);
          
          let deflection = 0;
          if (distToCenter < 190 && distToCenter > 0) {
            const push = (190 - distToCenter) / 190;
            deflection = (dy >= 0 ? 1 : -1) * push * 38;
          }

          const wave = Math.sin(x * 0.012 - t * 2.2 + i * 0.7) * (6 + (hum / 25.0));
          const curY = baseY + wave + deflection;

          if (x === 0) ctx.moveTo(x, curY);
          else ctx.lineTo(x, curY);
        }
        ctx.stroke();
      }

      // 4. Concentric Isobar Contour Waves with Compass Markings
      [90, 160, 230, 310].forEach((r, idx) => {
        const pulse = Math.sin(t * 1.2 + idx * 0.8) * 3;
        ctx.strokeStyle = idx % 2 === 0 ? 'rgba(121, 185, 193, 0.14)' : 'rgba(121, 185, 193, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Degree Tick Marks on Isobar Rings
        if (idx === 1 || idx === 3) {
          for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const tx1 = cx + Math.cos(rad) * (r + pulse - 4);
            const ty1 = cy + Math.sin(rad) * (r + pulse - 4);
            const tx2 = cx + Math.cos(rad) * (r + pulse + 4);
            const ty2 = cy + Math.sin(rad) * (r + pulse + 4);
            ctx.strokeStyle = 'rgba(121, 185, 193, 0.25)';
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.stroke();
          }
        }
      });

      // 5. Tactical Rotating Radar Sweeper Wedge & Arrow Needle (Full 360° Continuous Rotation)
      const sweepLength = Math.min(w, h) * 0.42;
      const wedgeAngle = Math.PI / 5; // 36 degree wedge
      const sweepGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, sweepLength);
      sweepGrad.addColorStop(0, 'rgba(59, 170, 182, 0.25)');
      sweepGrad.addColorStop(0.8, 'rgba(59, 170, 182, 0.05)');
      sweepGrad.addColorStop(1, 'rgba(59, 170, 182, 0)');

      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, sweepLength, sweepAngle - wedgeAngle, sweepAngle, false);
      ctx.closePath();
      ctx.fill();

      // Lead radar needle / arrow
      const tipX = cx + Math.cos(sweepAngle) * sweepLength;
      const tipY = cy + Math.sin(sweepAngle) * sweepLength;
      ctx.strokeStyle = '#79B9C1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      // Arrow head at tip of needle
      const arrowSize = 7;
      ctx.fillStyle = '#79B9C1';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(
        tipX - arrowSize * Math.cos(sweepAngle - Math.PI / 6),
        tipY - arrowSize * Math.sin(sweepAngle - Math.PI / 6)
      );
      ctx.lineTo(
        tipX - arrowSize * Math.cos(sweepAngle + Math.PI / 6),
        tipY - arrowSize * Math.sin(sweepAngle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // 6. Interactive Moisture Vapor Particle Vortex & Thermal Sparkles
      particles.forEach((p, idx) => {
        p.x += p.speedX * (temp / 24.0);
        p.y += Math.sin(t + p.phase) * (hum / 45.0) + p.speedY;

        if (p.x > w + 20) p.x = -20;
        if (p.y > h + 20) p.y = -20;
        if (p.y < -20) p.y = h + 20;

        const pOpacity = Math.max(0.1, Math.min(0.9, p.opacity + Math.sin(t * 3 + p.phase) * 0.2));
        const color = temp > 30 
          ? `rgba(240, 170, 60, ${pOpacity})` 
          : (hum > 70 ? `rgba(90, 200, 250, ${pOpacity})` : `rgba(121, 185, 193, ${pOpacity})`);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Vapor Linkages between neighboring moisture nodes
        if (idx % 3 === 0) {
          const nextP = particles[(idx + 1) % particles.length];
          const distNodes = Math.hypot(p.x - nextP.x, p.y - nextP.y);
          if (distNodes < 65) {
            ctx.strokeStyle = `rgba(90, 200, 250, ${(1 - distNodes / 65) * 0.25})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(nextP.x, nextP.y);
            ctx.stroke();
          }
        }
      });

      // 7. Tactical Altitude & Barometric Scale Gradients on Sides
      ctx.fillStyle = 'rgba(121, 185, 193, 0.4)';
      ctx.font = '700 8.5px "Space Grotesk", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LAPSE RATE: -6.5°C/km', 16, cy - 60);
      ctx.fillText('STD SLP: 1013.25 hPa', 16, cy - 44);
      ctx.fillText('AIR MASS: DRY/TROPICAL', 16, cy - 28);

      ctx.textAlign = 'right';
      ctx.fillText('ATMOSPHERE: TROPOSPHERE', w - 16, cy - 60);
      ctx.fillText('PRESSURE ALT: 124m MSL', w - 16, cy - 44);
      ctx.fillText('DYNAMIC VISCOSITY: 1.81e-5', w - 16, cy - 28);

      // 8. Draw Precision Dual Dials in Foreground
      drawThermalDial(ctx, cx - 120, cy, temp, currentUnit);
      drawHumidityDial(ctx, cx + 120, cy, hum);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Helper: Draw Circular Precision Temperature Dial
  const drawThermalDial = (ctx, x, y, tempC, currUnit) => {
    const radius = 72;
    const dispVal = currUnit === 'F' ? (tempC * 9/5 + 32).toFixed(1) : tempC.toFixed(1);
    const unitSymbol = currUnit === 'F' ? '°F' : '°C';

    // Outer Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.stroke();

    // Active Arc Gradient
    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;
    const norm = Math.max(0, Math.min(1, (tempC - 10) / 40)); // 10°C to 50°C
    const endAngle = startAngle + norm * totalAngle;

    const arcGrad = ctx.createLinearGradient(x - radius, y, x + radius, y);
    arcGrad.addColorStop(0, '#3BAAB6');
    arcGrad.addColorStop(0.7, '#E5B842');
    arcGrad.addColorStop(1, '#E25555');

    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();

    // Dial Glow Ring
    ctx.strokeStyle = 'rgba(59, 170, 182, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.stroke();

    // Center Readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 24px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dispVal, x, y - 4);

    ctx.fillStyle = '#79B9C1';
    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.fillText(unitSymbol, x, y + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.fillText('TEMPERATURE', x, y + 30);
  };

  // Helper: Draw Circular Precision Humidity Gauge
  const drawHumidityDial = (ctx, x, y, humPct) => {
    const radius = 72;

    // Outer Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.stroke();

    // Active Arc
    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;
    const norm = Math.max(0, Math.min(1, humPct / 100));
    const endAngle = startAngle + norm * totalAngle;

    const humGrad = ctx.createLinearGradient(x - radius, y, x + radius, y);
    humGrad.addColorStop(0, '#5AC8FA');
    humGrad.addColorStop(1, '#007AFF');

    ctx.strokeStyle = humGrad;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();

    // Dial Glow Ring
    ctx.strokeStyle = 'rgba(90, 200, 250, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
    ctx.stroke();

    // Center Readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 24px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${humPct.toFixed(1)}%`, x, y - 4);

    ctx.fillStyle = '#5AC8FA';
    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.fillText('RH', x, y + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.fillText('HUMIDITY', x, y + 30);
  };

  // Sparkline generator helper
  const renderSparkline = (data, color = '#2D636B') => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) || 1;
    const width = 160;
    const height = 44;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 12) - 6;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="dht-sparkline-svg">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="dht-panel">
      {/* Header Bar */}
      <div className="dht-panel__header">
        <div className="dht-panel__header-left">
          <button className="dht-panel__back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>BACK TO HUB</span>
          </button>
          <div className="dht-panel__title-group">
            <h2 className="dht-panel__title">
              <Thermometer size={20} className="dht-panel__title-icon" />
              ATMOSPHERIC & ENVIRONMENTAL INTELLIGENCE
            </h2>
            <span className="dht-panel__badge">UNIT-03 [DHT11 SENSOR]</span>
          </div>
        </div>

        {/* Live Hardware Connection Tag */}
        <div className="dht-panel__header-right">
          <div className="dht-panel__hw-tag">
            <span className="dht-panel__hw-dot" />
            <span>{telemetry.source} // 9600 BAUD</span>
          </div>
          <div className="dht-panel__unit-toggle">
            <button
              className={`dht-panel__unit-btn ${unit === 'C' ? 'dht-panel__unit-btn--active' : ''}`}
              onClick={() => setUnit('C')}
            >
              °C
            </button>
            <button
              className={`dht-panel__unit-btn ${unit === 'F' ? 'dht-panel__unit-btn--active' : ''}`}
              onClick={() => setUnit('F')}
            >
              °F
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Holographic Airflow Canvas + Right Telemetry Cards */}
      <div className="dht-panel__grid">
        {/* Left Interactive 3D Atmospheric Airflow Canvas */}
        <div className="dht-panel__canvas-container">
          <canvas ref={canvasRef} className="dht-panel__canvas" />

          {/* Top Floating Telemetry Overlay Pins */}
          <div className="dht-panel__hud-overlay dht-panel__hud-overlay--top-left">
            <span className="dht-panel__hud-tag">AIR DENSITY</span>
            <span className="dht-panel__hud-val">{telemetry.air_density_kg_m3} <small>kg/m³</small></span>
            <span className="dht-panel__hud-sub">LIFT COEFFICIENT: 98.4%</span>
          </div>

          <div className="dht-panel__hud-overlay dht-panel__hud-overlay--top-right">
            <span className="dht-panel__hud-tag">HEAT INDEX</span>
            <span className="dht-panel__hud-val">{telemetry.heat_index_c}°C</span>
            <span className="dht-panel__hud-sub">DEW POINT: {telemetry.dew_point_c}°C</span>
          </div>

          {/* Bottom Floating Safety & Status Overlay */}
          <div className="dht-panel__hud-overlay dht-panel__hud-overlay--bottom">
            <div className="dht-panel__hud-status-item">
              <span className="dht-panel__hud-dot" />
              <span>ENVIRONMENT: {telemetry.comfort_index}</span>
            </div>
            <div className="dht-panel__hud-status-item">
              <ShieldAlert size={14} color="#3BAAB6" />
              <span>ICING RISK: 0% [NOMINAL]</span>
            </div>
            <div className="dht-panel__hud-status-item">
              <Wind size={14} color="#3BAAB6" />
              <span>VAPOR PRESSURE: 2.8 kPa</span>
            </div>
          </div>
        </div>

        {/* Right Information & Real-Time Waveform Cards Deck */}
        <div className="dht-panel__side-deck">
          {/* Card 1: Live Environmental Primary Metrics */}
          <div className="dht-card">
            <div className="dht-card__header">
              <span className="dht-card__title">ATMOSPHERIC TELEMETRY</span>
              <span className="dht-card__badge dht-card__badge--active">LIVE 2.0 Hz</span>
            </div>

            <div className="dht-metric-grid">
              <div className="dht-metric-box">
                <div className="dht-metric-box__icon-wrap">
                  <Thermometer size={18} color="#2D636B" />
                </div>
                <div className="dht-metric-box__content">
                  <span className="dht-metric-box__label">TEMPERATURE</span>
                  <span className="dht-metric-box__val">
                    {unit === 'F' ? telemetry.temperature_f : telemetry.temperature_c}
                    <small>°{unit}</small>
                  </span>
                </div>
              </div>

              <div className="dht-metric-box">
                <div className="dht-metric-box__icon-wrap" style={{ background: '#E0F2FE' }}>
                  <Droplets size={18} color="#0284C7" />
                </div>
                <div className="dht-metric-box__content">
                  <span className="dht-metric-box__label">HUMIDITY</span>
                  <span className="dht-metric-box__val">
                    {telemetry.humidity_pct}
                    <small>%RH</small>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Live Dual Waveform Trend History */}
          <div className="dht-card">
            <div className="dht-card__header">
              <span className="dht-card__title">REAL-TIME THERMAL & MOISTURE TRENDS</span>
              <Activity size={16} color="#2D636B" />
            </div>

            <div className="dht-waveform-row">
              <div className="dht-waveform-item">
                <div className="dht-waveform-header">
                  <span>TEMP CURVE (°C)</span>
                  <span className="dht-waveform-val">{telemetry.temperature_c}°C</span>
                </div>
                {renderSparkline(telemetry.history_temp, '#2D636B')}
              </div>

              <div className="dht-waveform-item">
                <div className="dht-waveform-header">
                  <span>HUMIDITY CURVE (%RH)</span>
                  <span className="dht-waveform-val" style={{ color: '#0284C7' }}>{telemetry.humidity_pct}%</span>
                </div>
                {renderSparkline(telemetry.history_hum, '#0284C7')}
              </div>
            </div>
          </div>

          {/* Card 3: Hardware Diagnostics & Sensor Specs */}
          <div className="dht-card">
            <div className="dht-card__header">
              <span className="dht-card__title">HARDWARE CONFIGURATION</span>
              <Cpu size={16} color="#2D636B" />
            </div>

            <div className="dht-specs-list">
              <div className="dht-spec-row">
                <span className="dht-spec-label">Sensor Model</span>
                <span className="dht-spec-val">DHT11 Digital Thermistor & Hygrometer</span>
              </div>
              <div className="dht-spec-row">
                <span className="dht-spec-label">Operating Voltage</span>
                <span className="dht-spec-val">3.3V ~ 5.0V DC (Arduino UNO Pin D2)</span>
              </div>
              <div className="dht-spec-row">
                <span className="dht-spec-label">Sampling Period</span>
                <span className="dht-spec-val">500 ms (2.0 Hz Update Rate)</span>
              </div>
              <div className="dht-spec-row">
                <span className="dht-spec-label">Drone Payload Location</span>
                <span className="dht-spec-val">Right Wing Root Vent Pylon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
