import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Drone base landing pad positions (must match useDroneMovement.js BASE_PADS)
const STORE_BASE_PADS = [
  { x: -190, y: 2, z: -190 },
  { x: -170, y: 2, z: -190 },
  { x: -190, y: 2, z: -170 },
  { x: -170, y: 2, z: -170 },
  { x: -180, y: 2, z: -180 },
]

const INITIAL_DRONES = [
  { id: 1, name: 'Falcon', callsign: 'Falcon', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[0].x, STORE_BASE_PADS[0].y, STORE_BASE_PADS[0].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, isSimulated: false },
  { id: 2, name: 'Eagle', callsign: 'Eagle', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[1].x, STORE_BASE_PADS[1].y, STORE_BASE_PADS[1].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, isSimulated: false },
  { id: 3, name: 'Hawk', callsign: 'Hawk', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[2].x, STORE_BASE_PADS[2].y, STORE_BASE_PADS[2].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, isSimulated: false },
  { id: 4, name: 'Raven', callsign: 'Raven', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[3].x, STORE_BASE_PADS[3].y, STORE_BASE_PADS[3].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, isSimulated: false },
  { id: 5, name: 'Owl', callsign: 'Owl', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[4].x, STORE_BASE_PADS[4].y, STORE_BASE_PADS[4].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, isSimulated: false },
]

export const useSimStore = create(
  persist(
    (set, get) => ({
      // ── Connection ──
      backendConnected: false,
      latency: 0,
      telemetry: {},
      liveAiDrones: [],

      setLiveAiDrones: (drones) => set({ liveAiDrones: drones ?? [] }),

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
      threats: [],
      sensorHistory: {}, // { droneId: [{ time, battery, speed, altitude, signal, gps_status }] }
      eventLog: [],
      selectedDrone: null,
      zoneCoverage: 0,

      // ── Search Region ──
      searchRegion: null, // { x1, z1, x2, z2 }

      // ── Drone Paths (keyed by drone id) ──
      deployPaths: {},
      searchPaths: {},
      returnPaths: {},
      deployStartTime: null,
      searchStartTime: null,
      returnStartTime: null,

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

      // ══════════════════════════════════════
      // ACTIONS
      // ══════════════════════════════════════

      // ── Mission Phase ──
      setMissionPhase: (phase) => set({ missionPhase: phase }),

      setSearchRegion: (region) => set({ searchRegion: region }),

      // ── Deploy ──
      startDeploy: (paths) => set({
        deployPaths: paths,
        deployStartTime: performance.now() / 1000,
        missionPhase: 'DEPLOYING',
        simulationRunning: true,
      }),

      // ── Search ──
      startSearch: (paths) => set({
        searchPaths: paths,
        searchStartTime: performance.now() / 1000,
        missionPhase: 'SEARCHING',
      }),

      // ── Return ──
      startReturn: (paths) => set({
        returnPaths: paths,
        returnStartTime: performance.now() / 1000,
        missionPhase: 'RETURNING',
      }),

      // ── Complete ──
      completeMission: () => set({
        missionPhase: 'COMPLETED',
        simulationRunning: false,
      }),

      // ── Notifications ──
      addNotification: (message, type = 'info') => set(s => ({
        notifications: [...s.notifications, {
          id: Date.now() + Math.random(),
          message,
          type,
          timestamp: Date.now(),
        }]
      })),

      // ── Backend State Merge ──
      applyBackendState: (msg) => {
        set(state => {
          const existingMsgs = new Set(state.eventLog.map(l => `${l.time}_${l.message}`))
          const newFiltered = (msg.new_events || [])
            .filter(l => !existingMsgs.has(`${l.time}_${l.message}`))
            .map(l => ({
              time: l.time,
              message: l.message,
              category: l.category || 'system',
              type: l.category || 'system',
              drone_id: l.drone_id,
            }))

          const updatedLog = [...state.eventLog, ...newFiltered].slice(-200)

          const notifications = [...state.notifications]
          for (const e of newFiltered) {
            const cat = e.category
            if (cat === 'ai' || (e.message && e.message.includes('[AI BRAIN]'))) {
              notifications.push({
                id: Date.now() + Math.random(),
                message: e.message,
                type: 'guide',
                timestamp: Date.now(),
              })
            } else if (cat === 'failover' || (e.message && e.message.includes('[FAILOVER]'))) {
              notifications.push({
                id: Date.now() + Math.random(),
                message: e.message,
                type: 'warning',
                timestamp: Date.now(),
              })
            } else if (cat === 'critical') {
              notifications.push({
                id: Date.now() + Math.random(),
                message: e.message,
                type: 'error',
                timestamp: Date.now(),
              })
            }
          }

          return {
            backendConnected: true,
            drones: state.drones.map(sd => {
              const bd = msg.drones?.find(d => d.id === sd.id)
              if (!bd) return sd
              return {
                ...sd,
                pos: bd.pos,
                battery: bd.battery,
                status: bd.status,
                speed: bd.speed || 0,
                signal: bd.signal,
                cpu: bd.cpu,
                gps_status: bd.gps_status,
                action: sd.isSimulated ? sd.action : bd.action,
                reason: sd.isSimulated ? sd.reason : bd.reason,
                nearby: bd.nearby,
              }
            }),
            survivors: state.survivors,
            threats: msg.threats || [],
            sensorHistory: (() => {
              // Only clone arrays that actually get new data
              const newHist = state.sensorHistory
              let changed = false
              const updates = {}
              msg.drones?.forEach(d => {
                const existing = newHist[d.id] || []
                const newEntry = {
                  time: msg.sim_time,
                  battery: Math.round(d.battery),
                  speed: Math.round(d.speed || 0),
                  altitude: Math.round(d.pos?.[1] || 0),
                  signal: d.mesh_connected ? Math.max(0, 100 - (d.relay_chain?.length || 0) * 15) : 0,
                  gps_status: d.gps_status,
                  // New advanced sensors
                  imu_accel: d.sensors?.imu_accel || [0,0,0],
                  imu_gyro: d.sensors?.imu_gyro || [0,0,0],
                  baro_hpa: d.sensors?.baro_hpa || 1013.25,
                  lidar_dist: d.sensors?.lidar_dist || 0,
                  co2_ppm: d.sensors?.co2_ppm || 400.0,
                  battery_voltage: d.sensors?.battery_voltage || 14.8,
                }
                const updated = [...existing, newEntry]
                // keep last 50 readings per drone to avoid memory bloat
                if (updated.length > 50) updated.shift()
                updates[d.id] = updated
                changed = true
              })
              return changed ? { ...newHist, ...updates } : newHist
            })(),
            zoneCoverage: msg.zone_coverage_pct ?? state.zoneCoverage,
            waterLevel: msg.water_level ?? state.waterLevel,
            terrainChanged: msg.terrain_changed ?? state.terrainChanged,
            eventLog: updatedLog,
            notifications: notifications.slice(-30),
          }
        })
      },

      // ── Local Simulation Actions ──
      incrementTime: (dt) => set(s => ({ simulationTime: s.simulationTime + dt })),
      incrementCoverage: (amt) => set(s => ({ zoneCoverage: Math.min(100, s.zoneCoverage + amt) })),

      updateDrone: (id, updates) => set(state => ({
        drones: state.drones.map(d => d.id === id ? { ...d, ...updates } : d)
      })),

      updateSurvivor: (id, updates) => set(state => ({
        survivors: state.survivors.map(s => s.id === id ? { ...s, ...updates } : s)
      })),

      addEvent: (event) => set(state => ({
        eventLog: [...state.eventLog, { ...event, category: event.type || 'info' }].slice(-200)
      })),

      addSurvivor: (survivor) => set(state => ({
        survivors: [...state.survivors, survivor]
      })),

      seedSurvivor: (x, z) => {
        const newS = {
          id: 'SURV-' + Date.now(),
          pos: [x, 0.5, z],
          status: 'PENDING',
          detected: false,
          confidence: 0,
          body_temp: 36.5 + Math.random() * 1.5,
          isLocal: true,
        }
        set(s => ({ survivors: [...s.survivors, newS] }))
      },

      setTelemetry: (data) => set({ telemetry: data }),

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
