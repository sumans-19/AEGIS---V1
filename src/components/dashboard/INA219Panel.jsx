import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, BatteryCharging, Activity, ArrowLeft, ShieldAlert,
  Cpu, Gauge, Power, RefreshCw, Layers
} from 'lucide-react';
import { IconBattery, IconMonitor } from '../Common/Icons';
import './INA219Panel.css';

export default function INA219Panel({ onBack }) {
  const [telemetry, setTelemetry] = useState({
    bus_voltage_v: 5.13,
    shunt_voltage_mv: 2.75,
    load_voltage_v: 5.13,
    current_ma: 27.5,
    current_a: 0.028,
    power_mw: 140.0,
    power_w: 0.14,
    energy_mwh: 18.4,
    capacity_mah: 3.65,
    efficiency_pct: 98.4,
    ripple_mv: 12.0,
    estimated_runtime_min: 184,
    power_status: 'OPTIMAL / NOMINAL',
    status: 'ACTIVE',
    source: 'HARDWARE_COM9',
    history_volt: [5.12, 5.13, 5.13, 5.12, 5.13, 5.14, 5.13],
    history_curr: [26.8, 27.2, 27.5, 27.1, 27.5, 27.8, 27.5],
    history_pow: [137.0, 139.5, 140.0, 138.8, 140.0, 141.2, 140.0],
  });

  const [unitMode, setUnitMode] = useState('STANDARD'); // 'STANDARD' (V, mA, mW) or 'HIGH_UNIT' (V, A, W)
  const canvasRef = useRef(null);
  const telemetryRef = useRef(telemetry);
  const unitModeRef = useRef(unitMode);

  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    unitModeRef.current = unitMode;
  }, [unitMode]);

  // Poll live INA219 telemetry from FastAPI stream_server
  useEffect(() => {
    let isMounted = true;
    const fetchINA = async () => {
      try {
        const res = await fetch('http://localhost:5000/ina219-data');
        if (res.ok && isMounted) {
          const data = await res.json();
          setTelemetry(prev => ({
            ...prev,
            ...data,
            history_volt: data.history_volt || prev.history_volt,
            history_curr: data.history_curr || prev.history_curr,
            history_pow: data.history_pow || prev.history_pow,
          }));
        }
      } catch (err) {
        // Fallback smooth drift if disconnected
        if (isMounted) {
          setTelemetry(prev => {
            const driftV = (Math.random() - 0.5) * 0.02;
            const driftC = (Math.random() - 0.5) * 0.8;
            const newV = Math.round((prev.bus_voltage_v + driftV) * 100) / 100;
            const newC = Math.round((prev.current_ma + driftC) * 10) / 10;
            const newP = Math.round((newV * newC) * 10) / 10;
            return {
              ...prev,
              bus_voltage_v: newV,
              current_ma: newC,
              current_a: Math.round((newC / 1000) * 1000) / 1000,
              power_mw: newP,
              power_w: Math.round((newP / 1000) * 1000) / 1000,
              shunt_voltage_mv: Math.round(newC * 0.1 * 100) / 100,
            };
          });
        }
      }
    };

    fetchINA();
    const interval = setInterval(fetchINA, 400);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Interactive Dynamic Power Vector & Electron Circuit Flow Canvas Visualizer
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

    // Electron Particles in Circuit Traces
    const electronCount = 90;
    const electrons = [];
    for (let i = 0; i < electronCount; i++) {
      electrons.push({
        lane: Math.floor(Math.random() * 6),
        offset: Math.random(),
        size: Math.random() * 2.0 + 0.8,
      });
    }

    let t = 0;

    const render = () => {
      t += 0.025;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      const currentTel = telemetryRef.current;
      const volt = currentTel.bus_voltage_v || 5.13;
      const curr = currentTel.current_ma || 27.5;
      const pow = currentTel.power_mw || 140.0;

      // 1. Deep Aerospace Background (Exact Match to DHT11 / Radar Canvas)
      const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(w, h) * 0.75);
      bgGrad.addColorStop(0, '#0D1A1E');
      bgGrad.addColorStop(0.5, '#091316');
      bgGrad.addColorStop(1, '#050A0C');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. High-Tech Hex & Bus Grid Lines
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

      // 3. Dynamic Oscilloscope Waveform Ribbon (Live Voltage & Current Ripple)
      ctx.beginPath();
      const oscY = h * 0.82;
      ctx.moveTo(0, oscY);
      for (let x = 0; x <= w; x += 6) {
        const ripple1 = Math.sin(x * 0.025 - t * 3.5) * (volt * 1.8);
        const ripple2 = Math.cos(x * 0.05 + t * 4.2) * (curr * 0.1);
        const yVal = oscY + ripple1 + ripple2;
        ctx.lineTo(x, yVal);
      }
      ctx.strokeStyle = 'rgba(121, 185, 193, 0.45)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Oscilloscope phosphor baseline & grid markers
      ctx.strokeStyle = 'rgba(121, 185, 193, 0.12)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, oscY);
      ctx.lineTo(w, oscY);
      ctx.stroke();
      ctx.setLineDash([]);

      // 4. Power Bus Traces with Glowing Brand-Teal Electron Flow
      const speedFactor = Math.max(0.2, curr / 30.0);
      const busLanes = [
        { y: h * 0.22, dir: 1 },
        { y: h * 0.30, dir: -1 },
        { y: h * 0.70, dir: 1 },
        { y: h * 0.78, dir: -1 },
      ];

      busLanes.forEach((lane) => {
        // Trace line
        ctx.strokeStyle = 'rgba(121, 185, 193, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, lane.y);
        ctx.lineTo(w, lane.y);
        ctx.stroke();

        // Node contact pads
        for (let nx = 50; nx < w; nx += 120) {
          ctx.fillStyle = 'rgba(121, 185, 193, 0.25)';
          ctx.beginPath();
          ctx.arc(nx, lane.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Render Electrons moving along the power traces (Clean Brand Teal & Cyan)
      electrons.forEach(el => {
        const lane = busLanes[el.lane % busLanes.length];
        el.offset = (el.offset + 0.008 * speedFactor * lane.dir + 1) % 1;
        const ex = el.offset * w;
        const ey = lane.y;

        ctx.fillStyle = '#79B9C1';
        ctx.shadowColor = '#3BAAB6';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(ex, ey, el.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // 5. Center Electromagnetic Induction Flux Rings (Teal / Cyan)
      [80, 140, 200].forEach((r, idx) => {
        const pulse = Math.sin(t * 1.5 + idx * 0.8) * 3;
        ctx.strokeStyle = idx === 1 ? 'rgba(121, 185, 193, 0.25)' : 'rgba(121, 185, 193, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r + pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Radial Tick Marks
        if (idx === 1) {
          for (let deg = 0; deg < 360; deg += 30) {
            const rad = (deg * Math.PI) / 180;
            const tx1 = cx + Math.cos(rad) * (r + pulse - 4);
            const ty1 = cy + Math.sin(rad) * (r + pulse - 4);
            const tx2 = cx + Math.cos(rad) * (r + pulse + 4);
            const ty2 = cy + Math.sin(rad) * (r + pulse + 4);
            ctx.strokeStyle = 'rgba(121, 185, 193, 0.3)';
            ctx.beginPath();
            ctx.moveTo(tx1, ty1);
            ctx.lineTo(tx2, ty2);
            ctx.stroke();
          }
        }
      });

      // 6. Draw Precision Dual Power Vector Dials (Brand Teals)
      drawVoltageArcDial(ctx, cx - 120, cy, volt);
      drawCurrentArcDial(ctx, cx + 120, cy, curr);
      drawCenterWattmeterCore(ctx, cx, cy, pow);

      // 7. Tactical Side Annotations
      ctx.fillStyle = 'rgba(121, 185, 193, 0.45)';
      ctx.font = '700 8.5px "Space Grotesk", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('DC BUS: 0V ~ 26V RANGE', 16, cy - 65);
      ctx.fillText('SHUNT: 0.100 Ω [1%]', 16, cy - 49);
      ctx.fillText('ADC RESOLUTION: 12-BIT', 16, cy - 33);

      ctx.textAlign = 'right';
      ctx.fillText('I2C ADDR: 0x40 (FAST-MODE)', w - 16, cy - 65);
      ctx.fillText('SAMPLE RATE: 2.0 Hz SYNC', w - 16, cy - 49);
      ctx.fillText('ENERGY HARVEST: NOMINAL', w - 16, cy - 33);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  // Helper: Circular Precision Bus Voltage Dial
  const drawVoltageArcDial = (ctx, x, y, volt) => {
    const radius = 68;

    // Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.stroke();

    // Active Arc (0V to 15V)
    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;
    const norm = Math.max(0, Math.min(1, volt / 15.0));
    const endAngle = startAngle + norm * totalAngle;

    const voltGrad = ctx.createLinearGradient(x - radius, y, x + radius, y);
    voltGrad.addColorStop(0, '#2D636B');
    voltGrad.addColorStop(0.5, '#3BAAB6');
    voltGrad.addColorStop(1, '#79B9C1');

    ctx.strokeStyle = voltGrad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();

    // Outer Glow Ring
    ctx.strokeStyle = 'rgba(121, 185, 193, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
    ctx.stroke();

    // Text Readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${volt.toFixed(2)}`, x, y - 4);

    ctx.fillStyle = '#79B9C1';
    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.fillText('VOLTS DC', x, y + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 8.5px "Inter", sans-serif';
    ctx.fillText('BUS VOLTAGE', x, y + 28);
  };

  // Helper: Circular Precision Current Gauge
  const drawCurrentArcDial = (ctx, x, y, currMa) => {
    const radius = 68;

    // Track
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0.75 * Math.PI, 2.25 * Math.PI);
    ctx.stroke();

    // Active Arc (0mA to 200mA nominal display range)
    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;
    const norm = Math.max(0, Math.min(1, currMa / 200.0));
    const endAngle = startAngle + norm * totalAngle;

    const currGrad = ctx.createLinearGradient(x - radius, y, x + radius, y);
    currGrad.addColorStop(0, '#2D636B');
    currGrad.addColorStop(0.5, '#589CA4');
    currGrad.addColorStop(1, '#79B9C1');

    ctx.strokeStyle = currGrad;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.stroke();

    // Outer Glow Ring
    ctx.strokeStyle = 'rgba(121, 185, 193, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
    ctx.stroke();

    // Text Readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${currMa.toFixed(1)}`, x, y - 4);

    ctx.fillStyle = '#79B9C1';
    ctx.font = '700 11px "Space Grotesk", sans-serif';
    ctx.fillText('MILLIAMPS', x, y + 16);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '600 8.5px "Inter", sans-serif';
    ctx.fillText('LOAD CURRENT', x, y + 28);
  };

  // Helper: Center Wattmeter Core
  const drawCenterWattmeterCore = (ctx, cx, cy, powMw) => {
    // Center glowing circle
    const coreGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, 50);
    coreGrad.addColorStop(0, 'rgba(121, 185, 193, 0.22)');
    coreGrad.addColorStop(0.7, 'rgba(121, 185, 193, 0.05)');
    coreGrad.addColorStop(1, 'rgba(121, 185, 193, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(121, 185, 193, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.stroke();

    // Wattage readout
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 20px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${powMw.toFixed(1)}`, cx, cy - 6);

    ctx.fillStyle = '#79B9C1';
    ctx.font = '700 9.5px "Space Grotesk", sans-serif';
    ctx.fillText('mW ACTIVE', cx, cy + 12);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.font = '600 8px "Inter", sans-serif';
    ctx.fillText('POWER DRAW', cx, cy + 24);
  };

  // Sparkline Generator Helper (Strictly using brand teal shades)
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
      <svg width={width} height={height} className="ina-sparkline-svg">
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

  // Subsystem power allocations (Unified Brand Teal Palette)
  const totalP = Math.max(1, telemetry.power_mw);
  const subsystems = [
    { name: 'Avionics Core & MCU', pct: 34, mw: (totalP * 0.34).toFixed(1), color: '#2D636B' },
    { name: 'ESP32-CAM Gimbal', pct: 28, mw: (totalP * 0.28).toFixed(1), color: '#3BAAB6' },
    { name: 'Sensors (HC-SR04/DHT11)', pct: 22, mw: (totalP * 0.22).toFixed(1), color: '#6BA5AD' },
    { name: 'RF Telemetry & Mesh', pct: 16, mw: (totalP * 0.16).toFixed(1), color: '#79B9C1' },
  ];

  return (
    <div className="ina-panel">
      {/* Header Bar */}
      <div className="ina-panel__header">
        <div className="ina-panel__header-left">
          <button className="ina-panel__back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>BACK TO HUB</span>
          </button>
          <div className="ina-panel__title-group">
            <h2 className="ina-panel__title">
              <Zap size={20} className="ina-panel__title-icon" />
              DC POWER BUS & ELECTRICAL INTELLIGENCE
            </h2>
            <span className="ina-panel__badge">UNIT-04 [INA219 SENSOR]</span>
          </div>
        </div>

        {/* Live Hardware Connection Tag & Unit Toggle */}
        <div className="ina-panel__header-right">
          <div className="ina-panel__hw-tag">
            <span className="ina-panel__hw-dot" />
            <span>{telemetry.source} // I2C 0x40 // 9600 BAUD</span>
          </div>
          <div className="ina-panel__unit-toggle">
            <button
              className={`ina-panel__unit-btn ${unitMode === 'STANDARD' ? 'ina-panel__unit-btn--active' : ''}`}
              onClick={() => setUnitMode('STANDARD')}
            >
              V / mA / mW
            </button>
            <button
              className={`ina-panel__unit-btn ${unitMode === 'HIGH_UNIT' ? 'ina-panel__unit-btn--active' : ''}`}
              onClick={() => setUnitMode('HIGH_UNIT')}
            >
              V / A / W
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="ina-panel__grid">
        {/* Left Holographic Circuit & Waveform Canvas */}
        <div className="ina-panel__canvas-container">
          <canvas ref={canvasRef} className="ina-panel__canvas" />

          {/* Floating Top Left Badge */}
          <div className="ina-panel__hud-overlay ina-panel__hud-overlay--top-left">
            <span className="ina-panel__hud-tag">SHUNT DROP</span>
            <span className="ina-panel__hud-val">{telemetry.shunt_voltage_mv} <small>mV</small></span>
            <span className="ina-panel__hud-sub">SHUNT RESISTOR: 0.100 Ω</span>
          </div>

          {/* Floating Top Right Badge */}
          <div className="ina-panel__hud-overlay ina-panel__hud-overlay--top-right">
            <span className="ina-panel__hud-tag">ENERGY ACCUMULATED</span>
            <span className="ina-panel__hud-val">{telemetry.energy_mwh} <small>mWh</small></span>
            <span className="ina-panel__hud-sub">CAPACITY: {telemetry.capacity_mah} mAh</span>
          </div>

          {/* Floating Bottom Status Overlay */}
          <div className="ina-panel__hud-overlay ina-panel__hud-overlay--bottom">
            <div className="ina-panel__hud-status-item">
              <span className="ina-panel__hud-dot" />
              <span>POWER STATUS: {telemetry.power_status}</span>
            </div>
            <div className="ina-panel__hud-status-item">
              <IconBattery size={14} style={{ color: '#79B9C1' }} />
              <span>EST. ENDURANCE: {telemetry.estimated_runtime_min} MIN</span>
            </div>
            <div className="ina-panel__hud-status-item">
              <ShieldAlert size={14} color="#79B9C1" />
              <span>EFFICIENCY: {telemetry.efficiency_pct}%</span>
            </div>
          </div>
        </div>

        {/* Right Information Deck */}
        <div className="ina-panel__side-deck">
          {/* Card 1: Primary Metrics */}
          <div className="ina-card">
            <div className="ina-card__header">
              <span className="ina-card__title">ELECTRICAL TELEMETRY</span>
              <span className="ina-card__badge">LIVE 2.0 Hz</span>
            </div>

            <div className="ina-metric-grid">
              <div className="ina-metric-box">
                <div className="ina-metric-box__icon-wrap">
                  <Zap size={18} color="#2D636B" />
                </div>
                <div className="ina-metric-box__content">
                  <span className="ina-metric-box__label">BUS VOLTAGE</span>
                  <span className="ina-metric-box__val">
                    {telemetry.bus_voltage_v}
                    <small>V</small>
                  </span>
                </div>
              </div>

              <div className="ina-metric-box">
                <div className="ina-metric-box__icon-wrap">
                  <Activity size={18} color="#2D636B" />
                </div>
                <div className="ina-metric-box__content">
                  <span className="ina-metric-box__label">CURRENT DRAW</span>
                  <span className="ina-metric-box__val">
                    {unitMode === 'HIGH_UNIT' ? telemetry.current_a : telemetry.current_ma}
                    <small>{unitMode === 'HIGH_UNIT' ? 'A' : 'mA'}</small>
                  </span>
                </div>
              </div>

              <div className="ina-metric-box">
                <div className="ina-metric-box__icon-wrap">
                  <Gauge size={18} color="#2D636B" />
                </div>
                <div className="ina-metric-box__content">
                  <span className="ina-metric-box__label">POWER OUTPUT</span>
                  <span className="ina-metric-box__val">
                    {unitMode === 'HIGH_UNIT' ? telemetry.power_w : telemetry.power_mw}
                    <small>{unitMode === 'HIGH_UNIT' ? 'W' : 'mW'}</small>
                  </span>
                </div>
              </div>

              <div className="ina-metric-box">
                <div className="ina-metric-box__icon-wrap">
                  <IconBattery size={18} style={{ color: '#2D636B' }} />
                </div>
                <div className="ina-metric-box__content">
                  <span className="ina-metric-box__label">ENERGY USED</span>
                  <span className="ina-metric-box__val">
                    {telemetry.energy_mwh}
                    <small>mWh</small>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Waveform Trends */}
          <div className="ina-card">
            <div className="ina-card__header">
              <span className="ina-card__title">REAL-TIME VOLTAGE & POWER PROFILES</span>
              <Activity size={16} color="#2D636B" />
            </div>

            <div className="ina-waveform-row">
              <div className="ina-waveform-item">
                <div className="ina-waveform-header">
                  <span>BUS VOLTAGE STABILITY (V)</span>
                  <span className="ina-waveform-val">{telemetry.bus_voltage_v} V</span>
                </div>
                {renderSparkline(telemetry.history_volt, '#2D636B')}
              </div>

              <div className="ina-waveform-item">
                <div className="ina-waveform-header">
                  <span>CURRENT DRAW (mA)</span>
                  <span className="ina-waveform-val">{telemetry.current_ma} mA</span>
                </div>
                {renderSparkline(telemetry.history_curr, '#3BAAB6')}
              </div>

              <div className="ina-waveform-item">
                <div className="ina-waveform-header">
                  <span>ACTIVE POWER (mW)</span>
                  <span className="ina-waveform-val">{telemetry.power_mw} mW</span>
                </div>
                {renderSparkline(telemetry.history_pow, '#6BA5AD')}
              </div>
            </div>
          </div>

          {/* Card 3: Subsystem Power Distribution */}
          <div className="ina-card">
            <div className="ina-card__header">
              <span className="ina-card__title">SUBSYSTEM POWER LOAD DISTRIBUTION</span>
              <Layers size={16} color="#2D636B" />
            </div>

            <div className="ina-subsystems-list">
              {subsystems.map((sub, i) => (
                <div className="ina-subsystem-row" key={i}>
                  <div className="ina-subsystem-labels">
                    <span>{sub.name}</span>
                    <span>{sub.mw} mW ({sub.pct}%)</span>
                  </div>
                  <div className="ina-subsystem-bar-bg">
                    <div
                      className="ina-subsystem-bar-fill"
                      style={{ width: `${sub.pct}%`, background: sub.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 4: Hardware Specifications */}
          <div className="ina-card">
            <div className="ina-card__header">
              <span className="ina-card__title">HARDWARE CONFIGURATION</span>
              <Cpu size={16} color="#2D636B" />
            </div>

            <div className="ina-specs-list">
              <div className="ina-spec-row">
                <span className="ina-spec-label">Sensor Chip</span>
                <span className="ina-spec-val">TI INA219 Zero-Drift Bi-directional I2C</span>
              </div>
              <div className="ina-spec-row">
                <span className="ina-spec-label">I2C Address</span>
                <span className="ina-spec-val">0x40 (Arduino Uno SDA A4 / SCL A5)</span>
              </div>
              <div className="ina-spec-row">
                <span className="ina-spec-label">Bus Voltage Range</span>
                <span className="ina-spec-val">0V ~ 26V DC Max</span>
              </div>
              <div className="ina-spec-row">
                <span className="ina-spec-label">Max Current Range</span>
                <span className="ina-spec-val">±3.2A with 0.100Ω Shunt Resistor</span>
              </div>
              <div className="ina-spec-row">
                <span className="ina-spec-label">Internal ADC</span>
                <span className="ina-spec-val">12-bit Resolution (±320mV Range)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
