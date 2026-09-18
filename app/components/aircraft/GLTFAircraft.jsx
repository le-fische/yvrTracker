'use client'

import { useState, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useGLTF, Clone } from '@react-three/drei'
import AircraftLights from './AircraftLights'

const WIREFRAME_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#00ffcc', wireframe: true, transparent: true, opacity: 0.5
})

export default function GLTFAircraft({ scale, position, modelPath, isNight }) {
  const { scene } = useGLTF(modelPath, '/draco/')
  const [metrics, setMetrics] = useState(null)
  
  useLayoutEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && !child.userData.hasEdges) {
        child.material = WIREFRAME_MATERIAL
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

useGLTF.preload('/b777_final.glb', '/draco/')
useGLTF.preload('/models/a320.glb', '/draco/')
useGLTF.preload('/models/b738.glb', '/draco/')
useGLTF.preload('/models/b789.glb', '/draco/')
useGLTF.preload('/models/q400.glb', '/draco/')
