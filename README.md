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

---

> **WARNING**: DO NOT TERMINATE BACKEND WHILE MISSION IS LIVE. 
> SYNCING... [OK]
