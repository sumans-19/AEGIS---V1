// ── Pathfinding & Mission-Phase-Aware Drone Movement ──
// Full-area search coverage with safe altitude above buildings

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

// ── Speeds (units/s) ──
// Deploy/return slower so flight is smooth and visible along road paths
const DEPLOY_SPEED = 18
const SEARCH_SPEED = 12
const RETURN_SPEED = 22
export const DEPLOY_STAGGER = 0.6 // seconds between drone launches

// ── Safe altitudes ──
const SEARCH_ALT = 45    // well above tallest building (~33m)
const DEPLOY_ALT = 50    // cruise altitude during deploy
const TAKEOFF_ALT = 8    // ground-level lift before route begins

// ═══════════════════════════════════════════
// ROAD INTERSECTION GRAPH (13×13 grid)
// ═══════════════════════════════════════════
const TOTAL_NODES = GRID_COUNT + 1 // 13
const ROAD_NODES = []
const ROAD_NODE_MAP = {}   // key: "gi_gj" → node (fixes A* neighbor lookup)

for (let i = 0; i < TOTAL_NODES; i++) {
  for (let j = 0; j < TOTAL_NODES; j++) {
    const node = {
      id: ROAD_NODES.length,  // sequential array index — NOT gi*TOTAL+gj
      x: i * SPACING - CITY_OFFSET,
      z: j * SPACING - CITY_OFFSET,
      gi: i,
      gj: j,
    }
    ROAD_NODES.push(node)
    ROAD_NODE_MAP[`${i}_${j}`] = node
  }
}

function getNode(gi, gj) {
  return ROAD_NODE_MAP[`${gi}_${gj}`] || null
}

function findNearestNode(x, z) {
  let best = null, bestD = Infinity
  for (const n of ROAD_NODES) {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2
    if (d < bestD) { bestD = d; best = n }
  }
  return best
}

// ═══════════════════════════════════════════
// A* PATHFINDING ON ROAD GRID (fixed neighbor lookup)
// ═══════════════════════════════════════════
function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function astar(startNode, endNode) {
  if (!startNode || !endNode) return []
  if (startNode.id === endNode.id) return [{ x: endNode.x, z: endNode.z }]

  const open = new Set([startNode.id])
  const cameFrom = {}
  const g = {}
  const f = {}

  for (const n of ROAD_NODES) {
    g[n.id] = Infinity
    f[n.id] = Infinity
  }
  g[startNode.id] = 0
  f[startNode.id] = heuristic(startNode, endNode)

  while (open.size > 0) {
    let cur = null, minF = Infinity
    for (const id of open) {
      if (f[id] < minF) { minF = f[id]; cur = ROAD_NODES[id] }
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

    // Use ROAD_NODE_MAP for correct neighbor lookup (fixes the A* bug)
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ni = cur.gi + di, nj = cur.gj + dj
      if (ni < 0 || ni >= TOTAL_NODES || nj < 0 || nj >= TOTAL_NODES) continue
      const neighbor = getNode(ni, nj)
      if (!neighbor) continue
      const tentG = g[cur.id] + SPACING
      if (tentG < g[neighbor.id]) {
        cameFrom[neighbor.id] = cur.id
        g[neighbor.id] = tentG
        f[neighbor.id] = tentG + heuristic(neighbor, endNode)
        open.add(neighbor.id)
      }
    }
  }
  // Fallback: direct waypoints
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
  const traveled = loop ? (elapsed * speed) % total : Math.min(elapsed * speed, total)
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

// ═══════════════════════════════════════════
// ZONE DISTRIBUTION LOGIC
// ═══════════════════════════════════════════
export function getActiveDronesCount(searchRegion) {
  if (!searchRegion) return 0
  const w = Math.abs(searchRegion.x2 - searchRegion.x1)
  const d = Math.abs(searchRegion.z2 - searchRegion.z1)
  const area = w * d
  // Lower thresholds so even small hand-drawn regions get at least 1 active drone
  if (area < 2000)  return 1
  if (area < 8000)  return 2
  if (area < 20000) return 3
  if (area < 38000) return 4
  return 5
}

// ═══════════════════════════════════════════
// DEPLOY PATHS: Base → Search Region entry point (via road grid)
// ═══════════════════════════════════════════
export function computeDeployPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}

  const activeCount = getActiveDronesCount(searchRegion)

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      // Inactive drones: null path so isDeployComplete skips them entirely
      result[i + 1] = null
      continue
    }

    // Each drone targets a different entry point along the x-axis of the search region
    const frac = (i + 0.5) / activeCount
    const targetX = x1 + (x2 - x1) * frac
    const targetZ = z1  // enter from the near edge

    const startNode = findNearestNode(pad.x, pad.z)
    const endNode = findNearestNode(targetX, targetZ)
    let deployPath = astar(startNode, endNode)

    // Anchor to pad origin
    if (deployPath.length > 0) {
      if ((deployPath[0].x - pad.x) ** 2 + (deployPath[0].z - pad.z) ** 2 > 4) {
        deployPath.unshift({ x: pad.x, z: pad.z })
      }
    } else {
      deployPath = [{ x: pad.x, z: pad.z }, { x: targetX, z: targetZ }]
    }

    // Append precise entry point if different from last grid node
    const last = deployPath[deployPath.length - 1]
    if ((last.x - targetX) ** 2 + (last.z - targetZ) ** 2 > 9) {
      deployPath.push({ x: targetX, z: targetZ })
    }

    result[i + 1] = deployPath
  }
  return result
}

// ═══════════════════════════════════════════
// SEARCH PATHS: Dense area-covering grid sweep
// Covers the ENTIRE marked region, not just road intersections.
// Drones fly at SEARCH_ALT (45m) so they pass OVER buildings.
// ═══════════════════════════════════════════
export function computeSearchPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}

  const activeCount = getActiveDronesCount(searchRegion)

  // Adaptive sweep step — scale to region size, min 8m, max ~12m
  // For tiny regions this ensures we still generate enough waypoints
  const regionW = Math.abs(x2 - x1)
  const regionD = Math.abs(z2 - z1)
  const sweepStep = Math.min(SPACING * 0.55, Math.max(8, Math.min(regionW, regionD) / 4))

  // Generate columns of x-positions covering the full region
  const cols = []
  for (let cx = x1; cx <= x2 + 0.1; cx += sweepStep) {
    cols.push(Math.min(cx, x2))
  }
  // Always ensure at least 2 columns so we have a real back-and-forth path
  if (cols.length === 0) cols.push(x1, x2)
  else if (cols[cols.length - 1] < x2 - 1) cols.push(x2)

  // Split columns among active drones
  const perDrone = Math.max(1, Math.ceil(cols.length / activeCount))

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      // Mark inactive drones clearly with null-path so deploy check skips them
      result[i + 1] = null
      continue
    }

    const myCols = cols.slice(i * perDrone, (i + 1) * perDrone)
    if (myCols.length === 0) {
      result[i + 1] = null
      continue
    }

    // Boustrophedon (lawnmower) sweep: alternate z direction per column
    const wps = []
    let goingDown = true

    for (const cx of myCols) {
      if (goingDown) {
        // top-to-bottom
        for (let cz = z1; cz <= z2 + 0.1; cz += sweepStep) {
          wps.push({ x: cx, z: Math.min(cz, z2) })
        }
        if (wps[wps.length - 1].z < z2 - 1) wps.push({ x: cx, z: z2 })
      } else {
        // bottom-to-top
        for (let cz = z2; cz >= z1 - 0.1; cz -= sweepStep) {
          wps.push({ x: cx, z: Math.max(cz, z1) })
        }
        if (wps[wps.length - 1].z > z1 + 1) wps.push({ x: cx, z: z1 })
      }
      goingDown = !goingDown
    }

    // Ensure at least 3 waypoints so loop has real distance
    if (wps.length < 3) {
      wps.push({ x: x1, z: z1 }, { x: x2, z: z1 }, { x: x2, z: z2 }, { x: x1, z: z2 })
    }

    // Loop: reverse path so drones sweep back and forth perpetually
    const rev = [...wps].reverse()
    result[i + 1] = [...wps, ...rev]
  }
  return result
}

// ═══════════════════════════════════════════
// RETURN PATHS: Current position → Base (via road grid, high altitude)
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
      const startTime = deployStartTime || (now - 0.1)
      if (!deployStartTime) {
        useSimStore.setState({ deployStartTime: startTime })
      }
      // Inactive drones (no deploy path) just sit on pad
      if (!path || path.length < 2) {
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

      // Altitude profile: rapid climb → cruise at DEPLOY_ALT → gentle descend at end
      let alt
      if (elapsed < 2.5) {
        // Takeoff ramp: 0 → DEPLOY_ALT over 2.5 seconds
        alt = TAKEOFF_ALT + (elapsed / 2.5) * (DEPLOY_ALT - TAKEOFF_ALT)
      } else if (r.progress > 0.85) {
        // Final approach: DEPLOY_ALT → SEARCH_ALT
        alt = DEPLOY_ALT - ((r.progress - 0.85) / 0.15) * (DEPLOY_ALT - SEARCH_ALT)
      } else {
        alt = DEPLOY_ALT
      }
      return { x: r.x, y: Math.max(TAKEOFF_ALT, alt), z: r.z }
    }

    case 'SEARCHING': {
      const path = searchPaths[drone.id]
      // Inactive drones (null path) hover at their current position
      if (!path || path.length < 2 || !searchStartTime) {
        const pad = BASE_PADS[(drone.id - 1) % 5]
        return { x: pad.x, y: pad.y, z: pad.z }
      }
      const elapsed = now - searchStartTime
      const r = posOnPath(path, elapsed, SEARCH_SPEED, true)
      if (!r) return { x: drone.pos?.[0] || 0, y: SEARCH_ALT, z: drone.pos?.[2] || 0 }

      // Altitude: hold at SEARCH_ALT with very gentle sinusoidal variation (±2m)
      // simulates LiDAR/terrain-following sensor response
      const alt = SEARCH_ALT + Math.sin(elapsed * 0.3 + drone.id * 1.2) * 2
      return { x: r.x, y: Math.max(SEARCH_ALT - 3, alt), z: r.z }
    }

    case 'ALL_FOUND': {
      // Hold position at current location, maintain safe altitude
      const pos = drone.pos
      return {
        x: pos?.[0] || 0,
        y: Math.max(SEARCH_ALT, pos?.[1] || SEARCH_ALT),
        z: pos?.[2] || 0
      }
    }

    case 'RETURNING': {
      const path = returnPaths[drone.id]
      if (!path || !returnStartTime) {
        return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || SEARCH_ALT, z: drone.pos?.[2] || 0 }
      }
      const delay = (drone.id - 1) * 1.2
      const elapsed = Math.max(0, now - returnStartTime - delay)
      if (elapsed <= 0) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || SEARCH_ALT, z: drone.pos?.[2] || 0 }
      const r = posOnPath(path, elapsed, RETURN_SPEED)
      if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || SEARCH_ALT, z: drone.pos?.[2] || 0 }

      // Altitude: stay at DEPLOY_ALT through most of return, descend near base
      let alt
      if (elapsed < 2.0) {
        // Brief climb to return altitude if below it
        const startY = drone.pos?.[1] || SEARCH_ALT
        alt = startY + (elapsed / 2.0) * Math.max(0, DEPLOY_ALT - startY)
      } else if (r.progress > 0.82) {
        // Final descent to pad
        alt = DEPLOY_ALT - ((r.progress - 0.82) / 0.18) * (DEPLOY_ALT - 8)
      } else {
        alt = DEPLOY_ALT
      }
      return { x: r.x, y: Math.max(5, alt), z: r.z }
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

  // Only check drones that have a real deploy path (active drones)
  // Inactive drones have null or 0-length paths and should be ignored
  const activeDrones = drones.filter(d => {
    const p = deployPaths[d.id]
    return p && p.length >= 2 && pathDist(p) >= 5
  })

  // If no drone has a real path, something is wrong — don't advance
  if (activeDrones.length === 0) return false

  return activeDrones.every(d => {
    const p = deployPaths[d.id]
    const dist = pathDist(p)
    const delay = (d.id - 1) * DEPLOY_STAGGER
    return (now - deployStartTime - delay) >= dist / DEPLOY_SPEED
  })
}

export function isReturnComplete() {
  const { returnPaths, returnStartTime, drones } = useSimStore.getState()
  if (!returnStartTime) return false
  const now = performance.now() / 1000

  // Only check drones that have real return paths
  const activeDrones = drones.filter(d => {
    const p = returnPaths[d.id]
    return p && p.length >= 2 && pathDist(p) >= 5
  })

  if (activeDrones.length === 0) return false

  return activeDrones.every(d => {
    const p = returnPaths[d.id]
    const dist = pathDist(p)
    const delay = (d.id - 1) * 1.2
    return (now - returnStartTime - delay) >= dist / RETURN_SPEED
  })
}
