import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimStore } from '../../store/useSimStore'
import { X } from 'lucide-react'

const INITIAL_DRONES = [
  { id: 1, name: 'Falcon',   battery: 100, thermal: true, obstacle: 10, signal: 100, cpu: 40 },
  { id: 2, name: 'Eagle',   battery: 100, thermal: true, obstacle: 10, signal: 100, cpu: 40 },
  { id: 3, name: 'Hawk',   battery: 100, thermal: true, obstacle: 10, signal: 100, cpu: 40 },
  { id: 4, name: 'Raven', battery: 100, thermal: true, obstacle: 10, signal: 100, cpu: 40 },
  { id: 5, name: 'Owl',     battery: 100, thermal: true, obstacle: 10, signal: 100, cpu: 40 },
]

const styles = {
  panel: {
    background: 'rgba(235, 243, 245, 0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    padding: '16px 24px',
    maxHeight: '70vh',
    overflow: 'auto',
    borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
    userSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '14px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '15px',
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: '#172124',
    margin: 0,
  },
  subtitle: {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: '#55666B',
    margin: '3px 0 0',
  },
  tableWrap: {
    overflowX: 'auto',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.07)',
    background: 'rgba(255, 255, 255, 0.7)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#55666B',
    fontWeight: 700,
    letterSpacing: '0.04em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.07)',
    background: 'rgba(255, 255, 255, 0.85)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '8px 12px',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    color: '#1F282B',
    verticalAlign: 'middle',
  },
  row: (selected) => ({
    cursor: 'pointer',
    background: selected ? '#B9DCE1' : 'transparent',
    boxShadow: selected ? 'inset 3px 0 0 #79B9C1' : 'none',
    transition: 'background 0.15s ease',
  }),
  name: {
    color: '#172124',
    fontWeight: 800,
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-primary)',
  },
  input: {
    width: '60px',
    padding: '4px 8px',
    background: '#FFFFFF',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '4px',
    color: '#172124',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
  },
  toggle: (on) => ({
    padding: '3px 8px',
    borderRadius: '4px',
    border: `1px solid ${on ? '#58ba8a' : '#dc3545'}`,
    background: on ? 'rgba(88, 186, 138, 0.15)' : 'rgba(220, 53, 69, 0.15)',
    color: on ? '#2e7d5a' : '#dc3545',
    cursor: 'pointer',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.04em',
  }),
  simulateBtn: (loading) => ({
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #D4A844',
    background: loading ? 'rgba(212, 168, 68, 0.08)' : 'rgba(212, 168, 68, 0.2)',
    color: loading ? '#8A9A9E' : '#8B6B1B',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.04em',
    transition: 'all 0.18s ease',
    whiteSpace: 'nowrap',
  }),
  linkBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #79B9C1',
    background: 'rgba(121, 185, 193, 0.15)',
    color: '#1a565e',
    fontFamily: 'var(--font-primary)',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.06em',
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    textTransform: 'uppercase',
  },
  closeBtn: {
    background: 'rgba(0, 0, 0, 0.04)',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '5px',
    color: '#55666B',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.18s ease',
  },
  liveBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '8.5px',
    color: '#2e7d5a',
    letterSpacing: '0.04em',
    fontWeight: 700,
    margin: '3px 0 0',
  },
  error: {
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(220, 53, 69, 0.4)',
    background: 'rgba(220, 53, 69, 0.1)',
    color: '#dc3545',
    fontFamily: 'var(--font-primary)',
    fontSize: '10px',
    fontWeight: 600,
  },
  simResult: {
    marginTop: '12px',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(212, 168, 68, 0.4)',
    background: 'rgba(212, 168, 68, 0.1)',
    color: '#8B6B1B',
    fontFamily: 'var(--font-primary)',
    fontSize: '10px',
    lineHeight: '1.6',
    fontWeight: 600,
  },
}

// POST to /override — syncs a drone's telemetry overrides to backend
async function applyOverride(drone) {
  await fetch('http://localhost:8000/override', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: drone.id,
      battery: drone.battery,
      thermal: drone.thermal,
      obstacle: drone.obstacle,
      signal: drone.signal,
      cpu: drone.cpu,
    }),
  })
}

export default function SimulationPanel({ onClose }) {
  const navigate = useNavigate()
  const backendConnected = useSimStore((s) => s.backendConnected)
  const liveAiDrones = useSimStore((s) => s.liveAiDrones)
  const updateDroneInStore = useSimStore((s) => s.updateDrone)

  const [drones, setDrones] = useState(INITIAL_DRONES)
  const [selectedDrone, setSelectedDrone] = useState(1)
  const [error, setError] = useState(null)
  const [simResult, setSimResult] = useState(null)
  const [loadingId, setLoadingId] = useState(null)

  const updateDrone = (id, field, value) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    )
  }

  const parseNum = (value, fallback = 0) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  // Manual sync function to apply overrides when a button is clicked
  const handleApplyOverride = async (drone) => {
    try {
      await applyOverride(drone)
    } catch (e) {
      setError(e.message || 'Override sync failed')
    }
  }

  // POST /simulate — calls the AI engine with the current panel values
  const simulateFailure = async (drone) => {
    setLoadingId(drone.id)
    setError(null)
    setSimResult(null)
    await handleApplyOverride(drone) // Sync overrides before running AI
    try {
      const res = await fetch('http://localhost:8000/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: drone.id,
          battery: drone.battery,
          thermal: drone.thermal,
          obstacle: drone.obstacle,
          signal: drone.signal,
          cpu: drone.cpu,
          propeller: 100,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      // Normalize action from returned result (may be dict or string)
      const rawAction = data.action
      const action =
        typeof rawAction === 'string'
          ? rawAction
          : rawAction?.action || 'CONTINUE_MISSION'
      const reason =
        typeof rawAction === 'object' && rawAction !== null
          ? rawAction.reason || ''
          : ''

      // Update the central store so Scene3D labels + AI Dashboard reflect it
      updateDroneInStore(drone.id, {
        action,
        reason,
        status: data.status || 'ACTIVE',
        battery: drone.battery,
        signal: drone.signal,
        cpu: drone.cpu,
        nearby: data.nearby_drone_id ?? null,
        isSimulated: true,
      })

      setSimResult({
        name: drone.name,
        action,
        reason,
        status: data.status || 'ACTIVE',
        nearby: data.nearby_drone_id,
      })
    } catch (e) {
      setError(`Simulation failed: ${e.message}`)
    } finally {
      setLoadingId(null)
    }
  }

  const activeCount = (liveAiDrones || []).filter(
    (d) => d.action && d.action.action !== 'CONTINUE_MISSION',
  ).length

  const selected = drones.find((d) => d.id === selectedDrone)

  return (
    <section style={styles.panel} aria-label="Drone failure simulation">
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>DRONE FAILURE SIMULATION</h2>
          <p style={styles.subtitle}>
            Live overrides — {selected?.name ?? '—'} · changes apply in real time
          </p>
          {backendConnected && (
            <p style={styles.liveBadge}>● LIVE AI ENGINE ACTIVE</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            style={styles.linkBtn}
            onClick={() => navigate('/ai-dashboard')}
          >
            VIEW AI DECISIONS{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          {onClose && (
            <button type="button" style={styles.closeBtn} onClick={onClose} title="Close">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>DRONE</th>
              <th style={styles.th}>BATTERY %</th>
              <th style={styles.th}>THERMAL</th>
              <th style={styles.th}>OBSTACLE (m)</th>
              <th style={styles.th}>SIGNAL</th>
              <th style={styles.th}>CPU °C</th>
              <th style={{ ...styles.th, color: '#fbbf24' }}>SIMULATE</th>
            </tr>
          </thead>
          <tbody>
            {drones.map((d) => {
              const isSelected = d.id === selectedDrone
              const isLoading = loadingId === d.id
              return (
                <tr
                  key={d.id}
                  style={styles.row(isSelected)}
                  onClick={() => setSelectedDrone(d.id)}
                >
                  <td style={{ ...styles.td, ...styles.name }}>{d.name}</td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={d.battery}
                      style={styles.input}
                      onChange={(e) =>
                        updateDrone(d.id, 'battery', parseNum(e.target.value, d.battery))
                      }
                    />
                  </td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      style={styles.toggle(d.thermal)}
                      onClick={() => updateDrone(d.id, 'thermal', !d.thermal)}
                    >
                      {d.thermal ? 'OK' : 'FAIL'}
                    </button>
                  </td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={d.obstacle}
                      style={styles.input}
                      onChange={(e) =>
                        updateDrone(d.id, 'obstacle', parseNum(e.target.value, d.obstacle))
                      }
                    />
                  </td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={d.signal}
                      style={styles.input}
                      onChange={(e) =>
                        updateDrone(d.id, 'signal', parseNum(e.target.value, d.signal))
                      }
                    />
                  </td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      step={0.1}
                      value={d.cpu}
                      style={styles.input}
                      onChange={(e) =>
                        updateDrone(d.id, 'cpu', parseNum(e.target.value, d.cpu))
                      }
                    />
                  </td>

                  <td style={styles.td} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        id={`sim-btn-${d.id}`}
                        style={styles.simulateBtn(isLoading)}
                        disabled={isLoading}
                        onClick={() => simulateFailure(d)}
                      >
                        {isLoading ? '...' : '⚡ RUN AI'}
                      </button>
                      <button
                        type="button"
                        style={{ ...styles.simulateBtn(isLoading), borderColor: '#ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                        disabled={isLoading}
                        onClick={async () => {
                          try {
                            await handleApplyOverride(d) // Sync overrides before injecting
                            await fetch('http://localhost:8000/api/simulate-failure', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ drone_id: d.id })
                            })
                            useSimStore.getState().addNotification(`Injected critical failure on ${d.name}`, 'warning')
                          } catch (err) {
                            console.error(err)
                          }
                        }}
                      >
                        🔥 INJECT
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <div style={styles.error}>⚠ {error}</div>}

      {simResult && (
        <div style={styles.simResult}>
          <div style={{ fontWeight: 700, marginBottom: '6px', color: '#fde68a' }}>
            ⚡ AI DECISION — {simResult.name}
          </div>
          <div>Action: <span style={{ color: '#ffffff' }}>{simResult.action}</span></div>
          {simResult.reason && <div>Reason: <span style={{ color: '#fca5a5' }}>{simResult.reason}</span></div>}
          <div>Status: {simResult.status}</div>
          {simResult.nearby && <div>Assist Drone: {simResult.nearby}</div>}
        </div>
      )}
    </section>
  )
}