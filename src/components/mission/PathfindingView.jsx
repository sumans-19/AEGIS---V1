import { useRef, useEffect, useState, useCallback } from 'react'
import { useSimStore } from '../../store/useSimStore'
import { Network, Info, ChevronDown, ChevronUp } from 'lucide-react'

// Poll backend for live cost grid data
function useBackendGrid() {
  const [backendGrid, setBackendGrid] = useState(null)
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/pathfinding')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setBackendGrid(data)
        }
      } catch { /* backend offline, use client grid */ }
    }
    poll()
    const iv = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])
  return backendGrid
}

// Seeded random for deterministic grid generation
function seededRandom(seed) {
  let x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// Per-drone color palette (matches callsigns)
const DRONE_COLORS = {
  1: '#00e5ff',   // FALCON — cyan
  2: '#ff6b2b',   // HAWK — orange
  3: '#00ff88',   // OSPREY — green
  4: '#e040fb',   // KESTREL — pink
  5: '#f9e23c',   // MERLIN — yellow
}

const CALLSIGN_COLORS = {
  FALCON: '#00e5ff',
  HAWK: '#ff6b2b',
  OSPREY: '#00ff88',
  KESTREL: '#e040fb',
  MERLIN: '#f9e23c',
}

const GRID_ROWS = 20
const GRID_COLS = 20
const CELL = 18 // px per cell on canvas (360px / 20 cells)

export default function PathfindingView() {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const [showLegend, setShowLegend] = useState(true)
  const [showStats, setShowStats] = useState(true)
  const [showDocs, setShowDocs] = useState(false)

  const drones = useSimStore(s => s.drones)
  const selectedDroneId = useSimStore(s => s.selectedDrone)
  const scenario = useSimStore(s => s.scenario)
  const backendGrid = useBackendGrid() // live data from backend

  // Build a static cost grid (deterministic from scenario seed)
  const buildCostGrid = useCallback(() => {
    const grid = []
    for (let r = 0; r < GRID_ROWS; r++) {
      grid[r] = []
      for (let c = 0; c < GRID_COLS; c++) {
        const seed = r * 100 + c + (scenario === 'earthquake' ? 0 : scenario === 'tsunami' ? 500 : 1000)
        const rand = seededRandom(seed)
        let cost
        if (scenario === 'earthquake') {
          cost = rand < 0.18 ? 3 : rand < 0.35 ? 2 : 1  // lots of rubble
        } else if (scenario === 'tsunami') {
          cost = (c < 6) ? 3 : rand < 0.2 ? 2 : 1        // coast is hazard
        } else if (scenario === 'flood') {
          cost = rand < 0.25 ? 3 : rand < 0.45 ? 2 : 1   // flooded cells
        } else {
          cost = rand < 0.2 ? 3 : rand < 0.4 ? 2 : 1     // wildfire
        }
        grid[r][c] = cost
      }
    }
    return grid
  }, [scenario])

  // A* implementation for visualization
  const runAStar = useCallback((grid, startR, startC, goalR, goalC) => {
    const heuristic = (r, c) => Math.abs(r - goalR) + Math.abs(c - goalC)
    const openSet = []
    const closedSet = new Set()
    const cameFrom = new Map()
    const gScore = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(Infinity))
    const fScore = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(Infinity))

    gScore[startR][startC] = 0
    fScore[startR][startC] = heuristic(startR, startC)
    openSet.push([fScore[startR][startC], startR, startC])

    const openNodes = new Set()
    openNodes.add(`${startR},${startC}`)

    while (openSet.length > 0) {
      openSet.sort((a, b) => a[0] - b[0])
      const [, r, c] = openSet.shift()
      openNodes.delete(`${r},${c}`)
      const key = `${r},${c}`
      if (closedSet.has(key)) continue
      closedSet.add(key)

      if (r === goalR && c === goalC) break

      const neighbors = [
        [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1],
        [r - 1, c - 1], [r - 1, c + 1], [r + 1, c - 1], [r + 1, c + 1]
      ]
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= GRID_ROWS || nc < 0 || nc >= GRID_COLS) continue
        const nk = `${nr},${nc}`
        if (closedSet.has(nk)) continue
        const moveCost = grid[nr][nc]
        const tentativeG = gScore[r][c] + moveCost
        if (tentativeG < gScore[nr][nc]) {
          cameFrom.set(nk, key)
          gScore[nr][nc] = tentativeG
          fScore[nr][nc] = tentativeG + heuristic(nr, nc)
          openSet.push([fScore[nr][nc], nr, nc])
          openNodes.add(nk)
        }
      }
    }

    // Reconstruct path
    const path = []
    let curr = `${goalR},${goalC}`
    while (cameFrom.has(curr)) {
      const [pr, pc] = curr.split(',').map(Number)
      path.unshift([pr, pc])
      curr = cameFrom.get(curr)
    }
    path.unshift([startR, startC])

    return { path, closedSet, openNodes }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let tick = 0

    const draw = () => {
      tick++
      const t = tick * 0.04
      const { width, height } = canvas

      // Use live backend grid (updated every 3s) or fall back to client-generated grid
      const grid = (backendGrid?.cost_grid) || buildCostGrid()

      ctx.fillStyle = '#080c10'
      ctx.fillRect(0, 0, width, height)

      const selectedDrone = useSimStore.getState().drones.find(d => d.id === selectedDroneId)
        || useSimStore.getState().drones[0]
      if (!selectedDrone) { animFrameRef.current = requestAnimationFrame(draw); return }

      // Convert drone world pos to grid cell
      const worldToGrid = (wx, wz) => {
        const r = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor((wx + 50) / 5)))
        const c = Math.min(GRID_COLS - 1, Math.max(0, Math.floor((wz + 50) / 5)))
        return [r, c]
      }

      const droneWorld = selectedDrone.pos || [0, 0, 0]
      const [startR, startC] = worldToGrid(droneWorld[0], droneWorld[2])

      // Goal: animated moving target (like real A* replanning)
      const goalR = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(10 + Math.sin(t * 0.3) * 7)))
      const goalC = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(10 + Math.cos(t * 0.25) * 7)))

      const { path, closedSet, openNodes } = runAStar(grid, startR, startC, goalR, goalC)

      const droneColor = DRONE_COLORS[selectedDroneId] || '#00e5ff'

      // Extra padding
      const padL = 8, padT = 8

      // --- Draw grid cells ---
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const x = padL + c * CELL
          const y = padT + r * CELL
          const key = `${r},${c}`
          const cost = grid[r][c]

          // Base fill by cost
          let fill
          if (cost === 1) fill = 'rgba(0, 229, 255, 0.07)'       // safe — dim cyan
          else if (cost === 2) fill = 'rgba(255, 179, 0, 0.12)'  // medium — amber
          else fill = 'rgba(255, 50, 50, 0.18)'                   // hazard — red

          // Closed set overlay
          if (closedSet.has(key)) fill = 'rgba(160, 100, 255, 0.22)' // checked — purple

          // Open set overlay
          if (openNodes.has(key)) fill = 'rgba(0, 229, 255, 0.28)' // evaluating — cyan

          ctx.fillStyle = fill
          ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)

          // Grid lines
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.8)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)

          // Cost text for cells (only on uncovered cells, small)
          if (cost > 1) {
            ctx.fillStyle = cost === 2 ? 'rgba(255,179,0,0.5)' : 'rgba(255,80,80,0.5)'
            ctx.font = '5px JetBrains Mono'
            ctx.textAlign = 'center'
            ctx.fillText(cost === 2 ? '■' : '■', x + CELL / 2, y + CELL / 2 + 2)
          }

          // Grid coord labels (top-left quadrant as example)
          if (r % 4 === 0 && c % 4 === 0) {
            const col = String.fromCharCode(65 + c)
            ctx.fillStyle = 'rgba(71, 85, 105, 0.7)'
            ctx.font = '4px JetBrains Mono'
            ctx.textAlign = 'left'
            ctx.fillText(`${col}${r + 1}`, x + 2, y + 6)
          }
        }
      }

      // --- Draw heuristic vectors (yellow-green lines from selected drone) ---
      const droneX = padL + startC * CELL + CELL / 2
      const droneY = padT + startR * CELL + CELL / 2
      const goalX = padL + goalC * CELL + CELL / 2
      const goalY = padT + goalR * CELL + CELL / 2

      ctx.beginPath()
      ctx.moveTo(droneX, droneY)
      ctx.lineTo(goalX, goalY)
      ctx.strokeStyle = 'rgba(180, 255, 60, 0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // --- Draw A* Path as glowing tube ---
      if (path.length > 1) {
        // Outer glow
        ctx.beginPath()
        for (let i = 0; i < path.length; i++) {
          const [pr, pc] = path[i]
          const px = padL + pc * CELL + CELL / 2
          const py = padT + pr * CELL + CELL / 2
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = `${droneColor}40`
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.stroke()

        // Inner path (animated dashes)
        ctx.beginPath()
        for (let i = 0; i < path.length; i++) {
          const [pr, pc] = path[i]
          const px = padL + pc * CELL + CELL / 2
          const py = padT + pr * CELL + CELL / 2
          if (i === 0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.strokeStyle = droneColor
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.lineDashOffset = -tick * 0.4
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0

        // Waypoint stops (octahedrons / diamonds)
        for (let i = 1; i < path.length - 1; i += Math.max(1, Math.floor(path.length / 4))) {
          const [wr, wc] = path[i]
          const wx = padL + wc * CELL + CELL / 2
          const wy = padT + wr * CELL + CELL / 2
          const s = 4
          ctx.beginPath()
          ctx.moveTo(wx, wy - s); ctx.lineTo(wx + s, wy); ctx.lineTo(wx, wy + s); ctx.lineTo(wx - s, wy); ctx.closePath()
          ctx.fillStyle = droneColor
          ctx.shadowBlur = 8
          ctx.shadowColor = droneColor
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      // --- All drones: show their path starts as small triangles ---
      useSimStore.getState().drones.forEach(d => {
        if (!d.pos) return
        const [dr, dc] = worldToGrid(d.pos[0], d.pos[2])
        const color = DRONE_COLORS[d.id] || '#94a3b8'
        const dx = padL + dc * CELL + CELL / 2
        const dy = padT + dr * CELL + CELL / 2

        if (d.id !== selectedDroneId) {
          // Other drones: dim triangle
          ctx.save()
          ctx.translate(dx, dy)
          ctx.beginPath()
          ctx.moveTo(0, -4); ctx.lineTo(-3, 3); ctx.lineTo(3, 3); ctx.closePath()
          ctx.fillStyle = color + '80'
          ctx.fill()
          ctx.restore()
        }
      })

      // --- Selected Drone: pulsing circle + bright triangle ---
      const pulseR = 5 + Math.sin(t * 3) * 2
      ctx.beginPath()
      ctx.arc(droneX, droneY, pulseR, 0, Math.PI * 2)
      ctx.strokeStyle = droneColor
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
      ctx.stroke()
      ctx.globalAlpha = 1

      ctx.save()
      ctx.translate(droneX, droneY)
      ctx.beginPath()
      ctx.moveTo(0, -5); ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.closePath()
      ctx.fillStyle = droneColor
      ctx.shadowBlur = 12
      ctx.shadowColor = droneColor
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()

      // --- Goal Marker: animated ring ---
      ctx.beginPath()
      ctx.arc(goalX, goalY, 4 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2)
      ctx.strokeStyle = '#ff4500'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(goalX, goalY, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#ff4500'
      ctx.shadowBlur = 10; ctx.shadowColor = '#ff4500'
      ctx.fill()
      ctx.shadowBlur = 0

      // --- Stats overlay (top-right corner) ---
      const infoLines = [
        `ALGO: A* (8-dir)`,
        `DRONE: ${selectedDrone.callsign || 'N/A'}`,
        `PATH: ${path.length} nodes`,
        `CLOSED: ${closedSet.size} cells`,
        `COST: ${grid[startR]?.[startC] ?? '?'}→${grid[goalR]?.[goalC] ?? '?'}`,
      ]
      const iw = 110, ih = infoLines.length * 12 + 10
      ctx.fillStyle = 'rgba(8,12,16,0.85)'
      ctx.fillRect(width - iw - 4, 4, iw, ih)
      ctx.strokeStyle = droneColor + '60'
      ctx.lineWidth = 0.5
      ctx.strokeRect(width - iw - 4, 4, iw, ih)
      infoLines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? droneColor : '#94a3b8'
        ctx.font = `${i === 0 ? 'bold ' : ''}8px JetBrains Mono`
        ctx.textAlign = 'left'
        ctx.fillText(line, width - iw, 16 + i * 12)
      })

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [selectedDroneId, scenario, buildCostGrid, runAStar, backendGrid])

  const droneColor = DRONE_COLORS[selectedDroneId] || '#00e5ff'
  const selectedDrone = drones.find(d => d.id === selectedDroneId) || drones[0]

  return (
    <div style={{ width: '100%', height: '100%', background: '#080c10', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={13} color={droneColor} />
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: '#e2e8f0', letterSpacing: '1px' }}>
            A*_PATHFINDING // {selectedDrone?.callsign || 'N/A'}
          </span>
        </div>
        <span style={{
          fontFamily: 'JetBrains Mono', fontSize: '8px',
          color: droneColor, padding: '2px 6px',
          border: `1px solid ${droneColor}40`,
          borderRadius: '2px',
        }}>
          LIVE REPLAN
        </span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          width={368}
          height={368}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />
      </div>

      {/* Legend */}
      <div style={{ borderTop: '1px solid #1e293b', flexShrink: 0 }}>
        <button onClick={() => setShowLegend(v => !v)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 12px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '9px',
        }}>
          <span>VISUAL LEGEND</span>
          {showLegend ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {showLegend && (
          <div style={{ padding: '4px 12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[
              { color: 'rgba(0,229,255,0.5)', label: 'Safe cells (cost=1)' },
              { color: 'rgba(255,179,0,0.7)', label: 'Medium cost — rubble (cost=2)' },
              { color: 'rgba(255,50,50,0.7)', label: 'Hazard zone — avoid (cost=3)' },
              { color: 'rgba(160,100,255,0.7)', label: 'Closed — already checked' },
              { color: 'rgba(0,229,255,0.7)', label: 'Open — evaluating NOW' },
              { color: droneColor, label: `Path tube — ${selectedDrone?.callsign}'s route` },
              { color: '#ff4500', label: 'Target waypoint' },
              { color: 'rgba(180,255,60,0.5)', label: 'Heuristic direction' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 8, height: 8, background: item.color, borderRadius: '1px', flexShrink: 0 }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '8px', color: '#64748b' }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-Drone Colors */}
      <div style={{ borderTop: '1px solid #1e293b', flexShrink: 0 }}>
        <button onClick={() => setShowStats(v => !v)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 12px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '9px',
        }}>
          <span>DRONE COLORS</span>
          {showStats ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {showStats && (
          <div style={{ padding: '4px 12px 8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {drones.map(d => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '2px 7px', border: `1px solid ${DRONE_COLORS[d.id] || '#333'}50`,
                borderRadius: '2px', background: `${DRONE_COLORS[d.id] || '#333'}10`,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: DRONE_COLORS[d.id] || '#94a3b8' }} />
                <span style={{ fontFamily: 'JetBrains Mono', fontSize: '8px', color: DRONE_COLORS[d.id] || '#94a3b8' }}>
                  {d.callsign || d.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expandable Docs */}
      <div style={{ borderTop: '1px solid #1e293b', flexShrink: 0 }}>
        <button onClick={() => setShowDocs(v => !v)} style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px 12px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', color: '#64748b', fontFamily: 'JetBrains Mono', fontSize: '9px',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={10} /> WHAT IS A* PATHFINDING?
          </span>
          {showDocs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {showDocs && (
          <div style={{ padding: '6px 12px 10px', fontFamily: 'JetBrains Mono', fontSize: '8px', color: '#64748b', lineHeight: 1.7 }}>
            A* is the algorithm each drone uses to plan its flight route. It evaluates every possible path through the grid,
            avoids rubble (cost=2) and hazard zones (cost=3), and finds the <span style={{ color: droneColor }}>shortest + safest route</span> to its next scan waypoint.
            The grid replans every 2 seconds as drones move and terrain conditions update.
            <div style={{ marginTop: '6px', color: '#475569' }}>
              Purple cells = nodes already checked. Cyan cells = nodes currently being evaluated.
              The glowing tube is the winning path.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
