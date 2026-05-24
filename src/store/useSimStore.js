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
  { id: 1, name: 'DRONE-01', callsign: 'FALCON', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[0].x, STORE_BASE_PADS[0].y, STORE_BASE_PADS[0].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 2, name: 'DRONE-02', callsign: 'HAWK', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[1].x, STORE_BASE_PADS[1].y, STORE_BASE_PADS[1].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 3, name: 'DRONE-03', callsign: 'OSPREY', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[2].x, STORE_BASE_PADS[2].y, STORE_BASE_PADS[2].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 4, name: 'DRONE-04', callsign: 'KESTREL', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[3].x, STORE_BASE_PADS[3].y, STORE_BASE_PADS[3].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
  { id: 5, name: 'DRONE-05', callsign: 'MERLIN', status: 'IDLE', battery: 100, pos: [STORE_BASE_PADS[4].x, STORE_BASE_PADS[4].y, STORE_BASE_PADS[4].z], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0 },
]

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

      // ── Obstacle Detection Logs (per drone) ──
      droneObstacleLogs: {}, // { [droneId]: [{time, message, pos}] }

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

      // ── Obstacle Log ──
      addObstacleLog: (droneId, entry) => set(state => {
        const prev = state.droneObstacleLogs[droneId] || []
        return {
          droneObstacleLogs: {
            ...state.droneObstacleLogs,
            [droneId]: [...prev, entry].slice(-60),
          }
        }
      }),

      clearObstacleLogs: (droneId) => set(state => ({
        droneObstacleLogs: { ...state.droneObstacleLogs, [droneId]: [] }
      })),

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
