'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Edges } from '@react-three/drei'

export default function ATCTower() {
  const glowRef = useRef()
  useFrame((state) => {
    if (glowRef.current) {
      glowRef.current.material.emissiveIntensity = 1 + Math.sin(state.clock.elapsedTime * 4) * 2;
    }
  })

  return (
    <group position={[4.06, 0, -0.25]}>
      {/* Base shaft */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.02, 0.04, 0.4, 8]} />
        <meshStandardMaterial color="#081015" roughness={0.5} />
        <Edges color="#00ffcc" transparent opacity={0.8} />
      </mesh>
      {/* Cab (control room) */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.06, 0.04, 0.1, 8]} />
        <meshStandardMaterial color="#081015" roughness={0.2} emissive="#00ffcc" emissiveIntensity={0.2} />
        <Edges color="#00ffcc" transparent opacity={1} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.01, 0.065, 0.04, 8]} />
        <meshStandardMaterial color="#081015" roughness={0.5} />
        <Edges color="#00ffcc" transparent opacity={0.8} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.002, 0.002, 0.15, 4]} />
        <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={0.5} />
      </mesh>
      {/* Glowing pulsing dot on top */}
      <mesh ref={glowRef} position={[0, 0.65, 0]}>
        <sphereGeometry args={[0.01, 8, 8]} />
        <meshStandardMaterial color="#ff0044" emissive="#ff0044" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}
