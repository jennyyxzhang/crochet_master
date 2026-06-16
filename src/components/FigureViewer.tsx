import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import type { AmiPart, Figure } from '../lib/amigurumi'
import { latheProfile, shapeProfile } from '../lib/amigurumi'
import { SWATCH_INCHES } from '../lib/gauge'

interface Placement {
  part: AmiPart
  offset: [number, number, number]
}

/** Spread a part's `count` copies symmetrically around the figure's center. */
function placements(part: AmiPart, sw: number, rh: number): Placement[] {
  const px = part.position.x * sw
  const py = part.position.y * rh
  const pz = part.position.z * sw
  if (part.count <= 1) return [{ part, offset: [px, py, pz] }]
  if (part.count === 2) {
    return [
      { part, offset: [px, py, pz] },
      { part, offset: [-px, py, pz] },
    ]
  }
  // 3+ copies: mirror on both x and z to make front/back pairs.
  const out: Placement[] = []
  for (let i = 0; i < part.count; i++) {
    const sx = i % 2 === 0 ? 1 : -1
    const sz = i < 2 ? 1 : -1
    out.push({ part, offset: [px * sx, py, pz * sz] })
  }
  return out
}

function PartMesh({ part, offset, sw, rh }: { part: AmiPart; offset: [number, number, number]; sw: number; rh: number }) {
  const geometry = useMemo(() => {
    const profile = shapeProfile(part.shape)
    const pts = latheProfile(profile, sw, rh)
    const v: THREE.Vector2[] = []
    // close the magic-ring base
    v.push(new THREE.Vector2(0.0001, pts[0].y))
    for (const p of pts) v.push(new THREE.Vector2(Math.max(p.r, 0.0001), p.y))
    if (part.shape.closed) {
      v.push(new THREE.Vector2(0.0001, pts[pts.length - 1].y))
    }
    const geo = new THREE.LatheGeometry(v, 48)
    geo.computeVertexNormals()
    return geo
  }, [part.shape, sw, rh])

  return (
    <mesh geometry={geometry} position={offset} scale={part.scale} castShadow receiveShadow>
      <meshStandardMaterial color={part.color} roughness={0.85} metalness={0.02} />
    </mesh>
  )
}

export default function FigureViewer({ figure, height = 460 }: { figure: Figure; height?: number }) {
  const sw = SWATCH_INCHES / figure.gauge.stsPer4in
  const rh = SWATCH_INCHES / figure.gauge.rowsPer4in

  // Rough framing: tallest stack + widest part.
  const extent = useMemo(() => {
    let maxY = 1
    let maxR = 1
    for (const part of figure.parts) {
      const profile = shapeProfile(part.shape)
      const top = part.position.y * rh + profile.length * rh
      maxY = Math.max(maxY, top)
      const r = (Math.max(...profile) * sw) / (2 * Math.PI) + Math.abs(part.position.x) * sw
      maxR = Math.max(maxR, r)
    }
    return { maxY, maxR }
  }, [figure.parts, sw, rh])

  const camDist = Math.max(extent.maxY, extent.maxR * 2) * 2.2 + 4

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-b from-sky-50 to-slate-100" style={{ height }}>
      <Canvas shadows camera={{ position: [camDist * 0.7, extent.maxY * 0.6 + 2, camDist], fov: 40 }}>
        <color attach="background" args={['#eef2f7']} />
        <hemisphereLight args={['#ffffff', '#cbd5e1', 0.9]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[8, 14, 8]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-6, 4, -8]} intensity={0.4} />
        <group position={[0, -extent.maxY / 2, 0]}>
          {figure.parts.flatMap((part) =>
            placements(part, sw, rh).map((pl, i) => (
              <PartMesh key={`${part.id}-${i}`} part={pl.part} offset={pl.offset} sw={sw} rh={rh} />
            )),
          )}
          <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={extent.maxR * 6 + 6} blur={2.4} far={12} />
        </group>
        <OrbitControls enablePan={false} minDistance={3} maxDistance={camDist * 3} target={[0, 0, 0]} />
      </Canvas>
    </div>
  )
}
