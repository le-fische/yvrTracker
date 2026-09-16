'use client'

import { useState, useEffect } from 'react'
import * as THREE from 'three'

export default function MapTerrain() {
  const [demTexture, setDemTexture] = useState(null)

  useEffect(() => {
    new THREE.TextureLoader().load('/vancouver_dem.png', (tex) => setDemTexture(tex))
  }, [])

  if (!demTexture) return null

  return (
    <group>
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial color="#001a33" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <group position={[-156.61, -0.2, 51.65]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[1539.84, 1531.39, 128, 128]} />
          <meshStandardMaterial 
            color="#00ff88" 
            emissive="#00cc66"
            emissiveIntensity={0.2}
            displacementMap={demTexture} 
            displacementScale={30} 
            wireframe={true} 
            transparent 
            opacity={0.4} 
          />
        </mesh>
      </group>
    </group>
  )
}
