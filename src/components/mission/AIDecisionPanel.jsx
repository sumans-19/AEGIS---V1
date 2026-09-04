import { useState, useEffect, useRef } from 'react'
import { useSimStore } from '../../store/useSimStore'
import {
  Database, BrainCircuit, CheckCircle2, Loader2, Cpu,
  ChevronDown, ChevronUp, Radio, Clock, Wifi, WifiOff
} from 'lucide-react'

const STREAM_BASE = 'http://localhost:5000'
const MAX_VISIBLE = 12

const styles = {
  panel: { flex: 1, padding: '24px 32px', overflow: 'auto', background: 'var(--bg-primary)' },
  rowContainer: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' },
  rowCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px', background: 'rgba(235, 243, 245, 0.85)',
    backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.95)',
    borderRadius: '10px', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.04)',
    flexWrap: 'wrap', gap: '12px',
  },
  rowSection: { display: 'flex', flexDirection: 'column', gap: '3px' },
  rowLabel: { fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#8A9A9E', fontWeight: 700, letterSpacing: '0.05em' },
  rowValue: { fontFamily: 'var(--font-primary)', fontSize: '12px', color: '#172124', fontWeight: 800 },
  btnGroup: { display: 'flex', gap: '8px', flexShrink: 0 },
  btnPush: { display: 'flex', alignItems: 'center', gap: '6px', background: '#2D636B', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.2s' },
  btnAnalyze: { display: 'flex', alignItems: 'center', gap: '6px', background: '#3BAAB6', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.2s' },
  aiResultBox: { background: 'rgba(255, 255, 255, 0.75)', border: '1px solid rgba(121, 185, 193, 0.5)', borderRadius: '8px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' },
  aiResultText: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#17545C', lineHeight: '1.6', letterSpacing: '0.02em', margin: 0, fontWeight: 700 },
}

export default function AIDecisionPanel() {
  const [liveWindows, setLiveWindows] = useState([])      // from stream_server /sensor-windows
  const [seededData, setSeededData] = useState([          // static seeded entries
    { id: 1, droneName: 'UAV-01 (ARJUN)', timestamp: getWindowTime(0), sensors: { dht11: '27.5°C | 68.0% | Air Dens: 1.18 kg/m³', ina219: '12.4V | 145mA | Pow: 1.8W', radar: '238.5cm (SAFE ZONE)', cam: '1 TARGET (94% LOCK)' }, pushed: false, analyzed: false, isAnalyzing: false, aiDetails: null, aiAction: null },
    { id: 2, droneName: 'UAV-02 (BHIMA)', timestamp: getWindowTime(120000), sensors: { dht11: '32.8°C | 45.5% | Air Dens: 1.12 kg/m³', ina219: '11.8V | 160mA | Pow: 1.9W', radar: '45.2cm (WARN: OBSTACLE)', cam: '2 TARGETS (88% LOCK)' }, pushed: false, analyzed: false, isAnalyzing: false, aiDetails: null, aiAction: null },
    { id: 3, droneName: 'UAV-03 (KARNA)', timestamp: getWindowTime(240000), sensors: { dht11: '24.1°C | 72.3% | Air Dens: 1.20 kg/m³', ina219: '12.1V | 150mA | Pow: 1.8W', radar: '310.0cm (CLEAR)', cam: '0 TARGETS' }, pushed: false, analyzed: false, isAnalyzing: false, aiDetails: null, aiAction: null },
    { id: 4, droneName: 'UAV-04 (KRISHNA)', timestamp: getWindowTime(360000), sensors: { dht11: '28.9°C | 55.1% | Air Dens: 1.15 kg/m³', ina219: '11.5V | 180mA | Pow: 2.1W', radar: '18.5cm (CRITICAL: COLLISION RISK)', cam: '1 TARGET (76% LOCK)' }, pushed: false, analyzed: false, isAnalyzing: false, aiDetails: null, aiAction: null },
  ])
  const [windowProgress, setWindowProgress] = useState({ elapsed: 0, remaining: 120, progress_pct: 0 })
  const [streamOnline, setStreamOnline] = useState(false)
  const [showAllLive, setShowAllLive] = useState(false)
  const [showAllSeeded, setShowAllSeeded] = useState(false)

  // Poll stream server for completed windows + progress
  useEffect(() => {
    const poll = async () => {
      try {
        const [winRes, progRes] = await Promise.all([
          fetch(`${STREAM_BASE}/sensor-windows`),
          fetch(`${STREAM_BASE}/sensor-window-status`)
        ])
        if (winRes.ok && progRes.ok) {
          const wins = await winRes.json()
          const prog = await progRes.json()
          setStreamOnline(true)
          setWindowProgress(prog)
          // Merge into liveWindows, preserving pushed/analyzed state
          setLiveWindows(prev => {
            const prevMap = Object.fromEntries(prev.map(w => [w.id, w]))
            return wins.map(w => prevMap[w.id] ? { ...w, ...{ pushed: prevMap[w.id].pushed, analyzed: prevMap[w.id].analyzed, isAnalyzing: prevMap[w.id].isAnalyzing, aiDetails: prevMap[w.id].aiDetails, aiAction: prevMap[w.id].aiAction } } : w)
          })
        }
      } catch { setStreamOnline(false) }
    }
    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [])

  // Push to DB (works for both live and seeded entries)
  const handlePushToDb = async (id, isLive) => {
    const row = isLive ? liveWindows.find(d => d.id === id) : seededData.find(d => d.id === id)
    if (!row || row.pushed) return
    try {
      const res = await fetch('http://localhost:8000/api/sensors/push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneName: row.droneName, timestamp: row.timestamp, sensors: row.sensors })
      })
      if (res.ok) {
        const update = prev => prev.map(d => d.id === id ? { ...d, pushed: true } : d)
        if (isLive) setLiveWindows(update); else setSeededData(update)
      }
    } catch (e) { console.error(e) }
  }

  // AI Analyze
  const handleAiAnalyze = async (id, isLive) => {
    const row = isLive ? liveWindows.find(d => d.id === id) : seededData.find(d => d.id === id)
    if (!row || row.analyzed || row.isAnalyzing) return
    const setAnalyzing = prev => prev.map(d => d.id === id ? { ...d, isAnalyzing: true } : d)
    if (isLive) setLiveWindows(setAnalyzing); else setSeededData(setAnalyzing)
    try {
      const res = await fetch('http://localhost:8000/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneName: row.droneName, sensors: row.sensors })
      })
      const data = await res.json()
      const update = prev => prev.map(d => d.id === id ? { ...d, isAnalyzing: false, analyzed: true, aiDetails: data.details, aiAction: data.action } : d)
      if (isLive) setLiveWindows(update); else setSeededData(update)
    } catch {
      const fail = prev => prev.map(d => d.id === id ? { ...d, isAnalyzing: false, analyzed: true, aiAction: 'AI OFFLINE: CONNECTION TO COMMAND NODE FAILED.' } : d)
      if (isLive) setLiveWindows(fail); else setSeededData(fail)
    }
  }

  const visibleLive = showAllLive ? liveWindows : liveWindows.slice(0, MAX_VISIBLE)
  const visibleSeeded = showAllSeeded ? seededData : seededData.slice(0, MAX_VISIBLE - liveWindows.length)

  return (
    <div style={styles.panel}>
      {/* ── Header ── */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, letterSpacing: '0.1em', color: '#172124', margin: '0 0 6px' }}>
          SENSOR DATA AGGREGATION & AI ANALYSIS
        </h3>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#55666B', margin: 0, letterSpacing: '0.04em' }}>
          CONSOLIDATED SENSOR WINDOWS // 2-MIN ROLLING AVERAGE // PENDING AI EVALUATION
        </p>
      </div>

      {/* ── Live Hardware Status Bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '12px 20px', background: 'rgba(235, 243, 245, 0.7)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.9)', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {streamOnline ? <Wifi size={14} color="#2D636B" /> : <WifiOff size={14} color="#dc3545" />}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: streamOnline ? '#2D636B' : '#dc3545' }}>
            {streamOnline ? 'HARDWARE STREAM CONNECTED' : 'STREAM OFFLINE — SHOWING SEEDED DATA'}
          </span>
        </div>
        {streamOnline && (
          <>
            <div style={{ width: '1px', height: '20px', background: 'rgba(0,0,0,0.1)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <Clock size={12} color="#55666B" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#55666B', fontWeight: 700 }}>
                NEXT WINDOW IN {Math.ceil(windowProgress.remaining)}s
              </span>
              <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${windowProgress.progress_pct}%`, background: 'linear-gradient(90deg, #2D636B, #3BAAB6)', borderRadius: '2px', transition: 'width 1s linear' }} />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#3BAAB6', fontWeight: 800 }}>
                {windowProgress.progress_pct.toFixed(0)}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={12} color="#3BAAB6" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#55666B', fontWeight: 700 }}>
                {liveWindows.length} WINDOW{liveWindows.length !== 1 ? 'S' : ''} CAPTURED
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Live Hardware Windows ── */}
      {liveWindows.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2D636B', animation: 'pulse 2s infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: '#2D636B', letterSpacing: '0.08em' }}>
              LIVE HARDWARE DATA — UAV-01 SENSOR PAYLOAD
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#8A9A9E', marginLeft: 'auto' }}>
              {liveWindows.length} TOTAL {liveWindows.length > MAX_VISIBLE ? `/ SHOWING ${MAX_VISIBLE}` : ''}
            </span>
          </div>

          {visibleLive.map(row => (
            <WindowRow key={row.id} row={row} isLive onPush={() => handlePushToDb(row.id, true)} onAnalyze={() => handleAiAnalyze(row.id, true)} />
          ))}

          {liveWindows.length > MAX_VISIBLE && (
            <button onClick={() => setShowAllLive(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px', background: 'rgba(59, 170, 182, 0.06)', border: '1px dashed rgba(59, 170, 182, 0.35)', borderRadius: '8px', cursor: 'pointer', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: '#3BAAB6', marginTop: '4px' }}>
              {showAllLive ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showAllLive ? 'COLLAPSE' : `+ ${liveWindows.length - MAX_VISIBLE} MORE WINDOWS — CLICK TO EXPAND`}
            </button>
          )}
        </div>
      )}

      {/* ── Seeded / Baseline Windows ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#79B9C1' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: '#55666B', letterSpacing: '0.08em' }}>
            {streamOnline ? 'BASELINE / SEEDED REFERENCE DATA' : 'DEMO DATA — CONNECT HARDWARE FOR LIVE WINDOWS'}
          </span>
        </div>

        {visibleSeeded.map(row => (
          <WindowRow key={row.id} row={row} isLive={false} onPush={() => handlePushToDb(row.id, false)} onAnalyze={() => handleAiAnalyze(row.id, false)} />
        ))}

        {seededData.length > (MAX_VISIBLE - liveWindows.length) && (
          <button onClick={() => setShowAllSeeded(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '12px', background: 'rgba(121, 185, 193, 0.06)', border: '1px dashed rgba(121, 185, 193, 0.35)', borderRadius: '8px', cursor: 'pointer', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 800, color: '#79B9C1', marginTop: '4px' }}>
            {showAllSeeded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showAllSeeded ? 'COLLAPSE' : `+ ${seededData.length - (MAX_VISIBLE - liveWindows.length)} MORE ENTRIES`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Reusable row component ──
function WindowRow({ row, isLive, onPush, onAnalyze }) {
  const isCritical = row.sensors?.radar?.includes('CRITICAL')

  return (
    <div style={styles.rowContainer}>
      <div style={{ ...styles.rowCard, border: isCritical ? '1px solid rgba(220, 53, 69, 0.3)' : '1px solid rgba(255, 255, 255, 0.95)', background: isCritical ? 'rgba(220, 53, 69, 0.05)' : 'rgba(235, 243, 245, 0.85)' }}>
        {/* Drone + Timestamp */}
        <div style={{ ...styles.rowSection, width: '150px' }}>
          <span style={styles.rowLabel}>TARGET UNIT</span>
          <span style={styles.rowValue}>{row.droneName}</span>
        </div>
        <div style={{ ...styles.rowSection, width: '130px' }}>
          <span style={styles.rowLabel}>WINDOW</span>
          <span style={{ ...styles.rowValue, fontSize: '10px', color: '#55666B' }}>{row.timestamp}</span>
        </div>

        {/* Sensor readings */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, borderLeft: '1px solid rgba(0,0,0,0.08)', borderRight: '1px solid rgba(0,0,0,0.08)', padding: '0 20px', flexWrap: 'wrap' }}>
          <SensorField label="DHT11" value={row.sensors?.dht11} color="#3BAAB6" />
          <SensorField label="INA219" value={row.sensors?.ina219} color="#2D636B" />
          <SensorField label="RADAR" value={row.sensors?.radar} color={isCritical ? '#dc3545' : row.sensors?.radar?.includes('WARN') ? '#e67e22' : '#79B9C1'} />
          <SensorField label="CAMERA" value={row.sensors?.cam} color="#1a565e" />
        </div>

        {/* Source badge + Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {isLive && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 800, color: '#2D636B', background: 'rgba(45, 99, 107, 0.1)', padding: '2px 6px', borderRadius: '3px', letterSpacing: '0.05em' }}>
              ● LIVE HW
            </span>
          )}
          <div style={styles.btnGroup}>
            <button style={{ ...styles.btnPush, opacity: row.pushed ? 0.55 : 1, background: row.pushed ? '#6C7F84' : '#2D636B' }} onClick={onPush} disabled={row.pushed}>
              {row.pushed ? <CheckCircle2 size={12} /> : <Database size={12} />}
              {row.pushed ? 'PUSHED' : 'PUSH TO DB'}
            </button>
            <button style={{ ...styles.btnAnalyze, opacity: (row.analyzed || row.isAnalyzing) ? 0.55 : 1, background: (row.analyzed || row.isAnalyzing) ? '#6C7F84' : '#3BAAB6' }} onClick={onAnalyze} disabled={row.analyzed || row.isAnalyzing}>
              {row.isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : row.analyzed ? <CheckCircle2 size={12} /> : <BrainCircuit size={12} />}
              {row.isAnalyzing ? 'ANALYZING...' : row.analyzed ? 'ANALYZED' : 'AI ANALYZE'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Result */}
      {(row.aiAction || row.aiDetails) && (
        <div style={styles.aiResultBox}>
          <div style={{ padding: '6px', background: 'rgba(121, 185, 193, 0.15)', borderRadius: '6px', flexShrink: 0 }}>
            <Cpu size={18} color="#2D636B" />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '10px', color: '#71888D', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '8px', letterSpacing: '0.1em' }}>
              AEGIS TACTICAL DIRECTIVE
            </span>
            {row.aiDetails && (
              <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(121, 185, 193, 0.2)' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#2D636B', fontFamily: 'var(--font-mono)', marginRight: '6px' }}>DETAILS:</span>
                <span style={{ fontSize: '12px', color: '#172124', lineHeight: '1.5', opacity: 0.9 }}>{row.aiDetails}</span>
              </div>
            )}
            <div>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#2D636B', fontFamily: 'var(--font-mono)', marginRight: '6px' }}>ACTION:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#1a565e', lineHeight: '1.6', letterSpacing: '0.02em', fontWeight: 700 }}>{row.aiAction}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SensorField({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: '#8A9A9E', fontWeight: 700, letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-primary)', fontSize: '11px', color: color || '#172124', fontWeight: 800 }}>{value || '—'}</span>
    </div>
  )
}

function getWindowTime(offsetMs) {
  const d2 = new Date(Date.now() - offsetMs)
  const d1 = new Date(d2.getTime() - 120000)
  return `${d1.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${d2.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}