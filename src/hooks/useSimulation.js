import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/useSimStore'
import {
  isDeployComplete,
  isReturnComplete,
  computeSearchPaths,
  getDronePosition,
  getDroneOverrideStage,
  getPathDistance,
} from './useDroneMovement'

export function useSimulation() {
  const simulationRunning = useSimStore(s => s.simulationRunning)
  const missionPhase = useSimStore(s => s.missionPhase)

  const lastDetectionCheck = useRef(0)
  const lastBatteryUpdate = useRef(0)
  const lastTelemetryUpdate = useRef(0)
  const deployChecked = useRef(false)
  const returnChecked = useRef(false)
  const allFoundNotified = useRef(false)

  useEffect(() => {
    deployChecked.current = false
    returnChecked.current = false
    allFoundNotified.current = false
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
