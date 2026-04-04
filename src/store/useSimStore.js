import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const INITIAL_DRONES = [
  { id: 1, name: 'DRONE-01', callsign: 'FALCON', status: 'SCANNING', battery: 100, pos: [0, 25, 0], trail: [], trajectory: [], scan_radius: 15, altitude: 25, speed: 0, radius: 25, phaseOffset: 0, orbitSpeed: 1.1, cx: -80, cz: -80 },
  { id: 2, name: 'DRONE-02', callsign: 'HAWK', status: 'RETURNING', battery: 34, pos: [10, 18, 10], trail: [], trajectory: [], scan_radius: 15, altitude: 18, speed: 0, radius: 25, phaseOffset: Math.PI / 4, orbitSpeed: 0.9, cx: 80, cz: -80 },
  { id: 3, name: 'DRONE-03', callsign: 'OSPREY', status: 'SCANNING', battery: 100, pos: [-10, 30, -5], trail: [], trajectory: [], scan_radius: 15, altitude: 30, speed: 0, radius: 30, phaseOffset: Math.PI / 2, orbitSpeed: 1.3, cx: -80, cz: 80 },
  { id: 4, name: 'DRONE-04', callsign: 'KESTREL', status: 'SEARCHING', battery: 92, pos: [-15, 22, 15], trail: [], trajectory: [], scan_radius: 18, altitude: 22, speed: 0, radius: 32, phaseOffset: Math.PI, orbitSpeed: 0.75, cx: 80, cz: 80 },
  { id: 5, name: 'DRONE-05', callsign: 'MERLIN', status: 'CHARGING', battery: 100, pos: [20, 2, -20], trail: [], trajectory: [], scan_radius: 15, altitude: 2, speed: 0, radius: 35, phaseOffset: 1.5, orbitSpeed: 1.0, cx: 0, cz: 0 },
]

export const useSimStore = create(
  persist(
    (set, get) => ({
      // Connection
      backendConnected: false,
      latency: 0,
      
      // Simulation State
      simulationRunning: false,
      simulationTime: 0,
      simulationSpeed: 1,
      missionPhase: 'SCAN',
      
      // Scenario
      scenario: 'earthquake',
      centerCoords: [37.166, 36.943],
      
      // Environmental
      waterLevel: 0.0,
      fireSpread: {},
      terrainChanged: false,
      
      // Entities
      drones: INITIAL_DRONES,
      survivors: [],
      eventLog: [],
      selectedDrone: 1,
      zoneCoverage: 34,
      
      // UI State
      parametersOpen: false,
      leftPanelCollapsed: false,
      rightPanelExpanded: false,
      activeSidebarTab: 'droneview',
      seedModeActive: false,
      fullMapMode: false,
      
      // Actions
      applyBackendState: (msg) => {
        set(state => {
          const existingMsgs = new Set(state.eventLog.map(l => `${l.time}_${l.message}`))
          const newFiltered = (msg.new_events || []).filter(l => !existingMsgs.has(`${l.time}_${l.message}`))
          const updatedLog = [...state.eventLog, ...newFiltered].slice(-200)

          // Merge backend drones with existing frontend properties to prevent NaN physics coordinates
          const mergedDrones = msg.drones ? msg.drones.map(backendDrone => {
            const existing = state.drones.find(d => d.id === backendDrone.id) || INITIAL_DRONES.find(d => d.id === backendDrone.id) || INITIAL_DRONES[0]
            
            const pos = backendDrone.pos || existing.pos || [0, 50, 0]
            const oldTrail = existing.trail || []
            let newTrail = oldTrail
            const lastP = oldTrail[oldTrail.length - 1]
            // Plot breadcrumb every 2 units of distance moved
            if (!lastP || Math.sqrt((lastP[0]-pos[0])**2 + (lastP[2]-pos[2])**2) > 2) {
               newTrail = [...oldTrail, [pos[0], pos[1], pos[2]]].slice(-100) 
            }

            // Project tactical vector 10 intervals ahead
            const headingRad = (existing.heading || 0) * (Math.PI / 180)
            const spd = backendDrone.speed || existing.speed || 15
            let newTrajectory = []
            for(let i=1; i<=10; i++) {
               // Assuming +Z is forward in basic 2D heading, or matching scene orientation
               newTrajectory.push([
                  pos[0] + Math.sin(headingRad) * spd * i * 0.5,
                  pos[1],
                  pos[2] + Math.cos(headingRad) * spd * i * 0.5
               ])
            }

            return {
              ...existing,
              ...backendDrone, // apply backend updates 
              
              trail: newTrail,
              trajectory: newTrajectory,
              
              // Preserve frontend-specific movement variables
              radius: existing.radius,
              phaseOffset: existing.phaseOffset, 
              orbitSpeed: existing.orbitSpeed,
              cx: existing.cx,
              cz: existing.cz,
              callsign: existing.callsign || backendDrone.name
            }
          }) : state.drones

          return {
            backendConnected: true,
            simulationTime: msg.sim_time ?? state.simulationTime,
            simulationRunning: msg.running ?? state.simulationRunning,
            drones: mergedDrones,
            survivors: [...(msg.survivors || []), ...state.survivors.filter(s => String(s.id).startsWith('SURV-'))],
            zoneCoverage: msg.zone_coverage_pct ?? state.zoneCoverage,
            waterLevel: msg.water_level ?? state.waterLevel,
            terrainChanged: msg.terrain_changed ?? state.terrainChanged,
            eventLog: updatedLog
          }
        })
      },
      
      // Local Simulation Actions (Offline Mode)
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
      
      setSelectedDrone: (id) => set({ selectedDrone: id }),
      setScenario: (scen) => set({ scenario: scen }),
      toggleParameters: () => set(state => ({ parametersOpen: !state.parametersOpen })),
      setLeftPanelCollapsed: (val) => set({ leftPanelCollapsed: val }),
      setRightPanelExpanded: (val) => set({ rightPanelExpanded: val }),
      setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),
      setSeedModeActive: (val) => set({ seedModeActive: val }),
      setFullMapMode: (val) => set({ fullMapMode: val }),
      
      toggleSimulation: () => {
         const currentlyRunning = get().simulationRunning
         set({ simulationRunning: !currentlyRunning })
      },
      setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
      
      seedSurvivor: (x, z) => {
        const newS = { 
           id: 'SURV-' + Date.now(), 
           pos: [x, 0.5, z], 
           status: 'PENDING', 
           detected: false,
           confidence: 0,
           body_temp: 36.5 + Math.random() * 1.5,
           isLocal: true
        }
        set(s => ({ survivors: [...s.survivors, newS] }))
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
      
      // Theme
      theme: 'dark',
      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    {
      name: 'aegis-storage',
      partialize: (state) => ({ 
        theme: state.theme,
        scenario: state.scenario
      }),
    }
  )
)
