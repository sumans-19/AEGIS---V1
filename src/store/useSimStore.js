import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MAX_NOTIFICATIONS = 80
const MAX_DRONE_LOGS = 120
const OBJECT_RELAY_RADIUS = 130

const makeNotification = (message, type = 'info') => ({
  id: Date.now() + Math.random(),
  message,
  type,
  timestamp: Date.now(),
})

const droneTelemetryQueue = new Map()
let droneTelemetryFlushHandle = null

const scheduleDroneTelemetryFlush = (set) => {
  if (droneTelemetryFlushHandle !== null) return

  const flush = () => {
    droneTelemetryFlushHandle = null
    if (droneTelemetryQueue.size === 0) return

    const queued = new Map(droneTelemetryQueue)
    droneTelemetryQueue.clear()

    set(state => {
      let changed = false
      const drones = state.drones.map(drone => {
        const updates = queued.get(drone.id)
        if (!updates) return drone
        changed = true
        return { ...drone, ...updates }
      })

      return changed ? { drones } : state
    })
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    droneTelemetryFlushHandle = window.requestAnimationFrame(flush)
  } else {
    droneTelemetryFlushHandle = setTimeout(flush, 16)
  }
}

function pathDistance(path = []) {
  let distance = 0
  for (let i = 1; i < path.length; i++) {
    const dx = (path[i].x ?? path[i][0] ?? 0) - (path[i - 1].x ?? path[i - 1][0] ?? 0)
    const dz = (path[i].z ?? path[i][2] ?? path[i][1] ?? 0) - (path[i - 1].z ?? path[i - 1][2] ?? path[i - 1][1] ?? 0)
    distance += Math.sqrt(dx * dx + dz * dz)
  }
  return distance
}

function makeDroneLog(droneId, entry) {
  return {
    id: Date.now() + Math.random(),
    droneId,
    time: entry.time ?? 0,
    type: entry.type || 'info',
    message: entry.message,
    location: entry.location,
    objectId: entry.objectId,
    targetDroneId: entry.targetDroneId,
    timestamp: Date.now(),
  }
}

function appendDroneLogs(existingLogs, entries) {
  if (!entries.length) return existingLogs

  const nextLogs = { ...existingLogs }
  entries.forEach(entry => {
    if (!entry?.droneId) return
    const droneId = String(entry.droneId)
    nextLogs[droneId] = [
      ...(nextLogs[droneId] || []),
      makeDroneLog(entry.droneId, entry),
    ].slice(-MAX_DRONE_LOGS)
  })
  return nextLogs
}

function pathPlanLogEntries(drones, paths, phase, simTime) {
  const phaseLabel = phase.toLowerCase()
  return drones.map(drone => {
    const path = paths?.[drone.id] || paths?.[String(drone.id)] || []
    const distance = pathDistance(path)
    const isHolding = path.length < 2 || distance < 1
    return {
      droneId: drone.id,
      time: simTime,
      type: isHolding ? 'standby' : 'path',
      message: isHolding
        ? `${drone.callsign} holding position; no ${phaseLabel} route required.`
        : `${drone.callsign} ${phaseLabel} path found: ${path.length} waypoints, ${distance.toFixed(0)}m planned.`,
    }
  })
}

function pathToTrajectory(path = [], altitude = 15) {
  return path.map(point => [point.x ?? point[0] ?? 0, altitude, point.z ?? point[2] ?? point[1] ?? 0])
}

// Drone base landing pad positions (must match useDroneMovement.js BASE_PADS)
const STORE_BASE_PADS = [
  { x: -190, y: 2, z: -190 },
  { x: -170, y: 2, z: -190 },
  { x: -190, y: 2, z: -170 },
  { x: -170, y: 2, z: -170 },
  { x: -180, y: 2, z: -180 },
]

const INITIAL_DRONES = [
  { id: 1, name: 'DRONE-01', callsign: 'FALCON', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[0].x, STORE_BASE_PADS[0].y, STORE_BASE_PADS[0].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 2, name: 'DRONE-02', callsign: 'HAWK', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[1].x, STORE_BASE_PADS[1].y, STORE_BASE_PADS[1].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 3, name: 'DRONE-03', callsign: 'OSPREY', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[2].x, STORE_BASE_PADS[2].y, STORE_BASE_PADS[2].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 4, name: 'DRONE-04', callsign: 'KESTREL', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[3].x, STORE_BASE_PADS[3].y, STORE_BASE_PADS[3].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 5, name: 'DRONE-05', callsign: 'MERLIN', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[4].x, STORE_BASE_PADS[4].y, STORE_BASE_PADS[4].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
]

const INITIAL_DRONE_LOGS = Object.fromEntries(
  INITIAL_DRONES.map(drone => [
    drone.id,
    [makeDroneLog(drone.id, {
      time: 0,
      type: 'system',
      message: `${drone.callsign} initialized and awaiting path assignment.`,
    })],
  ])
)

export const useSimStore = create(
  persist(
    (set, get) => ({
      // ── Connection ──
      backendConnected: false,
      latency: 0,

      // ── Simulation State ──
      simulationRunning: false,
      simulationTime: 0,

      // ── Mission Phase FSM ──
      // IDLE → SELECT_REGION → SEED_SURVIVORS → DEPLOYING → SEARCHING → ALL_FOUND → RETURNING → COMPLETED
      missionPhase: 'IDLE',

      // ── Scenario ──
      scenario: 'earthquake',
      centerCoords: [37.166, 36.943],

      // ── Environmental ──
      waterLevel: 0.0,
      fireSpread: {},
      terrainChanged: false,

      // ── Entities ──
      drones: INITIAL_DRONES,
      survivors: [],
      detectedObjects: [],
      droneLogs: INITIAL_DRONE_LOGS,
      eventLog: [],
      selectedDrone: null,
      zoneCoverage: 0,
      obstacles: [],

      // ── Search Region ──
      searchRegion: null, // { x1, z1, x2, z2 }

      // ── Drone Paths (keyed by drone id) ──
      deployPaths: {},
      searchPaths: {},
      returnPaths: {},
      deployStartTime: null,
      searchStartTime: null,
      returnStartTime: null,
      hardwareFailures: {},
      dronePathOverrides: {},

      // ── Notifications ──
      notifications: [
        { id: 1, message: 'System initialized. Drones stationed at base.', type: 'system', timestamp: Date.now() },
        { id: 2, message: 'Click "Select Search Region" to begin mission setup.', type: 'guide', timestamp: Date.now() },
      ],

      // ── UI State ──
      parametersOpen: false,
      leftPanelCollapsed: false,
      rightPanelExpanded: false,
      activeSidebarTab: 'droneview',
      seedModeActive: false,
      fullMapMode: false,
      coordinationPanelOpen: false,
      bottomPanelCollapsed: false,

      // ── Proximity Encounter ──
      proximityEncounter: null,  // { drone1, drone2, timestamp, pointCloud1, pointCloud2, reroutePath1, reroutePath2, algorithmState, survivorLogs }
      proximityPanelOpen: false,
      encounterCooldowns: {},    // { "1-2": timestamp } — per-pair cooldown to prevent spam
      encounterViewMode: 'side', // 'side' or 'full'

      // ══════════════════════════════════════
      // ACTIONS
      // ══════════════════════════════════════

      // ── Mission Phase ──
      setMissionPhase: (phase) => set({ missionPhase: phase }),

      setSearchRegion: (region) => set({ searchRegion: region }),

      setObstacles: (obstacles) => set({ obstacles }),

      setDroneOverride: (droneId, override) => set(state => ({ dronePathOverrides: { ...state.dronePathOverrides, [droneId]: override } })),

      updateDroneSearchPath: (droneId, newPath) => set(state => ({
        searchPaths: { ...state.searchPaths, [droneId]: newPath },
        drones: state.drones.map(d => d.id === droneId ? { ...d, trajectory: newPath.map(p => [p.x, 15, p.z]) } : d)
      })),

      logObstacleDetection: (droneId, obstacle, pos) => set(state => {
        const drone = state.drones.find(d => d.id === droneId);
        if (!drone) return state;
        const simTime = state.simulationTime;
        const objectId = obstacle.id || `${obstacle.type || 'object'}-${Math.round(obstacle.x)}-${Math.round(obstacle.z)}`;
        const alreadyDetected = state.detectedObjects.some(object => object.id === objectId && object.detectedBy === droneId);
        if (alreadyDetected) return state;

        const obstacleX = obstacle.x ?? pos.x;
        const obstacleZ = obstacle.z ?? pos.z;
        const objectType = (obstacle.type || 'object').toUpperCase();
        const message = `${drone.callsign} detected ${obstacle.type || 'object'} at [${obstacleX.toFixed(0)}, ${obstacleZ.toFixed(0)}]. Sensor route keeping safe clearance.`;
        const detectedObject = {
          id: objectId,
          type: objectType,
          pos: [obstacleX, 0.5, obstacleZ],
          confidence: 92,
          detectedBy: droneId,
          detectedByCallsign: drone.callsign,
          radius: obstacle.radius,
          time: simTime,
        };
        const logEntry = {
          droneId,
          time: simTime,
          type: 'object',
          objectId,
          location: detectedObject.pos,
          message,
        };
        const eventEntry = { time: simTime, message, type: 'object', category: 'object', drone_id: droneId, object_id: objectId };
        return {
          detectedObjects: [...state.detectedObjects, detectedObject].slice(-200),
          droneLogs: appendDroneLogs(state.droneLogs, [logEntry]),
          eventLog: [...state.eventLog, eventEntry].slice(-200)
        };
      }),

      // ── Deploy ──
      startDeploy: (paths) => set(state => ({
        deployPaths: paths,
        deployStartTime: performance.now() / 1000,
        missionPhase: 'DEPLOYING',
        simulationRunning: true,
        drones: state.drones.map(drone => ({
          ...drone,
          trajectory: pathToTrajectory(paths?.[drone.id] || paths?.[String(drone.id)] || [], 20),
        })),
        droneLogs: appendDroneLogs(
          state.droneLogs,
          pathPlanLogEntries(state.drones, paths, 'DEPLOY', state.simulationTime)
        ),
      })),

      // ── Search ──
      startSearch: (paths) => set(state => ({
        searchPaths: paths,
        searchStartTime: performance.now() / 1000,
        missionPhase: 'SEARCHING',
        drones: state.drones.map(drone => ({
          ...drone,
          trajectory: pathToTrajectory(paths?.[drone.id] || paths?.[String(drone.id)] || [], 15),
        })),
        droneLogs: appendDroneLogs(
          state.droneLogs,
          pathPlanLogEntries(state.drones, paths, 'SEARCH', state.simulationTime)
        ),
      })),

      // ── Return ──
      startReturn: (paths) => set(state => ({
        returnPaths: paths,
        returnStartTime: performance.now() / 1000,
        missionPhase: 'RETURNING',
        drones: state.drones.map(drone => ({
          ...drone,
          trajectory: pathToTrajectory(paths?.[drone.id] || paths?.[String(drone.id)] || [], 18),
        })),
        dronePathOverrides: Object.fromEntries(
          Object.entries(state.dronePathOverrides || {})
            .filter(([, override]) => override.mode === 'return-to-base')
        ),
        droneLogs: appendDroneLogs(
          state.droneLogs,
          pathPlanLogEntries(state.drones, paths, 'RETURN', state.simulationTime)
        ),
      })),

      applyHardwareFailure: ({
        failedDroneId,
        replacementDroneId,
        failure,
        returnPath = [],
        entryPath = [],
        operationPath = [],
      }) => set(state => {
        const failedId = Number(failedDroneId)
        const replacementId = replacementDroneId ? Number(replacementDroneId) : null
        const failedDrone = state.drones.find(drone => drone.id === failedId)
        const replacementDrone = state.drones.find(drone => drone.id === replacementId)
        if (!failedDrone || !failure) return state

        const now = performance.now() / 1000
        const simTime = state.simulationTime
        const isEmergencyLand = failure.id === 'motor_failure'
        const severity = failure.severity === 'critical' ? 'critical' : 'warning'
        const returnDistance = isEmergencyLand ? 0 : pathDistance(returnPath)
        const takeoverDistance = pathDistance(entryPath) + pathDistance(operationPath)

        const actionText = isEmergencyLand
          ? `Emergency landing initiated.`
          : `Return-to-base route assigned (${returnPath.length} waypoints, ${returnDistance.toFixed(0)}m).`

        const droneLogEntries = [
          {
            droneId: failedId,
            time: simTime,
            type: severity,
            message: `${failedDrone.callsign} ${failure.logLabel}. ${actionText}`,
          },
        ]

        const events = [
          {
            time: simTime,
            message: `${failedDrone.callsign} reported ${failure.label}. ${isEmergencyLand ? 'Emergency landing' : 'Failsafe RTB'} engaged and mission handoff started.`,
            type: severity,
            category: severity,
            drone_id: failedId,
          },
        ]

        const notifications = [
          makeNotification(`${failedDrone.callsign}: ${failure.label}. ${isEmergencyLand ? 'Emergency landing' : 'Returning to base'}.`, severity),
        ]

        const nextOverrides = {
          ...state.dronePathOverrides,
          [failedId]: {
            mode: isEmergencyLand ? 'emergency-land' : 'return-to-base',
            failureType: failure.id,
            path: returnPath,
            speed: isEmergencyLand ? 2 : failure.rtbSpeed,
            startTime: now,
            stage: isEmergencyLand ? 'landing' : 'returning',
          },
        }

        let nextSearchPaths = state.searchPaths

        if (replacementDrone) {
          nextOverrides[replacementId] = {
            mode: 'takeover',
            failedDroneId: failedId,
            entryPath,
            operationPath,
            entrySpeed: 22,
            operationSpeed: 10,
            startTime: now,
            stage: 'intercepting',
          }
          nextSearchPaths = {
            ...state.searchPaths,
            [replacementId]: operationPath,
          }

          const replacementMessage = `${replacementDrone.callsign} launched as standby replacement for ${failedDrone.callsign} (${takeoverDistance.toFixed(0)}m takeover route).`
          droneLogEntries.push({
            droneId: replacementId,
            time: simTime,
            type: 'path',
            targetDroneId: failedId,
            message: replacementMessage,
          })
          events.push({
            time: simTime,
            message: replacementMessage,
            type: 'drone',
            category: 'drone',
            drone_id: replacementId,
          })
          notifications.push(makeNotification(`${replacementDrone.callsign} taking over ${failedDrone.callsign}'s path.`, 'system'))
        } else {
          const noReplacementMessage = `No standby drone available for ${failedDrone.callsign}; failure logged and RTB continues.`
          events.push({
            time: simTime,
            message: noReplacementMessage,
            type: 'warning',
            category: 'warning',
            drone_id: failedId,
          })
          notifications.push(makeNotification(noReplacementMessage, 'warning'))
        }

        return {
          hardwareFailures: {
            ...state.hardwareFailures,
            [failedId]: {
              type: failure.id,
              label: failure.label,
              severity: failure.severity,
              status: 'RTB',
              triggeredAt: simTime,
              replacementDroneId: replacementId,
              returnDistance,
              takeoverDistance,
            },
          },
          dronePathOverrides: nextOverrides,
          searchPaths: nextSearchPaths,
          returnPaths: {
            ...state.returnPaths,
            [failedId]: returnPath,
          },
          drones: state.drones.map(drone => {
            if (drone.id === failedId) {
              return {
                ...drone,
                ...(failure.droneUpdates || {}),
                status: 'FAILED_RTB',
                hardwareFailure: failure.id,
                failureLabel: failure.label,
                failureSeverity: failure.severity,
                replacementDroneId: replacementId,
                trajectory: pathToTrajectory(returnPath, 18),
              }
            }
            if (replacementDrone && drone.id === replacementId) {
              return {
                ...drone,
                status: 'TAKEOVER',
                replacementFor: failedId,
                trajectory: pathToTrajectory([...entryPath, ...operationPath], 18),
              }
            }
            return drone
          }),
          droneLogs: appendDroneLogs(state.droneLogs, droneLogEntries),
          eventLog: [...state.eventLog, ...events].slice(-200),
          notifications: [...state.notifications, ...notifications].slice(-MAX_NOTIFICATIONS),
        }
      }),

      markDroneOverrideStage: (droneId, stage) => set(state => {
        const id = Number(droneId)
        const override = state.dronePathOverrides?.[id]
        if (!override || override.stage === stage) return state

        const drone = state.drones.find(d => d.id === id)
        if (!drone) return state

        const nextOverrides = {
          ...state.dronePathOverrides,
          [id]: { ...override, stage },
        }

        const droneLogEntries = []
        const events = []
        const notifications = []
        const nextFailures = { ...state.hardwareFailures }
        let nextDrones = state.drones

        if (override.mode === 'emergency-land' && stage === 'crashed') {
          const failure = nextFailures[id]
          if (failure) nextFailures[id] = { ...failure, status: 'GROUNDED', dockedAt: state.simulationTime }
          nextDrones = state.drones.map(d => d.id === id
            ? { ...d, status: 'GROUNDED', speed: 0, trajectory: [] }
            : d
          )
          const message = `${drone.callsign} has emergency landed due to motor failure.`
          droneLogEntries.push({ droneId: id, time: state.simulationTime, type: 'critical', message })
          events.push({ time: state.simulationTime, message, type: 'critical', category: 'critical', drone_id: id })
          notifications.push(makeNotification(message, 'error'))
        }

        if (override.mode === 'return-to-base' && stage === 'docked') {
          const failure = nextFailures[id]
          if (failure) nextFailures[id] = { ...failure, status: 'DOCKED', dockedAt: state.simulationTime }
          const pad = STORE_BASE_PADS[(id - 1) % STORE_BASE_PADS.length]
          nextDrones = state.drones.map(d => d.id === id
            ? { ...d, status: 'FAILED_DOCKED', speed: 0, pos: [pad.x, pad.y, pad.z], trajectory: [] }
            : d
          )
          const message = `${drone.callsign} reached base after hardware failure. Maintenance hold active.`
          droneLogEntries.push({ droneId: id, time: state.simulationTime, type: 'warning', message })
          events.push({ time: state.simulationTime, message, type: 'warning', category: 'warning', drone_id: id })
          notifications.push(makeNotification(message, 'warning'))
        }

        if (override.mode === 'takeover' && stage === 'operating') {
          nextDrones = state.drones.map(d => d.id === id
            ? { ...d, status: 'SCANNING', trajectory: pathToTrajectory(override.operationPath || [], 15) }
            : d
          )
          const failedDrone = state.drones.find(d => d.id === override.failedDroneId)
          const message = `${drone.callsign} reached ${failedDrone?.callsign || 'failed unit'} route and resumed the search operation.`
          droneLogEntries.push({
            droneId: id,
            time: state.simulationTime,
            type: 'path',
            targetDroneId: override.failedDroneId,
            message,
          })
          events.push({ time: state.simulationTime, message, type: 'drone', category: 'drone', drone_id: id })
          notifications.push(makeNotification(message, 'success'))
        }

        return {
          dronePathOverrides: nextOverrides,
          hardwareFailures: nextFailures,
          drones: nextDrones,
          droneLogs: appendDroneLogs(state.droneLogs, droneLogEntries),
          eventLog: [...state.eventLog, ...events].slice(-200),
          notifications: [...state.notifications, ...notifications].slice(-MAX_NOTIFICATIONS),
        }
      }),

      // ── Complete ──
      completeMission: () => set({
        missionPhase: 'COMPLETED',
        simulationRunning: false,
        dronePathOverrides: {},
      }),

      // ── Notifications ──
      addNotification: (message, type = 'info') => set(s => ({
        notifications: [...s.notifications, makeNotification(message, type)].slice(-MAX_NOTIFICATIONS)
      })),

      // ── Backend State Merge ──
      applyBackendState: (msg) => {
        set(state => {
          const existingMsgs = new Set(state.eventLog.map(l => `${l.time}_${l.message}`))
          const newFiltered = (msg.new_events || []).filter(l => !existingMsgs.has(`${l.time}_${l.message}`))
          const updatedLog = [...state.eventLog, ...newFiltered].slice(-200)

          // Frontend fully controls drone state — never override from backend
          return {
            backendConnected: true,
            drones: state.drones,
            survivors: state.survivors,
            zoneCoverage: msg.zone_coverage_pct ?? state.zoneCoverage,
            waterLevel: msg.water_level ?? state.waterLevel,
            terrainChanged: msg.terrain_changed ?? state.terrainChanged,
            eventLog: updatedLog,
          }
        })
      },

      // ── Local Simulation Actions ──
      incrementTime: (dt) => set(s => ({ simulationTime: s.simulationTime + dt })),
      incrementCoverage: (amt) => set(s => ({ zoneCoverage: Math.min(100, s.zoneCoverage + amt) })),

      updateDrone: (id, updates) => set(state => ({
        drones: state.drones.map(d => d.id === id ? { ...d, ...updates } : d)
      })),

      updateDrones: (updatesById) => set(state => {
        let changed = false
        const drones = state.drones.map(d => {
          const updates = updatesById[d.id] || updatesById[String(d.id)]
          if (!updates) return d
          changed = true
          return { ...d, ...updates }
        })
        return changed ? { drones } : state
      }),

      queueDroneTelemetry: (id, updates) => {
        droneTelemetryQueue.set(id, {
          ...(droneTelemetryQueue.get(id) || {}),
          ...updates,
        })
        scheduleDroneTelemetryFlush(set)
      },

      updateSurvivor: (id, updates) => set(state => ({
        survivors: state.survivors.map(s => s.id === id ? { ...s, ...updates } : s)
      })),

      markSurvivorsDetected: (detections) => set(state => {
        if (!detections?.length) return state

        const detectedById = new Map(detections.map(d => [d.id, d]))
        const detectionEvents = []
        const relayEvents = []
        const droneLogEntries = []
        const detectedObjects = []

        detections.forEach(detection => {
          const survivor = state.survivors.find(s => s.id === detection.id)
          const pos = detection.pos || survivor?.pos || [0, 0.5, 0]
          const [x, , z] = pos
          const detector = state.drones.find(d => d.id === detection.detectedDroneId)
          const relays = state.drones
            .filter(drone => drone.id !== detection.detectedDroneId && drone.pos)
            .map(drone => {
              const dx = (drone.pos?.[0] || 0) - x
              const dz = (drone.pos?.[2] || 0) - z
              return { ...drone, distance: Math.sqrt(dx * dx + dz * dz) }
            })
            .filter(drone => drone.distance <= OBJECT_RELAY_RADIUS)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)

          const relayedTo = relays.map(drone => drone.id)
          const objectLabel = detection.objectType || 'SURVIVOR'

          detectedObjects.push({
            id: detection.id,
            type: objectLabel,
            pos,
            confidence: detection.confidence,
            detectedBy: detection.detectedDroneId,
            detectedByCallsign: detection.detectedBy,
            relayedTo,
            time: detection.time,
          })

          detectionEvents.push({
            time: detection.time,
            message: detection.message,
            type: 'survivor',
            category: 'survivor',
            drone_id: detection.detectedDroneId,
            object_id: detection.id,
          })

          droneLogEntries.push({
            droneId: detection.detectedDroneId,
            time: detection.time,
            type: 'object',
            objectId: detection.id,
            location: pos,
            message: `${detector?.callsign || detection.detectedBy} detected ${objectLabel} ${detection.id} at [${x.toFixed(0)}, ${z.toFixed(0)}]. Relay radius ${OBJECT_RELAY_RADIUS}m.`,
          })

          relays.forEach(drone => {
            const relayMessage = `${drone.callsign} received ${objectLabel} ${detection.id} location [${x.toFixed(0)}, ${z.toFixed(0)}] from ${detection.detectedBy}. Distance ${drone.distance.toFixed(0)}m.`
            relayEvents.push({
              time: detection.time,
              message: relayMessage,
              type: 'relay',
              category: 'relay',
              drone_id: drone.id,
              object_id: detection.id,
            })
            droneLogEntries.push({
              droneId: drone.id,
              time: detection.time,
              type: 'relay',
              objectId: detection.id,
              location: pos,
              targetDroneId: detection.detectedDroneId,
              message: relayMessage,
            })
          })
        })

        return {
          survivors: state.survivors.map(s => {
            const detection = detectedById.get(s.id)
            if (!detection) return s
            return {
              ...s,
              detected: true,
              status: 'DETECTED',
              detectedBy: detection.detectedBy,
              detected_by: detection.detectedDroneId,
              confidence: detection.confidence,
            }
          }),
          detectedObjects: [...state.detectedObjects, ...detectedObjects].slice(-200),
          droneLogs: appendDroneLogs(state.droneLogs, droneLogEntries),
          eventLog: [...state.eventLog, ...detectionEvents, ...relayEvents].slice(-200),
          notifications: [
            ...state.notifications,
            ...detections.map(d => makeNotification(d.notification, 'detection')),
          ].slice(-MAX_NOTIFICATIONS),
        }
      }),

      appendDroneLog: (droneId, entry) => set(state => ({
        droneLogs: appendDroneLogs(state.droneLogs, [{ ...entry, droneId, time: entry.time ?? state.simulationTime }])
      })),

      resetPathfindingState: () => set(state => ({
        detectedObjects: [],
        droneLogs: Object.fromEntries(
          state.drones.map(drone => [
            drone.id,
            [makeDroneLog(drone.id, {
              time: 0,
              type: 'system',
              message: `${drone.callsign} initialized and awaiting path assignment.`,
            })],
          ])
        ),
      })),

      addEvent: (event) => set(state => ({
        eventLog: [...state.eventLog, { ...event, category: event.type || 'info' }].slice(-200)
      })),

      addSurvivor: (survivor) => set(state => ({
        survivors: [...state.survivors, survivor]
      })),

      seedSurvivor: (x, z) => {
        const idSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const newS = {
          id: `SURV-${idSuffix}`,
          pos: [x, 0.5, z],
          status: 'PENDING',
          detected: false,
          confidence: 0,
          body_temp: 36.5 + Math.random() * 1.5,
          isLocal: true,
        }
        set(s => ({
          survivors: [...s.survivors, newS],
          notifications: [
            ...s.notifications,
            makeNotification(`Survivor placed at [${x.toFixed(0)}, ${z.toFixed(0)}].`, 'info'),
          ].slice(-MAX_NOTIFICATIONS),
        }))
      },

      // ── UI Actions ──
      setCoordinationPanelOpen: (val) => set({ coordinationPanelOpen: val }),
      setSelectedDrone: (id) => set({ selectedDrone: id }),
      setScenario: (scen) => set({ scenario: scen }),
      toggleParameters: () => set(state => ({ parametersOpen: !state.parametersOpen })),
      setLeftPanelCollapsed: (val) => set({ leftPanelCollapsed: val }),
      setRightPanelExpanded: (val) => set({ rightPanelExpanded: val }),
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
      setSeedModeActive: (val) => set({ seedModeActive: val }),
      setFullMapMode: (val) => set({ fullMapMode: val }),
      setPovMode: (val) => set({ povMode: val }),
      setBottomPanelCollapsed: (val) => set({ bottomPanelCollapsed: val }),

      triggerProximityEncounter: (data) => set({ proximityEncounter: data }),
      dismissProximityEncounter: () => set({ proximityEncounter: null, proximityPanelOpen: false }),
      setProximityPanelOpen: (val) => set({ proximityPanelOpen: val }),
      toggleEncounterViewMode: () => set(s => ({ encounterViewMode: s.encounterViewMode === 'side' ? 'full' : 'side' })),
      setEncounterCooldown: (pairKey) => set(s => ({
        encounterCooldowns: { ...s.encounterCooldowns, [pairKey]: Date.now() }
      })),

      toggleSimulation: () => {
        const currentlyRunning = get().simulationRunning
        set({ simulationRunning: !currentlyRunning })
      },

      exportMission: async (format) => {
        const url = `http://localhost:8000/api/export/${format}`
        try {
          const res = await fetch(url)
          if (res.ok) {
            const blob = await res.blob()
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `mission_export_${format}_${Date.now()}.${format}`
            a.click()
          }
        } catch (e) {
          console.error("Export failure:", e)
        }
      },

      // ── Theme ──
      theme: 'dark',
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      // ── Playback State (kept for compatibility) ──
      playbackProgress: 0,
      setPlaybackProgress: (p) => set({ playbackProgress: typeof p === 'function' ? p(get().playbackProgress) : p }),
      isPlayingScript: false,
      setIsPlayingScript: (b) => set({ isPlayingScript: b }),
    }),
    {
      name: 'aegis-storage',
      partialize: (state) => ({
        theme: state.theme,
        scenario: state.scenario,
      }),
    }
  )
)
