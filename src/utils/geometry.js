// Geometry utilities: Andrew's Monotonic Chain convex hull and simple buffer
export function computeConvexHull(points) {
  // points: array of {x, z}
  if (!points || points.length === 0) return []
  const pts = points.map(p => ({ x: p.x, z: p.z }))
  // sort by x, then z
  pts.sort((a, b) => a.x === b.x ? a.z - b.z : a.x - b.x)

  function cross(o, a, b) {
    return (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  }

  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  // Concatenate lower and upper to get full hull; remove duplicate endpoints
  lower.pop()
  upper.pop()
  const hull = lower.concat(upper)
  return hull
}

export function bufferPolygon(polygon, bufferDistance = 8) {
  // polygon: array of {x,z} in CCW or CW order (convex expected)
  if (!polygon || polygon.length === 0) return []
  // Compute centroid
  let cx = 0, cz = 0
  for (const p of polygon) { cx += p.x; cz += p.z }
  cx /= polygon.length; cz /= polygon.length

  // Expand each vertex away from centroid by bufferDistance (preserves convexity)
  const out = polygon.map(p => {
    const dx = p.x - cx, dz = p.z - cz
    const dist = Math.sqrt(dx * dx + dz * dz) || 1
    const nx = dx / dist, nz = dz / dist
    return { x: p.x + nx * bufferDistance, z: p.z + nz * bufferDistance }
  })
  return out
}

export function pointInPolygon(pt, polygon) {
  // ray-casting algorithm for point-in-polygon
  if (!polygon || polygon.length < 3) return false
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z
    const intersect = ((zi > pt.z) !== (zj > pt.z)) && (pt.x < (xj - xi) * (pt.z - zi) / (zj - zi + 0.0000001) + xi)
    if (intersect) inside = !inside
  }
  return inside
}
