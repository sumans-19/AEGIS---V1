// ── Drone Position Registry ──
// A plain JS Map that stores live 60fps drone positions.
// Written to by DroneModel.useFrame (no Zustand overhead).
// Read by camera components (DroneView, ThermalView) for smooth tracking.

import * as THREE from 'three'

/** @type {Map<number, THREE.Vector3>} */
export const dronePositionRegistry = new Map()

/** @type {Map<number, THREE.Vector3>} direction vectors */
export const droneDirectionRegistry = new Map()

/**
 * Update the live position for a drone.
 * Call this every frame from DroneModel.useFrame.
 * @param {number} id
 * @param {THREE.Vector3} pos
 * @param {THREE.Vector3} [dir] optional direction vector
 */
export function setDronePosition(id, pos, dir) {
  if (!dronePositionRegistry.has(id)) {
    dronePositionRegistry.set(id, pos.clone())
  } else {
    dronePositionRegistry.get(id).copy(pos)
  }
  if (dir) {
    if (!droneDirectionRegistry.has(id)) {
      droneDirectionRegistry.set(id, dir.clone())
    } else {
      droneDirectionRegistry.get(id).copy(dir)
    }
  }
}
