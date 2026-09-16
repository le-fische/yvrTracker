'use client'

import { useEffect } from 'react'
import { useGLTF } from '@react-three/drei'

export default function BakedAirportGround() {
  const { scene } = useGLTF('/airport_ground.glb')
  
  useEffect(() => {
    scene.traverse(c => {
      if (c.isLine && c.material) {
        c.material.transparent = true
        c.material.opacity = 0.6
      }
    })
  }, [scene])
  
  return <primitive object={scene} />
}

useGLTF.preload('/airport_ground.glb')
