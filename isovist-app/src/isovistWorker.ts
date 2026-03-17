// Web Worker: runs isovist ray-cast off the main thread
// Message in:  { edges: Float32Array, ox, oz, maxRadius, rayCount }
// Message out: { positions: Float32Array }  (transferable)

self.onmessage = (e: MessageEvent) => {
  const { edges, ox, oz, maxRadius, rayCount } = e.data as {
    edges: Float32Array
    ox: number
    oz: number
    maxRadius: number
    rayCount: number
  }

  // Filter edges to those within (maxRadius + buffer) of viewpoint
  const buffer = maxRadius + 10
  const nearby: number[] = []
  for (let i = 0; i < edges.length; i += 4) {
    const x1 = edges[i], z1 = edges[i + 1], x2 = edges[i + 2], z2 = edges[i + 3]
    // AABB check
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
    const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2)
    if (maxX < ox - buffer || minX > ox + buffer) continue
    if (maxZ < oz - buffer || minZ > oz + buffer) continue
    nearby.push(x1, z1, x2, z2)
  }

  function castRay(dx: number, dz: number): number {
    let minT = maxRadius
    for (let i = 0; i < nearby.length; i += 4) {
      const x1 = nearby[i], z1 = nearby[i + 1]
      const ex = nearby[i + 2] - x1
      const ez = nearby[i + 3] - z1
      const denom = dx * ez - dz * ex
      if (Math.abs(denom) < 1e-10) continue
      const tx = x1 - ox, tz = z1 - oz
      const t = (tx * ez - tz * ex) / denom
      const u = (tx * dz - tz * dx) / denom
      if (t > 0.1 && t < minT && u >= 0 && u <= 1) minT = t
    }
    return minT
  }

  const Y = 1
  const positions = new Float32Array(rayCount * 9)
  let p = 0

  for (let i = 0; i < rayCount; i++) {
    const a0 = (i / rayCount) * Math.PI * 2
    const a1 = ((i + 1) / rayCount) * Math.PI * 2
    const t0 = castRay(Math.cos(a0), Math.sin(a0))
    const t1 = castRay(Math.cos(a1), Math.sin(a1))
    // triangle: center, ray i, ray i+1
    positions[p++] = ox;  positions[p++] = Y;  positions[p++] = oz
    positions[p++] = ox + Math.cos(a0) * t0; positions[p++] = Y; positions[p++] = oz + Math.sin(a0) * t0
    positions[p++] = ox + Math.cos(a1) * t1; positions[p++] = Y; positions[p++] = oz + Math.sin(a1) * t1
  }

  self.postMessage({ positions }, [positions.buffer])
}
