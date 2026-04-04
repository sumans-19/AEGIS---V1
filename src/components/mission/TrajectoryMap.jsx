import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Map, Navigation, Maximize2, Minimize2, ZoomIn, ZoomOut, Target } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function TrajectoryMap() {
  const canvasRef = useRef(null)
  const [zoom, setZoom] = useState(2.5)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  
  const drones = useSimStore(s => s.drones)
  const s_id = useSimStore(s => s.selectedDrone)
  const survivors = useSimStore(s => s.survivors)
  const zoneCoverage = useSimStore(s => s.zoneCoverage)
  
  const selectedDrone = drones.find(d => d.id === s_id) || drones[0]
  
  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let req
    
    const draw = () => {
       const store = useSimStore.getState()
       const currentDrones = store.drones
       const currentSurvivors = store.survivors
       const currentSid = store.selectedDrone
       const currentSelectedDrone = currentDrones.find(d => d.id === currentSid) || currentDrones[0]

       ctx.clearRect(0, 0, canvas.width, canvas.height)
       
       ctx.save()
       ctx.translate(canvas.width/2 + pan.x, canvas.height/2 + pan.y)
       ctx.scale(zoom, zoom)
       
       // 1. Draw Grid
       const cellSize = 5
       for (let i = -10; i < 10; i++) {
         for (let j = -10; j < 10; j++) {
           ctx.beginPath()
           ctx.rect(i * cellSize, j * cellSize, cellSize, cellSize)
           ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)'
           ctx.stroke()
         }
       }
       
       // 2. Draw Trails
       currentDrones.forEach(d => {
         if (!d.trail || d.trail.length < 2) return
         ctx.beginPath()
         ctx.moveTo(d.trail[0][0], d.trail[0][2])
         d.trail.forEach(p => ctx.lineTo(p[0], p[2]))
         ctx.strokeStyle = d.id === currentSid ? 'rgba(0, 229, 255, 0.6)' : 'rgba(148, 163, 184, 0.2)'
         ctx.lineWidth = 0.5
         ctx.stroke()
       })
       
       // 3. Draw Planned Path
       if (currentSelectedDrone?.trajectory) {
          const sdx = currentSelectedDrone.pos?.[0] || 0
          const sdz = currentSelectedDrone.pos?.[2] || 0
          ctx.beginPath()
          ctx.setLineDash([2, 2])
          ctx.moveTo(sdx, sdz)
          currentSelectedDrone.trajectory.forEach(p => ctx.lineTo(p[0], p[2]))
          ctx.strokeStyle = '#00e5ff'
          ctx.lineWidth = 0.5
          ctx.stroke()
          ctx.setLineDash([])
          
          currentSelectedDrone.trajectory.forEach((p, idx) => {
             if (idx % 5 === 0) {
                ctx.beginPath()
                ctx.arc(p[0], p[2], 0.4, 0, Math.PI*2)
                ctx.fillStyle = '#00e5ff'
                ctx.fill()
             }
          })
       }
       
       // 4. Draw Survivors
       currentSurvivors.forEach(s => {
          if (!s.detected) return
          const sx = s.pos?.[0] || s.position?.x || 0
          const sz = s.pos?.[2] || s.position?.z || 0
          ctx.beginPath()
          ctx.arc(sx, sz, 1.2, 0, Math.PI*2)
          ctx.fillStyle = s.status === 'RESCUED' ? '#00ff88' : '#00e5ff'
          ctx.fill()
          ctx.font = '2px JetBrains Mono'
          ctx.fillStyle = 'white'
          ctx.fillText(`S#${s.id}`, sx + 1.5, sz + 1)
       })

       // 5. Draw Drones as Triangles
       currentDrones.forEach(d => {
          const dx = d.pos?.[0] || 0
          const dz = d.pos?.[2] || 0
          ctx.save()
          ctx.translate(dx, dz)
          ctx.rotate((d.heading || 0) * (Math.PI / 180))
          
          // Selection Glow
          if (d.id === currentSid) {
             ctx.shadowBlur = 10
             ctx.shadowColor = '#00e5ff'
          }

          ctx.beginPath()
          ctx.moveTo(0, -6) 
          ctx.lineTo(-4, 4) 
          ctx.lineTo(4, 4) 
          ctx.closePath()
          
          ctx.fillStyle = d.id === currentSid ? '#00e5ff' : '#94a3b8'
          ctx.globalAlpha = d.id === currentSid ? 1 : 0.7
          ctx.fill()
          
          if (d.id === currentSid) {
             ctx.strokeStyle = 'white'
             ctx.lineWidth = 1.0
             ctx.stroke()
          }
          ctx.restore()
       })

       ctx.restore()
       req = requestAnimationFrame(draw)
    }
    
    req = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(req)
  }, [pan, zoom])

  const handleMouseDown = (e) => {
     setIsDragging(true)
     lastMousePos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e) => {
     if (!isDragging) return
     const dx = e.clientX - lastMousePos.current.x
     const dy = e.clientY - lastMousePos.current.y
     setPan(p => ({ x: p.x + dx, y: p.y + dy }))
     lastMousePos.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => setIsDragging(false)
  const handleWheel = (e) => {
     const nextZoom = Math.max(1, Math.min(10, zoom - e.deltaY * 0.005))
     setZoom(nextZoom)
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0a0a0f',
      position: 'relative',
      overflow: 'hidden',
      border: '1px solid var(--border-color)',
      cursor: isDragging ? 'grabbing' : 'crosshair',
    }}>
      <canvas 
        ref={canvasRef}
        width={800}
        height={600}
        style={{ width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      
      <div style={{
         position: 'absolute',
         bottom: 16,
         right: 16,
         display: 'flex',
         flexDirection: 'column',
         gap: '8px',
      }}>
         <button onClick={() => setZoom(z => Math.min(10, z + 0.5))} style={btnStyle}><ZoomIn size={16}/></button>
         <button onClick={() => setZoom(z => Math.max(1, z - 0.5))} style={btnStyle}><ZoomOut size={16}/></button>
         <button onClick={() => { setPan({x:0, y:0}); setZoom(2.5) }} style={btnStyle}><Target size={16}/></button>
      </div>

      <div style={{
         position: 'absolute',
         top: 16,
         left: 16,
         background: 'rgba(0,0,0,0.6)',
         padding: '8px 12px',
         borderRadius: '2px',
         fontFamily: 'JetBrains Mono',
         fontSize: '10px',
         color: '#00e5ff',
         letterSpacing: '1px',
         display: 'flex',
         alignItems: 'center',
         gap: '8px',
         border: '1px solid rgba(0,229,255,0.2)',
      }}>
         <Map size={14} />
         TRAJECTORY_X_Y // ACTIVE_PLOT
      </div>
    </div>
  )
}

const btnStyle = {
   background: 'rgba(0,0,0,0.6)',
   border: '1px solid var(--border-color)',
   color: 'white',
   padding: '8px',
   cursor: 'pointer',
   display: 'flex',
   alignItems: 'center',
   justifyContent: 'center',
   borderRadius: '2px',
}
