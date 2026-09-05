// ── Mission Simulation Loop ──
// Phase 11: Backend-driven mission with frontend visual rendering.
// The backend AEGIS Runtime is authoritative for:
//   - Drone positions (physics loop at 10Hz)
//   - Mission phase transitions  
//   - Survivor detection (proximity-based perception)
// The frontend handles:
//   - Visual animation (A* path rendering, trail lines)
//   - Sensor quality UI (thermal boost, LiDAR indicators)
//   - Event log, notifications, coverage meter

import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/useSimStore'
import { isDeployComplete, isReturnComplete, computeSearchPaths, computeDeployPaths } from './useDroneMovement'

const BACKEND_POLL_INTERVAL_MS = 200  // 5Hz polling to match animation loop

export function useSimulation() {
  const missionPhase = useSimStore(s => s.missionPhase)
  const simulationRunning = useSimStore(s => s.simulationRunning)

  const deployTransitioned = useRef(false)
  const returnTransitioned = useRef(false)
  const allFoundNotified = useRef(false)
  const batteryTimer = useRef(0)
  const coverageAccum = useRef(0)
  const backendPolling = useRef(false)

  // Reset refs when phase changes
  useEffect(() => {
    deployTransitioned.current = false
    returnTransitioned.current = false
    allFoundNotified.current = false
  }, [missionPhase])

  // ── Backend State Polling ──
  // Poll /api/state every 200ms when the simulation is running.
  // This syncs drone positions, battery, status, and survivor detections from the AEGIS Core engine.
  useEffect(() => {
    if (!simulationRunning) {
      backendPolling.current = false
      return
    }
    if (!['DEPLOYING', 'SEARCHING', 'RETURNING', 'ALL_FOUND'].includes(missionPhase)) return

    backendPolling.current = true

    const pollBackend = async () => {
      if (!backendPolling.current) return
      try {
        const res = await fetch('http://localhost:8000/api/state')
        if (!res.ok) return
        const data = await res.json()

        const store = useSimStore.getState()

        // --- Sync drone positions and status from backend ---
        if (data.drones && data.drones.length > 0) {
          const updatedDrones = store.drones.map(frontendDrone => {
            const backendDrone = data.drones.find(bd => bd.id === String(frontendDrone.id))
            if (!backendDrone) return frontendDrone

            // Only sync pos/battery/status — do NOT override trail/path rendering data
            return {
              ...frontendDrone,
              pos: backendDrone.pos,
              battery: backendDrone.battery,
              status: backendDrone.status === 'SEARCHING' ? 'SCANNING' : backendDrone.status,
              signal: backendDrone.signal ?? frontendDrone.signal,
              gps_status: backendDrone.gps_healthy ?? frontendDrone.gps_status,
              obstacle_distance: backendDrone.obstacle_distance ?? frontendDrone.obstacle_distance,
            }
          })
          useSimStore.setState({ drones: updatedDrones })
        }

        // --- Sync survivors detected by backend ---
        if (data.survivors && data.survivors.length > 0) {
          const store2 = useSimStore.getState()
          const updatedSurvivors = store2.survivors.map(fs => {
            // Match by position proximity (since IDs may differ between frontend seeds and backend)
            const backendSurv = data.survivors.find(bs => {
              if (!bs.pos || !fs.pos) return false
              const dx = (bs.pos[0] || 0) - (fs.pos[0] || 0)
              const dz = (bs.pos[2] || 0) - (fs.pos[2] || 0)
              return Math.sqrt(dx*dx + dz*dz) < 15.0  // Within 15 scene units
            })

            if (backendSurv && backendSurv.detected && !fs.detected) {
              // Backend has detected this survivor — update frontend state
              const conf = backendSurv.confidence || 75
              store2.addEvent({
                time: Math.floor(store2.simulationTime),
                message: `Backend AI detected survivor at [${(backendSurv.pos[0]||0).toFixed(0)}, ${(backendSurv.pos[2]||0).toFixed(0)}]. Thermal signature confirmed. Confidence ${conf}%.`,
                type: 'survivor',
              })
              store2.addNotification(`Survivor confirmed by AEGIS AI! Confidence: ${conf}%`, 'detection')
              return {
                ...fs,
                detected: true,
                status: 'DETECTED',
                confidence: conf,
              }
            }
            return fs
          })
          useSimStore.setState({ survivors: updatedSurvivors })
        }

        // --- Sync coverage ---
        if (typeof data.sim_time === 'number') {
          useSimStore.getState().incrementTime(0)  // Trigger re-render
        }

      } catch (e) {
        // Backend unreachable — fall back to frontend-only mode silently
      }
    }

    const interval = setInterval(pollBackend, BACKEND_POLL_INTERVAL_MS)
    return () => {
      backendPolling.current = false
      clearInterval(interval)
    }
  }, [simulationRunning, missionPhase])

  // ── Main frontend simulation loop: 200ms ──
  // Handles: phase transitions, sensor-driven detection, battery drain, coverage.
  useEffect(() => {
    if (!simulationRunning) return
    if (!['DEPLOYING', 'SEARCHING', 'RETURNING'].includes(missionPhase)) return

    const BASE_DETECT_RADIUS = 20
    const THERMAL_DETECT_BOOST = 4
    const interval = setInterval(() => {
      const store = useSimStore.getState()

      // Increment simulation clock
      store.incrementTime(0.2)

      // ═══ PHASE: DEPLOYING ═══
      if (store.missionPhase === 'DEPLOYING' && !deployTransitioned.current) {
        if (isDeployComplete()) {
          deployTransitioned.current = true
          const sPaths = computeSearchPaths(store.searchRegion)
          useSimStore.getState().startSearch(sPaths)
          useSimStore.getState().addNotification('All drones at search altitude. AI search pattern active.', 'success')
          useSimStore.getState().addEvent({
            time: Math.floor(store.simulationTime),
            message: 'All drones deployed to search altitude. AEGIS AI sweeping assigned zones.',
            type: 'system',
          })
          store.drones.forEach(d => {
            useSimStore.getState().updateDrone(d.id, { status: 'SCANNING' })
          })
        }
        return
      }

      // ═══ PHASE: SEARCHING ═══
      if (store.missionPhase === 'SEARCHING') {
        const currentNow = performance.now() / 1000

        // ── Battery drain ──
        if (currentNow - batteryTimer.current > 1.0) {
          batteryTimer.current = currentNow
          store.drones.forEach(drone => {
            const newBattery = Math.max(5, drone.battery - 0.15)
            useSimStore.getState().updateDrone(drone.id, { battery: newBattery })
          })
        }

        // ── Frontend sensor-driven survivor detection (backup to backend) ──
        store.survivors.forEach(survivor => {
          if (survivor.detected || survivor.status === 'DETECTED') return
          if (!String(survivor.id).startsWith('SURV-')) return

          const sx = survivor.pos?.[0] || 0
          const sz = survivor.pos?.[2] || 0

          let bestDrone = null, bestDist = Infinity
          store.drones.forEach(d => {
            const dx = (d.pos?.[0] || 0) - sx
            const dz = (d.pos?.[2] || 0) - sz
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist < bestDist) { bestDist = dist; bestDrone = d }
          })

          if (!bestDrone) return

          const thermalBoost = (survivor.body_temp || 36.5) > 36.5 ? THERMAL_DETECT_BOOST : 0
          const lidarReduction = (bestDrone.obstacle_distance || 10) < 3 ? -5 : 0
          const signalFactor = (bestDrone.signal || 100) / 100
          const effectiveRadius = (BASE_DETECT_RADIUS + thermalBoost + lidarReduction) * signalFactor

          if (bestDist < effectiveRadius) {
            const conf = Math.round(70 + Math.min(28, ((effectiveRadius - bestDist) / effectiveRadius) * 35))
            useSimStore.getState().updateSurvivor(survivor.id, {
              detected: true,
              status: 'DETECTED',
              detectedBy: bestDrone.callsign,
              confidence: conf,
            })
            useSimStore.getState().addEvent({
              time: Math.floor(store.simulationTime),
              message: `${bestDrone.callsign} detected survivor at [${sx.toFixed(0)}, ${sz.toFixed(0)}]. Confidence ${conf}%. Thermal ${survivor.body_temp?.toFixed(1) || '37.0'}°C. Distance ${bestDist.toFixed(1)}m.`,
              type: 'survivor',
            })
            useSimStore.getState().addNotification(
              `Survivor detected by ${bestDrone.callsign}! Confidence: ${conf}%`,
              'detection'
            )
          }
        })

        // ── Check if all seeded survivors are found ──
        const seeded = store.survivors.filter(s => String(s.id).startsWith('SURV-'))
        if (seeded.length > 0 && !allFoundNotified.current) {
          const allDetected = seeded.every(s => s.detected || s.status === 'DETECTED')
          if (allDetected) {
            allFoundNotified.current = true
            useSimStore.getState().setMissionPhase('ALL_FOUND')
            useSimStore.getState().addNotification('All survivors detected! Click "End Task" to recall drones to base.', 'success')
            useSimStore.getState().addEvent({
              time: Math.floor(store.simulationTime),
              message: `All ${seeded.length} survivor(s) successfully detected. Mission objective complete. Awaiting RTH command.`,
              type: 'system',
            })
          }
        }

        // ── Coverage accumulation ──
        coverageAccum.current += 0.04 * store.drones.length
        if (coverageAccum.current >= 1.0) {
          useSimStore.getState().incrementCoverage(Math.floor(coverageAccum.current))
          coverageAccum.current = coverageAccum.current % 1.0
        }

        // ── Periodic AI tactical log ──
        if (Math.random() < 0.008) {
          const msgs = [
            'SwarmTaskAllocator optimizing zone coverage. Rebalancing drone assignments.',
            'Thermal sweep pattern nominal. All drones reporting healthy sensor readings.',
            'AEGIS AI: Obstacle avoidance sensors clear — proceeding on planned route.',
            'Swarm coordination: Task handover initiated between drones.',
            'LiDAR mapping rubble density in active sector.',
            'Ground station telemetry sync nominal. All comms mesh links active.',
            'Sensor fusion active: Thermal + RGB camera data being cross-validated.',
            'SafetyValidator monitoring all GotoCommands in real time.',
          ]
          useSimStore.getState().addEvent({
            time: Math.floor(store.simulationTime),
            message: msgs[Math.floor(Math.random() * msgs.length)],
            type: 'info',
          })
        }
      }

      // ═══ PHASE: RETURNING ═══
      if (store.missionPhase === 'RETURNING' && !returnTransitioned.current) {
        if (isReturnComplete()) {
          returnTransitioned.current = true
          useSimStore.getState().completeMission()
          useSimStore.getState().addNotification('All drones safely docked at base. Mission complete!', 'success')
          useSimStore.getState().addEvent({
            time: Math.floor(store.simulationTime),
            message: 'All drones returned to base. AEGIS mission concluded successfully.',
            type: 'system',
          })
          store.drones.forEach(d => {
            useSimStore.getState().updateDrone(d.id, { status: 'IDLE' })
          })
        }
      }

    }, 250)

    return () => clearInterval(interval)
  }, [simulationRunning, missionPhase])
}
