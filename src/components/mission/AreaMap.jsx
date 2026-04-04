import { useRef, useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Map as MapIcon, Compass, Anchor, ScrollText } from 'lucide-react'
import { useSimStore } from '../../store/useSimStore'

export default function AreaMap() {
  const canvasRef = useRef(null)
  const [zoom, setZoom] = useState(2.2)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const lastMousePos = useRef({ x: 0, y: 0 })
  
  const drones = useSimStore(s => s.drones)
  const s_id = useSimStore(s => s.selectedDrone)
  const survivors = useSimStore(s => s.survivors)
  const zoneCoverage = useSimStore(s => s.zoneCoverage)

  // Parchment palette
  const COLORS = {
    paper: '#f2e3c9',
    ink: '#3d2b1f',
    inkDim: 'rgba(61, 43, 31, 0.2)',
    inkRed: '#a32a2a',
    inkBlue: '#2a4a7a',
    wood: '#4a3219'
  }
  
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

       // 1. Draw Paper Texture Background
       ctx.fillStyle = COLORS.paper
       ctx.fillRect(0, 0, canvas.width, canvas.height)
       
       // Subtle paper grain/stains
       ctx.save()
       ctx.globalAlpha = 0.05
       for(let i=0; i<10; i++) {
          ctx.fillStyle = i % 2 === 0 ? '#000' : '#fff'
          ctx.beginPath()
          ctx.arc(Math.sin(i)*canvas.width, Math.cos(i)*canvas.height, 100, 0, Math.PI*2)
          ctx.fill()
       }
       ctx.restore()

       ctx.save()
       ctx.translate(canvas.width/2 + pan.x, canvas.height/2 + pan.y)
       ctx.scale(zoom, zoom)
       
       // 2. Base Grid (Antique Style)
       const cellSize = 12
       ctx.strokeStyle = COLORS.inkDim
       ctx.lineWidth = 0.5
       ctx.beginPath()
       for (let i = -20; i <= 20; i++) {
          ctx.moveTo(i * cellSize, -240)
          ctx.lineTo(i * cellSize, 240)
          ctx.moveTo(-240, i * cellSize)
          ctx.lineTo(240, i * cellSize)
       }
       ctx.stroke()

       // Coordinate Numbers (Calligraphy style feel)
       ctx.font = 'italic 3px serif'
       ctx.fillStyle = COLORS.ink
       ctx.globalAlpha = 0.4
       for (let i = -20; i <= 20; i+=5) {
          ctx.fillText(`${i}`, i * cellSize + 1, 2)
          ctx.fillText(`${i}`, 2, i * cellSize - 1)
       }
       ctx.globalAlpha = 1.0

       // 3. Zone Outlines (Hand-stitched look)
       currentDrones.forEach(d => {
          if (!d.assigned_zone) return
          const [z1, y1, z2, y2] = d.assigned_zone
          const x1 = z1 * 5 - 50, x2 = z2 * 5 - 50
          const y_w1 = y1 * 5 - 50, y_w2 = y2 * 5 - 50
          
          ctx.beginPath()
          ctx.rect(x1, y_w1, x2 - x1, y_w2 - y_w1)
          ctx.strokeStyle = d.id === currentSid ? COLORS.inkBlue : COLORS.inkDim
          ctx.setLineDash([2, 1])
          ctx.lineWidth = 0.8
          ctx.stroke()
          ctx.setLineDash([])
          
          ctx.font = 'bold 3px serif'
          ctx.fillStyle = d.id === currentSid ? COLORS.inkBlue : COLORS.inkDim
          ctx.fillText(`SECTOR_${d.id}`, x1 + 1, y_w1 + 4)
       })

       // 4. Survivors (X marks the spot)
       currentSurvivors.forEach(s => {
          if (!s.detected) return
          const sx = s.pos?.[0] || s.position?.x || 0
          const sz = s.pos?.[2] || s.position?.z || 0
          
          ctx.save()
          ctx.translate(sx, sz)
          
          if (s.status === 'RESCUED') {
             ctx.strokeStyle = '#228b22'
             ctx.lineWidth = 1.5
             ctx.beginPath()
             ctx.arc(0, 0, 3, 0, Math.PI*2)
             ctx.stroke()
          } else {
             ctx.strokeStyle = COLORS.inkRed
             ctx.lineWidth = 1.5
             // Draw X
             ctx.beginPath()
             ctx.moveTo(-2, -2); ctx.lineTo(2, 2)
             ctx.moveTo(2, -2); ctx.lineTo(-2, 2)
             ctx.stroke()
          }
          
          ctx.font = 'bold 2px serif'
          ctx.fillStyle = COLORS.ink
          ctx.fillText(`S#${s.id}`, 3, 0)
          ctx.restore()
       })

       // 5. Drones (Compass Needles)
       currentDrones.forEach(d => {
          const dx = d.pos?.[0] || 0
          const dz = d.pos?.[2] || 0
          
          ctx.save()
          ctx.translate(dx, dz)
          ctx.rotate((d.heading || 0) * (Math.PI / 180))
          
          // Stylized Needle
          ctx.beginPath()
          ctx.moveTo(0, -6) 
          ctx.lineTo(-3, 2) 
          ctx.lineTo(0, 0)
          ctx.lineTo(3, 2) 
          ctx.closePath()
          
          ctx.fillStyle = d.id === currentSid ? COLORS.inkBlue : COLORS.ink
          ctx.fill()
          
          // Center pin
          ctx.beginPath()
          ctx.arc(0, 0, 0.8, 0, Math.PI*2)
          ctx.fillStyle = COLORS.inkRed
          ctx.fill()

          if (d.id === currentSid) {
             ctx.strokeStyle = COLORS.inkBlue
             ctx.lineWidth = 0.5
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
      background: '#241a12', // Dark wood table background
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      {/* Wooden Scroll Ends */}
      <div style={{
         position: 'absolute',
         left: '5px',
         top: '10px',
         bottom: '10px',
         width: '15px',
         background: 'linear-gradient(to right, #352110, #5a3e20, #352110)',
         borderRadius: '10px',
         boxShadow: '2px 0 10px rgba(0,0,0,0.5)',
         zIndex: 5
      }} />
      <div style={{
         position: 'absolute',
         right: '5px',
         top: '10px',
         bottom: '10px',
         width: '15px',
         background: 'linear-gradient(to right, #352110, #5a3e20, #352110)',
         borderRadius: '10px',
         boxShadow: '-2px 0 10px rgba(0,0,0,0.5)',
         zIndex: 5
      }} />

      <div style={{
         width: '100%',
         height: '100%',
         position: 'relative',
         boxShadow: 'inset 0 0 50px rgba(0,0,0,0.2), 0 10px 30px rgba(0,0,0,0.5)',
         border: '1px solid #d2b48c',
         cursor: isDragging ? 'grabbing' : 'crosshair',
         background: COLORS.paper
      }}>
        <canvas 
          ref={canvasRef}
          width={800}
          height={600}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        <div style={{
           position: 'absolute',
           top: 16,
           right: 16,
           display: 'flex',
           flexDirection: 'column',
           gap: '4px',
           minWidth: '150px',
        }}>
           <div style={statRowStyle}>
              <span>Area_Claimed</span>
              <span>{zoneCoverage?.toFixed(1) || '0.0'}%</span>
           </div>
           <div style={{ ...statRowStyle, color: '#a32a2a' }}>
              <span>Souls_Saved</span>
              <span>{survivors.filter(s => s.detected).length}</span>
           </div>
           <div style={statRowStyle}>
              <span>Units_Active</span>
              <span>{drones.filter(d => d.status !== 'CHARGING').length}</span>
           </div>
        </div>
        
        {/* Compass Rose (Bottom Left Decoration) */}
        <div style={{
           position: 'absolute',
           bottom: '20px',
           left: '20px',
           opacity: 0.3,
           color: COLORS.ink
        }}>
           <Compass size={60} strokeWidth={1} />
        </div>
      </div>
    </div>
  )
}

const statRowStyle = {
   background: 'rgba(210, 180, 140, 0.4)',
   padding: '6px 10px',
   fontFamily: 'serif',
   fontSize: '10px',
   fontStyle: 'italic',
   fontWeight: 'bold',
   display: 'flex',
   justifyContent: 'space-between',
   border: '1px solid rgba(61, 43, 31, 0.2)',
   color: '#3d2b1f'
}
