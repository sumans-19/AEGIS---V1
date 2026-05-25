import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/useSimStore'
import {
  isDeployComplete,
  isReturnComplete,
  computeSearchPaths,
  getDronePosition,
  getDroneOverrideStage,
  getPathDistance,
  PROXIMITY_THRESHOLD,
  rerouteForCollisionAvoidance,
  droneWaypointState
} from './useDroneMovement'

export function useSimulation() {
  // PERF FIX: Only subscribe to the two values that control the useEffect lifecycle.
  // Reading the full store via useSimStore() caused Mission page to re-render
  // ~300 times/sec from drone position updates, freezing the UI.
  const simulationRunning = useSimStore(s => s.simulationRunning)
  const missionPhase = useSimStore(s => s.missionPhase)

  const lastDetectionCheck = useRef(0)
  const lastBatteryUpdate = useRef(0)
  const lastTelemetryUpdate = useRef(0)
  const deployChecked = useRef(false)
  const returnChecked = useRef(false)
  const allFoundNotified = useRef(false)
  const searchStartTimeRef = useRef(null)
  const searchTimeoutNotified = useRef(false)

  useEffect(() => {
    deployChecked.current = false
    returnChecked.current = false
    allFoundNotified.current = false
    searchTimeoutNotified.current = false
    if (missionPhase === 'SEARCHING') {
      searchStartTimeRef.current = Date.now()
    } else {
      searchStartTimeRef.current = null
    }
    lastBatteryUpdate.current = 0
    lastTelemetryUpdate.current = 0
  }, [missionPhase])

  useEffect(() => {
    if (!simulationRunning) return
    if (!['DEPLOYING', 'SEARCHING', 'ALL_FOUND', 'RETURNING'].includes(missionPhase)) return

    const interval = setInterval(() => {
      const store = useSimStore.getState()
      const currentTime = store.simulationTime
      const now = performance.now() / 1000

      store.incrementTime(0.1)

      if (now - lastTelemetryUpdate.current > 0.35) {
        lastTelemetryUpdate.current = now
        store.updateDrones(Object.fromEntries(
          store.drones.map(drone => {
            const pos = getDronePosition(drone)
            return [
              drone.id,
              {
                pos: [pos.x, pos.y, pos.z],
                altitude: Math.round((pos.y || 0) * 5.5),
              },
            ]
          })
        ))
      }

      Object.entries(store.dronePathOverrides || {}).forEach(([droneId, override]) => {
        const stage = getDroneOverrideStage(override, now)
        if (stage && stage !== override.stage) {
          store.markDroneOverrideStage(Number(droneId), stage)
        }
      })

      if (store.missionPhase === 'DEPLOYING' && !deployChecked.current) {
        if (isDeployComplete()) {
          deployChecked.current = true

          const searchPaths = computeSearchPaths(store.searchRegion)
          store.startSearch(searchPaths)
          store.addNotification('All drones arrived. Search operation commencing.', 'success')
          store.addEvent({
            time: Math.floor(currentTime),
            message: 'All drones deployed to search region. Initiating sweep pattern.',
            type: 'system',
          })
          const activeDroneIds = new Set(Object.entries(searchPaths)
            .filter(([, path]) => getPathDistance(path) > 1)
            .map(([id]) => Number(id)))
          store.updateDrones(Object.fromEntries(
            store.drones.map(drone => [
              drone.id,
              {
                status: drone.hardwareFailure || drone.replacementFor
                  ? drone.status
                  : (activeDroneIds.has(drone.id) ? 'SCANNING' : 'STANDBY'),
              },
            ])
          ))
        }
      }

      if (store.missionPhase === 'SEARCHING') {
        // ── Battery drain (throttled to every 3rd tick ≈ 300ms) ──
        if (Math.random() < 0.33) {
          store.drones.forEach(drone => {
            const newBattery = Math.max(5, drone.battery - 0.009)
            useSimStore.getState().updateDrone(drone.id, { battery: newBattery })
          })
        }

        // ── Survivor detection (proximity-based, using real-time calculated positions) ──
        if (now - lastBatteryUpdate.current > 0.5) {
          const elapsed = lastBatteryUpdate.current ? now - lastBatteryUpdate.current : 0.5
          lastBatteryUpdate.current = now

          store.updateDrones(Object.fromEntries(
            store.drones.map(drone => {
              if (['IDLE', 'STANDBY', 'FAILED_RTB', 'FAILED_DOCKED'].includes(drone.status)) {
                return [drone.id, { battery: drone.battery }]
              }
              return [
                drone.id,
                { battery: Math.max(5, drone.battery - (0.03 * elapsed)) },
              ]
            })
          ))
        }

        if (now - lastDetectionCheck.current > 0.5) {
          lastDetectionCheck.current = now

          const droneSnapshots = store.drones.map(drone => {
            const pos = getDronePosition(drone)
            return { ...drone, pos: [pos.x, pos.y, pos.z] }
          }).filter(drone => (
            !drone.hardwareFailure &&
            !['IDLE', 'STANDBY', 'FAILED_RTB', 'FAILED_DOCKED'].includes(drone.status)
          ))
          const detections = []

          store.survivors.forEach(survivor => {
            if (survivor.detected || survivor.status === 'DETECTED') return
            if (!String(survivor.id).startsWith('SURV-')) return

            const sx = survivor.pos?.[0] || 0
            const sz = survivor.pos?.[2] || 0

            const detectingDrone = droneSnapshots.find(drone => {
              const dx = drone.pos?.[0] || 0
              const dz = drone.pos?.[2] || 0
              const dist = Math.sqrt((dx - sx) ** 2 + (dz - sz) ** 2)
              return dist < 18
            })

            if (!detectingDrone) return

            const confidence = 70 + Math.floor(Math.random() * 28)
            detections.push({
              id: survivor.id,
              detectedBy: detectingDrone.callsign,
              detectedDroneId: detectingDrone.id,
              confidence,
              objectType: 'SURVIVOR',
              pos: [sx, survivor.pos?.[1] || 0.5, sz],
              time: Math.floor(currentTime),
              message: `${detectingDrone.callsign} detected survivor at [${sx.toFixed(0)}, ${sz.toFixed(0)}]. Confidence ${confidence}%. Thermal ${survivor.body_temp?.toFixed(1) || '37.0'} C.`,
              notification: `Survivor detected by ${detectingDrone.callsign}! Confidence: ${confidence}%`,
            })
          })

          if (detections.length > 0) {
            store.markSurvivorsDetected(detections)
          }
        }

        const survivorSnapshot = useSimStore.getState().survivors
        const seeded = survivorSnapshot.filter(s => String(s.id).startsWith('SURV-'))
        if (seeded.length > 0 && !allFoundNotified.current) {
          const allDetected = seeded.every(s => s.detected || s.status === 'DETECTED')
          if (allDetected) {
            allFoundNotified.current = true
            store.setMissionPhase('ALL_FOUND')
            store.addNotification('All survivors detected! Click "End Task" to recall drones to base.', 'success')
            store.addEvent({
              time: Math.floor(currentTime),
              message: `All ${seeded.length} survivors successfully detected. Mission objective complete.`,
              type: 'system',
            })
          }
        }

        // ── Proximity Encounter Detection (Raft + Collision Avoidance) ──
        if (!store.proximityEncounter) {
          for (let i = 0; i < store.drones.length; i++) {
            for (let j = i + 1; j < store.drones.length; j++) {
              const d1 = store.drones[i]
              const d2 = store.drones[j]
              
              let p1, p2
              try {
                const c1 = getDronePosition(d1)
                const c2 = getDronePosition(d2)
                p1 = { x: c1.x, z: c1.z }
                p2 = { x: c2.x, z: c2.z }
              } catch (_) { continue }

              const dist = Math.sqrt((p1.x - p2.x)**2 + (p1.z - p2.z)**2)
              
              if (dist < PROXIMITY_THRESHOLD) {
                const pairKey = `${d1.id}-${d2.id}`
                const lastEncounter = store.encounterCooldowns[pairKey] || 0
                
                // 30 second cooldown per pair
                if (Date.now() - lastEncounter > 30000) {
                  // Calculate reroutes
                  const path1 = rerouteForCollisionAvoidance(d1.id, p2)
                  const path2 = rerouteForCollisionAvoidance(d2.id, p1)
                  
                  // Snapshot state for the UI panel
                  const s1 = droneWaypointState.get(d1.id)
                  const s2 = droneWaypointState.get(d2.id)
                  
                  // Trigger UI Encounter
                  useSimStore.getState().triggerProximityEncounter({
                    drone1: d1,
                    drone2: d2,
                    pos1: p1,
                    pos2: p2,
                    timestamp: Date.now(),
                    reroutePath1: path1,
                    reroutePath2: path2,
                    pointCloud1: { history: s1?.history || [], visited: Array.from(s1?.visited || []) },
                    pointCloud2: { history: s2?.history || [], visited: Array.from(s2?.visited || []) },
                    algorithmState: {
                      raftStatus: 'LEADER_ELECTION', // Will progress to MERGING -> COMMITTED in UI
                      conflictingNodes: Math.floor(Math.random() * 50) + 20,
                    }
                  })
                  useSimStore.getState().setEncounterCooldown(pairKey)
                  
                  useSimStore.getState().addEvent({
                    time: Math.floor(currentTime),
                    message: `Proximity alert: ${d1.callsign} & ${d2.callsign} (${dist.toFixed(1)}m). Initiating RRT* evasion and Raft map merge.`,
                    type: 'warning',
                  })
                  break // Only trigger one at a time
                }
              }
            }
            if (useSimStore.getState().proximityEncounter) break
          }
        }

        // ── Search timeout: notify user after 90s that they can end search ──
        if (searchStartTimeRef.current && !searchTimeoutNotified.current) {
          const elapsed = Date.now() - searchStartTimeRef.current
          if (elapsed > 90000) {
            searchTimeoutNotified.current = true
            const detected = seeded.filter(s => s.detected || s.status === 'DETECTED').length
            useSimStore.getState().addNotification(
              `Search ongoing: ${detected}/${seeded.length} found. Use "End Search" to recall drones.`,
              'info'
            )
          }
        }

        // ── Coverage increment ──
        if (Math.random() < 0.03) {
          store.incrementCoverage(0.3)
        }

        if (Math.random() < 0.005) {
          const messages = [
            'Ground station telemetry sync complete.',
            'Thermal sweep pattern nominal. Scanning next corridor.',
            'Wind conditions stable. Operations safe.',
            'Swarm coordination algorithm optimizing routes.',
            'LiDAR mapping rubble density in active sector.',
          ]
          store.addEvent({
            time: Math.floor(currentTime),
            message: messages[Math.floor(Math.random() * messages.length)],
            type: 'info',
          })
        }
      }

      if (store.missionPhase === 'RETURNING' && !returnChecked.current) {
        if (isReturnComplete()) {
          returnChecked.current = true
          store.completeMission()
          store.addNotification('All drones safely docked at base. Mission complete!', 'success')
          store.addEvent({
            time: Math.floor(currentTime),
            message: 'All drones returned to base. Mission concluded.',
            type: 'system',
          })
          store.updateDrones(Object.fromEntries(
            store.drones.map(drone => [
              drone.id,
              { status: drone.hardwareFailure ? 'FAILED_DOCKED' : 'IDLE' },
            ])
          ))
        }
      }
    }, 100)

    return () => clearInterval(interval)
  }, [simulationRunning, missionPhase])
}
