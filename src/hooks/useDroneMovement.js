// ── Pathfinding & Mission-Phase-Aware Drone Movement ──
// Replaces orbit-based movement with A* grid navigation through city road corridors

import { useSimStore } from '../store/useSimStore'

// Slice bounds map for each drone (used when a replacement drone takes over)
let latestSliceMap = {}
export const getLatestSliceMap = () => latestSliceMap

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
export const DEPLOY_SPEED = 22
export const SEARCH_SPEED = 10
export const RETURN_SPEED = 24
export const DEPLOY_STAGGER = 2.5 // seconds between drone launches
const NAV_GRID_STEP = 6
const OBSTACLE_CLEARANCE = 4
const SENSOR_AVOIDANCE_RANGE = 18
const WORLD_LIMIT = 240
const SEARCH_AREA_INSET = 8
const pathDistanceCache = new WeakMap()

export const HARDWARE_FAILURE_TYPES = [
  {
    id: 'battery_failure',
    label: 'Battery Failure',
    severity: 'critical',
    logLabel: 'battery pack failure',
    rtbSpeed: 18,
    droneUpdates: { battery: 5 },
  },
  {
    id: 'sensor_failure',
    label: 'Sensor Failure',
    severity: 'warning',
    logLabel: 'thermal/LiDAR sensor failure',
    rtbSpeed: RETURN_SPEED,
    droneUpdates: { scan_radius: 0 },
  },
  {
    id: 'motor_failure',
    label: 'Motor Failure',
    severity: 'critical',
    logLabel: 'motor thrust failure',
    rtbSpeed: 12,
    droneUpdates: { speed: 0 },
  },
  {
    id: 'comms_failure',
    label: 'Comms Failure',
    severity: 'warning',
    logLabel: 'communication link failure',
    rtbSpeed: RETURN_SPEED,
    droneUpdates: { linkStatus: 'DEGRADED' },
  },
  {
    id: 'gps_failure',
    label: 'GPS Failure',
    severity: 'warning',
    logLabel: 'navigation sensor failure',
    rtbSpeed: 16,
    droneUpdates: { navStatus: 'DEGRADED' },
  },
]

const FAILURE_BY_ID = Object.fromEntries(HARDWARE_FAILURE_TYPES.map(failure => [failure.id, failure]))

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

    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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
export function findRoute(ax, az, bx, bz) {
  const obstacles = getNavigationObstacles()
  const safeStart = nearestSafePoint({ x: ax, z: az }, obstacles)
  const safeEnd = nearestSafePoint({ x: bx, z: bz }, obstacles)
  const sn = findNearestNode(safeStart.x, safeStart.z)
  const en = findNearestNode(safeEnd.x, safeEnd.z)
  const gridPath = astar(sn, en)
  const full = [safeStart]

  if (gridPath.length > 0) {
    const f0 = gridPath[0]
    if ((f0.x - safeStart.x) ** 2 + (f0.z - safeStart.z) ** 2 > 9) full.push(...gridPath)
    else full.push(...gridPath.slice(1))
  }
  const last = gridPath[gridPath.length - 1]
  if (last && ((last.x - safeEnd.x) ** 2 + (last.z - safeEnd.z) ** 2 > 9)) {
    full.push(safeEnd)
  }
  return makeObstacleSafePath(full, obstacles)
}

// ═══════════════════════════════════════════
// PATH UTILITIES
// ═══════════════════════════════════════════
function pathDist(path = []) {
  if (!Array.isArray(path) || path.length < 2) return 0
  if (pathDistanceCache.has(path)) return pathDistanceCache.get(path)
  let d = 0
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x, dz = path[i].z - path[i - 1].z
    d += Math.sqrt(dx * dx + dz * dz)
  }
  pathDistanceCache.set(path, d)
  return d
}

export function getPathDistance(path = []) {
  return pathDist(path)
}

export function getMarkedAreaDestination(searchRegion) {
  if (!searchRegion) return null
  return {
    x: (searchRegion.x1 + searchRegion.x2) / 2,
    z: (searchRegion.z1 + searchRegion.z2) / 2,
  }
}

function pointFromDrone(drone) {
  return {
    x: drone?.pos?.[0] ?? BASE_PADS[(drone?.id || 1) - 1]?.x ?? DRONE_BASE.x,
    z: drone?.pos?.[2] ?? BASE_PADS[(drone?.id || 1) - 1]?.z ?? DRONE_BASE.z,
  }
}

function getMissionPathForDrone(store, droneId) {
  const phasePathSources = {
    DEPLOYING: [store.deployPaths, store.searchPaths],
    SEARCHING: [store.searchPaths, store.deployPaths],
    ALL_FOUND: [store.searchPaths, store.deployPaths],
    RETURNING: [store.returnPaths, store.searchPaths, store.deployPaths],
  }
  const pathSources = phasePathSources[store.missionPhase] || [
    store.searchPaths,
    store.deployPaths,
    store.returnPaths,
  ]

  for (const paths of pathSources) {
    const path = paths?.[droneId] || paths?.[String(droneId)]
    if (path?.length > 1 && pathDist(path) > 1) return path
  }

  const destination = getMarkedAreaDestination(store.searchRegion)
  const pad = BASE_PADS[(Number(droneId) - 1) % BASE_PADS.length]
  if (destination) return findRoute(pad.x, pad.z, destination.x, destination.z)
  return [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
}

function findReplacementDrone(store, failedDroneId) {
  const failedIds = new Set(
    Object.entries(store.hardwareFailures || {})
      .filter(([, failure]) => failure?.status !== 'CLEARED')
      .map(([id]) => Number(id))
  )
  failedIds.add(Number(failedDroneId))

  return store.drones
    .filter(drone => !failedIds.has(drone.id))
    .filter(drone => !drone.hardwareFailure && !drone.replacementFor)
    .filter(drone => ['STANDBY', 'IDLE'].includes(drone.status))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'STANDBY' ? -1 : 1
      return (b.battery || 0) - (a.battery || 0)
    })[0]
}

function nearestPathIndex(path = [], point) {
  if (!path.length) return 0
  let bestIndex = 0
  let bestDistance = Infinity
  path.forEach((waypoint, index) => {
    const dx = waypoint.x - point.x
    const dz = waypoint.z - point.z
    const distance = dx * dx + dz * dz
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

function remainingPathFromPoint(path = [], point, loop = false) {
  if (!path.length) return [{ x: point.x, z: point.z }]

  const nearestIndex = nearestPathIndex(path, point)
  const remainder = path.slice(nearestIndex)
  const wrapped = loop ? path.slice(0, nearestIndex + 1) : []
  const nextPath = [{ x: point.x, z: point.z }, ...remainder, ...wrapped]

  return nextPath.filter((waypoint, index) => {
    if (index === 0) return true
    const prev = nextPath[index - 1]
    return (waypoint.x - prev.x) ** 2 + (waypoint.z - prev.z) ** 2 > 1
  })
}

function getTakeoverOperationPath(store, failedDrone, failedPoint) {
  const destination = getMarkedAreaDestination(store.searchRegion)
  const missionPath = getMissionPathForDrone(store, failedDrone.id)

  if (['SEARCHING', 'ALL_FOUND'].includes(store.missionPhase) && missionPath?.length > 1) {
    return remainingPathFromPoint(missionPath, failedPoint, true)
  }

  if (store.missionPhase === 'DEPLOYING' && destination) {
    return findRoute(failedPoint.x, failedPoint.z, destination.x, destination.z)
  }

  if (missionPath?.length > 1) {
    return remainingPathFromPoint(missionPath, failedPoint, false)
  }

  if (destination) return findRoute(failedPoint.x, failedPoint.z, destination.x, destination.z)
  return [{ x: failedPoint.x, z: failedPoint.z }]
}

export function getDroneOverrideStage(override, now = performance.now() / 1000) {
  if (!override) return null
  const elapsed = Math.max(0, now - (override.startTime || now))

  if (override.mode === 'emergency-land') {
    // Drop from 15m to 2m at 2m/s takes 6.5s
    return elapsed >= 6.5 ? 'crashed' : 'landing'
  }

  if (override.mode === 'return-to-base') {
    const duration = pathDist(override.path || []) / (override.speed || RETURN_SPEED)
    return elapsed >= duration ? 'docked' : 'returning'
  }

  if (override.mode === 'takeover') {
    const entryDuration = pathDist(override.entryPath || []) / (override.entrySpeed || DEPLOY_SPEED)
    return elapsed >= entryDuration ? 'operating' : 'intercepting'
  }

  return null
}

export function triggerHardwareFailure(droneId, failureId) {
  const failure = FAILURE_BY_ID[failureId]
  const store = useSimStore.getState()
  const failedDrone = store.drones.find(drone => drone.id === droneId)

  if (!failure || !failedDrone) return false
  if (store.hardwareFailures?.[droneId]?.status && store.hardwareFailures[droneId].status !== 'CLEARED') {
    store.addNotification(`${failedDrone.callsign} already has an active failure state.`, 'warning')
    return false
  }

  const failedPoint = pointFromDrone(failedDrone)
  const failedPad = BASE_PADS[(failedDrone.id - 1) % BASE_PADS.length]
  const isEmergencyLand = failureId === 'motor_failure'
  const returnPath = isEmergencyLand ? [{ x: failedPoint.x, z: failedPoint.z }] : findRoute(failedPoint.x, failedPoint.z, failedPad.x, failedPad.z)
  const operationPath = getTakeoverOperationPath(store, failedDrone, failedPoint)
  const replacementDrone = findReplacementDrone(store, failedDrone.id)

  let entryPath = []
  if (replacementDrone && operationPath?.length) {
    const replacementPoint = pointFromDrone(replacementDrone)
    const firstWaypoint = operationPath[0]
    entryPath = findRoute(replacementPoint.x, replacementPoint.z, firstWaypoint.x, firstWaypoint.z)
  }

  store.applyHardwareFailure({
    failedDroneId: failedDrone.id,
    replacementDroneId: replacementDrone?.id || null,
    failure,
    returnPath,
    entryPath,
    operationPath,
  })

  return true
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
  return 4;
}

function clamp(value, min, max) {
  if (min > max) return value
  return Math.min(max, Math.max(min, value))
}

function normalizeBounds(bounds) {
  if (!bounds) return null
  return {
    minX: Math.min(bounds.minX, bounds.maxX),
    maxX: Math.max(bounds.minX, bounds.maxX),
    minZ: Math.min(bounds.minZ, bounds.maxZ),
    maxZ: Math.max(bounds.minZ, bounds.maxZ),
  }
}

function clampPointToBounds(point, bounds) {
  const b = normalizeBounds(bounds)
  if (!b) {
    return {
      x: clamp(point.x, -WORLD_LIMIT, WORLD_LIMIT),
      z: clamp(point.z, -WORLD_LIMIT, WORLD_LIMIT),
    }
  }
  return {
    x: clamp(point.x, b.minX, b.maxX),
    z: clamp(point.z, b.minZ, b.maxZ),
  }
}

function obstacleRadius(obstacle, extra = 0) {
  if (Number.isFinite(obstacle?.halfX) && Number.isFinite(obstacle?.halfZ)) {
    return Math.sqrt((obstacle.halfX + OBSTACLE_CLEARANCE + extra) ** 2 + (obstacle.halfZ + OBSTACLE_CLEARANCE + extra) ** 2)
  }
  return Math.max(1, obstacle?.clearanceRadius ?? ((obstacle?.radius || 5) + OBSTACLE_CLEARANCE)) + extra
}

function getNavigationObstacles(obstacles = useSimStore.getState().obstacles || []) {
  return obstacles
    .filter(obstacle => Number.isFinite(obstacle?.x) && Number.isFinite(obstacle?.z))
    .map(obstacle => ({
      ...obstacle,
      clearanceRadius: (obstacle.radius || 5) + OBSTACLE_CLEARANCE,
      sensorRadius: (obstacle.radius || 5) + SENSOR_AVOIDANCE_RANGE,
    }))
}

function pointInsideObstacle(x, z, obstacle, extra = 0) {
  if (Number.isFinite(obstacle?.halfX) && Number.isFinite(obstacle?.halfZ)) {
    const margin = OBSTACLE_CLEARANCE + extra
    return Math.abs(x - obstacle.x) <= obstacle.halfX + margin
      && Math.abs(z - obstacle.z) <= obstacle.halfZ + margin
  }
  const radius = obstacleRadius(obstacle, extra)
  return (x - obstacle.x) ** 2 + (z - obstacle.z) ** 2 <= radius ** 2
}

function pointIsSafe(x, z, obstacles) {
  return !obstacles.some(obstacle => pointInsideObstacle(x, z, obstacle))
}

function segmentHitsObstacle(ax, az, bx, bz, obstacle, extra = 0) {
  const dx = bx - ax
  const dz = bz - az
  const lenSq = dx * dx + dz * dz
  if (lenSq < 0.01) return pointInsideObstacle(ax, az, obstacle, extra)
  if (Number.isFinite(obstacle?.halfX) && Number.isFinite(obstacle?.halfZ)) {
    const len = Math.sqrt(lenSq)
    const samples = Math.max(2, Math.ceil(len / (NAV_GRID_STEP / 2)))
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      if (pointInsideObstacle(ax + dx * t, az + dz * t, obstacle, extra)) return true
    }
    return false
  }
  let t = ((obstacle.x - ax) * dx + (obstacle.z - az) * dz) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cz = az + t * dz
  return (cx - obstacle.x) ** 2 + (cz - obstacle.z) ** 2 <= obstacleRadius(obstacle, extra) ** 2
}

function segmentIsSafe(ax, az, bx, bz, obstacles) {
  return !obstacles.some(obstacle => segmentHitsObstacle(ax, az, bx, bz, obstacle))
}

function nearestSafePoint(point, obstacles, bounds = null) {
  const start = clampPointToBounds(point, bounds)
  if (pointIsSafe(start.x, start.z, obstacles)) return start

  let best = start
  let bestDist = Infinity
  for (let radius = NAV_GRID_STEP; radius <= 80; radius += NAV_GRID_STEP) {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24
      const candidate = clampPointToBounds({
        x: start.x + Math.cos(angle) * radius,
        z: start.z + Math.sin(angle) * radius,
      }, bounds)
      if (!pointIsSafe(candidate.x, candidate.z, obstacles)) continue
      const dist = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2
      if (dist < bestDist) {
        best = candidate
        bestDist = dist
      }
    }
    if (bestDist < Infinity) return best
  }
  return best
}

function makeBounds(points, obstacles, constraint = null) {
  const xs = points.map(point => point.x)
  const zs = points.map(point => point.z)
  obstacles.forEach(obstacle => {
    const radius = obstacleRadius(obstacle, NAV_GRID_STEP * 2)
    xs.push(obstacle.x - radius, obstacle.x + radius)
    zs.push(obstacle.z - radius, obstacle.z + radius)
  })

  const bounds = {
    minX: clamp(Math.floor((Math.min(...xs) - 30) / NAV_GRID_STEP) * NAV_GRID_STEP, -WORLD_LIMIT, WORLD_LIMIT),
    maxX: clamp(Math.ceil((Math.max(...xs) + 30) / NAV_GRID_STEP) * NAV_GRID_STEP, -WORLD_LIMIT, WORLD_LIMIT),
    minZ: clamp(Math.floor((Math.min(...zs) - 30) / NAV_GRID_STEP) * NAV_GRID_STEP, -WORLD_LIMIT, WORLD_LIMIT),
    maxZ: clamp(Math.ceil((Math.max(...zs) + 30) / NAV_GRID_STEP) * NAV_GRID_STEP, -WORLD_LIMIT, WORLD_LIMIT),
  }
  const limit = normalizeBounds(constraint)
  if (!limit) return bounds
  return {
    minX: Math.max(bounds.minX, limit.minX),
    maxX: Math.min(bounds.maxX, limit.maxX),
    minZ: Math.max(bounds.minZ, limit.minZ),
    maxZ: Math.min(bounds.maxZ, limit.maxZ),
  }
}

function findNearestOpenCell(cell, cols, rows, isBlocked) {
  const queue = [cell]
  const visited = new Set([`${cell.c},${cell.r}`])
  let cursor = 0
  while (cursor < queue.length) {
    const cur = queue[cursor++]
    if (cur.c >= 0 && cur.c < cols && cur.r >= 0 && cur.r < rows && !isBlocked(cur.c, cur.r)) return cur
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { c: cur.c + dc, r: cur.r + dr }
      const key = `${next.c},${next.r}`
      if (visited.has(key)) continue
      visited.add(key)
      queue.push(next)
    }
  }
  return cell
}

function simplifyPath(path) {
  if (!path || path.length < 3) return path || []
  const simplified = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const cur = path[i]
    const next = path[i + 1]
    const dx1 = Math.sign(cur.x - prev.x)
    const dz1 = Math.sign(cur.z - prev.z)
    const dx2 = Math.sign(next.x - cur.x)
    const dz2 = Math.sign(next.z - cur.z)
    if (dx1 === dx2 && dz1 === dz2) continue
    simplified.push(cur)
  }
  simplified.push(path[path.length - 1])
  return simplified.filter((point, index) => {
    if (index === 0) return true
    const prev = simplified[index - 1]
    return (point.x - prev.x) ** 2 + (point.z - prev.z) ** 2 > 1
  })
}

function buildSensorRoute(startPoint, endPoint, obstacles, bounds = null) {
  const start = nearestSafePoint(startPoint, obstacles, bounds)
  const end = nearestSafePoint(endPoint, obstacles, bounds)
  if (segmentIsSafe(start.x, start.z, end.x, end.z, obstacles)) return [start, end]

  const routeBounds = makeBounds([start, end], obstacles, bounds)
  const cols = Math.max(1, Math.round((routeBounds.maxX - routeBounds.minX) / NAV_GRID_STEP) + 1)
  const rows = Math.max(1, Math.round((routeBounds.maxZ - routeBounds.minZ) / NAV_GRID_STEP) + 1)
  const toCell = point => ({
    c: clamp(Math.round((point.x - routeBounds.minX) / NAV_GRID_STEP), 0, cols - 1),
    r: clamp(Math.round((point.z - routeBounds.minZ) / NAV_GRID_STEP), 0, rows - 1),
  })
  const toPoint = cell => ({
    x: routeBounds.minX + cell.c * NAV_GRID_STEP,
    z: routeBounds.minZ + cell.r * NAV_GRID_STEP,
  })
  const isBlocked = (c, r) => {
    const point = toPoint({ c, r })
    return !pointIsSafe(point.x, point.z, obstacles)
  }

  const startCell = findNearestOpenCell(toCell(start), cols, rows, isBlocked)
  const endCell = findNearestOpenCell(toCell(end), cols, rows, isBlocked)
  const startKey = `${startCell.c},${startCell.r}`
  const endKey = `${endCell.c},${endCell.r}`
  const open = new Set([startKey])
  const cameFrom = new Map()
  const g = new Map([[startKey, 0]])
  const f = new Map([[startKey, Math.abs(startCell.c - endCell.c) + Math.abs(startCell.r - endCell.r)]])
  const closed = new Set()

  while (open.size > 0) {
    let currentKey = null
    let currentScore = Infinity
    open.forEach(key => {
      const score = f.get(key) ?? Infinity
      if (score < currentScore) {
        currentScore = score
        currentKey = key
      }
    })
    if (!currentKey) break
    if (currentKey === endKey) {
      const cells = []
      let cursor = currentKey
      while (cursor) {
        const [c, r] = cursor.split(',').map(Number)
        cells.unshift({ c, r })
        cursor = cameFrom.get(cursor)
      }
      return simplifyPath([start, ...cells.map(toPoint), end])
    }

    open.delete(currentKey)
    closed.add(currentKey)
    const [c, r] = currentKey.split(',').map(Number)
    const currentPoint = toPoint({ c, r })

    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc
      const nr = r + dr
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue
      const neighborKey = `${nc},${nr}`
      if (closed.has(neighborKey) || isBlocked(nc, nr)) continue
      const nextPoint = toPoint({ c: nc, r: nr })
      if (!segmentIsSafe(currentPoint.x, currentPoint.z, nextPoint.x, nextPoint.z, obstacles)) continue

      const tentativeG = (g.get(currentKey) ?? Infinity) + 1
      if (tentativeG >= (g.get(neighborKey) ?? Infinity)) continue
      cameFrom.set(neighborKey, currentKey)
      g.set(neighborKey, tentativeG)
      f.set(neighborKey, tentativeG + Math.abs(nc - endCell.c) + Math.abs(nr - endCell.r))
      open.add(neighborKey)
    }
  }

  const blocker = obstacles.find(obstacle => segmentHitsObstacle(start.x, start.z, end.x, end.z, obstacle))
  if (blocker) {
    const dx = end.x - start.x
    const dz = end.z - start.z
    const len = Math.sqrt(dx * dx + dz * dz) || 1
    const perpX = -dz / len
    const perpZ = dx / len
    const radius = obstacleRadius(blocker, NAV_GRID_STEP * 2)
    const candidates = [1, -1].map(side => nearestSafePoint({
      x: blocker.x + perpX * radius * side,
      z: blocker.z + perpZ * radius * side,
    }, obstacles, bounds))
    const detour = candidates.find(point => (
      segmentIsSafe(start.x, start.z, point.x, point.z, obstacles)
      && segmentIsSafe(point.x, point.z, end.x, end.z, obstacles)
    ))
    if (!detour) return [start]
    return [start, detour, end]
  }

  return [start]
}

function relevantObstaclesForSegment(start, end, obstacles) {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minZ = Math.min(start.z, end.z)
  const maxZ = Math.max(start.z, end.z)
  return obstacles.filter(obstacle => {
    const radius = obstacleRadius(obstacle, NAV_GRID_STEP * 2)
    return obstacle.x >= minX - radius
      && obstacle.x <= maxX + radius
      && obstacle.z >= minZ - radius
      && obstacle.z <= maxZ + radius
  })
}

function makeObstacleSafePath(rawPath = [], obstacles = getNavigationObstacles(), bounds = null) {
  if (!rawPath.length) return []
  if (!obstacles.length) return rawPath.map(point => clampPointToBounds(point, bounds))

  const safePath = [nearestSafePoint(rawPath[0], obstacles, bounds)]
  for (let i = 1; i < rawPath.length; i++) {
    const prev = safePath[safePath.length - 1]
    const nearby = relevantObstaclesForSegment(prev, rawPath[i], obstacles)
    const next = nearestSafePoint(rawPath[i], nearby.length ? nearby : obstacles, bounds)
    const routeObstacles = relevantObstaclesForSegment(prev, next, obstacles)
    const route = buildSensorRoute(prev, next, routeObstacles, bounds)
    safePath.push(...route.slice(1))
  }
  return simplifyPath(safePath)
}

function roadNodeInBounds(node, bounds) {
  const b = normalizeBounds(bounds)
  if (!b) return true
  return node.x >= b.minX && node.x <= b.maxX && node.z >= b.minZ && node.z <= b.maxZ
}

function roadNodeIsSafe(node, obstacles) {
  return pointIsSafe(node.x, node.z, obstacles)
}

function nearestRoadNodeInBounds(point, bounds, obstacles) {
  let best = null
  let bestD = Infinity
  for (const node of ROAD_NODES) {
    if (!roadNodeInBounds(node, bounds) || !roadNodeIsSafe(node, obstacles)) continue
    const d = (node.x - point.x) ** 2 + (node.z - point.z) ** 2
    if (d < bestD) {
      best = node
      bestD = d
    }
  }
  return best ? { x: best.x, z: best.z, id: best.id, gi: best.gi, gj: best.gj } : nearestSafePoint(point, obstacles, bounds)
}

function constrainedRoadRoute(startPoint, endPoint, bounds, obstacles) {
  const start = nearestRoadNodeInBounds(startPoint, bounds, obstacles)
  const end = nearestRoadNodeInBounds(endPoint, bounds, obstacles)
  const startNode = findNearestNode(start.x, start.z)
  const endNode = findNearestNode(end.x, end.z)
  if (!startNode || !endNode) return [start, end]
  if (startNode.id === endNode.id) return [{ x: startNode.x, z: startNode.z }]

  const open = new Set([startNode.id])
  const cameFrom = {}
  const g = new Map()
  const f = new Map()

  for (const node of ROAD_NODES) {
    g.set(node.id, Infinity)
    f.set(node.id, Infinity)
  }
  g.set(startNode.id, 0)
  f.set(startNode.id, heuristic(startNode, endNode))

  while (open.size > 0) {
    let current = null
    let minF = Infinity
    for (const id of open) {
      if (f.get(id) < minF) {
        minF = f.get(id)
        current = ROAD_NODES[id]
      }
    }
    if (!current) break
    if (current.id === endNode.id) {
      const path = []
      let cursor = current.id
      while (cursor !== undefined && cursor !== startNode.id) {
        path.unshift({ x: ROAD_NODES[cursor].x, z: ROAD_NODES[cursor].z })
        cursor = cameFrom[cursor]
      }
      path.unshift({ x: startNode.x, z: startNode.z })
      return path
    }
    open.delete(current.id)

    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ni = current.gi + di
      const nj = current.gj + dj
      if (ni < 0 || ni >= TOTAL_NODES || nj < 0 || nj >= TOTAL_NODES) continue
      const nid = nodeId(ni, nj)
      const neighbor = ROAD_NODES[nid]
      if (!roadNodeInBounds(neighbor, bounds) || !roadNodeIsSafe(neighbor, obstacles)) continue
      if (!segmentIsSafe(current.x, current.z, neighbor.x, neighbor.z, obstacles)) continue

      const tentativeG = g.get(current.id) + SPACING
      if (tentativeG < g.get(nid)) {
        cameFrom[nid] = current.id
        g.set(nid, tentativeG)
        f.set(nid, tentativeG + heuristic(neighbor, endNode))
        open.add(nid)
      }
    }
  }

  return segmentIsSafe(start.x, start.z, end.x, end.z, obstacles) ? [start, end] : [start]
}

function buildRoadSweepWaypoints(bounds, obstacles, horizontalFirst) {
  const safeNodes = ROAD_NODES.filter(node => roadNodeInBounds(node, bounds) && roadNodeIsSafe(node, obstacles))
  if (!safeNodes.length) return []

  const byZ = new Map()
  const byX = new Map()
  safeNodes.forEach(node => {
    byZ.set(node.z, [...(byZ.get(node.z) || []), node])
    byX.set(node.x, [...(byX.get(node.x) || []), node])
  })

  const waypoints = []
  let forward = true
  const groups = horizontalFirst
    ? [...byZ.entries()].sort((a, b) => a[0] - b[0])
    : [...byX.entries()].sort((a, b) => a[0] - b[0])

  groups.forEach(([, nodes]) => {
    const sorted = [...nodes].sort((a, b) => horizontalFirst ? a.x - b.x : a.z - b.z)
    if (!sorted.length) return
    const first = forward ? sorted[0] : sorted[sorted.length - 1]
    const last = forward ? sorted[sorted.length - 1] : sorted[0]
    waypoints.push({ x: first.x, z: first.z })
    if (first.id !== last.id) waypoints.push({ x: last.x, z: last.z })
    forward = !forward
  })

  return waypoints
}

function connectRoadWaypoints(waypoints, bounds, obstacles) {
  if (!waypoints.length) return []
  const path = [waypoints[0]]
  for (let i = 1; i < waypoints.length; i++) {
    const prev = path[path.length - 1]
    const route = constrainedRoadRoute(prev, waypoints[i], bounds, obstacles)
    path.push(...route.slice(1))
  }
  return simplifyPath(path)
}

function uniqueSafeWaypoints(points, obstacles, bounds) {
  const seen = new Set()
  const safe = []

  points.forEach(point => {
    const safePoint = nearestSafePoint(point, obstacles, bounds)
    const key = `${Math.round(safePoint.x)},${Math.round(safePoint.z)}`
    if (seen.has(key)) return
    seen.add(key)
    safe.push(safePoint)
  })

  return safe
}

function buildCoverageWaypoints(bounds, obstacles, horizontalFirst) {
  const b = normalizeBounds(bounds)
  if (!b) return []

  const width = b.maxX - b.minX
  const height = b.maxZ - b.minZ
  if (width <= 1 || height <= 1) return []

  // Tighter lane spacing for full coverage — scan radius is ~15m,
  // so spacing of 8 ensures overlap and no gaps.
  const laneStep = 8
  const waypoints = []
  let forward = true

  if (horizontalFirst) {
    const lanes = Math.max(1, Math.ceil(height / laneStep))
    for (let lane = 0; lane <= lanes; lane++) {
      const z = b.minZ + (height * lane) / lanes
      // Generate intermediate points every ~laneStep for obstacle-safe routing
      const steps = Math.max(2, Math.ceil(width / laneStep))
      const row = []
      for (let s = 0; s <= steps; s++) {
        row.push({ x: b.minX + (width * s) / steps, z })
      }
      waypoints.push(...(forward ? row : [...row].reverse()))
      forward = !forward
    }
  } else {
    const lanes = Math.max(1, Math.ceil(width / laneStep))
    for (let lane = 0; lane <= lanes; lane++) {
      const x = b.minX + (width * lane) / lanes
      const steps = Math.max(2, Math.ceil(height / laneStep))
      const column = []
      for (let s = 0; s <= steps; s++) {
        column.push({ x, z: b.minZ + (height * s) / steps })
      }
      waypoints.push(...(forward ? column : [...column].reverse()))
      forward = !forward
    }
  }

  return uniqueSafeWaypoints(waypoints, obstacles, b)
}

function getDeployDestination(searchRegion, index, activeCount) {
  if (!searchRegion) return { x: 0, z: 0 }

  const minX = Math.min(searchRegion.x1, searchRegion.x2)
  const maxX = Math.max(searchRegion.x1, searchRegion.x2)
  const minZ = Math.min(searchRegion.z1, searchRegion.z2)
  const maxZ = Math.max(searchRegion.z1, searchRegion.z2)

  const isWide = (maxX - minX) > (maxZ - minZ)

  if (isWide) {
    const sx1 = minX + (maxX - minX) * (index / activeCount)
    const sx2 = minX + (maxX - minX) * ((index + 1) / activeCount)
    return { x: (sx1 + sx2) / 2, z: (minZ + maxZ) / 2 }
  } else {
    const sz1 = minZ + (maxZ - minZ) * (index / activeCount)
    const sz2 = minZ + (maxZ - minZ) * ((index + 1) / activeCount)
    return { x: (minX + maxX) / 2, z: (sz1 + sz2) / 2 }
  }
}

// ═══════════════════════════════════════════
// DEPLOY PATHS: Base → Search Region (Grid Locked)
// ═══════════════════════════════════════════
export function computeDeployPaths(searchRegion) {
  if (!searchRegion) return {}
  const result = {}
  const activeCount = getActiveDronesCount(searchRegion)
  const obstacles = getNavigationObstacles()
  const regionBounds = {
    minX: Math.min(searchRegion.x1, searchRegion.x2) + SEARCH_AREA_INSET,
    maxX: Math.max(searchRegion.x1, searchRegion.x2) - SEARCH_AREA_INSET,
    minZ: Math.min(searchRegion.z1, searchRegion.z2) + SEARCH_AREA_INSET,
    maxZ: Math.max(searchRegion.z1, searchRegion.z2) - SEARCH_AREA_INSET,
  }

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      result[i + 1] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue;
    }

    const destination = nearestRoadNodeInBounds(getDeployDestination(searchRegion, i, activeCount), regionBounds, obstacles)
    result[i + 1] = findRoute(pad.x, pad.z, destination.x, destination.z)
  }
  return result
}

// ═══════════════════════════════════════════
// SEARCH PATHS: Lawnmower via safe road intersections
// ═══════════════════════════════════════════
let latestSliceMap = {}

export function computeSearchPaths(searchRegion) {
  if (!searchRegion) return {}
  const { x1, z1, x2, z2 } = searchRegion
  const result = {}
  const store = useSimStore.getState()
  const obstacles = getNavigationObstacles(store.obstacles || [])

  const areaMinX = Math.min(x1, x2)
  const areaMaxX = Math.max(x1, x2)
  const areaMinZ = Math.min(z1, z2)
  const areaMaxZ = Math.max(x1, x2)
  const inset = Math.min(
    2,
    Math.max(0, (areaMaxX - areaMinX) / 20),
    Math.max(0, (areaMaxZ - areaMinZ) / 20)
  )
  const minX = areaMinX + inset
  const maxX = areaMaxX - inset
  const minZ = areaMinZ + inset
  const maxZ = areaMaxZ - inset

  const activeCount = getActiveDronesCount(searchRegion)
  const isWide = (maxX - minX) > (maxZ - minZ)

  latestSliceMap = {}

  for (let i = 0; i < 5; i++) {
    const pad = BASE_PADS[i]
    if (i >= activeCount) {
      result[i + 1] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue;
    }

    let droneMinX, droneMaxX, droneMinZ, droneMaxZ;
    if (isWide) {
      const sliceWidth = (maxX - minX) / activeCount
      droneMinX = minX + i * sliceWidth
      droneMaxX = minX + (i + 1) * sliceWidth
      droneMinZ = minZ
      droneMaxZ = maxZ
    } else {
      const sliceHeight = (maxZ - minZ) / activeCount
      droneMinX = minX
      droneMaxX = maxX
      droneMinZ = minZ + i * sliceHeight
      droneMaxZ = minZ + (i + 1) * sliceHeight
    }

    const sliceW = droneMaxX - droneMinX
    const sliceH = droneMaxZ - droneMinZ
    const sliceBounds = { minX: droneMinX, maxX: droneMaxX, minZ: droneMinZ, maxZ: droneMaxZ }
    latestSliceMap[i + 1] = sliceBounds
    const searchWaypoints = buildCoverageWaypoints(sliceBounds, obstacles, sliceW >= sliceH)
    const sweepPath = makeObstacleSafePath(searchWaypoints, obstacles, sliceBounds)

    if (!sweepPath.length) {
      result[i + 1] = [{ x: pad.x, z: pad.z }, { x: pad.x, z: pad.z }]
      continue
    }

    const currentDrone = store.drones.find(drone => drone.id === i + 1)
    const start = pointFromDrone(currentDrone || { id: i + 1, pos: [pad.x, pad.y, pad.z] })
    const entryPath = findRoute(start.x, start.z, sweepPath[0].x, sweepPath[0].z)
    const returnSweep = [...sweepPath].reverse()
    result[i + 1] = simplifyPath([...entryPath, ...sweepPath.slice(1), ...returnSweep.slice(1)])
  }
  return result
}

// Build a fresh search path for a specific drone (used during takeover)
function buildSearchPathForDrone(droneId, startPoint) {
  const store = useSimStore.getState()
  const obstacles = getNavigationObstacles(store.obstacles || [])
  // Use the failed drone's slice (the replacement takes over that slice)
  const failedForId = store.drones.find(d => d.id === droneId)?.replacementFor
  const slice = latestSliceMap[failedForId] || latestSliceMap[droneId]
  if (!slice) return null

  const horizontalFirst = (slice.maxX - slice.minX) >= (slice.maxZ - slice.minZ)
  const searchWaypoints = buildCoverageWaypoints(slice, obstacles, horizontalFirst)
  const sweepPath = makeObstacleSafePath(searchWaypoints, obstacles, slice)
  if (!sweepPath.length) return null

  const entryRoute = findRoute(startPoint.x, startPoint.z, sweepPath[0].x, sweepPath[0].z)
  const returnSweep = [...sweepPath].reverse()
  return simplifyPath([...entryRoute, ...sweepPath.slice(1), ...returnSweep.slice(1)])
}

// ═══════════════════════════════════════════
// RETURN PATHS: Current position → Base
// ═══════════════════════════════════════════
export function computeReturnPaths(currentPositions) {
  const result = {}
  const store = useSimStore.getState()
  for (let i = 0; i < 5; i++) {
    const id = i + 1
    const drone = store.drones.find(d => d.id === id)
    // Motor-failed (GROUNDED) drones stay at crash site — don't route them back
    if (drone && (drone.status === 'GROUNDED' || drone.status === 'FAILED_DOCKED')) {
      const crashPos = currentPositions[id] || { x: drone.pos?.[0] || 0, z: drone.pos?.[2] || 0 }
      result[id] = [{ x: crashPos.x, z: crashPos.z }]
      continue
    }
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
    deployStartTime, searchStartTime, returnStartTime, dronePathOverrides } = store
  const now = performance.now() / 1000 + timeOffset
  const override = dronePathOverrides?.[drone.id] || dronePathOverrides?.[String(drone.id)]

  if (override?.mode === 'emergency-land') {
    const elapsed = Math.max(0, now - (override.startTime || now))
    const alt = Math.max(2, 15 - elapsed * 2)
    const px = override.path?.[0]?.x ?? (drone.pos?.[0] || 0)
    const pz = override.path?.[0]?.z ?? (drone.pos?.[2] || 0)
    return { x: px, y: alt, z: pz }
  }

  if (override?.mode === 'return-to-base') {
    const elapsed = Math.max(0, now - (override.startTime || now))
    const r = posOnPath(override.path, elapsed, override.speed || RETURN_SPEED)
    if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
    let alt = 18
    if (r.progress > 0.85) alt = 18 - ((r.progress - 0.85) / 0.15) * 16
    return { x: r.x, y: Math.max(2, alt), z: r.z }
  }

  if (override?.mode === 'takeover') {
    const elapsed = Math.max(0, now - (override.startTime || now))
    const entryPath = override.entryPath || []
    const entrySpeed = override.entrySpeed || DEPLOY_SPEED
    const entryDuration = pathDist(entryPath) / entrySpeed

    // Phase 1: Flying to the failed drone's area
    if (elapsed < entryDuration) {
      const r = posOnPath(entryPath, elapsed, entrySpeed)
      if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
      let alt = 20
      if (elapsed < 2) alt = 2 + (elapsed / 2) * 18
      return { x: r.x, y: Math.max(2, alt), z: r.z }
    }

    // Phase 2: Entry path complete — build a proper search path for this drone's
    // assigned slice and switch to using searchPaths (same as normal SEARCHING).
    // This runs once: after it sets searchPaths[droneId], subsequent frames use
    // the SEARCHING case because we also clear the takeover override.
    const entryEnd = entryPath.length ? entryPath[entryPath.length - 1] : { x: drone.pos?.[0] || 0, z: drone.pos?.[2] || 0 }
    const freshPath = buildSearchPathForDrone(drone.id, entryEnd)
    if (freshPath && freshPath.length > 1) {
      // Store fresh search path and reset searchStartTime for this drone,
      // then clear the takeover override so normal SEARCHING takes over.
      useSimStore.setState(state => {
        const newOverrides = { ...state.dronePathOverrides }
        delete newOverrides[drone.id]
        delete newOverrides[String(drone.id)]
        return {
          searchPaths: { ...state.searchPaths, [drone.id]: freshPath },
          searchStartTime: performance.now() / 1000,
          dronePathOverrides: newOverrides,
          drones: state.drones.map(d =>
            d.id === drone.id ? { ...d, status: 'SCANNING' } : d
          ),
        }
      })
    }

    // Use the operationPath as fallback until the state update triggers re-render
    const operationPath = override.operationPath || []
    const operationElapsed = elapsed - entryDuration
    const r = posOnPath(operationPath, operationElapsed, override.operationSpeed || SEARCH_SPEED, false)
    if (!r) return { x: drone.pos?.[0] || 0, y: drone.pos?.[1] || 15, z: drone.pos?.[2] || 0 }
    const alt = 15 + Math.sin(operationElapsed * 0.4 + drone.id * 1.5) * 2
    return { x: r.x, y: alt, z: r.z }
  }

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
      const path = searchPaths[drone.id]
      if (!path || !searchStartTime) {
        return { x: drone.pos?.[0] || 0, y: 15, z: drone.pos?.[2] || 0 }
      }
      const elapsed = now - searchStartTime
      const r = posOnPath(path, elapsed, SEARCH_SPEED, false)
      if (!r) return { x: drone.pos?.[0] || 0, y: 15, z: drone.pos?.[2] || 0 }
      const alt = 15 + Math.sin(elapsed * 0.4 + drone.id * 1.5) * 2
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
  const state = useSimStore.getState()
  const override = state.dronePathOverrides?.[drone.id] || state.dronePathOverrides?.[String(drone.id)]
  if (override?.mode === 'emergency-land') {
    return 0
  }
  if (override?.mode === 'return-to-base') {
    return getDroneOverrideStage(override) === 'docked' ? 0 : (override.speed || RETURN_SPEED)
  }
  if (override?.mode === 'takeover') {
    return getDroneOverrideStage(override) === 'operating'
      ? (override.operationSpeed || SEARCH_SPEED)
      : (override.entrySpeed || DEPLOY_SPEED)
  }

  const phase = state.missionPhase
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
  const { deployPaths, deployStartTime, drones, dronePathOverrides } = useSimStore.getState()
  if (!deployStartTime) return false
  const now = performance.now() / 1000
  return drones.every(d => {
    const override = dronePathOverrides?.[d.id] || dronePathOverrides?.[String(d.id)]
    if (override?.mode === 'takeover') {
      return getDroneOverrideStage(override, now) === 'operating'
    }
    if (override?.mode === 'return-to-base' || d.hardwareFailure) return true

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
