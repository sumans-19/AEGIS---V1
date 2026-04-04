import { useEffect, useRef } from 'react'
import { useSimStore } from '../store/useSimStore'

const EVENT_TEMPLATES = {
  drone: [
    (drone) => `${drone.name || drone.callsign} adjusting altitude. Current: ${drone.altitude || 0}m.`,
    (drone) => `${drone.name || drone.callsign} thermal sweep in progress. Sector scan nominal.`,
    (drone) => `${drone.name || drone.callsign} LiDAR module active. Mapping rubble density at grid position.`,
    (drone) => `${drone.name || drone.callsign} communication relay signal strong. Latency 12ms.`,
    (drone) => `${drone.name || drone.callsign} obstacle detected at bearing 045. Adjusting flight path.`,
  ],
  info: [
    () => 'Ground station telemetry sync complete. All channels nominal.',
    () => 'Weather station update: Wind 8km/h NNW. Visibility 3.2km. Safe for operations.',
    () => 'Zone coverage updated. Anomaly density map refreshed.',
    () => 'Flight coordinator algorithm optimizing patrol routes.',
    () => 'Satellite uplink confirmed. HD imagery processing queued.',
  ],
  warning: [
    () => 'Structural instability detected in sector NE-2. Routing drones clear.',
    () => 'Communication interference detected on 2.4GHz band. Switching to backup frequency.',
    () => 'Dust cloud density increasing in sector W-1. Thermal readings may be affected.',
  ],
}

const GRID_REFS = ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5','E1','E2','E3','E4','E5']

export function useSimulation() {
  const {
    simulationRunning, simulationSpeed, simulationTime,
    incrementTime, drones, updateDrone, addEvent,
    addSurvivor, survivors, incrementCoverage,
    eventLog,
  } = useSimStore()

  const lastEventTime = useRef(0)
  const lastSurvivorTime = useRef(0)
  const nextSurvivorInterval = useRef(15 + Math.random() * 15)
  const nextEventInterval = useRef(4 + Math.random() * 6)
  const survivorCounter = useRef(survivors.length)

  useEffect(() => {
    if (!simulationRunning) return

    const interval = setInterval(() => {
      const dt = 0.1 * simulationSpeed
      const store = useSimStore.getState()
      const currentTime = store.simulationTime

      // Increment simulation time
      useSimStore.getState().incrementTime(dt)

      // Battery drain
      store.drones.forEach(drone => {
        let batteryChange = 0
        if (drone.status === 'CHARGING') {
          batteryChange = 0.005 * simulationSpeed
        } else if (drone.status === 'RETURNING') {
          batteryChange = -0.003 * simulationSpeed
        } else {
          batteryChange = -0.002 * simulationSpeed
        }
        
        let newBattery = Math.max(0, Math.min(100, drone.battery + batteryChange))
        let newStatus = drone.status
        
        // Status transitions
        if (newBattery <= 5 && drone.status !== 'CHARGING') {
          newStatus = 'RETURNING'
        }
        if (drone.status === 'CHARGING' && newBattery >= 100) {
          newStatus = 'SCANNING'
        }
        if (drone.status === 'RETURNING' && newBattery <= 2) {
          newStatus = 'CHARGING'
          newBattery = 5
        }

        useSimStore.getState().updateDrone(drone.id, {
          battery: newBattery,
          status: newStatus,
        })
      })

      // Generate events
      if (currentTime - lastEventTime.current > nextEventInterval.current) {
        lastEventTime.current = currentTime
        nextEventInterval.current = 4 + Math.random() * 8

        const categories = ['drone', 'drone', 'info', 'info', 'warning']
        const category = categories[Math.floor(Math.random() * categories.length)]
        const templates = EVENT_TEMPLATES[category]
        const template = templates[Math.floor(Math.random() * templates.length)]

        let message
        if (category === 'drone') {
          const activeDrones = store.drones.filter(d => d.status !== 'CHARGING')
          const drone = activeDrones[Math.floor(Math.random() * activeDrones.length)]
          if (drone) message = template(drone)
          else message = 'All drones nominal. Awaiting deployment orders.'
        } else {
          message = template()
        }

        if (message) {
          useSimStore.getState().addEvent({
            time: Math.floor(currentTime),
            message,
            type: category,
          })
        }
      }

      // Survivor detection and auto-logging
      if (currentTime - lastSurvivorTime.current > nextSurvivorInterval.current) {
        lastSurvivorTime.current = currentTime
        nextSurvivorInterval.current = 20 + Math.random() * 25

        const scanningDrones = store.drones.filter(d => 
          d.status === 'SCANNING' || d.status === 'SEARCHING'
        )
        if (scanningDrones.length > 0) {
          const drone = scanningDrones[Math.floor(Math.random() * scanningDrones.length)]
          if (!drone) return
          
          survivorCounter.current += 1
          const gridRef = GRID_REFS[Math.floor(Math.random() * GRID_REFS.length)]
          const name = drone.name || `DR-${drone.id}`

          const survivor = {
            id: survivorCounter.current,
            confidence: 78 + Math.floor(Math.random() * 20),
            temperature: parseFloat((36.2 + Math.random() * 1.5).toFixed(1)),
            detectedAt: Math.floor(currentTime),
            detectedBy: name,
            droneCallsign: drone.callsign,
            status: 'PENDING',
            position: {
              x: -20 + Math.random() * 40,
              y: 0.5,
              z: -20 + Math.random() * 40,
            },
            gridRef,
          }

          useSimStore.getState().addSurvivor(survivor)
        }
      }

      // Check proximity of drones to PENDING local survivors
      store.survivors.forEach(survivor => {
        if (!survivor.detected && String(survivor.id).startsWith('SURV-')) {
          // If a drone is close, detect it
          const sx = survivor.pos?.[0] || survivor.position?.x || 0
          const sz = survivor.pos?.[2] || survivor.position?.z || 0

          const detectingDrone = store.drones.find(d => {
             const dx = d.pos?.[0] || 0
             const dz = d.pos?.[2] || 0
             const dist = Math.sqrt((dx - sx)**2 + (dz - sz)**2)
             return dist < 30 // Detection radius
          })

          if (detectingDrone) {
             const conf = 60 + Math.floor(Math.random() * 35)
             useSimStore.getState().updateSurvivor(survivor.id, {
                detected: true,
                status: 'DETECTED',
                detectedBy: detectingDrone.name || detectingDrone.callsign,
                confidence: conf
             })
             useSimStore.getState().addEvent({
                time: Math.floor(currentTime),
                message: `${detectingDrone.name || detectingDrone.callsign} · Manual signature confirmed at [${sx.toFixed(1)}, ${sz.toFixed(1)}]. Confidence ${conf}%. Thermal ${survivor.body_temp.toFixed(1)}°C.`,
                type: 'survivor',
             })
          }
        }
      })

      // Coverage increment
      if (Math.random() < 0.01 * simulationSpeed) {
        useSimStore.getState().incrementCoverage(0.2)
      }

    }, 100)

    return () => clearInterval(interval)
  }, [simulationRunning, simulationSpeed])
}
