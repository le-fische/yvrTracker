'use client'

import { useState, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

export default function EnvironmentLighting() {
  const { scene } = useThree()
  const [sunElevation, setSunElevation] = useState(1)
  const [isDay, setIsDay] = useState(true)

  useEffect(() => {
    const updateTime = () => {
      const hour = new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver', hour: 'numeric', hourCycle: 'h23' })
      const h = parseInt(hour, 10)
      
      const timeProgress = (h - 6) / 12; // 6am to 6pm
      const day = timeProgress > 0 && timeProgress < 1;
      setIsDay(day);
      if (typeof window !== 'undefined') {
        window.isNightTime = !day; // Global flag for strobes
      }
      
      setSunElevation(day ? Math.sin(timeProgress * Math.PI) : -0.5);
    }
    updateTime()
    const int = setInterval(updateTime, 60000)
    return () => clearInterval(int)
  }, [])

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
