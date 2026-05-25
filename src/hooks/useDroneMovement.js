// ── Pathfinding & Mission-Phase-Aware Drone Movement ──
// Replaces orbit-based movement with A* grid navigation through city road corridors

import { useSimStore } from '../store/useSimStore'

// ── Constants matching Terrain.jsx building grid ──
export const GRID_COUNT = 12
export const SPACING = 22
export const CITY_OFFSET = (GRID_COUNT * SPACING) / 2 // 132

// ── Drone Base (outside city grid) ──
export const DRONE_BASE = { x: -180, y: 0, z: -180 }
export const BASE_PADS = [
  { x: -190, y: 2, z: -190 },
  { x: -170, y: 2, z: -190 },
  { x: -190, y: 2, z: -170 },
  { x: -170, y: 2, z: -170 },
  { x: -180, y: 2, z: -180 },
]

// ── Speeds (m/s) ──
const DEPLOY_SPEED = 22
const SEARCH_SPEED = 10
const RETURN_SPEED = 24
export const DEPLOY_STAGGER = 2.5 // seconds between drone launches
export const PROXIMITY_THRESHOLD = 30 // meters for encounter trigger

// ── Dynamic Waypoint State ──
// We store this outside zustand to prevent massive re-render storms
export const droneWaypointState = new Map()
// Shape: { path: [{x,z}...], segmentStartTime: timestamp, history: [{x,z}...], visited: Set }

// ═══════════════════════════════════════════
// ROAD INTERSECTION GRAPH
// Roads form a 13×13 grid of intersections
// ═══════════════════════════════════════════
const TOTAL_NODES = GRID_COUNT + 1 // 13
const ROAD_NODES = []
for (let i = 0; i < TOTAL_NODES; i++) {
  for (let j = 0; j < TOTAL_NODES; j++) {
    ROAD_NODES.push({
      id: i * TOTAL_NODES + j,
      x: i * SPACING - CITY_OFFSET,
      z: j * SPACING - CITY_OFFSET,
      gi: i,
      gj: j,
    })
  }
}

function nodeId(i, j) { return i * TOTAL_NODES + j }

function findNearestNode(x, z) {
  let best = null, bestD = Infinity
  for (const n of ROAD_NODES) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2
    if (d < bestD) { bestD = d; best = n }
  }
  return best
}

// ═══════════════════════════════════════════
// A* PATHFINDING ON ROAD GRID
// ═══════════════════════════════════════════
function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function astar(startNode, endNode) {
  if (startNode.id === endNode.id) return [{ x: endNode.x, z: endNode.z }]

  const open = new Set([startNode.id])
  const cameFrom = {}
  const g = new Map()
  const f = new Map()

  for (const n of ROAD_NODES) {
    g.set(n.id, Infinity)
    f.set(n.id, Infinity)
  }
  g.set(startNode.id, 0)
  f.set(startNode.id, heuristic(startNode, endNode))

  while (open.size > 0) {
    let cur = null, minF = Infinity
    for (const id of open) {
      if (f.get(id) < minF) { minF = f.get(id); cur = ROAD_NODES[id] }
    }
    if (!cur) break
    if (cur.id === endNode.id) {
      const path = []
      let c = cur.id
      while (c !== undefined && c !== startNode.id) {
        path.unshift({ x: ROAD_NODES[c].x, z: ROAD_NODES[c].z })
        c = cameFrom[c]
      }
      path.unshift({ x: startNode.x, z: startNode.z })
      return path
    }
    open.delete(cur.id)

    for (const [di, dj] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const ni = cur.gi + di, nj = cur.gj + dj
      if (ni < 0 || ni >= TOTAL_NODES || nj < 0 || nj >= TOTAL_NODES) continue
      const nid = nodeId(ni, nj)
      const tentG = g.get(cur.id) + SPACING
      if (tentG < g.get(nid)) {
        cameFrom[nid] = cur.id
        g.set(nid, tentG)
        f.set(nid, tentG + heuristic(ROAD_NODES[nid], endNode))
        open.add(nid)
      }
    }
  }
  // Fallback direct line
  return [{ x: startNode.x, z: startNode.z }, { x: endNode.x, z: endNode.z }]
}

// Route from arbitrary point A to B via road grid
function findRoute(ax, az, bx, bz) {
  const sn = findNearestNode(ax, az)
  const en = findNearestNode(bx, bz)
  const gridPath = astar(sn, en)
  const full = [{ x: ax, z: az }]

  if (gridPath.length > 0) {
    const f0 = gridPath[0]
    if ((f0.x - ax) ** 2 + (f0.z - az) ** 2 > 9) full.push(...gridPath)
    else full.push(...gridPath.slice(1))
  }
  const last = gridPath[gridPath.length - 1]
  if (last && ((last.x - bx) ** 2 + (last.z - bz) ** 2 > 9)) {
    full.push({ x: bx, z: bz })
  }
  return full
}

// ═══════════════════════════════════════════
// PATH UTILITIES
// ═══════════════════════════════════════════
function pathDist(path) {
  let d = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x, dz = path[i].z - path[i - 1].z
    d += Math.sqrt(dx * dx + dz * dz)
  }
  return d
}

function posOnPath(path, elapsed, speed, loop = false) {
  if (!path || path.length === 0) return null
  if (path.length === 1) return { x: path[0].x, z: path[0].z, progress: 1 }
  const total = pathDist(path)
  if (total === 0) return { x: path[0].x, z: path[0].z, progress: 1 }
  const traveled = loop ? (elapsed * speed) % total : elapsed * speed;
  if (traveled >= total) {
    const l = path[path.length - 1]
    return { x: l.x, z: l.z, progress: 1 }
  }
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x, dz = path[i].z - path[i - 1].z
    const seg = Math.sqrt(dx * dx + dz * dz)
    if (acc + seg >= traveled) {
      const t = (traveled - acc) / seg
      return {
        x: path[i - 1].x + dx * t,
        z: path[i - 1].z + dz * t,
        progress: traveled / total,
      }
    }
    acc += seg
  }
  const l = path[path.length - 1]
  return { x: l.x, z: l.z, progress: 1 }
}

function getRandomNodeInColumns(colsMap, colKeys, excludeNodeId = null) {
  if (colKeys.length === 0) return null
  const randomCol = colKeys[Math.floor(Math.random() * colKeys.length)]
  let nodes = colsMap[randomCol]
  if (excludeNodeId !== null && nodes.length > 1) {
    nodes = nodes.filter(n => n.id !== excludeNodeId)
  }
  if (!nodes || nodes.length === 0) return null
  return nodes[Math.floor(Math.random() * nodes.length)]
}

// ═══════════════════════════════════════════
// ZONE DISTRIBUTION LOGIC
// ═══════════════════════════════════════════
export function getActiveDronesCount(searchRegion) {
  if (!searchRegion) return 0;
  const w = Math.abs(searchRegion.x2 - searchRegion.x1);
  const d = Math.abs(searchRegion.z2 - searchRegion.z1);
  const area = w * d;
  if (area < 4000) return 1;
  if (area < 12000) return 2;
  if (area < 25000) return 3;
  if (area < 45000) return 4;
  return 5;
}

// ═══════════════════════════════════════════
// DEPLOY PATHS: Base → Search Region (Grid Locked)
// ═══════════════════════════════════════════
export function computeDeployPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}
  
  const activeCount = getActiveDronesCount(searchRegion)

  const allNodes = ROAD_NODES.filter(n => n.x >= x1 && n.x <= x2 && n.z >= z1 && n.z <= z2)
  const cols = {}
  allNodes.forEach(n => { if (!cols[n.gi]) cols[n.gi] = []; cols[n.gi].push(n) })
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b)
  const perDrone = Math.max(1, Math.ceil(colKeys.length / activeCount))

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      result[i + 1] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue;
    }

    const myCols = colKeys.slice(i * perDrone, (i + 1) * perDrone)
    let targetNode = null
    
    if (myCols.length > 0) {
      const firstCol = cols[myCols[0]].sort((a, b) => a.z - b.z)
      targetNode = firstCol[0]
    } else {
      const sx = x1 + (x2 - x1) * ((i + 0.5) / activeCount)
      targetNode = findNearestNode(sx, (z1 + z2)/2)
    }

    const startNode = findNearestNode(pad.x, pad.z)
    let deployPath = astar(startNode, targetNode)
    
    // Anchor accurately to pad origin
    if (deployPath.length > 0) {
      if ((deployPath[0].x - pad.x)**2 + (deployPath[0].z - pad.z)**2 > 4) {
        deployPath.unshift({ x: pad.x, z: pad.z })
      }
    } else {
      deployPath = [{ x: pad.x, z: pad.z }, { x: targetNode.x, z: targetNode.z }]
    }
    
    result[i + 1] = deployPath
  }
  return result
}

// ═══════════════════════════════════════════
// SEARCH PATHS: Random Waypoint Generation (Kinematic Pathfinding)
// ═══════════════════════════════════════════
export function computeSearchPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}
  
  const activeCount = getActiveDronesCount(searchRegion)
  droneWaypointState.clear()

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      result[i + 1] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue
    }

    // Assign drone a horizontal sub-region for initial spread
    const droneW = (x2 - x1) / activeCount
    const subX1 = x1 + i * droneW
    const subX2 = x1 + (i + 1) * droneW

    const targetX = subX1 + Math.random() * (subX2 - subX1)
    const targetZ = z1 + Math.random() * (z2 - z1)

    // Current position
    const storeDrone = useSimStore.getState().drones.find(d => d.id === i + 1) || { id: i + 1 }
    const currentPosStr = getDronePosition(storeDrone)
    const startPoint = { x: currentPosStr.x, z: currentPosStr.z }
    const path = [startPoint, { x: targetX, z: targetZ }]

    result[i + 1] = path

    droneWaypointState.set(i + 1, {
      path,
      segmentStartTime: performance.now() / 1000,
      history: [],
      visited: new Set(),
      region: searchRegion,
      subRegion: { x1: subX1, x2: subX2, z1, z2 } // bias its random movement slightly
    })
  }
  return result
}

export function generateNextWaypoint(droneId) {
  const state = droneWaypointState.get(droneId)
  if (!state || !state.path || state.path.length === 0) return null

  const now = performance.now() / 1000
  // Throttle spam if completed instantly
  if (now - state.segmentStartTime < 0.1) {
     return state.path 
  }

  const currentPos = state.path[state.path.length - 1]
  const { x1, z1, x2, z2 } = state.region
  
  // Truly random point inside the FULL region
  const targetX = x1 + Math.random() * (x2 - x1)
  const targetZ = z1 + Math.random() * (z2 - z1)
  
  const newPath = [currentPos, { x: targetX, z: targetZ }]
  
  state.history.push(currentPos)
  if (state.history.length > 20) state.history.shift()
  
  state.path = newPath
  state.segmentStartTime = now
  droneWaypointState.set(droneId, state)
  return newPath
}

export function rerouteForCollisionAvoidance(droneId, otherDronePos) {
  const state = droneWaypointState.get(droneId)
  if (!state || !state.path) return null

  const currentPosStr = getDronePosition({id: droneId}) // use real-time pos
  const currentPos = {x: currentPosStr.x, z: currentPosStr.z}
  
  // Calculate vector away from other drone
  const dx = currentPos.x - otherDronePos.x
  const dz = currentPos.z - otherDronePos.z
  
  // RRT* style perpendicular evasion point
  // Go 40m away perpendicularly
  const evasionDist = 40
  const mag = Math.sqrt(dx*dx + dz*dz) || 1
  const evadeX = currentPos.x + (dx/mag) * evasionDist + (Math.random() - 0.5) * 20
  const evadeZ = currentPos.z + (dz/mag) * evasionDist + (Math.random() - 0.5) * 20
  
  const newPath = [currentPos, { x: evadeX, z: evadeZ }]
  
  state.history.push(currentPos)
  if (state.history.length > 300) state.history.shift()
  state.path = newPath
  state.segmentStartTime = performance.now() / 1000
  droneWaypointState.set(droneId, state)
  
  return newPath
}

// ═══════════════════════════════════════════
// RETURN PATHS: Current position → Base
// ═══════════════════════════════════════════
export function computeReturnPaths(currentPositions) {
  const result = {}
  for (let i = 0; i < 5; i++) {
    const id = i + 1
    const pos = currentPositions[id] || { x: 0, z: 0 }
    const pad = BASE_PADS[i]
    result[id] = findRoute(pos.x, pos.z, pad.x, pad.z)
  }
  return result
}

// ═══════════════════════════════════════════
// MAIN POSITION CALCULATION (phase-aware)
// ═══════════════════════════════════════════
export function getDronePosition(drone, timeOffset = 0) {
  const store = useSimStore.getState()
  const { missionPhase, deployPaths, searchPaths, returnPaths,
    deployStartTime, searchStartTime, returnStartTime } = store
  const now = performance.now() / 1000 + timeOffset

  switch (missionPhase) {
    case 'IDLE':
    case 'SELECT_REGION':
    case 'SEED_SURVIVORS':
    case 'READY_TO_DEPLOY': {
      const pad = BASE_PADS[(drone.id - 1) % 5]
      return { x: pad.x, y: pad.y, z: pad.z }
    }

    case 'DEPLOYING': {
      const path = deployPaths[drone.id]
      // Recovery: If we are in DEPLOYING phase but lost our start time (e.g. HMR), reset it.
      const startTime = deployStartTime || (now - 0.1)
      if (!deployStartTime) {
        useSimStore.setState({ deployStartTime: startTime })
      }

      if (!path) {
        const pad = BASE_PADS[(drone.id - 1) % 5]
        return { x: pad.x, y: pad.y, z: pad.z }
      }
      const delay = (drone.id - 1) * DEPLOY_STAGGER
      const elapsed = Math.max(0, now - startTime - delay)
      if (elapsed <= 0) {
        const pad = BASE_PADS[(drone.id - 1) % 5]
        return { x: pad.x, y: pad.y, z: pad.z }
      }
      const r = posOnPath(path, elapsed, DEPLOY_SPEED)
      if (!r) { const pad = BASE_PADS[(drone.id - 1) % 5]; return { x: pad.x, y: pad.y, z: pad.z } }
      // Altitude envelope: rise → cruise → descend
      let alt = 20
      if (elapsed < 2) alt = 2 + (elapsed / 2) * 18
      else if (r.progress > 0.9) alt = 20 - ((r.progress - 0.9) / 0.1) * 5
      return { x: r.x, y: Math.max(2, alt), z: r.z }
    }

    case 'SEARCHING': {
      const state = droneWaypointState.get(drone.id)
      
      if (!state || !state.path) {
        // Fallback to basic search Paths if dynamic state is missing
        const path = searchPaths[drone.id]
        if (!path || !searchStartTime) {
          return { x: drone.pos?.[0] || 0, y: 15, z: drone.pos?.[2] || 0 }
        }
        const elapsedFallback = now - searchStartTime
        const rFallback = posOnPath(path, elapsedFallback, SEARCH_SPEED, true)
        if (!rFallback) return { x: drone.pos?.[0] || 0, y: 15, z: drone.pos?.[2] || 0 }
        return { x: rFallback.x, y: 15 + Math.sin(elapsedFallback * 0.4 + drone.id * 1.5) * 2, z: rFallback.z }
      }

      const elapsed = now - state.segmentStartTime
      const r = posOnPath(state.path, elapsed, SEARCH_SPEED, false) // DO NOT LOOP
      
      // Continuously record history for dense point cloud visualization
      if (r && (!state.lastHistoryTime || now - state.lastHistoryTime > 0.2)) {
        state.history.push({ x: r.x, z: r.z })
        if (state.history.length > 300) state.history.shift()
        state.lastHistoryTime = now
      }

      // If we reached the end of the current dynamic segment, generate next waypoint
      if (r && r.progress >= 1) {
        generateNextWaypoint(drone.id)
      }

      if (!r) return { x: drone.pos?.[0] || 0, y: 15, z: drone.pos?.[2] || 0 }
      const alt = 15 + Math.sin(now * 0.4 + drone.id * 1.5) * 2
      return { x: r.x, y: alt, z: r.z }
    }

    case 'ALL_FOUND': {
      return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
    }

    case 'RETURNING': {
      const path = returnPaths[drone.id]
      if (!path || !returnStartTime) {
        return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
      }
      const delay = (drone.id - 1) * 1.5
      const elapsed = Math.max(0, now - returnStartTime - delay)
      if (elapsed <= 0) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
      const r = posOnPath(path, elapsed, RETURN_SPEED)
      if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
      let alt = 20
      if (r.progress > 0.85) alt = 20 - ((r.progress - 0.85) / 0.15) * 18
      return { x: r.x, y: Math.max(2, alt), z: r.z }
    }

    case 'COMPLETED': {
      const pad = BASE_PADS[(drone.id - 1) % 5]
      return { x: pad.x, y: pad.y, z: pad.z }
    }

    default:
      return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 2, z: drone.pos?.[2] || 0 }
  }
}

export function getDroneAltitude(pos) {
  return Math.round((pos.y || 0) * 5.5)
}

export function getDroneSpeed(drone) {
  const phase = useSimStore.getState().missionPhase
  switch (phase) {
    case 'DEPLOYING': return DEPLOY_SPEED
    case 'SEARCHING': return SEARCH_SPEED
    case 'RETURNING': return RETURN_SPEED
    default: return 0
  }
}

// ═══════════════════════════════════════════
// PHASE COMPLETION CHECKS
// ═══════════════════════════════════════════
export function isDeployComplete() {
  const { deployPaths, deployStartTime, drones } = useSimStore.getState()
  if (!deployStartTime) return false
  const now = performance.now() / 1000
  return drones.every(d => {
    const p = deployPaths[d.id]
    if (!p || p.length < 2) return true
    const dist = pathDist(p)
    if (dist === 0) return true // Skip waiting if resting at base
    const delay = (d.id - 1) * DEPLOY_STAGGER
    return (now - deployStartTime - delay) >= dist / DEPLOY_SPEED
  })
}

export function isReturnComplete() {
  const { returnPaths, returnStartTime, drones } = useSimStore.getState()
  if (!returnStartTime) return false
  const now = performance.now() / 1000
  return drones.every(d => {
    const p = returnPaths[d.id]
    if (!p || p.length < 2) return true
    const dist = pathDist(p)
    if (dist === 0) return true // Skip waiting if already at base
    const delay = (d.id - 1) * 1.5
    return (now - returnStartTime - delay) >= dist / RETURN_SPEED
  })
}
