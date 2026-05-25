import { useEffect, useRef, useState } from 'react'
import { X, Cpu, Radio, ShieldAlert, Activity, Battery, Crosshair, ArrowRightLeft, Database, Hexagon, Route, Wifi, Maximize, Minimize } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'
import { PROXIMITY_THRESHOLD, droneWaypointState, getDronePosition } from '../../hooks/useDroneMovement'

const DRONE_COLORS = {
  FALCON: '#00e5ff', HAWK: '#ff6b2b', OSPREY: '#00ff88',
  KESTREL: '#e040fb', MERLIN: '#f9e23c',
}

// ── Point Cloud Canvas ──
function PointCloudCanvas({ drone, mergeProgress, survivors }) {
  const canvasRef = useRef(null)
  const color = DRONE_COLORS[drone.callsign] || '#00e5ff'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0

    const draw = () => {
      tick++
      const { width, height } = canvas
      ctx.fillStyle = '#020508'
      ctx.fillRect(0, 0, width, height)

      const state = droneWaypointState.get(drone.id)
      const history = state?.history || []

      // Fallback to drone position if no history is available yet
      const currentPos = history.length > 0 ? history[history.length - 1] : { x: drone.pos?.[0] || 0, z: drone.pos?.[2] || 0 }
      const cx = currentPos.x
      const cz = currentPos.z
      const zoom = 80 + Math.sin(tick * 0.02) * 10
      const angle = tick * 0.005

      const toCanvas = (wx, wz) => {
        const dx = wx - cx
        const dz = wz - cz
        const rx = dx * Math.cos(angle) - dz * Math.sin(angle)
        const rz = dx * Math.sin(angle) + dz * Math.cos(angle)
        return {
          x: width/2 + (rx / zoom) * (width / 2),
          y: height/2 + (rz / zoom) * (height / 2)
        }
      }

      // Draw Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'
      ctx.lineWidth = 1
      for (let i = -4; i <= 4; i++) {
         const p1 = toCanvas(cx + i*20, cz - 100); const p2 = toCanvas(cx + i*20, cz + 100)
         ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke()
         const p3 = toCanvas(cx - 100, cz + i*20); const p4 = toCanvas(cx + 100, cz + i*20)
         ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke()
      }

      // Draw Points
      if (history.length > 0) {
        history.forEach((p, idx) => {
           const pt = toCanvas(p.x, p.z)
           const isMerging = mergeProgress > 0 && Math.random() < mergeProgress
           ctx.beginPath()
           ctx.arc(pt.x, pt.y, 2, 0, Math.PI*2)
           ctx.fillStyle = isMerging ? '#ffffff' : color
           ctx.fill()
           
           // Dense Simulated LiDAR scatter
           for (let i = 0; i < 40; i++) {
             const seededRandom = Math.sin(p.x * 12.9898 + p.z * 78.233 + i * 13.37) * 43758.5453
             const scatterR = Math.abs(seededRandom % 1) * 35
             const scatterA = (seededRandom * 100) % (Math.PI * 2)
             const spX = p.x + Math.cos(scatterA) * scatterR
             const spZ = p.z + Math.sin(scatterA) * scatterR
             const spt = toCanvas(spX, spZ)
             
             ctx.beginPath()
             ctx.arc(spt.x, spt.y, 1, 0, Math.PI*2)
             ctx.fillStyle = isMerging ? '#ffffff' : color + '70'
             ctx.fill()
           }
        })
      }

      // Draw Survivors
      survivors?.forEach(s => {
        if (!s.detected || s.detectedBy !== drone.callsign) return;
        const spt = toCanvas(s.pos[0], s.pos[2])
        ctx.beginPath()
        ctx.arc(spt.x, spt.y, 3, 0, Math.PI*2)
        ctx.fillStyle = '#ff0055'
        ctx.fill()
        
        // Crosshair
        ctx.beginPath()
        ctx.moveTo(spt.x - 6, spt.y)
        ctx.lineTo(spt.x + 6, spt.y)
        ctx.moveTo(spt.x, spt.y - 6)
        ctx.lineTo(spt.x, spt.y + 6)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.stroke()
      })

      // Scan line
      const scanA = tick * 0.05
      ctx.beginPath()
      ctx.moveTo(width/2, height/2)
      ctx.arc(width/2, height/2, width, scanA, scanA + 0.3)
      ctx.lineTo(width/2, height/2)
      ctx.fillStyle = `${color}15`
      ctx.fill()

      requestAnimationFrame(draw)
    }
    const animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [drone, mergeProgress, color])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', border: `1px solid ${color}30`, borderRadius: '4px', overflow: 'hidden' }}>
      <canvas ref={canvasRef} width={300} height={300} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: '10px', color: color, fontWeight: 'bold', textShadow: '0 0 4px #000' }}>
        ORB-SLAM3 // {drone.callsign}
      </div>
      <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: '9px', color: '#64748b' }}>
        REAL-TIME SCAN
      </div>
    </div>
  )
}

// ── Evasion Canvas ──
function EvasionCanvas({ d1, d2, path1, path2 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let tick = 0

    const draw = () => {
      tick++
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)

      // Get real-time positions
      const currentPos1 = getDronePosition(d1)
      const currentPos2 = getDronePosition(d2)

      // Center view on midpoint
      const cx = (currentPos1.x + currentPos2.x) / 2
      const cz = (currentPos1.z + currentPos2.z) / 2
      const viewSize = 120 // 120x120m view

      const toCanvas = (wx, wz) => ({
        x: ((wx - cx) / viewSize) * width + width/2,
        y: ((wz - cz) / viewSize) * height + height/2,
      })

      const c1 = DRONE_COLORS[d1.callsign] || '#00e5ff'
      const c2 = DRONE_COLORS[d2.callsign] || '#ff6b2b'

      // Draw RRT* Exploration Tree (simulated faint lines emanating from drones)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let i = 0; i < 10; i++) {
        const {x: px, y: py} = toCanvas(currentPos1.x, currentPos1.z)
        const {x: px2, y: py2} = toCanvas(currentPos1.x + (Math.random()-0.5)*60, currentPos1.z + (Math.random()-0.5)*60)
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px2, py2); ctx.stroke()
        
        const {x: p2x, y: p2y} = toCanvas(currentPos2.x, currentPos2.z)
        const {x: p2x2, y: p2y2} = toCanvas(currentPos2.x + (Math.random()-0.5)*60, currentPos2.z + (Math.random()-0.5)*60)
        ctx.beginPath(); ctx.moveTo(p2x, p2y); ctx.lineTo(p2x2, p2y2); ctx.stroke()
      }

      // Draw Projected Paths
      const drawPath = (path, color) => {
        if (!path || path.length < 2) return
        ctx.beginPath()
        const start = toCanvas(path[0].x, path[0].z)
        ctx.moveTo(start.x, start.y)
        for (let i = 1; i < path.length; i++) {
          const pt = toCanvas(path[i].x, path[i].z)
          ctx.lineTo(pt.x, pt.y)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }

      drawPath(path1, c1)
      drawPath(path2, c2)

      // Draw Drones
      const p1 = toCanvas(currentPos1.x, currentPos1.z)
      const p2 = toCanvas(currentPos2.x, currentPos2.z)
      
      // Proximity ring
      const dist = Math.sqrt((currentPos1.x-currentPos2.x)**2 + (currentPos1.z-currentPos2.z)**2)
      ctx.beginPath()
      ctx.arc(p1.x, p1.y, (PROXIMITY_THRESHOLD / viewSize) * width, 0, Math.PI * 2)
      ctx.strokeStyle = dist < PROXIMITY_THRESHOLD ? 'rgba(255, 50, 0, 0.6)' : 'rgba(0, 255, 136, 0.4)'
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([])

      // Drone blips
      ctx.beginPath(); ctx.arc(p1.x, p1.y, 6, 0, Math.PI*2); ctx.fillStyle = c1; ctx.fill()
      ctx.beginPath(); ctx.arc(p2.x, p2.y, 6, 0, Math.PI*2); ctx.fillStyle = c2; ctx.fill()

      requestAnimationFrame(draw)
    }
    const animId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animId)
  }, [d1, d2, path1, path2])

  return (
    <div style={{ position: 'relative', width: '100%', height: '180px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
      <canvas ref={canvasRef} width={600} height={180} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: '10px', color: '#ff3200', fontWeight: 'bold' }}>
        <Route size={12} style={{display:'inline', verticalAlign:'middle', marginRight: 4}}/>
        RRT* KINEMATIC EVASION
      </div>
    </div>
  )
}

// ── Main Component ──
export default function ProximityEncounterPanel({ isInline }) {
  const encounter = useSimStore(s => s.proximityEncounter)
  const dismiss = useSimStore(s => s.dismissProximityEncounter)
  const toggleViewMode = useSimStore(s => s.toggleEncounterViewMode)
  const viewMode = useSimStore(s => s.encounterViewMode)
  const survivors = useSimStore(s => s.survivors)
  
  const [raftState, setRaftState] = useState('LEADER_ELECTION')
  const [mergeProgress, setMergeProgress] = useState(0)

  // Algorithm state machine simulation
  useEffect(() => {
    if (!encounter) return
    setRaftState('LEADER_ELECTION')
    setMergeProgress(0)

    const t1 = setTimeout(() => setRaftState('MERGING'), 1200)
    const t2 = setInterval(() => {
      setMergeProgress(p => {
        if (p >= 1) {
          clearInterval(t2)
          setRaftState('COMMITTED')
          return 1
        }
        return p + 0.05
      })
    }, 100)

    return () => { clearTimeout(t1); clearInterval(t2) }
  }, [encounter])

  if (!encounter) return null

  const { drone1, drone2, pos1, pos2, pointCloud1, pointCloud2, reroutePath1, reroutePath2, algorithmState } = encounter
  const c1 = DRONE_COLORS[drone1.callsign] || '#00e5ff'
  const c2 = DRONE_COLORS[drone2.callsign] || '#ff6b2b'
  const dist = Math.sqrt((pos1.x-pos2.x)**2 + (pos1.z-pos2.z)**2)

  // Generate some fake survivor logs based on actual survivors
  const logs = survivors.filter(s => s.detected).slice(-4).map(s => ({
    time: Date.now() - Math.random() * 10000,
    drone: Math.random() > 0.5 ? drone1.callsign : drone2.callsign,
    id: s.id,
    conf: s.confidence,
    hex: Array.from({length: 8}, () => Math.floor(Math.random()*256).toString(16).padStart(2, '0')).join(' ').toUpperCase()
  }))

  return (
    <div style={{
      position: isInline ? 'absolute' : 'fixed', 
      inset: 0, 
      zIndex: isInline ? 10 : 9999,
      background: isInline ? '#04090f' : 'rgba(2, 5, 10, 0.96)', 
      backdropFilter: isInline ? 'none' : 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'JetBrains Mono, monospace', 
      padding: isInline ? '0' : '40px'
    }}>
      <div style={{
        width: '100%', maxWidth: isInline ? '100%' : '1200px', 
        height: '100%', maxHeight: isInline ? '100%' : '800px',
        border: isInline ? 'none' : '1px solid rgba(255, 50, 0, 0.3)', 
        borderRadius: isInline ? '0' : '8px',
        background: '#04090f', display: 'flex', flexDirection: 'column',
        boxShadow: isInline ? 'none' : '0 0 50px rgba(255, 50, 0, 0.1)', overflow: 'hidden'
      }}>
        
        {/* 1. HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'rgba(255, 50, 0, 0.05)', borderBottom: '1px solid rgba(255,50,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: '#ff3200', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', animation: 'pulse 2s infinite' }}>
              <ShieldAlert size={16} /> PROXIMITY ENCOUNTER
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
              <span style={{ color: c1, fontWeight: 'bold' }}>{drone1.callsign}</span>
              <ArrowRightLeft size={14} color="#64748b" />
              <span style={{ color: c2, fontWeight: 'bold' }}>{drone2.callsign}</span>
            </div>
            <div style={{ color: '#ff3200', fontSize: '14px', fontFamily: 'Rajdhani', fontWeight: 'bold' }}>
              {dist.toFixed(1)}m SEPARATION
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', color: '#64748b', textAlign: 'right', display: isInline ? 'none' : 'block' }}>
              <div>JETSON POWER: <span style={{color: '#00ff88'}}>14.2W / 15W</span></div>
              <div>LORA MESH: <span style={{color: '#00e5ff'}}>48 kbps</span></div>
            </div>
            <button onClick={toggleViewMode} title={viewMode === 'side' ? 'Full Screen' : 'Side-by-Side'} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer', padding: '8px', borderRadius: '4px', transition: '0.2s' }} onMouseOver={e=>e.currentTarget.style.color='#fff'} onMouseOut={e=>e.currentTarget.style.color='#94a3b8'}>
              {viewMode === 'side' ? <Maximize size={16} /> : <Minimize size={16} />}
            </button>
            <button onClick={dismiss} style={{ background: 'none', border: '1px solid #475569', color: '#94a3b8', cursor: 'pointer', padding: '8px', borderRadius: '4px', transition: '0.2s' }} onMouseOver={e=>{e.currentTarget.style.color='#ff3200'; e.currentTarget.style.borderColor='#ff3200'}} onMouseOut={e=>{e.currentTarget.style.color='#94a3b8'; e.currentTarget.style.borderColor='#475569'}}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
          
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#04090f' }}>
            
            {/* 2. MAP COMPARISON */}
            <div style={{ padding: '20px', height: '300px', display: 'flex', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
              <PointCloudCanvas drone={drone1} mergeProgress={mergeProgress} survivors={survivors} />
              <PointCloudCanvas drone={drone2} mergeProgress={mergeProgress} survivors={survivors} />
              
              {/* Raft Merge Overlay */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', border: '1px solid #00e5ff', padding: '12px 20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
                <Database size={24} color={raftState === 'COMMITTED' ? '#00ff88' : '#00e5ff'} style={{ marginBottom: 8 }} />
                <div style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 'bold', letterSpacing: '1px' }}>RAFT CONSENSUS</div>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'Rajdhani' }}>{raftState}</div>
                {raftState === 'MERGING' && (
                  <div style={{ width: '100px', height: '4px', background: '#333', marginTop: '8px', borderRadius: '2px' }}>
                    <div style={{ width: `${mergeProgress * 100}%`, height: '100%', background: '#00e5ff', borderRadius: '2px' }} />
                  </div>
                )}
              </div>
            </div>

            {/* 4. DYNAMIC REROUTING */}
            <div style={{ padding: '20px', flex: 1 }}>
              <EvasionCanvas d1={drone1} d2={drone2} path1={reroutePath1} path2={reroutePath2} />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#04090f' }}>
            
            {/* 3. LIVE TELEMETRY */}
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} /> LIVE HARDWARE TELEMETRY
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Drone 1 Telemetry */}
                <div style={{ border: `1px solid ${c1}30`, borderRadius: '4px', padding: '12px' }}>
                  <div style={{ color: c1, fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>{drone1.callsign}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                    <div style={{ color: '#64748b' }}>BATTERY <span style={{color: '#fff', float: 'right'}}>{drone1.battery?.toFixed(1)}%</span></div>
                    <div style={{ color: '#64748b' }}>GPU TEMP <span style={{color: '#ffb300', float: 'right'}}>68°C</span></div>
                    <div style={{ color: '#64748b' }}>ALTITUDE <span style={{color: '#fff', float: 'right'}}>{(drone1.pos?.[1] || 15).toFixed(1)}m</span></div>
                    <div style={{ color: '#64748b' }}>SIGNAL <span style={{color: '#00ff88', float: 'right'}}>-62dBm</span></div>
                  </div>
                </div>

                {/* Drone 2 Telemetry */}
                <div style={{ border: `1px solid ${c2}30`, borderRadius: '4px', padding: '12px' }}>
                  <div style={{ color: c2, fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>{drone2.callsign}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '10px' }}>
                    <div style={{ color: '#64748b' }}>BATTERY <span style={{color: '#fff', float: 'right'}}>{drone2.battery?.toFixed(1)}%</span></div>
                    <div style={{ color: '#64748b' }}>GPU TEMP <span style={{color: '#ffb300', float: 'right'}}>71°C</span></div>
                    <div style={{ color: '#64748b' }}>ALTITUDE <span style={{color: '#fff', float: 'right'}}>{(drone2.pos?.[1] || 15).toFixed(1)}m</span></div>
                    <div style={{ color: '#64748b' }}>SIGNAL <span style={{color: '#00ff88', float: 'right'}}>-65dBm</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1 }}>
              
              {/* 5A. ALGORITHM STATE */}
              <div style={{ padding: '20px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Hexagon size={14} /> HUNGARIAN ALLOCATION
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: 1.6 }}>
                  <div>&gt; Cost matrix computed...</div>
                  <div>&gt; Overlap detected in sector 4.</div>
                  <div style={{ color: '#ffb300', margin: '8px 0' }}>REASSIGNING TASK:</div>
                  <div>Target: <span style={{color: '#fff'}}>{drone1.callsign}</span></div>
                  <div>New Sector: <span style={{color: '#fff'}}>X: {pos1.x.toFixed(0)}, Z: {pos1.z.toFixed(0)} + 150m</span></div>
                  <div style={{ color: '#00ff88', marginTop: '8px' }}>✓ Optimization complete.</div>
                </div>
              </div>

              {/* 5B. SURVIVOR LOGS */}
              <div style={{ padding: '20px', overflowY: 'auto' }}>
                <div style={{ fontSize: '11px', color: '#64748b', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Crosshair size={14} /> YOLOv8 DETECTIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {logs.map((log, i) => (
                    <div key={i} style={{ borderLeft: `2px solid ${DRONE_COLORS[log.drone]}`, paddingLeft: '8px', fontSize: '9px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>{log.drone} // {log.id}</span>
                        <span style={{ color: '#00ff88' }}>CONF: {(log.conf * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {log.hex}
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic' }}>No detections in local cache.</div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 50, 0, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 50, 0, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 50, 0, 0); }
        }
      `}} />
    </div>
  )
}
