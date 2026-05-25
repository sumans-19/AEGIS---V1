import React, { useEffect } from 'react'
import { Play, Pause, RotateCcw, XCircle } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import { useNavigate } from 'react-router-dom'
import RecoveryMonitoringPanel from './RecoveryMonitoringPanel'

const SCRIPT_STAGES = {
  battery_critical: [
    { t: 0.0, text: "> Standard pathing. Voltage 98%." },
    { t: 0.3, text: "> ALERT! Cell voltage collapse detected on Drone-1." },
    { t: 0.4, text: "> CRITICAL: Battery forced dropping. Triggering fail-safe." },
    { t: 0.5, text: "> Recalculating RTB (Return to Base). Diverting." },
    { t: 0.8, text: "> Safe landing sequence at home base pad initiated." },
  ],
  imminent_collision: [
    { t: 0.0, text: "> Drones 2 & 3 proceeding on intersecting waypoints." },
    { t: 0.3, text: "> Proximity alert: Collision imminent." },
    { t: 0.5, text: "> A* Repulsor field activated. Evasive maneuver fired." },
    { t: 0.7, text: "> Vectors cleared successfully. Deflection secured." },
    { t: 0.9, text: "> Resuming nominal pathing towards original targets." },
  ],
  wind_disturbance: [
    { t: 0.0, text: "> Swarm proceeding to waypoints under clear skies." },
    { t: 0.3, text: "> ALERT: 15m/s unexpected crosswind shear hitting swarm." },
    { t: 0.4, text: "> Wind pushing drone off-route. Drift detected." },
    { t: 0.6, text: "> Corrective thrust vectoring engaged. Overcoming shear." },
    { t: 0.8, text: "> Heading stabilized. Original trajectory recovered." },
  ],
  comms_loss: [
    { t: 0.0, text: "> Full uplink maintaining telemetry with base." },
    { t: 0.3, text: "> Signal degraded. High packet loss." },
    { t: 0.4, text: "> CRITICAL: Handshake lost. Connection severed." },
    { t: 0.5, text: "> Localized autonomous loiter protocol activated. Holding." },
    { t: 0.9, text: "> Mesh network relayed connection. Uplink restored." },
  ],
  drone_failure: [
    { t: 0.0, text: "> Drone 3 scanning nominal path. Telemetry green." },
    { t: 0.2, text: "> HARDWARE FAULT: Motor 4 failure detected on Drone 3." },
    { t: 0.3, text: "> Initiating emergency P2P handshake with Drone 4." },
    { t: 0.4, text: "> Handshake OK. Synchronizing terrain map & survivor data." },
    { t: 0.7, text: "> Transfer 100% complete. Drone 3 offline. Drone 4 resuming mission." },
  ]
}

export default function EdgeCaseOverlay({ scriptId }) {
  const progress = useSimStore(s => s.playbackProgress)
  const setProgress = useSimStore(s => s.setPlaybackProgress)
  const isPlaying = useSimStore(s => s.isPlayingScript)
  const setIsPlaying = useSimStore(s => s.setIsPlayingScript)
  
  const edgeCaseStep = useSimStore(s => s.edgeCaseStep)
  const setEdgeCaseStep = useSimStore(s => s.setEdgeCaseStep)
  
  const navigate = useNavigate()

  useEffect(() => {
    let animId
    let lastTime = performance.now()
    const loop = (time) => {
       if (isPlaying) {
          const delta = Math.max(0, (time - lastTime) / 1000)
          setProgress(p => {
             let next = p + delta * 0.1 // 10 seconds per playback
             if (next >= 1) {
                setIsPlaying(false)
                return 1
             }
             return next
          })
       }
       lastTime = time
       animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying, setProgress, setIsPlaying])

  const stages = SCRIPT_STAGES[scriptId] || []
  let activeText = stages.length > 0 ? stages[0].text : ""
  for (let s of stages) {
     if (progress >= s.t) activeText = s.text
  }

  return (
    <>
      <div style={{
         position: 'absolute',
         bottom: 40,
         left: '50%',
         transform: 'translateX(-50%)',
         width: '600px',
         background: 'rgba(5, 10, 16, 0.9)',
         backdropFilter: 'blur(10px)',
         border: '1px solid var(--border-color)',
         borderRadius: '8px',
         padding: '20px',
         zIndex: 9999,
         display: 'flex',
         flexDirection: 'column',
         gap: '16px',
         boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ color: '#00e5ff', fontFamily: 'Rajdhani', fontSize: '20px', fontWeight: 'bold' }}>
              EDGE CASE SCRIPT RUNNER: {scriptId.toUpperCase()}
           </div>
           <button 
             onClick={() => navigate('/mission')}
             style={{ background: 'transparent', border: 'none', color: '#ff3366', cursor: 'pointer' }}
           >
             <XCircle size={20} />
           </button>
        </div>
  
        <div style={{ 
           fontFamily: 'JetBrains Mono', 
           fontSize: '13px', 
           color: '#ffb300', 
           padding: '12px', 
           background: 'rgba(255, 179, 0, 0.1)', 
           borderRadius: '4px',
           borderLeft: '4px solid #ffb300'
        }}>
           {activeText}
        </div>
  
        {scriptId === 'drone_failure' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
           <div style={{ color: 'white', fontFamily: 'JetBrains Mono', fontSize: '14px' }}>
              STEP {edgeCaseStep} / 7
           </div>
           
           <button 
               onClick={() => {
                  if (edgeCaseStep < 7) setEdgeCaseStep(edgeCaseStep + 1)
                  else setEdgeCaseStep(1) // restart
               }}
               style={{ 
                 background: '#00e5ff', 
                 color: '#000', 
                 border: 'none', 
                 padding: '10px 24px', 
                 borderRadius: '4px', 
                 cursor: 'pointer',
                 fontFamily: 'Rajdhani',
                 fontWeight: 'bold',
                 fontSize: '16px',
                 letterSpacing: '1px'
               }}
            >
               {edgeCaseStep < 7 ? 'NEXT STEP →' : 'RESTART SIMULATION'}
            </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
           <button 
               onClick={() => {
                  if (progress >= 1) setProgress(0)
                  setIsPlaying(!isPlaying)
               }}
               style={{ background: '#00e5ff', color: '#000', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
            >
               {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            
            <button 
               onClick={() => { setProgress(0); setIsPlaying(false) }}
               style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
            >
               <RotateCcw size={16} />
            </button>
  
            <input 
               type="range" 
               min="0" max="1" step="0.001" 
               value={progress}
               onChange={(e) => {
                  setProgress(parseFloat(e.target.value))
                  setIsPlaying(false)
               }}
               style={{ flex: 1, cursor: 'pointer', accentColor: '#00e5ff' }}
            />
  
            <div style={{ color: 'white', fontFamily: 'JetBrains Mono', fontSize: '14px', width: '40px' }}>
               {Math.round(progress * 100)}%
            </div>
        </div>
      )}
      </div>
      
      {/* Optional Side Panels for specific edge cases */}
      <RecoveryMonitoringPanel activeEdgeCase={scriptId} />
    </>
  )
}
