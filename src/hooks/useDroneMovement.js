// Parametric drone path calculation
// Each drone follows an elliptical orbit with gentle bobbing

export function getDronePosition(drone, time) {
  if (drone.status === 'CHARGING') {
    return { x: 20, y: 2, z: -20 }
  }

  const t = time * 0.05
  const { radius, phaseOffset, orbitSpeed, cx = 0, cz = 0 } = drone

  const x = cx + radius * Math.cos(t * orbitSpeed + phaseOffset)
  const z = cz + radius * Math.sin(t * orbitSpeed * 0.7 + phaseOffset)
  const baseAlt = drone.status === 'RETURNING' ? 35 : 50 // Increased so they fly far above the rubble and tall buildings
  const y = baseAlt + Math.sin(t * 0.5 + phaseOffset) * 4

  return { x, y, z }
}

export function getDroneAltitude(position) {
  return Math.round(position.y * 5.5)
}

export function getDroneSpeed(drone, time) {
  if (drone.status === 'CHARGING') return 0
  if (drone.status === 'RETURNING') return Math.round(18 + Math.sin(time * 0.1) * 4)
  return Math.round(14 + Math.sin(time * 0.2 + drone.phaseOffset) * 6)
}
