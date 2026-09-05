# AEGIS — Autonomous Multi-UAV Disaster Response Platform

> **AI-driven drone swarm control for search, rescue, and reconnaissance in disaster-hit, forested, and comms-challenged environments.**

---

## Overview

AEGIS (Autonomous Emergency Ground Intelligence System) is an end-to-end autonomous drone swarm platform built for disaster response — earthquakes, wildfires, floods, and forested or hard-to-access terrain. It combines a real flight-control pipeline (PX4 + Gazebo + MAVSDK) with an AI decision engine and a full 3D mission control dashboard, so the system can be understood, operated, and evaluated as a single coherent product rather than a collection of separate demos.

The platform is designed around the core problem: manual search and rescue in disaster zones is slow, dangerous for personnel, and limited by the range and endurance of a single drone. AEGIS addresses this with a swarm of coordinated autonomous drones that map terrain, detect survivors, avoid obstacles, distribute search tasks, and relay intelligence back to a human command center — with minimal continuous human control, and without depending on GPS.

**Primary Use Cases**
- Autonomous multi-drone coordination for disaster recovery
- Real-time sensor-driven flight decision-making (obstacle avoidance, battery management, target investigation)
- Thermal/visual survivor detection and confidence-based alerting
- 3D tactical visualization of swarm operations for a human rescue coordinator
- Path planning and zone-based search allocation
- Multi-scenario disaster simulation (earthquake, tsunami, wildfire, flood)
- Educational demonstration of swarm robotics and autonomous decision architecture

---

## System Architecture

AEGIS is built as two layers that work together: a **flight-control and decision layer** that talks directly to real flight-controller firmware, and a **mission dashboard layer** that visualizes the swarm and gives a human rescue coordinator situational awareness.

```
                        SENSORS
        (Temperature, Humidity, Power, Proximity, Thermal/Visual)
                             │
                             ▼
                 COMPANION COMPUTER (Edge)
        Sensor fusion → Decision engine → Safety validation
                             │
                             ▼  MAVLink / MAVSDK
                    FLIGHT CONTROLLER (PX4)
                    Executes stabilization,
                    navigation, motor control
                             │
                             ▼
                  SIMULATED / REAL AIRFRAME
                     (Gazebo X500 / real drone)
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
     QGroundControl (monitor)      MISSION DASHBOARD
                                  (React + Three.js + FastAPI)
                                  3D swarm view, thermal feed,
                                  pathfinding, mission control
```

The separation matters: the flight controller (PX4) only ever executes structured, numeric commands — it has no concept of "survivor detected" or "battery low." All perception and reasoning happen on the companion computer, which then sends the flight controller simple, safe, validated commands. This mirrors how real autonomous drones (Skydio, agricultural UAV fleets) are actually built.

---

## Tech Stack

### Flight Control & Simulation
| Component | Technology |
|---|---|
| Flight controller firmware | PX4 (SITL) |
| Physics/3D simulator | Gazebo (Harmonic), via Docker |
| Companion-computer control | MAVSDK-Python |
| Ground control station | QGroundControl |
| Decision & safety logic | Python |

### Mission Dashboard
| Category | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| 3D rendering | Three.js + @react-three/fiber + @react-three/drei |
| Post-processing | @react-three/postprocessing |
| Animation | Framer Motion |
| State management | Zustand |
| Styling | Tailwind CSS |
| Backend | Python 3.10+ / FastAPI / Uvicorn |
| Physics & optimization | NumPy, SciPy |
| Computer vision | OpenCV (headless), Pillow |
| ML utilities | scikit-learn |
| Realtime transport | WebSockets |
| AI reasoning layer | Rule-based decision engine (Groq API integration available for LLM-assisted reasoning) |
| Persistence | MongoDB Atlas |

### Hardware Sensor Payload
| Sensor | Function |
|---|---|
| DHT11 | Environmental temperature and humidity monitoring |
| INA219 | Real-time power draw and battery telemetry |
| HC-SR04 | Proximity/obstacle sensing |
| ESP32-CAM | Thermal and optical imaging for survivor detection |

---

## Core Capabilities

### Autonomous Flight Control
- Fully autonomous arm, takeoff, offboard navigation, and landing via MAVSDK — no manual piloting required
- Sensor-driven decision states: `HOLD` (critical obstacle proximity), `RETURN` (low battery), `AVOID_HEAT` (high-temperature zone), `INVESTIGATE` (high-confidence detection), `SEARCH` (default patrol)
- Independent safety validation layer that bounds every outgoing flight command (max range, altitude, speed) regardless of what the decision engine produces
- Configurable zone-based patrol patterns, scalable from small test areas to full operational search zones

### AI Decision Engine
- Fuses environmental, power, proximity, and detection data into a single unified sensor state
- Converts sensor state into a specific, explainable flight action — every decision can be traced to the sensor reading that caused it
- Designed to extend to multi-drone auction-based task allocation (Contract Net Protocol), so drones dynamically claim and hand off search zones based on distance, battery, and workload

### Survivor Detection
- Thermal and optical imaging pipeline for identifying heat signatures consistent with human survivors
- Confidence-scored detections with classification, core temperature, and kinematic state, surfaced directly to the mission dashboard
- Detection triggers automatic priority scoring and relay to the human rescue coordinator

### Mission Control Dashboard
- Real-time interactive 3D disaster scene with procedural terrain, structural damage, and fire/smoke effects
- Multi-drone swarm telemetry — battery, velocity, altitude, and status per unit, with 3D trajectory trails
- Synchronized 2D tactical map view alongside the 3D scene
- Live sensor cards (environmental, power, proximity, thermal) with real-time readings
- A* pathfinding visualization with hazard-weighted cost routing
- Mission event log and AI decision log, so every autonomous action is inspectable by a human operator
- Fault/edge-case simulation panel for testing drone failure and obstacle-response behavior

### Disaster Scenarios
- **Earthquake** — Turkey/Syria 2023 (37.17N, 36.95E) — urban rubble, structural collapse
- **Tsunami** — Indonesia 2018 (6.10S, 105.42E) — coastal flooding, debris fields
- **Wildfire** — Hawaii 2023 (20.89N, 156.68W) — extreme heat, smoke obscuration
- **Flood** — Pakistan 2022 (27.50N, 68.50E) — water level rise, limited landing zones

---

## Core Algorithms

| Algorithm | Purpose |
|---|---|
| Rule-based decision engine | Explainable sensor-to-action mapping |
| Safety command validation | Bounds-checks every flight command before dispatch |
| A* pathfinding | Obstacle-aware route computation |
| Contract Net Protocol (auction-based allocation) | Dynamic, decentralized zone assignment across the swarm |
| YOLOv8 | Survivor/target detection from thermal and optical imagery |
| Occupancy grid mapping | Tracks searched vs. unsearched terrain per zone |
| Mesh relay / store-and-forward | Delivers detection alerts even when direct connectivity to base is unavailable |

---

## Installation & Boot Sequence

### Prerequisites
- Docker Desktop (for PX4 SITL + Gazebo)
- Node.js v18+ and npm
- Python 3.10+ and pip
- Git

### Flight Control Layer

```bash
docker rm -f aegis-px4 2>/dev/null

docker run --rm -it \
  --name aegis-px4 \
  --network aegis-net \
  --ip 172.28.0.3 \
  --add-host host.docker.internal:host-gateway \
  -p 14550:14550/udp \
  -e DISPLAY=$DISPLAY \
  -e WAYLAND_DISPLAY=$WAYLAND_DISPLAY \
  -e XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR \
  -e PX4_SIM_MODEL=gz_x500 \
  -e PX4_GZ_WORLD=walls \
  -e PX4_SIM_SPEED_FACTOR=0.5 \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  px4io/px4-sitl-gazebo:latest
```

In a separate terminal, run the sensor-to-flight decision pipeline:
```bash
python aegis_sensor_traversal.py
```

### Mission Dashboard

```bash
# Terminal 1 — hardware sensor stream server
python stream_server.py            # port 5000

# Terminal 2 — core simulation & API backend
cd backend && python main.py       # port 8000

# Terminal 3 — frontend dashboard
npm run dev                        # port 5173
```

**.env configuration**
```
GROQ_API_KEY=your_key_here
VITE_THERMAL_STREAM_URL=http://localhost:5000/thermal-stream
```

**Endpoints**

| Service | URL |
|---|---|
| Frontend Dashboard | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| WebSocket Feed | ws://localhost:8000/ws |
| Swagger Docs | http://localhost:8000/docs |
| Hardware Stream | http://localhost:5000/thermal-stream |

---

## Novelty

1. **Real sensor data drives real flight decisions.** A live proximity, temperature, or battery reading directly changes what the drone does in flight — not a pre-scripted animation.
2. **Explainable decision-making over black-box AI.** Every autonomous action traces back to a specific, named reason — essential for a life-safety application where operators need to trust and audit swarm behavior.
3. **Production-realistic architecture.** The companion computer and flight controller are correctly separated, mirroring how real deployed autonomous drones (e.g., Skydio) are built — not a shortcut invented for a demo.
4. **Independent safety validation layer.** Commands are bounds-checked after the decision engine runs, so no decision output — however it was derived — can produce an unsafe flight action.
5. **Unified operator experience.** Real flight telemetry, sensor readings, AI decisions, and mission visualization are designed to live in one dashboard, giving a human rescue coordinator complete situational awareness without needing to interpret raw logs.

---

## Roadmap

**Near-term:** live ESP32 sensor streaming into the decision engine · live YOLOv8 inference on thermal/optical feed · real-time telemetry bridge from the flight-control layer into the 3D dashboard · multi-drone PX4 instances with auction-based task allocation

**Mid-term:** GPS-denied localization via SLAM/VIO · encrypted mesh networking with store-and-forward relay · coverage-tracked systematic search patterns · ground-accessibility path suggestions for rescue teams

**Long-term:** physical companion-computer deployment on a real airframe (Jetson/Pixhawk) · pre-positioned autonomous docking/charging stations · full regulatory (BVLOS) certification for field deployment

---

## Academic Foundation

**Swarm Coordination & Control**
- Beard, R. W., et al. (2006). *Cooperative Control of Multi-Agent Systems*. Handbook of Unmanned Aerial Vehicles, Springer.
- Olfati-Saber, R., et al. (2007). *Consensus and Cooperation in Networked Multi-Agent Systems*. Proceedings of IEEE.

**Path Planning & Collision Avoidance**
- Karaman, S. & Frazzoli, E. (2011). *Sampling-based Algorithms for Optimal Motion Planning*. IJRR, 30(7).
- Van den Berg, J., et al. (2008). *Reciprocal Collision Avoidance for Multiple Robots*. IEEE ICRA.

**SLAM & Computer Vision**
- Thrun, S. (2002). *Robotic SLAM: Known Unknowns*. MIT Press.
- Redmon, J., et al. (2016). *You Only Look Once: Unified, Real-Time Object Detection*. CVPR.
- Mur-Artal, R. & Tardós, J. D. (2017). *ORB-SLAM2*. https://github.com/UZ-SLAMLab/ORB_SLAM2

**Energy Management for UAVs**
- Beard, R. W. & McLain, T. W. (2012). *Small Unmanned Aircraft: Theory and Practice*. Princeton University Press.

---

## Repository

| Field | Value |
|---|---|
| Owner | sumans-19 |
| Status | Active hackathon build |
| License | — |

> AEGIS is built to be evaluated honestly: the flight-control pipeline runs against real PX4/Gazebo physics with autonomous decision-making, and the mission dashboard demonstrates the full swarm-scale operational vision the platform is designed to grow into.