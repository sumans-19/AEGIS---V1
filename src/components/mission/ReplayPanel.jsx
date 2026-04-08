import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Play, Pause, SkipBack, SkipForward,
  FastForward, Rewind, Activity, Zap, AlertTriangle,
  Wind, WifiOff, MapPin, Terminal, Download, Crosshair
} from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

function MiniRecorderScreen({ scenario }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0
    let anim
    
    const draw = () => {
      tick++
      ctx.fillStyle = '#050a10'
      ctx.fillRect(0,0, canvas.width, canvas.height)
      
      // Draw grid
      ctx.strokeStyle = 'rgba(0,229,255,0.05)'
      ctx.lineWidth = 1
      for(let i=0; i<canvas.width; i+=20) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); ctx.stroke() }
      for(let i=0; i<canvas.height; i+=20) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); ctx.stroke() }
      
      ctx.textAlign = 'center'
      
      // Draw Rec indicator
      if (scenario) {
         ctx.fillStyle = tick % 60 < 30 ? '#ff0000' : 'transparent'
         ctx.beginPath(); ctx.arc(canvas.width - 25, 15, 3, 0, Math.PI*2); ctx.fill()
         ctx.fillStyle = '#ff0000'
         ctx.font = 'bold 9px JetBrains Mono'
         ctx.fillText('REC', canvas.width - 45, 18)
      } else {
         ctx.fillStyle = '#475569'
         ctx.font = '10px JetBrains Mono'
         ctx.fillText('NO SCRIPT LOADED', canvas.width/2, canvas.height/2)
      }

      // ── Animate based on scenario ──
      const cw = canvas.width
      const ch = canvas.height
      const cy = ch / 2 + 5
      
      if (scenario === 'battery_critical') {
         const progress = (tick % 200) / 200
         const x = 50 + progress * (cw - 100)
         const isReturning = progress > 0.5
         
         ctx.fillStyle = isReturning ? '#ff4500' : '#00e5ff'
         ctx.beginPath(); ctx.arc(isReturning ? (cw - 50) - (progress-0.5)*2*(cw-100) : x, cy, 6, 0, Math.PI*2); ctx.fill()
         
         if (isReturning) {
             ctx.fillStyle = tick % 20 < 10 ? '#ff4500' : 'transparent'
             ctx.font = 'bold 10px JetBrains Mono'
             ctx.fillText('RTB - BATT 08%', cw/2, cy - 20)
         }
      } 
      else if (scenario === 'imminent_collision') {
         const progress = (tick % 200) / 200
         ctx.fillStyle = '#ffb300'
         const p1x = 50 + progress * 60
         const p2x = cw - 50 - progress * 60
         
         ctx.beginPath(); ctx.arc(p1x, cy, 6, 0, Math.PI*2); ctx.fill()
         ctx.beginPath(); ctx.arc(p2x, cy, 6, 0, Math.PI*2); ctx.fill()
         
         if (progress > 0.75) {
             ctx.fillStyle = tick % 15 < 7 ? '#ff3200' : 'transparent'
             ctx.font = 'bold 10px JetBrains Mono'
             ctx.fillText('REPULSION FIELD ACTIVE', cw/2, cy - 20)
             ctx.strokeStyle = `rgba(255,50,0,${Math.sin(tick*0.5)})`
             ctx.beginPath(); ctx.arc(cw/2, cy, 20, 0, Math.PI*2); ctx.stroke()
         }
      }
      else if (scenario === 'wind_disturbance') {
         const progress = (tick % 200) / 200
         let y = cy
         if (progress > 0.3 && progress < 0.7) y += Math.sin(tick*0.3) * 12
         
         ctx.fillStyle = '#00e5ff'
         ctx.beginPath(); ctx.arc(50 + progress * (cw - 100), y, 6, 0, Math.PI*2); ctx.fill()
         
         if (progress > 0.3 && progress < 0.7) {
            ctx.fillStyle = '#00e5ff'
            ctx.fillText('CORRECTING WIND SHEAR', cw/2, cy - 20)
            
            // Draw wind particles
            ctx.fillStyle = 'rgba(255,255,255,0.2)'
            for(let i=0;i<5;i++) ctx.fillRect(cw/2 + Math.random()*50 - tick%20*5, cy + Math.random()*40-20, 10, 1)
         }
      }
      else if (scenario === 'comms_loss') {
         ctx.fillStyle = tick % 30 < 15 ? '#e040fb' : '#475569'
         ctx.beginPath(); ctx.arc(cw/2, cy, 6, 0, Math.PI*2); ctx.fill()
         
         ctx.fillStyle = '#e040fb'
         ctx.font = 'bold 10px JetBrains Mono'
         ctx.fillText('AUTONOMOUS LOITER - LINK SEVERED', cw/2, cy - 20)
         
         // Error circles
         ctx.strokeStyle = `rgba(224,64,251,${1 - (tick%40)/40})`
         ctx.beginPath(); ctx.arc(cw/2, cy, (tick%40)*1.5, 0, Math.PI*2); ctx.stroke()
      }

      anim = requestAnimationFrame(draw)
    }
    anim = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(anim)
  }, [scenario])

  return (
    <div style={{ position: 'relative', height: '120px', width: '100%', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
      <canvas ref={canvasRef} width={450} height={120} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: '9px', color: 'rgba(0,229,255,0.6)', letterSpacing: '2px', fontFamily: 'JetBrains Mono' }}>
         AUTORECORDED SIMULATION CAPTURE
      </div>
    </div>
  )
}

export default function ReplayPanel({ onClose }) {
  const simulationTime = useSimStore(s => s.simulationTime)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(100)
  
  // Edge Case Handling
  const [activeEdgeCase, setActiveEdgeCase] = useState(null)
  const [edgeLogs, setEdgeLogs] = useState([])

  const triggerEdgeCase = async (scenarioMap) => {
    setActiveEdgeCase(scenarioMap.id)
    setEdgeLogs(prev => [...prev, `[T+${simulationTime.toFixed(0)}] INITIATING EDGE CASE: ${scenarioMap.title}`])
    
    try {
      await fetch('http://localhost:8000/api/simulation/edge-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: scenarioMap.id })
      })
      
      // Simulate receiving updates
      setTimeout(() => {
        setEdgeLogs(prev => [...prev, `[T+${(simulationTime + 0.5).toFixed(0)}] System responding to override...`])
      }, 500)
      
      setTimeout(() => {
        setActiveEdgeCase(null)
      }, 3000)
    } catch (e) {
      setActiveEdgeCase(null)
    }
  }

  const EDGE_CASES = [
    {
      id: 'battery_critical',
      title: 'CRITICAL BATTERY FAILURE',
      icon: Zap,
      color: '#ff4500',
      description: 'Forces Drone 1 (FALCON) to 8% battery. Triggers emergency RTB protocol.',
      impact: 'MISSION ABORT + RTB'
    },
    {
      id: 'imminent_collision',
      title: 'IMMINENT COLLISION',
      icon: AlertTriangle,
      color: '#ffb300',
      description: 'Forces Drone 2 & 3 on an intercept course. Tests the A* repulsor field logic.',
      impact: 'EVASIVE MANEUVER'
    },
    {
      id: 'wind_disturbance',
      title: 'HEAVY WIND SHEAR',
      icon: Wind,
      color: '#00e5ff',
      description: 'Applies 15m/s crosswind velocity vector to the swarm. Tests path correction.',
      impact: 'PATH RECALCULATION'
    },
    {
      id: 'comms_loss',
      title: 'COMMS LINK DROPOUT',
      icon: WifiOff,
      color: '#e040fb',
      description: 'Severs connection to Drone 5 (MERLIN). Drone enters localized autonomous loiter.',
      impact: 'AUTONOMOUS LOITER'
    }
  ]

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: '45vh',
        zIndex: 9500,
        background: 'rgba(5, 9, 15, 0.98)',
        borderTop: '1px solid rgba(168, 85, 247, 0.3)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'JetBrains Mono, monospace',
        boxShadow: '0 -10px 50px rgba(0,0,0,0.5)',
      }}
    >
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: '#0a0a0a'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '4px', height: '20px', background: '#a855f7', borderRadius: '2px' }} />
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '2px', fontFamily: 'Rajdhani' }}>
              AEGIS MISSION REPLAY & EDGE TESTING
            </div>
            <div style={{ fontSize: '10px', color: '#a855f7', letterSpacing: '1px' }}>
              ARCHIVE PLAYBACK // SYSTEM STRESS TESTER
            </div>
          </div>
        </div>
        
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#e2e8f0', cursor: 'pointer', padding: '6px', borderRadius: '4px',
          display: 'flex', transition: '0.2s',
        }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT: REPLAY/SCRUBBER UI */}
        <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Main Scrubber */}
          <div style={{ marginBottom: '30px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '11px', color: '#94a3b8' }}>
                <span>mission_start</span>
                <span style={{ color: '#a855f7' }}>T+{simulationTime.toFixed(1)}s (LIVE)</span>
             </div>
             <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative', cursor: 'pointer' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#a855f7', borderRadius: '2px', position: 'relative' }}>
                   <div style={{
                      position: 'absolute', right: -6, top: -4, width: 12, height: 12,
                      background: '#fff', borderRadius: '50%', boxShadow: '0 0 10px #a855f7'
                   }} />
                </div>
                {/* Event blips on timeline */}
                {[20, 45, 60, 85].map((pct, i) => (
                   <div key={i} style={{
                      position: 'absolute', left: `${pct}%`, top: -2, width: 8, height: 8,
                      background: i % 2 === 0 ? '#00e5ff' : '#00ff88', borderRadius: '50%',
                      border: '2px solid rgba(5, 9, 15, 1)'
                   }} />
                ))}
             </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <button style={btnStyle}><SkipBack size={18} /></button>
               <button style={btnStyle}><Rewind size={18} /></button>
               <button 
                 onClick={() => setIsPlaying(!isPlaying)}
                 style={{ ...btnStyle, width: '48px', height: '48px', borderRadius: '50%', border: '1px solid #a855f7', background: 'rgba(168, 85, 247, 0.1)', color: '#00e5ff' }}
               >
                 {isPlaying ? <Pause size={24} /> : <Play size={24} />}
               </button>
               <button style={btnStyle}><FastForward size={18} /></button>
               <button style={btnStyle}><SkipForward size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
               <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>SPEED</div>
                  <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 700 }}>1.0x</div>
               </div>
               <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px' }}>ACTIVE CAMS</div>
                  <div style={{ fontSize: '14px', color: '#00e5ff', fontWeight: 700 }}>3/5</div>
               </div>
            </div>

            <button style={{
               display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
               background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.3)',
               color: '#00e5ff', borderRadius: '4px', fontSize: '11px', cursor: 'pointer'
            }}>
               <Download size={14} />
               EXPORT RECORDING
            </button>
          </div>
        </div>

        {/* RIGHT: EDGE CASE INJECTION */}
        <div style={{ width: '450px', background: '#080c14', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: '#a855f7', letterSpacing: '1px' }}>
              SCENARIO INJECTION SCRIPT RUNNER
           </div>
           
           <MiniRecorderScreen scenario={activeEdgeCase} />
           
           <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {EDGE_CASES.map(scenario => (
                 <button
                    key={scenario.id}
                    onClick={() => triggerEdgeCase(scenario)}
                    disabled={activeEdgeCase !== null && activeEdgeCase !== scenario.id}
                    style={{
                       display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '16px',
                       border: `1px solid ${activeEdgeCase === scenario.id ? scenario.color : 'rgba(255,255,255,0.05)'}`,
                       background: activeEdgeCase === scenario.id ? `${scenario.color}15` : 'rgba(0,0,0,0.3)',
                       borderRadius: '6px', cursor: activeEdgeCase !== null ? 'not-allowed' : 'pointer',
                       textAlign: 'left', transition: 'all 0.2s', opacity: activeEdgeCase !== null && activeEdgeCase !== scenario.id ? 0.4 : 1
                    }}
                    onMouseOver={e => { if(activeEdgeCase === null) e.currentTarget.style.borderColor = scenario.color + '50' }}
                    onMouseOut={e => { if(activeEdgeCase === null) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}
                 >
                    <div style={{ padding: '8px', background: `${scenario.color}20`, borderRadius: '6px', color: scenario.color }}>
                       <scenario.icon size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                       <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700, marginBottom: '4px', letterSpacing: '0.5px' }}>
                          {activeEdgeCase === scenario.id ? 'EXECUTING SCRIPT...' : scenario.title}
                       </div>
                       <div style={{ fontSize: '9px', color: '#94a3b8', lineHeight: 1.4, marginBottom: '6px' }}>
                          {scenario.description}
                       </div>
                       <div style={{ display: 'inline-block', fontSize: '8px', padding: '2px 6px', border: `1px solid ${scenario.color}40`, color: scenario.color, borderRadius: '4px', background: `${scenario.color}10` }}>
                          EXPECTED: {scenario.impact}
                       </div>
                    </div>
                 </button>
              ))}
           </div>
        </div>

        {/* LOG CONSOLE */}
        <div style={{ width: '350px', background: '#020408', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} color="#a855f7" />
              <span style={{ fontSize: '11px', color: '#a855f7', letterSpacing: '1px' }}>SYSTEM TERMINAL</span>
           </div>
           <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {edgeLogs.length === 0 ? (
                 <div style={{ color: '#334155', fontSize: '10px' }}>Waiting for script execution...</div>
              ) : (
                 edgeLogs.map((log, i) => (
                    <div key={i} style={{ 
                       fontSize: '10px', 
                       color: log.includes('INITIATING') ? '#ffb300' : '#00ff88',
                       fontFamily: 'JetBrains Mono',
                       lineHeight: 1.4,
                    }}>
                       {log}
                    </div>
                 ))
              )}
           </div>
        </div>

      </div>
    </motion.div>
  )
}

const btnStyle = {
   display: 'flex', alignItems: 'center', justifyContent: 'center',
   width: '36px', height: '36px', background: 'transparent',
   border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', borderRadius: '6px',
   cursor: 'pointer', transition: '0.2s',
}
