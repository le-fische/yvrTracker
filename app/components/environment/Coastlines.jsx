'use client'

import { useState, useEffect } from 'react'
import { Line } from '@react-three/drei'
import { getPosition } from '../core/constants'

export default function Coastlines() {
  const [ways, setWays] = useState(null)
  
  useEffect(() => {
    fetch('/coastlines.json')
      .then(r => r.json())
      .then(data => setWays(data.ways))
      .catch(err => console.error("Failed to load coastlines", err))
  }, [])

  if (!ways) return null

  return (
    <group>
      {ways.map((coords, i) => {
        const pts = coords.map(([lat, lon]) => {
          const [x, , z] = getPosition(lat, lon, 0)
          return [x, 0.15, z]
        })
        if (pts.length < 2) return null
        return <Line key={`coast-${i}`} points={[...pts]} color="#00ffcc" lineWidth={2} transparent opacity={0.9} />
      })}
    </group>
  )
}
