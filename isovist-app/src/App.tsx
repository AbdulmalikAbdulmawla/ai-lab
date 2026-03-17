import { useState, useEffect, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'

interface GeoFeature {
  type: string
  geometry: { type: string; coordinates: any }
  properties: Record<string, any>
}
interface GeoJSON {
  type: string
  features: GeoFeature[]
}

const SCALE = 100000
const CX = 857.9
const CZ = 2172.2
const MAX_RADIUS = 500
const RAY_COUNT = 360

// ── Buildings ────────────────────────────────────────────────────────────────
function Buildings({ geojson }: { geojson: GeoJSON }) {
  const geo = useMemo(() => {
    const positions: number[] = []
    const addPolygon = (ring: number[][]) => {
      for (let i = 1; i < ring.length - 2; i++) {
        positions.push(ring[0][0] * SCALE - CX, ring[0][2] ?? 0, ring[0][1] * SCALE - CZ)
        positions.push(ring[i][0] * SCALE - CX, ring[i][2] ?? 0, ring[i][1] * SCALE - CZ)
        positions.push(ring[i + 1][0] * SCALE - CX, ring[i + 1][2] ?? 0, ring[i + 1][1] * SCALE - CZ)
      }
    }
    for (const f of geojson.features) {
      if (f.geometry.type === 'Polygon') addPolygon(f.geometry.coordinates[0])
      else if (f.geometry.type === 'MultiPolygon')
        for (const poly of f.geometry.coordinates) addPolygon(poly[0])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.computeVertexNormals()
    return g
  }, [geojson])

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="white" side={THREE.DoubleSide} />
    </mesh>
  )
}

// ── Streets ──────────────────────────────────────────────────────────────────
function Streets({ geojson }: { geojson: GeoJSON }) {
  return (
    <group>
      {geojson.features.map((f, i) => {
        if (f.geometry.type !== 'LineString') return null
        const pts = (f.geometry.coordinates as number[][]).map(
          (c) => new THREE.Vector3(c[0] * SCALE - CX, 0.5, c[1] * SCALE - CZ)
        )
        if (pts.length < 2) return null
        return <Line key={i} points={pts} color="#bbbbbb" lineWidth={0.8} />
      })}
    </group>
  )
}

// ── Pre-compute ground-level footprint edges (once, from buildings data) ──────
function buildFootprintEdges(geojson: GeoJSON): Float32Array {
  const arr: number[] = []
  for (const f of geojson.features) {
    const processRing = (ring: number[][]) => {
      for (let i = 0; i < ring.length - 1; i++) {
        // Only include edges where both endpoints are at ground level (height ≈ 0)
        if ((ring[i][2] ?? 0) < 0.5 && (ring[i + 1][2] ?? 0) < 0.5) {
          arr.push(
            ring[i][0] * SCALE - CX, ring[i][1] * SCALE - CZ,
            ring[i + 1][0] * SCALE - CX, ring[i + 1][1] * SCALE - CZ,
          )
        }
      }
    }
    if (f.geometry.type === 'Polygon')
      for (const ring of f.geometry.coordinates) processRing(ring)
    else if (f.geometry.type === 'MultiPolygon')
      for (const poly of f.geometry.coordinates)
        for (const ring of poly) processRing(ring)
  }
  return new Float32Array(arr)
}

// ── Isovist polygon (receives pre-built positions from worker) ────────────────
function IsovistPolygon({ positions }: { positions: Float32Array }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [positions])

  return (
    <mesh geometry={geo} renderOrder={1}>
      <meshBasicMaterial
        color="#4488ff"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// ── Viewpoint marker ─────────────────────────────────────────────────────────
function ViewpointMarker({ position }: { position: THREE.Vector3 }) {
  return (
    <mesh position={[position.x, 8, position.z]}>
      <sphereGeometry args={[6, 16, 16]} />
      <meshBasicMaterial color="#ff3333" />
    </mesh>
  )
}

// ── Ground plane ─────────────────────────────────────────────────────────────
function GroundPlane({ onPlace }: { onPlace: (p: THREE.Vector3) => void }) {
  const downRef = useRef<{ x: number; y: number } | null>(null)
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY } }}
      onPointerUp={(e) => {
        if (!downRef.current) return
        const dx = e.clientX - downRef.current.x
        const dy = e.clientY - downRef.current.y
        if (dx * dx + dy * dy < 25) { e.stopPropagation(); onPlace(e.point.clone()) }
        downRef.current = null
      }}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// ── Scene ────────────────────────────────────────────────────────────────────
function Scene({
  buildings, streets, edges, onCalculating,
}: {
  buildings: GeoJSON
  streets: GeoJSON
  edges: Float32Array
  onCalculating: (v: boolean) => void
}) {
  const [viewpoint, setViewpoint] = useState<THREE.Vector3 | null>(null)
  const [isovistPositions, setIsovistPositions] = useState<Float32Array | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./isovistWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current.onmessage = (e: MessageEvent) => {
      setIsovistPositions(e.data.positions)
      onCalculating(false)
    }
    return () => workerRef.current?.terminate()
  }, [])

  const handlePlace = (p: THREE.Vector3) => {
    setViewpoint(p)
    setIsovistPositions(null)
    onCalculating(true)
    workerRef.current?.postMessage(
      { edges, ox: p.x, oz: p.z, maxRadius: MAX_RADIUS, rayCount: RAY_COUNT },
      [edges.buffer.slice(0)] // send a copy so original stays usable
    )
  }

  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight position={[200, 400, 200]} intensity={1.2} />
      <Buildings geojson={buildings} />
      <Streets geojson={streets} />
      <GroundPlane onPlace={handlePlace} />
      {isovistPositions && <IsovistPolygon positions={isovistPositions} />}
      {viewpoint && <ViewpointMarker position={viewpoint} />}
      <OrbitControls makeDefault />
    </>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [buildings, setBuildings] = useState<GeoJSON | null>(null)
  const [streets, setStreets] = useState<GeoJSON | null>(null)
  const [calculating, setCalculating] = useState(false)

  const edges = useMemo(
    () => (buildings ? buildFootprintEdges(buildings) : null),
    [buildings]
  )

  useEffect(() => {
    fetch('/weimar-buildings-3d.geojson').then((r) => r.json()).then(setBuildings)
    fetch('/weimar-streets.geojson').then((r) => r.json()).then(setStreets)
  }, [])

  const ready = buildings && streets && edges

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'white' }}>
      {!ready && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#666', zIndex: 10,
        }}>
          Loading city data…
        </div>
      )}

      {ready && (
        <Canvas
          camera={{ position: [0, 1200, 900], fov: 45, near: 1, far: 10000 }}
          gl={{ antialias: true }}
          style={{ background: 'white' }}
        >
          <Scene
            buildings={buildings}
            streets={streets}
            edges={edges}
            onCalculating={setCalculating}
          />
        </Canvas>
      )}

      {/* Hint */}
      {!calculating && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(255,255,255,0.85)', borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: '#444',
          pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          Click on the ground to place a viewpoint and compute the isovist
        </div>
      )}

      {/* Calculating overlay */}
      {calculating && (
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(255,255,255,0.92)', borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: '#333',
          pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
            border: '2px solid #aaa', borderTopColor: '#4488ff',
            animation: 'spin 0.8s linear infinite',
          }} />
          Calculating isovist…
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
