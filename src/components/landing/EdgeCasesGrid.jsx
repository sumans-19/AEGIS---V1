import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, AlertTriangle, Wind, WifiOff, Play, Pause, RotateCcw } from 'lucide-react'

const EDGE_CASES = [
  {
    id: 'battery_critical',
    title: 'CRITICAL BATTERY FAILURE',
    icon: Zap,
    color: '#ff4500',
    description: 'Simulates a sudden voltage drop in Drone 1 mid-flight. Tests the system\'s ability to instantly override current mission parameters and force an emergency emergency Return-to-Base (RTB) protocol before physical failure.',
    impact: 'MISSION ABORT + RTB'
  },
  {
    id: 'imminent_collision',
    title: 'IMMINENT COLLISION',
    icon: AlertTriangle,
    color: '#ffb300',
    description: 'Forces Drone 2 & 3 onto a direct high-speed intercept trajectory. Demonstrates the A* dynamic repulsor field logic instantly kicking in to force localized elevation/heading deflections, overcoming standard pathing.',
    impact: 'EVASIVE MANEUVER'
  },
  {
    id: 'wind_disturbance',
    title: 'HEAVY WIND SHEAR',
    icon: Wind,
    color: '#00e5ff',
    description: 'Injects a sudden 15m/s lateral crosswind vector against the swarm. Shows how the flight controllers detect off-path drift and engage corrective thrust vectoring to re-stabilize and recover the original trajectory.',
    impact: 'PATH RECALCULATION'
  },
  {
    id: 'comms_loss',
    title: 'COMMS LINK DROPOUT',
    icon: WifiOff,
    color: '#e040fb',
    description: 'Instantly severs the simulated uplink connection to Drone 5. Validates that the drone falls back to its onboard autonomous loiter protocol to hold position safely until the mesh network can reestablish contact.',
    impact: 'AUTONOMOUS LOITER'
  }
]

const SCRIPT_STAGES = {
  battery_critical: [
    { t: 0.0, text: "> 0.0s: Standard grid scan trajectory nominal. Voltage 98%." },
    { t: 0.3, text: "> 1.2s: ALERT! Cell voltage collapse detected on Drone-1." },
    { t: 0.4, text: "> 1.6s: CRITICAL: Battery forced to 8%. Triggering fail-safe." },
    { t: 0.5, text: "> 2.0s: Recalculating RTB (Return to Base). Diverting now." },
    { t: 0.8, text: "> 3.2s: Safe landing sequence at home base pad initiated." },
  ],
  imminent_collision: [
    { t: 0.0, text: "> 0.0s: Drones 2 & 3 proceeding on intersecting waypoints." },
    { t: 0.3, text: "> 1.2s: Proximity alert: Collision imminent within 2.4s." },
    { t: 0.5, text: "> 2.0s: A* Repulsor field activated. Evasive maneuver fired." },
    { t: 0.7, text: "> 2.8s: Vectors cleared successfully. Deflection secured." },
    { t: 0.9, text: "> 3.6s: Resuming nominal pathing towards original targets." },
  ],
  wind_disturbance: [
    { t: 0.0, text: "> 0.0s: Swarm proceeding to waypoints under clear skies." },
    { t: 0.3, text: "> 1.2s: ALERT: 15m/s unexpected crosswind shear hitting swarm." },
    { t: 0.4, text: "> 1.6s: Wind pushing drone off-route. Drift detected." },
    { t: 0.6, text: "> 2.4s: Corrective thrust vectoring engaged. Overcoming shear." },
    { t: 0.8, text: "> 3.2s: Heading stabilized. Original trajectory recovered." },
  ],
  comms_loss: [
    { t: 0.0, text: "> 0.0s: Full uplink maintaining 20Hz telemetry with base." },
    { t: 0.3, text: "> 1.2s: Signal from MERLIN degrading. High packet loss." },
    { t: 0.4, text: "> 1.6s: CRITICAL: Handshake lost. Connection completely severed." },
    { t: 0.5, text: "> 2.0s: Localized autonomous loiter protocol activated. Holding." },
    { t: 0.9, text: "> 3.6s: Mesh network relayed connection. Uplink restored." },
  ]
}

function InteractiveSimulator({ scenario, color }) {
  const canvasRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  
  // Animation Loop Update
  useEffect(() => {
    let animId
    let lastTime = performance.now()
    
    const loop = (time) => {
       if (isPlaying) {
          const delta = (time - lastTime) / 1000 // seconds
          setProgress(p => {
             let next = p + delta * 0.25 // 4 seconds per loop
             if (next >= 1) return 0 // loop back
             return next
          })
       }
       lastTime = time
       animId = requestAnimationFrame(loop)
    }
    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying])

  // Canvas Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cw = canvas.width
    const ch = canvas.height
    
    // Clean background
    ctx.fillStyle = '#050a10'
    ctx.fillRect(0,0, cw, ch)
    
    // Draw grid
    ctx.strokeStyle = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, 0.1)`
    ctx.lineWidth = 1
    for(let i=0; i<cw; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,ch); ctx.stroke() }
    for(let i=0; i<ch; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(cw,i); ctx.stroke() }

    const cy = ch / 2
    
    // Custom drawing per scenario based entirely on `progress` 0-1
    if (scenario === 'battery_critical') {
       // Base pad at left
       ctx.fillStyle = '#1e293b'
       ctx.fillRect(20, cy-20, 40, 40)
       ctx.strokeStyle = '#475569'
       ctx.strokeRect(20, cy-20, 40, 40)
       ctx.fillStyle = '#94a3b8'
       ctx.font = '10px JetBrains Mono'
       ctx.fillText('BASE', 40, cy+4)

       const isReturning = progress > 0.5
       const forwardTraj = 40 + progress * 2 * (cw - 120) // goes out to right
       const returnTraj = (cw - 80) - ((progress-0.5)*2) * (cw - 120) // comes back
       
       const droneX = isReturning ? returnTraj : forwardTraj

       // Drone
       ctx.fillStyle = isReturning ? color : '#00e5ff'
       ctx.beginPath(); ctx.arc(droneX, cy, 6, 0, Math.PI*2); ctx.fill()
       ctx.fillStyle = '#fff'
       ctx.font = 'bold 10px JetBrains Mono'
       ctx.fillText(isReturning ? 'RTB 08%' : 'BAT 98%', droneX, cy - 14)
       
       // Alert rings when dropping
       if (progress > 0.4 && progress < 0.6) {
          ctx.strokeStyle = `rgba(255, 69, 0, ${(0.6 - progress) * 5})`
          ctx.beginPath(); ctx.arc(droneX, cy, 10 + (progress*50)%20, 0, Math.PI*2); ctx.stroke()
       }
    } 
    else if (scenario === 'imminent_collision') {
       const d1x = 40 + progress * (cw - 80)
       const d2x = (cw - 40) - progress * (cw - 80)
       let y1 = cy, y2 = cy
       
       // Repulsor field activation (evasive vertical shift in 2D map)
       const isEvading = progress > 0.4 && progress < 0.7
       if (isEvading) {
          // Both curve outwards
          const evasion = Math.sin((progress-0.4)/0.3 * Math.PI) * 25
          y1 -= evasion
          y2 += evasion
          
          ctx.fillStyle = `rgba(255, 179, 0, ${Math.sin(progress*50) * 0.3})`
          ctx.beginPath(); ctx.arc(cw/2, cy, 40, 0, Math.PI*2); ctx.fill()
          ctx.fillStyle = color
          ctx.fillText('REPULSION FIELD ACTIVE', cw/2, cy - 50)
       }

       ctx.fillStyle = isEvading ? color : '#00e5ff'
       ctx.beginPath(); ctx.arc(d1x, y1, 6, 0, Math.PI*2); ctx.fill()
       ctx.beginPath(); ctx.arc(d2x, y2, 6, 0, Math.PI*2); ctx.fill()
    }
    else if (scenario === 'wind_disturbance') {
       const droneX = 40 + progress * (cw - 80)
       let y = cy
       const hasWind = progress > 0.3 && progress < 0.8
       
       if (hasWind) {
          // Off-path drift
          if (progress < 0.5) {
             y += (progress - 0.3) * 100 // blows down
          } else {
             // Correcting back
             y += 20 - (progress - 0.5) * 66 
          }
          
          // Draw wind particles flowing top-left to bottom-right
          ctx.strokeStyle = 'rgba(255,255,255,0.2)'
          for(let i=0; i<8; i++) {
             const px = (cw * progress * 2 + i * 40) % cw
             ctx.beginPath(); ctx.moveTo(px, cy - 40); ctx.lineTo(px + 20, cy + 20); ctx.stroke()
          }
          
          ctx.fillStyle = color
          if (progress < 0.5) ctx.fillText('WIND DRIFT DETECTED', cw/2, cy - 30)
          else ctx.fillText('THRUST VECTORING ACTIVE', cw/2, Math.min(y - 15, cy - 15))
       }
       
       // Nominal trajectory line
       ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'
       ctx.setLineDash([4, 4])
       ctx.beginPath(); ctx.moveTo(40, cy); ctx.lineTo(cw - 40, cy); ctx.stroke()
       ctx.setLineDash([])

       ctx.fillStyle = hasWind ? color : '#00e5ff'
       ctx.beginPath(); ctx.arc(droneX, y, 6, 0, Math.PI*2); ctx.fill()
    }
    else if (scenario === 'comms_loss') {
       const droneX = cw / 2
       const isLost = progress > 0.4 && progress < 0.9
       
       ctx.fillStyle = '#00e5ff'
       // Comms tower
       ctx.fillRect(20, cy-15, 10, 30)
       ctx.beginPath(); ctx.moveTo(25, cy-15); ctx.lineTo(25, cy-30); ctx.stroke()

       // Signal ripples from tower
       if (!isLost) {
          const r1 = Math.max(0.1, Math.abs((progress*20)%1)*100)
          ctx.strokeStyle = `rgba(0, 229, 255, ${(1 - Math.abs((progress*20)%1))})`
          ctx.beginPath(); ctx.arc(25, cy-30, r1, -Math.PI/2, Math.PI/2); ctx.stroke()
       }

       // Drone
       ctx.fillStyle = isLost ? color : '#00e5ff'
       ctx.beginPath(); ctx.arc(droneX, cy, 6, 0, Math.PI*2); ctx.fill()
       ctx.fillText(isLost ? 'LINK SEVERED' : 'UPLINK OK', droneX, cy - 15)

       if (isLost) {
          // Loiter rings
          const r2 = Math.max(0.1, Math.abs((progress*10)%1)*30)
          ctx.strokeStyle = `rgba(${parseInt(color.slice(1,3),16)}, ${parseInt(color.slice(3,5),16)}, ${parseInt(color.slice(5,7),16)}, ${1 - Math.abs((progress*10)%1)})`
          ctx.beginPath(); ctx.arc(droneX, cy, r2, 0, Math.PI*2); ctx.stroke()
          ctx.fillText('AUTONOMOUS LOITER', droneX, cy + 20)
       }
    }
  }, [scenario, color, progress])

  // Get active script text
  const stages = SCRIPT_STAGES[scenario]
  let activeText = stages[0].text
  for (let s of stages) {
     if (progress >= s.t) activeText = s.text
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
       <div style={{ position: 'relative', height: '180px', width: '100%', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
         <canvas ref={canvasRef} width={600} height={180} style={{ width: '100%', height: '100%', display: 'block' }} />
         
         {/* Live Script Terminal Overlay */}
         <div style={{ 
            position: 'absolute', bottom: 10, left: 10, right: 10, 
            background: 'rgba(5, 10, 16, 0.85)', padding: '8px 12px', 
            borderRadius: '4px', border: `1px solid ${color}40`,
            fontFamily: 'JetBrains Mono', fontSize: '11px', color: color,
            backdropFilter: 'blur(4px)'
         }}>
            {activeText}
         </div>
       </div>

       {/* Video Scrubber Controls */}
       <div style={{ padding: '12px 16px', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <button 
             onClick={() => setIsPlaying(!isPlaying)}
             style={{ background: 'transparent', border: 'none', color: 'var(--cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
             {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          
          <button 
             onClick={() => setProgress(0)}
             style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
             style={{ flex: 1, accentColor: color, cursor: 'pointer' }}
          />
          
          <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-dim)', width: '30px', textAlign: 'right' }}>
             {Math.round(progress * 100)}%
          </div>
       </div>
    </div>
  )
}

export default function EdgeCasesGrid() {
  return (
    <section id="edgecases" style={{
      padding: '40px 40px 120px',
      background: 'var(--bg-primary)',
      transition: 'background 0.5s ease',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           transition={{ duration: 0.6 }}
           style={{ textAlign: 'center', marginBottom: '80px' }}
        >
          <div style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '12px',
            color: '#a855f7',
            letterSpacing: '5px',
            marginBottom: '16px',
            fontWeight: 700,
          }}>
            // EXTREME CONTINGENCIES
          </div>
          <h2 style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '48px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '4px',
            marginBottom: '16px',
          }}>
            INTERACTIVE EDGE LOGIC
          </h2>
          <p style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '18px',
            color: 'var(--text-secondary)',
            maxWidth: '700px',
            margin: '0 auto',
            lineHeight: 1.7,
            fontWeight: 500,
          }}>
            Explore dynamic simulations of AEGIS handling critical hardware and environmental failures.
            Use the interactive scrubbers below to review exactly how the swarm overcomes chaotic events in real-time.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '24px',
        }}>
          {EDGE_CASES.map((scenario, idx) => (
             <motion.div
                key={scenario.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                style={{
                   background: 'var(--bg-panel)',
                   border: '1px solid var(--border-color)',
                   borderRadius: '8px',
                   display: 'flex',
                   flexDirection: 'column',
                   overflow: 'hidden',
                   boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
                }}
             >
                <div style={{ height: '140px', background: `linear-gradient(45deg, #050a10, ${scenario.color}20)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <scenario.icon size={64} color={scenario.color} opacity={0.3} />
                </div>
                
                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <div style={{ padding: '10px', background: `${scenario.color}15`, borderRadius: '6px', color: scenario.color }}>
                         <scenario.icon size={24} />
                      </div>
                      <h3 style={{ 
                         fontFamily: 'Rajdhani, sans-serif', 
                         fontSize: '22px', 
                         fontWeight: 700,
                         color: 'var(--text-primary)',
                         letterSpacing: '1px'
                      }}>
                         {scenario.title}
                      </h3>
                   </div>
                   
                   <p style={{
                      fontFamily: 'Roboto, sans-serif',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.6,
                      marginBottom: '24px'
                   }}>
                      {scenario.description}
                   </p>
                   
                   <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                     <div style={{ 
                        fontFamily: 'JetBrains Mono',
                        fontSize: '10px',
                        padding: '6px 14px',
                        border: `1px solid ${scenario.color}40`,
                        background: `${scenario.color}15`,
                        color: scenario.color,
                        borderRadius: '4px',
                        letterSpacing: '0.5px',
                        fontWeight: 'bold'
                     }}>
                        PROTOCOL: {scenario.impact}
                     </div>
                     
                     <a 
                        href={`/mission?scenario=earthquake&script=${scenario.id}`}
                        style={{
                           textDecoration: 'none',
                           fontFamily: 'Rajdhani',
                           fontWeight: 'bold',
                           fontSize: '14px',
                           padding: '8px 16px',
                           background: scenario.color,
                           color: '#000',
                           borderRadius: '4px',
                           letterSpacing: '1px'
                        }}
                     >
                        LAUNCH 3D SCRIPT
                     </a>
                   </div>
                </div>
             </motion.div>
          ))}

        </div>
      </div>
    </section>
  )
}
