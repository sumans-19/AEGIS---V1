// ── Pathfinding & Mission-Phase-Aware Drone Movement ──────────────────────
// A* grid navigation through city road corridors.
// Grid constants MUST stay in sync with Terrain.jsx and buildingRegistry.js.

import { useSimStore } from '../store/useSimStore'

// ── Grid constants ────────────────────────────────────────────────────────
export const GRID_COUNT  = 18
export const SPACING     = 30
export const CITY_OFFSET = (GRID_COUNT * SPACING) / 2  // 270

// ── Drone Base (well outside city) ───────────────────────────────────────
export const DRONE_BASE = { x: -340, y: 0, z: -340 }
export const BASE_PADS  = [
  { x: -355, y: 2, z: -355 },
  { x: -325, y: 2, z: -355 },
  { x: -355, y: 2, z: -325 },
  { x: -325, y: 2, z: -325 },
  { x: -340, y: 2, z: -340 },
]

// ── Speeds (m/s) ─────────────────────────────────────────────────────────
const DEPLOY_SPEED = 28
const SEARCH_SPEED = 10
const RETURN_SPEED = 30
export const DEPLOY_STAGGER = 2.0   // seconds between drone launches

// ── Cruise altitude — just below medium buildings so avoidance is real ───
const CRUISE_ALT   = 28   // drone flies at this during DEPLOY / SEARCH / RETURN
const CRUISE_CLIMB = 3    // seconds to reach cruise from ground

// ═════════════════════════════════════════════════════════════════════════
// ROAD INTERSECTION GRAPH  (GRID_COUNT+1 nodes each axis)
// ═════════════════════════════════════════════════════════════════════════
const TOTAL_NODES = GRID_COUNT + 1   // 19
const ROAD_NODES  = []
for (let i = 0; i < TOTAL_NODES; i++) {
  for (let j = 0; j < TOTAL_NODES; j++) {
    ROAD_NODES.push({
      id: i * TOTAL_NODES + j,
      x:  i * SPACING - CITY_OFFSET,
      z:  j * SPACING - CITY_OFFSET,
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

// ═════════════════════════════════════════════════════════════════════════
// A* ON ROAD GRID
// ═════════════════════════════════════════════════════════════════════════
function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z)
}

function astar(startNode, endNode) {
  if (startNode.id === endNode.id) return [{ x: endNode.x, z: endNode.z }]

  const open      = new Set([startNode.id])
  const cameFrom  = {}
  const g         = new Map()
  const f         = new Map()

  for (const n of ROAD_NODES) { g.set(n.id, Infinity); f.set(n.id, Infinity) }
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
      const nid    = nodeId(ni, nj)
      const tentG  = g.get(cur.id) + SPACING
      if (tentG < g.get(nid)) {
        cameFrom[nid] = cur.id
        g.set(nid, tentG)
        f.set(nid, tentG + heuristic(ROAD_NODES[nid], endNode))
        open.add(nid)
      }
    }
  }
  return [{ x: startNode.x, z: startNode.z }, { x: endNode.x, z: endNode.z }]
}

// Route from arbitrary world point A → B through road grid
function findRoute(ax, az, bx, bz) {
  const sn      = findNearestNode(ax, az)
  const en      = findNearestNode(bx, bz)
  const gridPath = astar(sn, en)
  const full    = [{ x: ax, z: az }]
  if (gridPath.length > 0) {
    const f0 = gridPath[0]
    if ((f0.x - ax) ** 2 + (f0.z - az) ** 2 > 9) full.push(...gridPath)
    else full.push(...gridPath.slice(1))
  }
  const last = gridPath[gridPath.length - 1]
  if (last && ((last.x - bx) ** 2 + (last.z - bz) ** 2 > 9)) full.push({ x: bx, z: bz })
  return full
}

// ═════════════════════════════════════════════════════════════════════════
// PATH UTILITIES
// ═════════════════════════════════════════════════════════════════════════
function pathDist(path) {
  let d = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i-1].x, dz = path[i].z - path[i-1].z
    d += Math.sqrt(dx*dx + dz*dz)
  }
  return d
}

function posOnPath(path, elapsed, speed, loop = false) {
  if (!path || path.length === 0) return null
  if (path.length === 1) return { x: path[0].x, z: path[0].z, progress: 1 }
  const total   = pathDist(path)
  if (total === 0) return { x: path[0].x, z: path[0].z, progress: 1 }
  const traveled = loop ? (elapsed * speed) % total : elapsed * speed
  if (traveled >= total) {
    const l = path[path.length - 1]
    return { x: l.x, z: l.z, progress: 1 }
  }
  let acc = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i-1].x, dz = path[i].z - path[i-1].z
    const seg = Math.sqrt(dx*dx + dz*dz)
    if (acc + seg >= traveled) {
      const t = (traveled - acc) / seg
      return { x: path[i-1].x + dx*t, z: path[i-1].z + dz*t, progress: traveled / total }
    }
    acc += seg
  }
  const l = path[path.length - 1]
  return { x: l.x, z: l.z, progress: 1 }
}

// ═════════════════════════════════════════════════════════════════════════
// ZONE DISTRIBUTION LOGIC
// ═════════════════════════════════════════════════════════════════════════
export function getActiveDronesCount(searchRegion) {
  if (!searchRegion) return 0
  const w = Math.abs(searchRegion.x2 - searchRegion.x1)
  const d = Math.abs(searchRegion.z2 - searchRegion.z1)
  const area = w * d
  if (area < 6000)  return 1
  if (area < 18000) return 2
  if (area < 40000) return 3
  if (area < 70000) return 4
  return 5
}

// ═════════════════════════════════════════════════════════════════════════
// DEPLOY PATHS: Base → random node inside search region (unique per drone)
// ═════════════════════════════════════════════════════════════════════════
function seededRand(seed) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

// Exported so useSimulation.js can pass them into computeSearchPaths
export function computeDeployPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}
  const activeCount = getActiveDronesCount(searchRegion)
  const regionNodes = ROAD_NODES.filter(n => n.x >= x1 && n.x <= x2 && n.z >= z1 && n.z <= z2)

  for (let i = 0; i < 5; i++) {
    const droneId = i + 1
    const pad     = BASE_PADS[i]

    if (i >= activeCount) {
      result[droneId] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue
    }

    let targetNode = null
    if (regionNodes.length > 0) {
      // Seeded-random target unique per drone (stable across renders)
      const idx  = Math.floor(seededRand(droneId * 137.5) * regionNodes.length)
      targetNode = regionNodes[Math.min(idx, regionNodes.length - 1)]
    } else {
      const randX = x1 + seededRand(droneId * 53.3) * (x2 - x1)
      const randZ = z1 + seededRand(droneId * 97.7) * (z2 - z1)
      targetNode  = findNearestNode(randX, randZ)
    }

    const startNode  = findNearestNode(pad.x, pad.z)
    let   deployPath = astar(startNode, targetNode)

    if (deployPath.length > 0) {
      if ((deployPath[0].x - pad.x) ** 2 + (deployPath[0].z - pad.z) ** 2 > 4) {
        deployPath.unshift({ x: pad.x, z: pad.z })
      }
    } else {
      deployPath = [{ x: pad.x, z: pad.z }, { x: targetNode.x, z: targetNode.z }]
    }

    result[droneId] = deployPath
  }
  return result
}

// ═════════════════════════════════════════════════════════════════════════
// SEARCH PATHS: lawnmower from deploy endpoint — NO teleport
// Pass deployPaths so each drone starts its search from where it just landed.
// ═════════════════════════════════════════════════════════════════════════
export function computeSearchPaths(searchRegion, deployPaths = {}) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result     = {}
  const activeCount = getActiveDronesCount(searchRegion)

  const allNodes = ROAD_NODES.filter(n => n.x >= x1 && n.x <= x2 && n.z >= z1 && n.z <= z2)
  const cols     = {}
  allNodes.forEach(n => { if (!cols[n.gi]) cols[n.gi] = []; cols[n.gi].push(n) })
  const colKeys  = Object.keys(cols).map(Number).sort((a, b) => a - b)
  const perDrone = Math.max(1, Math.ceil(colKeys.length / activeCount))

  for (let i = 0; i < 5; i++) {
    const droneId = i + 1
    const pad     = BASE_PADS[i]

    if (i >= activeCount) {
      result[droneId] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue
    }

    // Drone's deploy endpoint (last node of its deploy path) — avoid teleport
    const dPath       = deployPaths[droneId] || []
    const deployEnd   = dPath.length > 0 ? dPath[dPath.length - 1] : null
    const startNode   = deployEnd
      ? findNearestNode(deployEnd.x, deployEnd.z)
      : findNearestNode(
          x1 + (x2 - x1) * ((i + 0.5) / activeCount),
          (z1 + z2) / 2
        )

    const myCols = colKeys.slice(i * perDrone, (i + 1) * perDrone)
    if (myCols.length < 1) {
      result[droneId] = [{ x: startNode.x, z: startNode.z }, { x: startNode.x, z: startNode.z }]
      continue
    }

    const wps     = []
    let   fwd     = true
    let   prevNode = startNode   // ← start sweep from where drone actually arrived

    for (const ck of myCols) {
      const nodes = cols[ck].sort((a, b) => fwd ? a.z - b.z : b.z - a.z)
      for (const n of nodes) {
        const seg = astar(prevNode, n)
        wps.push(...seg.slice(1))
        prevNode = n
      }
      fwd = !fwd
    }

    // Append reversed path so drone patrols back and forth indefinitely
    const rev = [...wps].reverse()
    result[droneId] = [...wps, ...rev]
  }
  return result
}

// ═════════════════════════════════════════════════════════════════════════
// RETURN PATHS: Current position → own pad (unique path per drone)
// Each drone takes a different intermediate exit waypoint before heading home.
// ═════════════════════════════════════════════════════════════════════════
export function computeReturnPaths(currentPositions) {
  const result = {}

  // Give each drone a unique exit corner so they spread out and don't convoy
  const exitOffsets = [
    { dx: -0.7, dz: -0.7 },
    { dx:  0.7, dz: -0.7 },
    { dx: -0.7, dz:  0.7 },
    { dx:  0.7, dz:  0.7 },
    { dx:  0.0, dz: -1.0 },
  ]

  for (let i = 0; i < 5; i++) {
    const id  = i + 1
    const pos = currentPositions[id] || { x: 0, z: 0 }
    const pad = BASE_PADS[i]

    // Intermediate waypoint: move toward edge of city before heading home
    const exitMag = CITY_OFFSET * 0.85
    const off     = exitOffsets[i]
    const exitX   = off.dx * exitMag
    const exitZ   = off.dz * exitMag

    // Route: current → exit corner → base pad (via road grid)
    const toExit = findRoute(pos.x, pos.z, exitX, exitZ)
    const toBase = findRoute(exitX, exitZ, pad.x, pad.z)

    // Merge, avoiding duplicate junction point
    const merged = [...toExit]
    if (toBase.length > 1) merged.push(...toBase.slice(1))

    result[id] = merged
  }
  return result
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN POSITION CALCULATION (phase-aware)
// ═════════════════════════════════════════════════════════════════════════
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
      const path      = deployPaths[drone.id]
      const startTime = deployStartTime || (now - 0.1)
      if (!deployStartTime) useSimStore.setState({ deployStartTime: startTime })
      if (!path) { const pad = BASE_PADS[(drone.id - 1) % 5]; return { x: pad.x, y: pad.y, z: pad.z } }

      const delay   = (drone.id - 1) * DEPLOY_STAGGER
      const elapsed = Math.max(0, now - startTime - delay)
      if (elapsed <= 0) { const pad = BASE_PADS[(drone.id - 1) % 5]; return { x: pad.x, y: pad.y, z: pad.z } }

      const r = posOnPath(path, elapsed, DEPLOY_SPEED)
      if (!r) { const pad = BASE_PADS[(drone.id - 1) % 5]; return { x: pad.x, y: pad.y, z: pad.z } }

      // Altitude: climb to CRUISE_ALT in first CRUISE_CLIMB seconds, hold, tiny descent at end
      let alt = CRUISE_ALT
      if (elapsed < CRUISE_CLIMB) alt = 2 + (elapsed / CRUISE_CLIMB) * (CRUISE_ALT - 2)
      else if (r.progress > 0.92)  alt = CRUISE_ALT - ((r.progress - 0.92) / 0.08) * (CRUISE_ALT - 4)
      return { x: r.x, y: Math.max(2, alt), z: r.z }
    }

    case 'SEARCHING': {
      const path = searchPaths[drone.id]
      if (!path || !searchStartTime) {
        return { x: drone.pos?.[0] || 0, y: CRUISE_ALT, z: drone.pos?.[2] || 0 }
      }
      const elapsed = now - searchStartTime
      const r       = posOnPath(path, elapsed, SEARCH_SPEED, true)
      if (!r) return { x: drone.pos?.[0] || 0, y: CRUISE_ALT, z: drone.pos?.[2] || 0 }
      // Gentle altitude oscillation makes each drone's sweep visually distinct
      const alt = CRUISE_ALT + Math.sin(elapsed * 0.35 + drone.id * 1.7) * 2
      return { x: r.x, y: alt, z: r.z }
    }

    case 'ALL_FOUND': {
      // Hold last position
      return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || CRUISE_ALT, z: drone.pos?.[2] || 0 }
    }

    case 'RETURNING': {
      const path = returnPaths[drone.id]
      if (!path || !returnStartTime) {
        return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || CRUISE_ALT, z: drone.pos?.[2] || 0 }
      }
      const delay   = (drone.id - 1) * 1.8   // stagger takeoff so they don't convoy
      const elapsed = Math.max(0, now - returnStartTime - delay)
      if (elapsed <= 0) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || CRUISE_ALT, z: drone.pos?.[2] || 0 }

      const r = posOnPath(path, elapsed, RETURN_SPEED)
      if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || CRUISE_ALT, z: drone.pos?.[2] || 0 }

      let alt = CRUISE_ALT
      if (r.progress > 0.88) alt = CRUISE_ALT - ((r.progress - 0.88) / 0.12) * (CRUISE_ALT - 2)
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

// ═════════════════════════════════════════════════════════════════════════
// PHASE COMPLETION CHECKS
// ═════════════════════════════════════════════════════════════════════════
export function isDeployComplete() {
  const { deployPaths, deployStartTime, drones } = useSimStore.getState()
  if (!deployStartTime) return false
  const now = performance.now() / 1000
  return drones.every(d => {
    const p    = deployPaths[d.id]
    if (!p || p.length < 2) return true
    const dist = pathDist(p)
    if (dist === 0) return true
    const delay = (d.id - 1) * DEPLOY_STAGGER
    return (now - deployStartTime - delay) >= dist / DEPLOY_SPEED
  })
}

export function isReturnComplete() {
  const { returnPaths, returnStartTime, drones } = useSimStore.getState()
  if (!returnStartTime) return false
  const now = performance.now() / 1000
  return drones.every(d => {
    const p    = returnPaths[d.id]
    if (!p || p.length < 2) return true
    const dist = pathDist(p)
    if (dist === 0) return true
    const delay = (d.id - 1) * 1.8
    return (now - returnStartTime - delay) >= dist / RETURN_SPEED
  })
}
