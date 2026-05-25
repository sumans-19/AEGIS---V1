import { useMemo } from 'react'
import { useSimStore } from '../store/useSimStore'

export function useEdgeCaseScript(baseDrones) {
  const params = new URLSearchParams(window.location.search)
  const scriptId = params.get('script')
  const progress = useSimStore(s => s.playbackProgress)
  const edgeCaseStep = useSimStore(s => s.edgeCaseStep)

  return useMemo(() => {
     if (!scriptId || !baseDrones || baseDrones.length === 0) return baseDrones
     
     // Clone the drones array to mutate
     let activeDrones = JSON.parse(JSON.stringify(baseDrones))
     
     if (scriptId === 'battery_critical') {
        const d1 = activeDrones[0]
        if (d1) {
           d1.isScriptOverride = true
           d1.battery = progress > 0.4 ? 8 : 98
           if (progress > 0.4) {
              const localProg = (progress - 0.4) / 0.6
              const startX = 20, startZ = 20
              d1.pos[0] = startX - (localProg * startX)
              d1.pos[2] = startZ - (localProg * startZ)
              d1.pos[1] = 25 - (localProg * 25)
              d1.nextPos = [d1.pos[0]-1, d1.pos[1]-1, d1.pos[2]-1]
              d1.trail = [[startX, 25, startZ], [d1.pos[0], d1.pos[1], d1.pos[2]]]
              d1.status = 'RTB'
           } else {
              d1.pos = [20 * (progress/0.4), 25, 20 * (progress/0.4)]
              d1.nextPos = [20 * ((progress+0.01)/0.4), 25, 20 * ((progress+0.01)/0.4)]
              d1.status = 'SCANNING'
           }
        }
     } 
     else if (scriptId === 'imminent_collision') {
        const d2 = activeDrones[1]
        const d3 = activeDrones[2]
        if (d2 && d3) {
           d2.isScriptOverride = true
           d3.isScriptOverride = true
           d2.status = 'INTERCEPT'
           d3.status = 'INTERCEPT'
           const p1Start = [0, 20, 0]
           const p2Start = [40, 20, 40]
           
           if (progress < 0.5) {
              const t = progress / 0.5
              d2.pos = [p1Start[0] + 20*t, 20, p1Start[2] + 20*t]
              d3.pos = [p2Start[0] - 20*t, 20, p2Start[2] - 20*t]
              d2.nextPos = [p1Start[0] + 20*(t+0.01), 20, p1Start[2] + 20*(t+0.01)]
              d3.nextPos = [p2Start[0] - 20*(t+0.01), 20, p2Start[2] - 20*(t+0.01)]
           } else {
              const t = (progress - 0.5) / 0.5
              const deflection = Math.sin(t * Math.PI) * 15
              const nextT = t + 0.01; const nextDeflection = Math.sin(nextT * Math.PI) * 15;
              d2.pos = [20 + 20*t, 20 + deflection, 20 + 20*t]
              d3.pos = [20 - 20*t, 20 - deflection, 20 - 20*t]
              d2.nextPos = [20 + 20*nextT, 20 + nextDeflection, 20 + 20*nextT]
              d3.nextPos = [20 - 20*nextT, 20 - nextDeflection, 20 - 20*nextT]
              d2.status = 'EVASIVE'
              d3.status = 'EVASIVE'
           }
        }
     }
     else if (scriptId === 'wind_disturbance') {
        const d4 = activeDrones[3]
        if (d4) {
           d4.isScriptOverride = true
           d4.status = 'NOMINAL'
           const baseX = -30 + progress * 60
           const baseZ = 0
           if (progress > 0.4 && progress < 0.8) {
              const windDrift = Math.sin((progress-0.4)/0.4 * Math.PI) * 20
              const nextDrift = Math.sin(((progress+0.01)-0.4)/0.4 * Math.PI) * 20
              d4.pos = [baseX, 22, windDrift] 
              d4.nextPos = [baseX + 0.6, 22, nextDrift]
              d4.status = 'CORRECTING'
           } else {
              d4.pos = [baseX, 22, baseZ]
              d4.nextPos = [baseX + 0.6, 22, baseZ]
           }
        }
     }
     else if (scriptId === 'comms_loss') {
        const d5 = activeDrones[4]
        if (d5) {
           d5.isScriptOverride = true
           d5.pos = [20, 30, -20]
           d5.nextPos = [20.001, 30, -20]
           if (progress > 0.4 && progress < 0.9) {
              d5.status = 'LOITER'
              d5.pos[0] += Math.sin(progress * 20) * 5
              d5.pos[2] += Math.cos(progress * 20) * 5
              d5.nextPos[0] = d5.pos[0] + Math.sin((progress+0.01) * 20) * 5
              d5.nextPos[2] = d5.pos[2] + Math.cos((progress+0.01) * 20) * 5
           } else {
              d5.status = 'SCANNING'
           }
        }
     }
     else if (scriptId === 'drone_failure') {
        const d3 = activeDrones[2]
        const d4 = activeDrones[3]
        if (d3 && d4) {
           d3.isScriptOverride = true
           d4.isScriptOverride = true
           
           // Step 1: Search Initialization
           // Drones are exploring side-by-side
           if (edgeCaseStep === 1) {
              d3.status = 'SCANNING'
              d3.pos = [-10, 25, 30]
              d3.nextPos = [-9.9, 25, 30]
              
              d4.status = 'SCANNING'
              d4.pos = [10, 25, 50]
              d4.nextPos = [10.1, 25, 50]
           }
           // Step 2: Survivor Detection
           else if (edgeCaseStep === 2) {
              d3.status = 'SCANNING' // Drone 1 technically in the UI, but we use Drone 3 internally
              d3.pos = [-5, 25, 30]
              d3.nextPos = [-4.9, 25, 30]
              
              d4.status = 'SCANNING'
              d4.pos = [15, 25, 50]
              d4.nextPos = [15.1, 25, 50]
           }
           // Step 3: Drone Failure Trigger
           else if (edgeCaseStep === 3) {
              d3.status = 'FAILED'
              d3.pos = [-5, 25, 30]
              d3.nextPos = [...d3.pos]
              
              d4.status = 'SCANNING'
              d4.pos = [20, 25, 50]
              d4.nextPos = [20.1, 25, 50]
           }
           // Step 4 & 5: Emergency Transfer / Merge
           else if (edgeCaseStep === 4 || edgeCaseStep === 5) {
              d3.status = 'FAILED_SYNCING'
              d3.pos = [-5, 25, 30]
              d3.nextPos = [...d3.pos]
              
              d4.status = 'RECEIVING'
              d4.pos = [25, 25, 50]
              d4.nextPos = [-5, 25, 30] // Looking at D3
           }
           // Step 6: Shutdown
           else if (edgeCaseStep === 6) {
              d3.status = 'OFFLINE'
              d3.pos = [-5, 0, 30] // Grounded
              d3.nextPos = [...d3.pos]
              d3.altitude = 0
              
              d4.status = 'SCANNING'
              d4.pos = [25, 25, 50]
              d4.nextPos = [25.1, 25, 50]
           }
           // Step 7: Mission Continuation
           else if (edgeCaseStep === 7) {
              d3.status = 'OFFLINE'
              d3.pos = [-5, 0, 30]
              d3.nextPos = [...d3.pos]
              d3.altitude = 0
              
              d4.status = 'SCANNING'
              d4.pos = [15, 25, 35] // Moved into D3's zone
              d4.nextPos = [14.9, 25, 35]
           }
        }
     }

     return activeDrones
  }, [baseDrones, scriptId, progress, edgeCaseStep])
}
