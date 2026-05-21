import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/useSimStore'
import { isDeployComplete, isReturnComplete, computeSearchPaths } from './useDroneMovement'

export function useSimulation() {
  const {
    simulationRunning, missionPhase, simulationTime,
    incrementTime, drones, survivors, addEvent,
    addNotification, searchRegion,
  } = useSimStore()

  const lastDetectionCheck = useRef(0)
  const deployChecked = useRef(false)
  const returnChecked = useRef(false)
  const allFoundNotified = useRef(false)

  // Reset refs when phase changes
  useEffect(() => {
    deployChecked.current = false
    returnChecked.current = false
    allFoundNotified.current = false
  }, [missionPhase])

  useEffect(() => {
    if (!simulationRunning) return
    if (!['DEPLOYING', 'SEARCHING', 'RETURNING'].includes(missionPhase)) return

    const interval = setInterval(() => {
      const store = useSimStore.getState()
      const currentTime = store.simulationTime
      const now = performance.now() / 1000

      // ── Increment simulation time ──
      useSimStore.getState().incrementTime(0.1)

      // ═══ PHASE: DEPLOYING ═══
      if (store.missionPhase === 'DEPLOYING' && !deployChecked.current) {
        if (isDeployComplete()) {
          deployChecked.current = true

          // Compute search paths & transition
          const sPaths = computeSearchPaths(store.searchRegion)
          useSimStore.getState().startSearch(sPaths)
          useSimStore.getState().addNotification('All drones arrived. Search operation commencing.', 'success')
          useSimStore.getState().addEvent({
            time: Math.floor(currentTime),
            message: 'All drones deployed to search region. Initiating sweep pattern.',
            type: 'system',
          })

          // Update drone statuses
          store.drones.forEach(d => {
            useSimStore.getState().updateDrone(d.id, { status: 'SCANNING' })
          })
        }
      }

      // ═══ PHASE: SEARCHING ═══
      if (store.missionPhase === 'SEARCHING') {
        // ── Battery drain ──
        store.drones.forEach(drone => {
          const newBattery = Math.max(5, drone.battery - 0.003)
          useSimStore.getState().updateDrone(drone.id, { battery: newBattery })
        })

        // ── Survivor detection (proximity-based) ──
        if (now - lastDetectionCheck.current > 0.5) {
          lastDetectionCheck.current = now

          store.survivors.forEach(survivor => {
            if (survivor.detected || survivor.status === 'DETECTED') return
            if (!String(survivor.id).startsWith('SURV-')) return

            const sx = survivor.pos?.[0] || 0
            const sz = survivor.pos?.[2] || 0

            const detectingDrone = store.drones.find(d => {
              const dx = d.pos?.[0] || 0
              const dz = d.pos?.[2] || 0
              const dist = Math.sqrt((dx - sx) ** 2 + (dz - sz) ** 2)
              return dist < 18 // reasonable detection radius to require physical sweeps
            })

            if (detectingDrone) {
              const conf = 70 + Math.floor(Math.random() * 28)
              useSimStore.getState().updateSurvivor(survivor.id, {
                detected: true,
                status: 'DETECTED',
                detectedBy: detectingDrone.callsign,
                confidence: conf,
              })
              useSimStore.getState().addEvent({
                time: Math.floor(currentTime),
                message: `${detectingDrone.callsign} detected survivor at [${sx.toFixed(0)}, ${sz.toFixed(0)}]. Confidence ${conf}%. Thermal ${survivor.body_temp?.toFixed(1) || '37.0'}°C.`,
                type: 'survivor',
              })
              useSimStore.getState().addNotification(
                `Survivor detected by ${detectingDrone.callsign}! Confidence: ${conf}%`,
                'detection'
              )
            }
          })
        }

        // ── Check if all seeded survivors are detected ──
        const seeded = store.survivors.filter(s => String(s.id).startsWith('SURV-'))
        if (seeded.length > 0 && !allFoundNotified.current) {
          const allDetected = seeded.every(s => s.detected || s.status === 'DETECTED')
          if (allDetected) {
            allFoundNotified.current = true
            useSimStore.getState().setMissionPhase('ALL_FOUND')
            useSimStore.getState().addNotification('All survivors detected! Click "End Task" to recall drones to base.', 'success')
            useSimStore.getState().addEvent({
              time: Math.floor(currentTime),
              message: `All ${seeded.length} survivors successfully detected. Mission objective complete.`,
              type: 'system',
            })
          }
        }

        // ── Coverage increment ──
        if (Math.random() < 0.03) {
          useSimStore.getState().incrementCoverage(0.3)
        }

        // ── Periodic events ──
        if (Math.random() < 0.005) {
          const msgs = [
            'Ground station telemetry sync complete.',
            'Thermal sweep pattern nominal. Scanning next corridor.',
            'Wind conditions stable. Operations safe.',
            'Swarm coordination algorithm optimizing routes.',
            'LiDAR mapping rubble density in active sector.',
          ]
          useSimStore.getState().addEvent({
            time: Math.floor(currentTime),
            message: msgs[Math.floor(Math.random() * msgs.length)],
            type: 'info',
          })
        }
      }

      // ═══ PHASE: RETURNING ═══
      if (store.missionPhase === 'RETURNING' && !returnChecked.current) {
        if (isReturnComplete()) {
          returnChecked.current = true
          useSimStore.getState().completeMission()
          useSimStore.getState().addNotification('All drones safely docked at base. Mission complete!', 'success')
          useSimStore.getState().addEvent({
            time: Math.floor(currentTime),
            message: 'All drones returned to base. Mission concluded.',
            type: 'system',
          })
          // Reset drone statuses
          store.drones.forEach(d => {
            useSimStore.getState().updateDrone(d.id, { status: 'IDLE' })
          })
        }
      }

    }, 100)

    return () => clearInterval(interval)
  }, [simulationRunning, missionPhase])
}
