'use client'

import { useState, useEffect } from 'react'
import * as THREE from 'three'
import { useGLTF, Clone } from '@react-three/drei'
import AircraftLights from './AircraftLights'

export default function GLTFAircraft({ scale, position, modelPath, isNight }) {
  const { scene } = useGLTF(modelPath)
  const [metrics, setMetrics] = useState(null)
  
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && !child.userData.hasEdges) {
        child.material = new THREE.MeshBasicMaterial({ color: '#00ffcc', wireframe: true, transparent: true, opacity: 0.5 })
        child.userData.hasEdges = true
      }
    })
    
    const box = new THREE.Box3().setFromObject(scene)
    if (!box.isEmpty()) {
       setMetrics({
         minX: box.min.x, maxX: box.max.x,
         minY: box.min.y, maxY: box.max.y,
         minZ: box.min.z, maxZ: box.max.z
       })
    }
  }, [scene])

  return (
    <group scale={scale} position={position}>
      <group position={[0, metrics ? -metrics.minY : 0, 0]}>
        <Clone object={scene} />
        <AircraftLights metrics={metrics} isNight={isNight} />
      </group>
    </group>
  )
}

useGLTF.preload('/b777_final.glb')
useGLTF.preload('/models/a320.glb')
useGLTF.preload('/models/b738.glb')
useGLTF.preload('/models/b789.glb')
useGLTF.preload('/models/q400.glb')
