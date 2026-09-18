'use client'

import { useMemo, useContext, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TimeOfDayContext } from '../core/TimeOfDayContext'

export default function EnvironmentLighting() {
  const { scene } = useThree()
  const { isDay, sunElevation } = useContext(TimeOfDayContext)

  const bgNight = new THREE.Color('#020202');
  const bgDay = new THREE.Color('#0A192F'); // Slate blue
  const bgColor = useMemo(() => bgNight.clone().lerp(bgDay, Math.max(0, sunElevation)), [sunElevation])

  useEffect(() => {
    scene.background = bgColor;
    scene.fog = new THREE.Fog(bgColor, 60, 2000);
  }, [scene, bgColor])

  return (
    <>
      <ambientLight intensity={isDay ? 1.5 : 0.3} />
      <directionalLight position={[100, sunElevation * 200, 50]} intensity={isDay ? 2.5 * sunElevation : 0} color="#eef7ff" />
      <directionalLight position={[-100, 50, -100]} intensity={isDay ? 0.8 : 0.2} color="#224488" />
    </>
  )
}
