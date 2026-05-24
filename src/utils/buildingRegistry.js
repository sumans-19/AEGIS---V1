// ── Building Obstacle Registry ──────────────────────────────────────────────
// MUST stay in sync with Terrain.jsx grid constants.
// Drone obstacle-avoidance uses these real bounding boxes.

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// ── Grid constants (must match Terrain.jsx & useDroneMovement.js) ──
export const REG_GRID_SIZE = 18
export const REG_SPACING   = 30
const OFFSET = (REG_GRID_SIZE * REG_SPACING) / 2   // 270

// ── BUILDING_OBSTACLES ────────────────────────────────────────────────────
// Array of { cx, cz, hw, hd, height }
//   cx/cz  — world-space center X and Z
//   hw/hd  — half-width (X) and half-depth (Z)
//   height — full height (geometry goes from y=0 → y=height)
export const BUILDING_OBSTACLES = (() => {
  const obs = []
  for (let gx = 0; gx < REG_GRID_SIZE; gx++) {
    for (let gz = 0; gz < REG_GRID_SIZE; gz++) {
      const seed = gx * 100 + gz
      const rand = seededRandom(seed)
      const cx = gx * REG_SPACING - OFFSET + REG_SPACING / 2 + (seededRandom(seed + 1) - 0.5) * 4
      const cz = gz * REG_SPACING - OFFSET + REG_SPACING / 2 + (seededRandom(seed + 2) - 0.5) * 4
      const typeRand = seededRandom(seed + 10)

      if (typeRand < 0.12 || typeRand >= 0.92) continue   // vegetation / empty
      const damageLevel = seededRandom(seed + 3)
      if (damageLevel < 0.35) continue                     // collapsed rubble

      const w = 9 + rand * 8
      const d = 9 + rand * 8
      const height = damageLevel < 0.6
        ? 16 + rand * 30   // partially collapsed
        : 20 + rand * 55   // intact

      obs.push({ cx, cz, hw: w / 2, hd: d / 2, height })
    }
  }
  return obs
})()
