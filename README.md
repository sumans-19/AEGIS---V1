# AEGIS - V1 // Autonomous Swarm Control

> **STATUS: ACTIVE DEPLOYMENT**  
> **SYSTEM: EARTHQUAKE // URBAN RECOVERY**  
> **SYNC: BACKEND OPERATIONAL (8000/5173)**

---

## ⚡ REAL-TIME TACTICAL OVERVIEW
AEGIS is a high-performance mission control dashboard for autonomous drone swarms. Optimized for urban disaster recovery, it bridges custom physics simulations with a low-latency 3D tactical interface.

### 🚁 CURRENT PAYLOAD
*   **Dynamic Swarm Telemetry**: Multi-unit tracking with 3D trail rendering and orbit/search physics.
*   **3D Disaster Scene**: Procedural urban terrain featuring high-fidelity fire simulations and structural damage.
*   **Parchment Mapping**: An antique "Treasure Map" styled 2D tactical plot for long-range surveyor logging.
*   **Dual-Panel Control**: Integrated mission logs, drone status, and thermal diagnostic feeds.

---

## 🛠️ TECH STACK (RAW)
*   **CORE**: Vite + React + Three.js (Fiber/Drei)
*   **BACKEND**: Python 3.x + FastAPI (Physics Loop + API)
*   **STATE**: Zustand (Global Simulation Persistence)
*   **ANIMATION**: Framer Motion + custom Canvas loops

---

## 🚀 BOOT SEQUENCE

### 1. START BACKEND (CORE PHYSICS)
```bash
cd backend
python main.py
```
*Runs on port 8000*

### 2. START FRONTEND (TACTICAL HUB)
```bash
npm run dev
```
*Main dashboard available on port 5173/5174*

---

## 📋 ACTIVE OBJECTIVES
- [x] Implement 3D Fire & Smoke Simulation
- [x] Integrate 2D/3D Map Synchronization
- [x] Restore UI Layout Stability (Full Map Mode)
- [x] Refine "Treasure Map" Aesthetic for Field Surveyor Mode
- [ ] Implement Swarm Collision Avoidance (V1.1)
- [ ] Expand Thermal Imaging Overlay (V1.2)
- [ ] Add Research References & Hardware Constraints (V1.1)
- [ ] Implement Dynamic Multi-Drone Task Allocation (V1.2)

---

## 🔬 ACADEMIC FOUNDATION

### Core Algorithms (Baseline Hardware: DJI Matrice 300 RTK)

**Swarm Coordination & Control:**
- Beard, R. W., et al. (2006). *Cooperative Control of Multi-Agent Systems*. Handbook of Unmanned Aerial Vehicles, Springer.
- Olfati-Saber, R., et al. (2007). *Consensus and Cooperation in Networked Multi-Agent Systems*. Proceedings of IEEE.

**Path Planning & Collision Avoidance:**
- Karaman, S. & Frazzoli, E. (2011). *Sampling-based Algorithms for Optimal Motion Planning*. The International Journal of Robotics Research, 30(7), 846-894.
- Van den Berg, J., et al. (2008). *Reciprocal Collision Avoidance for Multiple Robots*. Proceedings of IEEE ICRA 2008.

**SLAM & Computer Vision:**
- Thrun, S. (2002). *Robotic SLAM: Known Unknowns*. MIT Press.
- Redmon, J., et al. (2016). *You Only Look Once: Unified, Real-Time Object Detection*. Proceedings of CVPR 2016.
- ORB-SLAM2: Murillo-Rubio, J. M., et al. (2017). https://github.com/UZ-SLAMLab/ORB_SLAM2

**Energy Management for UAVs:**
- Beard, R. W. & McLain, T. W. (2012). *Small Unmanned Aircraft: Theory and Practice*. Princeton University Press.

### Documentation Files
- **[IMPROVEMENT_AREAS.md](IMPROVEMENT_AREAS.md)** - Detailed analysis of feedback & recommended enhancements
- **[HARDWARE_CONSTRAINTS.md](HARDWARE_CONSTRAINTS.md)** - DJI Matrice 300 RTK specs & power models

---

> **WARNING**: DO NOT TERMINATE BACKEND WHILE MISSION IS LIVE. 
> SYNCING... [OK]
