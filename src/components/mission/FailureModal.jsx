import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Zap, Radio, Compass, Battery } from 'lucide-react'
import { HARDWARE_FAILURE_TYPES, triggerHardwareFailure } from '../../hooks/useDroneMovement'
import { useSimStore } from '../../store/useSimStore'

// ── Drone color registry ────────────────────────────────────────────────────
const DRONE_COLORS = {
  FALCON: '#00e5ff', HAWK: '#ff6b2b', OSPREY: '#00ff88',
  KESTREL: '#e040fb', MERLIN: '#f9e23c',
}

// ── Icon map for each failure type ──────────────────────────────────────────
const FAILURE_ICONS = {
  battery_failure: Battery,
  sensor_failure:  Zap,
  motor_failure:   AlertTriangle,
  comms_failure:   Radio,
  gps_failure:     Compass,
}

// ── Severity colour helpers ─────────────────────────────────────────────────
const SEVERITY_COLORS = {
  critical: { text: '#ff3030', bg: 'rgba(255,48,48,0.08)', border: 'rgba(255,48,48,0.28)', glow: '0 0 14px rgba(255,48,48,0.35)' },
  warning:  { text: '#ffb300', bg: 'rgba(255,179,0,0.07)',  border: 'rgba(255,179,0,0.28)',  glow: '0 0 14px rgba(255,179,0,0.3)' },
}

// ── Animated scan line ───────────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      initial={{ top: 0 }}
      animate={{ top: '100%' }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.35), transparent)',
        pointerEvents: 'none', zIndex: 1,
      }}
    />
  )
}

// ── Individual failure card ──────────────────────────────────────────────────
function FailureCard({ failure, isHovered, isSelected, onHover, onClick, droneHasFailure }) {
  const sc = SEVERITY_COLORS[failure.severity] || SEVERITY_COLORS.warning
  const Icon = FAILURE_ICONS[failure.id] || AlertTriangle
  const active = isHovered || isSelected
  const disabled = droneHasFailure

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.015, y: -2 }}
      whileTap={disabled ? {}   : { scale: 0.985 }}
      onClick={() => !disabled && onClick(failure.id)}
      onMouseEnter={() => !disabled && onHover(failure.id)}
      onMouseLeave={() => !disabled && onHover(null)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: '14px 18px',
        background: disabled ? 'rgba(0,0,0,0.2)' : active ? sc.bg : 'rgba(255,255,255,0.02)',
        border: `1px solid ${disabled ? 'rgba(71,85,105,0.18)' : active ? sc.border : 'rgba(71,85,105,0.2)'}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.2s, border-color 0.2s',
        boxShadow: active && !disabled ? sc.glow : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left icon circle */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active && !disabled ? sc.bg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active && !disabled ? sc.border : 'rgba(71,85,105,0.15)'}`,
        transition: 'all 0.2s',
      }}>
        <Icon size={20} color={active && !disabled ? sc.text : '#475569'} />
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}>
          <span style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 700,
            fontSize: 15,
            color: active && !disabled ? sc.text : '#e2e8f0',
            letterSpacing: '0.5px',
            transition: 'color 0.2s',
          }}>
            {failure.label}
          </span>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 3,
            background: sc.bg,
            border: `1px solid ${sc.border}`,
            color: sc.text,
            letterSpacing: '1px',
          }}>
            {failure.severity.toUpperCase()}
          </span>
        </div>

        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#475569',
          letterSpacing: '0.3px',
          lineHeight: 1.6,
        }}>
          {failure.logLabel}
        </div>

        {/* Effects row */}
        <div style={{
          display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap',
        }}>
          {failure.droneUpdates && Object.entries(failure.droneUpdates).map(([k, v]) => (
            <span key={k} style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              padding: '2px 7px',
              borderRadius: 3,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(71,85,105,0.2)',
              color: '#64748b',
            }}>
              {k}: {v}
            </span>
          ))}
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            padding: '2px 7px',
            borderRadius: 3,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(71,85,105,0.2)',
            color: '#64748b',
          }}>
            {failure.id === 'motor_failure' ? 'EMERGENCY LAND' : `RTB @ ${failure.rtbSpeed} m/s`}
          </span>
        </div>
      </div>

      {/* Arrow chevron */}
      {!disabled && (
        <motion.div
          animate={{ x: active ? 0 : -4, opacity: active ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          style={{ color: sc.text, alignSelf: 'center', flexShrink: 0 }}
        >
          ▶
        </motion.div>
      )}
    </motion.button>
  )
}

// ── Main FailureModal ────────────────────────────────────────────────────────
export default function FailureModal({ droneId, onClose }) {
  const drones         = useSimStore(s => s.drones)
  const hardwareFailures = useSimStore(s => s.hardwareFailures)
  const missionPhase   = useSimStore(s => s.missionPhase)

  const drone = drones.find(d => d.id === droneId)
  const droneColor = DRONE_COLORS[drone?.callsign] || '#00e5ff'
  const existingFailure = hardwareFailures?.[droneId]
  const droneHasFailure = !!(existingFailure && existingFailure.status !== 'CLEARED')

  const [hoveredId, setHoveredId] = useState(null)
  const [triggered, setTriggered] = useState(null)
  const [confirming, setConfirming] = useState(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSelect = useCallback((failureId) => {
    if (confirming === failureId) {
      // Second click = confirm
      const ok = triggerHardwareFailure(droneId, failureId)
      if (ok) {
        setTriggered(failureId)
        setTimeout(onClose, 1800)
      }
      setConfirming(null)
    } else {
      setConfirming(failureId)
    }
  }, [confirming, droneId, onClose])

  const canInject = ['DEPLOYING', 'SEARCHING', 'ALL_FOUND'].includes(missionPhase)

  return (
    <AnimatePresence>
      <motion.div
        key="failure-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(2, 4, 10, 0.88)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          key="failure-modal-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          style={{
            width: 560,
            maxHeight: '92vh',
            overflowY: 'auto',
            background: '#04090f',
            border: `1px solid ${droneColor}30`,
            borderRadius: 12,
            boxShadow: `0 0 60px ${droneColor}18, 0 24px 60px rgba(0,0,0,0.8)`,
            fontFamily: 'JetBrains Mono, monospace',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Animated scan line */}
          <ScanLine />

          {/* ── Header ───────────────────────────────────────────────── */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid rgba(255,255,255,0.05)`,
            background: '#050d14',
            position: 'relative',
            zIndex: 2,
          }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Pulsing drone dot */}
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: droneHasFailure ? '#ff3030' : droneColor,
                    boxShadow: `0 0 10px ${droneHasFailure ? '#ff3030' : droneColor}`,
                  }}
                />
                <div>
                  <div style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: 18, fontWeight: 700,
                    color: '#e2e8f0', letterSpacing: '2px',
                  }}>
                    {drone?.name || `DRONE-0${droneId}`}
                    <span style={{
                      marginLeft: 10,
                      fontSize: 12,
                      color: droneColor,
                      fontFamily: 'JetBrains Mono',
                    }}>
                      [{drone?.callsign}]
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#394250', letterSpacing: '1.5px', marginTop: 2 }}>
                    // HARDWARE FAILURE INJECTION · AEGIS FAILSAFE PROTOCOL
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,50,50,0.1)',
                  border: '1px solid rgba(255,50,50,0.3)',
                  color: '#ff5555',
                  cursor: 'pointer',
                  padding: '7px 9px',
                  borderRadius: 6,
                  display: 'flex',
                  transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.25)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,50,50,0.1)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drone telemetry bar */}
            <div style={{
              display: 'flex', gap: 0,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(71,85,105,0.2)',
              borderRadius: 6,
              overflow: 'hidden',
            }}>
              {[
                { label: 'STATUS', value: drone?.status || '—', color: '#94a3b8' },
                { label: 'BATTERY', value: `${Math.round(drone?.battery || 0)}%`, color: (drone?.battery || 0) < 20 ? '#ff3030' : '#00ff88' },
                { label: 'ALT', value: `${Math.round(drone?.pos?.[1] || 0)}m`, color: '#00e5ff' },
                { label: 'SPD', value: `${Math.round(drone?.speed || 0)} m/s`, color: '#00e5ff' },
                { label: 'PHASE', value: missionPhase, color: droneColor },
              ].map((item, i) => (
                <div key={item.label} style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRight: i < 4 ? '1px solid rgba(71,85,105,0.15)' : 'none',
                }}>
                  <div style={{ fontSize: 8, color: '#394250', letterSpacing: '1px', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: item.color, fontWeight: 700, fontFamily: 'Rajdhani' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Existing failure notice ──────────────────────────────── */}
          {droneHasFailure && (
            <div style={{
              margin: '16px 24px',
              padding: '12px 16px',
              background: 'rgba(255,48,48,0.06)',
              border: '1px solid rgba(255,48,48,0.25)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 11, color: '#ff5555',
            }}>
              <AlertTriangle size={16} />
              <span>
                <strong>{drone?.callsign}</strong> already has active failure: <em>{existingFailure?.label}</em>.
                Cannot inject another until cleared.
              </span>
            </div>
          )}

          {/* ── Phase guard notice ──────────────────────────────────── */}
          {!canInject && !droneHasFailure && (
            <div style={{
              margin: '16px 24px',
              padding: '12px 16px',
              background: 'rgba(255,179,0,0.05)',
              border: '1px solid rgba(255,179,0,0.2)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 11, color: '#ffb300',
            }}>
              <AlertTriangle size={16} />
              Failure injection is only available during DEPLOYING or SEARCHING phase. Current: <strong style={{ marginLeft: 4 }}>{missionPhase}</strong>
            </div>
          )}

          {/* ── Success flash ────────────────────────────────────────── */}
          <AnimatePresence>
            {triggered && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  margin: '16px 24px',
                  padding: '14px 18px',
                  background: 'rgba(255,48,48,0.08)',
                  border: '1px solid rgba(255,48,48,0.3)',
                  borderRadius: 8,
                  fontFamily: 'Rajdhani, sans-serif',
                  fontSize: 15,
                  color: '#ff3030',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  zIndex: 10,
                }}
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  ⚠
                </motion.div>
                FAILURE INJECTED · FAILSAFE RTB ENGAGED · STANDBY LAUNCHING...
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Failure list ─────────────────────────────────────────── */}
          <div style={{ padding: '16px 24px 24px', position: 'relative', zIndex: 2 }}>
            <div style={{
              fontSize: 9, color: '#394250',
              letterSpacing: '1.5px', marginBottom: 14,
            }}>
              SELECT FAILURE TYPE TO INJECT
              <span style={{ color: '#1e2a35', marginLeft: 8 }}>
                (click once to preview · click again to confirm)
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {HARDWARE_FAILURE_TYPES.map(failure => {
                const isConfirming = confirming === failure.id
                return (
                  <div key={failure.id}>
                    <FailureCard
                      failure={failure}
                      isHovered={hoveredId === failure.id}
                      isSelected={isConfirming}
                      onHover={setHoveredId}
                      onClick={handleSelect}
                      droneHasFailure={droneHasFailure || !canInject}
                    />
                    {/* Confirm strip */}
                    <AnimatePresence>
                      {isConfirming && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 18px',
                            background: 'rgba(255,48,48,0.06)',
                            border: '1px solid rgba(255,48,48,0.2)',
                            borderTop: 'none',
                            borderRadius: '0 0 6px 6px',
                            fontSize: 10,
                          }}>
                            <span style={{ color: '#ff7070' }}>
                              ⚠ Confirm inject <strong>{failure.label}</strong> on {drone?.callsign}?
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setConfirming(null)}
                                style={{
                                  padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                                  background: 'transparent', border: '1px solid rgba(71,85,105,0.3)',
                                  color: '#64748b', fontSize: 9, fontFamily: 'JetBrains Mono',
                                }}
                              >
                                CANCEL
                              </button>
                              <button
                                onClick={() => handleSelect(failure.id)}
                                style={{
                                  padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                                  background: 'rgba(255,48,48,0.15)', border: '1px solid rgba(255,48,48,0.4)',
                                  color: '#ff5555', fontSize: 9, fontFamily: 'JetBrains Mono', fontWeight: 700,
                                }}
                              >
                                CONFIRM INJECT
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>

            {/* Footer note */}
            <div style={{
              marginTop: 18,
              padding: '10px 14px',
              background: 'rgba(0,229,255,0.03)',
              border: '1px solid rgba(0,229,255,0.08)',
              borderRadius: 6,
              fontSize: 9, color: '#2a3844', lineHeight: 1.7, letterSpacing: '0.3px',
            }}>
              ▸ Failed drone immediately initiates Return-to-Base (RTB) or Emergency Landing.<br />
              ▸ Nearest standby drone intercepts the failed drone's remaining route.<br />
              ▸ Failure is recorded in the mission event log and drone telemetry stream.<br />
              ▸ Replacement drone returns to base upon mission completion.
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
