import { useRef, useEffect } from 'react'
import { useSimStore } from '../../store/useSimStore'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'

const DRONE_COLORS = {
  1: '#00e5ff',
  2: '#ff6b2b',
  3: '#00ff88',
  4: '#e040fb',
  5: '#f9e23c',
}

const DRONE_CALLSIGNS = {
  1: 'FALCON',
  2: 'HAWK',
  3: 'OSPREY',
  4: 'KESTREL',
  5: 'MERLIN',
}

const SEV_COLORS = {
  HIGH: '#ff4500',
  MED:  '#ffb300',
  LOW:  '#64748b',
}

function formatElapsed(now, timestamp) {
  const sec = Math.floor(now - timestamp)
  if (sec < 60) return `${sec}s ago`
  return `${Math.floor(sec / 60)}m ago`
}

export default function ObstacleLogPanel({ drone }) {
  const logs      = useSimStore(s => s.droneObstacleLogs)
  const clearLogs = useSimStore(s => s.clearObstacleLogs)
  const missionPhase = useSimStore(s => s.missionPhase)
  const scrollRef = useRef(null)

  // Active drone id: prefer passed drone, else show all
  const droneId = drone?.id || null

  // Combine entries for the selected drone (or all if none selected)
  const entries = droneId
    ? (logs[droneId] || [])
    : Object.entries(logs).flatMap(([id, arr]) =>
        arr.map(e => ({ ...e, droneId: Number(id) }))
      ).sort((a, b) => a.timestamp - b.timestamp)

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  const isFlying = ['DEPLOYING', 'SEARCHING'].includes(missionPhase)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#080c10',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'JetBrains Mono, monospace',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={12} color={droneId ? DRONE_COLORS[droneId] : '#ff6b2b'} />
          <span style={{ fontSize: '9px', color: '#e2e8f0', letterSpacing: '1px' }}>
            OBSTACLE_LOG // {droneId ? DRONE_CALLSIGNS[droneId] : 'ALL DRONES'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Live indicator */}
          {isFlying && (
            <span style={{
              fontSize: '7px', color: '#00ff88', letterSpacing: '1px',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <span style={{
                display: 'inline-block', width: 5, height: 5,
                borderRadius: '50%', background: '#00ff88',
                boxShadow: '0 0 6px #00ff88',
                animation: 'aegisBlink 1s ease-in-out infinite',
              }} />
              LIVE
            </span>
          )}
          <button
            title="Clear log"
            onClick={() => droneId ? clearLogs(droneId) : [1,2,3,4,5].forEach(id => clearLogs(id))}
            style={{
              background: 'none', border: '1px solid #1e293b',
              color: '#475569', cursor: 'pointer',
              padding: '2px 6px', borderRadius: '3px',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '8px',
              transition: 'all 0.15s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#ff4500'; e.currentTarget.style.color = '#ff4500' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#1e293b'; e.currentTarget.style.color = '#475569' }}
          >
            <Trash2 size={9} /> CLEAR
          </button>
        </div>
      </div>

      {/* ── Count Badge ────────────────────────────────────────────────── */}
      <div style={{
        padding: '5px 12px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '8px', color: '#475569' }}>TOTAL EVENTS:</span>
        <span style={{
          fontSize: '10px', fontWeight: 700,
          color: entries.length > 0 ? '#ff6b2b' : '#334155',
        }}>
          {entries.length}
        </span>
        {entries.length > 0 && (
          <span style={{
            fontSize: '7px', color: '#64748b',
            marginLeft: 'auto',
          }}>
            HIGH: {entries.filter(e => e.severity === 'HIGH').length} &nbsp;
            MED: {entries.filter(e => e.severity === 'MED').length}
          </span>
        )}
      </div>

      {/* ── Drone selector tabs (only when no drone prop) ──────────────── */}
      {!droneId && (
        <DroneTabs logs={logs} />
      )}

      {/* ── Log Entries ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {entries.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '8px',
            color: '#334155',
          }}>
            <RotateCcw size={22} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: '9px', letterSpacing: '1px', opacity: 0.5 }}>
              {isFlying ? 'MONITORING FOR OBSTACLES...' : 'NO EVENTS YET'}
            </span>
            {!isFlying && (
              <span style={{ fontSize: '8px', color: '#1e293b', marginTop: '2px' }}>
                Deploy drones to start detection
              </span>
            )}
          </div>
        ) : (
          [...entries].reverse().map((entry, i) => {
            const id = entry.droneId || droneId
            const color = DRONE_COLORS[id] || '#64748b'
            const sevColor = SEV_COLORS[entry.severity] || '#64748b'
            return (
              <div
                key={entry.id || i}
                style={{
                  padding: '7px 12px',
                  borderBottom: '1px solid rgba(30,41,59,0.6)',
                  background: i === 0 ? 'rgba(255,107,43,0.04)' : 'transparent',
                  transition: 'background 0.3s',
                  animation: i === 0 ? 'aegisObstacleFadeIn 0.4s ease' : 'none',
                }}
              >
                {/* Top row: callsign + severity + time */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: '4px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 5px ${color}80`,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '8px', color, letterSpacing: '0.5px', fontWeight: 700 }}>
                      {DRONE_CALLSIGNS[id] || `DRONE-${id}`}
                    </span>
                    <span style={{
                      fontSize: '7px', color: sevColor,
                      border: `1px solid ${sevColor}50`,
                      padding: '0px 4px', borderRadius: '2px',
                      letterSpacing: '0.5px',
                    }}>
                      {entry.severity || 'MED'}
                    </span>
                  </div>
                  <span style={{ fontSize: '7px', color: '#334155' }}>
                    T+{entry.time}s
                  </span>
                </div>

                {/* Message */}
                <div style={{
                  fontSize: '8px', color: '#94a3b8',
                  lineHeight: 1.5, paddingLeft: '12px',
                }}>
                  {entry.message}
                </div>

                {/* Position */}
                {entry.pos && (
                  <div style={{
                    fontSize: '7px', color: '#334155',
                    paddingLeft: '12px', marginTop: '3px',
                    display: 'flex', gap: '8px',
                  }}>
                    <span style={{ color: '#475569' }}>POS:</span>
                    <span>X:{entry.pos[0]} Y:{entry.pos[1]} Z:{entry.pos[2]}</span>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ── Footer hint ────────────────────────────────────────────────── */}
      <div style={{
        borderTop: '1px solid #1e293b',
        padding: '5px 12px',
        fontSize: '7px',
        color: '#1e293b',
        flexShrink: 0,
        letterSpacing: '0.5px',
      }}>
        OBSTACLE DETECTION // A* REROUTE ENGINE // AEGIS-V1
      </div>

      <style>{`
        @keyframes aegisObstacleFadeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes aegisBlink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// Inner component: per-drone mini-stat tabs
function DroneTabs({ logs }) {
  const DRONE_COLORS_ARR = ['#00e5ff','#ff6b2b','#00ff88','#e040fb','#f9e23c']
  const CALLSIGNS = ['FALCON','HAWK','OSPREY','KESTREL','MERLIN']

  return (
    <div style={{
      display: 'flex',
      borderBottom: '1px solid #1e293b',
      flexShrink: 0,
      overflowX: 'auto',
    }}>
      {[1,2,3,4,5].map((id, i) => {
        const count = (logs[id] || []).length
        const color = DRONE_COLORS_ARR[i]
        return (
          <div
            key={id}
            style={{
              flex: '1 0 60px',
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              borderRight: '1px solid #1e293b',
              background: count > 0 ? `${color}08` : 'transparent',
            }}
          >
            <span style={{ fontSize: '7px', color, letterSpacing: '0.5px' }}>
              {CALLSIGNS[i].slice(0, 3)}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 700,
              color: count > 0 ? color : '#1e293b',
            }}>
              {count}
            </span>
          </div>
        )
      })}
    </div>
  )
}
