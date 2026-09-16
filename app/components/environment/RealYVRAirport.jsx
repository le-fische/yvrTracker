'use client'

import { useState, useEffect, useMemo, memo } from 'react'
import * as THREE from 'three'
import { Edges } from '@react-three/drei'
import { getPosition } from '../core/constants'
import MapTerrain from './MapTerrain'
import Coastlines from './Coastlines'
import BakedAirportGround from './BakedAirportGround'
import RunwayMarkings from './RunwayMarkings'
import ATCTower from '../tower/ATCTower'

const RealYVRAirport = memo(() => {
  const [aeroways, setAeroways] = useState(null)
  const [buildings, setBuildings] = useState(null)

  useEffect(() => {
    fetch('/yvr_aeroways.json')
      .then(r => r.json())
      .then(data => setAeroways(data))
      .catch(err => console.error("Failed to load aeroways:", err))

    fetch('/yvr_buildings.json')
      .then(r => r.json())
      .then(data => setBuildings(data.buildings))
      .catch(err => console.error("Failed to load buildings:", err))
  }, [])

  const buildingShapes = useMemo(() => {
    if (!buildings) return []
    return buildings.map(points => {
      if (points.length < 3) return null
      const shape = new THREE.Shape()
      points.forEach(([lat, lon], idx) => {
        const [x, y, z] = getPosition(lat, lon, 0)
        if (idx === 0) shape.moveTo(x, -z)
        else shape.lineTo(x, -z)
      })
      return shape
    })
  }, [buildings])

  if (!aeroways) return null

  return (
    <group>
      <MapTerrain />
      <Coastlines />

      <group position={[0, 0.02, 0]}>
        {/* Aprons as subtle geometric shapes */}
        {aeroways.aprons.map((points, i) => {
          if (points.length < 3) return null
          const shape = new THREE.Shape()
          points.forEach(([lat, lon], idx) => {
            const [x, y, z] = getPosition(lat, lon, 0)
            if (idx === 0) shape.moveTo(x, -z)
            else shape.lineTo(x, -z)
          })
          return (
            <mesh key={`apron-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
              <extrudeGeometry args={[shape, { depth: 0.05, bevelEnabled: false }]} />
              <meshBasicMaterial color="#081015" />
              <Edges color="#00ffcc" threshold={15} transparent opacity={0.5} />
            </mesh>
          )
        })}
        <BakedAirportGround />
        <RunwayMarkings aeroways={aeroways} />
      </group>

      {/* Real OSM Terminal Buildings */}
      {buildingShapes.map((shape, i) => {
        if (!shape) return null
        const hash = Math.floor(Math.abs(buildings[i][0][0] * 100000 + buildings[i][0][1] * 100000));
        const depth = 0.15 + (hash % 10) * 0.01; // Realistic heights (15m to 25m)
        const extrudeSettings = { depth, bevelEnabled: false }
        
        return (
          <mesh key={`bldg-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <extrudeGeometry args={[shape, extrudeSettings]} />
            <meshStandardMaterial color="#081015" roughness={0.5} />
            <Edges color="#00ffcc" transparent opacity={0.8} />
          </mesh>
        )
      })}

      <ATCTower />
    </group>
  )
})

export default RealYVRAirport
