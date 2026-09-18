'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getPosition } from '../core/constants'

function buildRunwayTextGeometry(str, baseOffsetZ) {
  const chars = str.split('')
  const charSpacing = 0.15
  const totalWidth = (chars.length - 1) * charSpacing
  const startOffset = -totalWidth / 2
  
  const scale = 0.12
  const th = 0.15 * scale
  const w = 0.8 * scale
  const h = 1.0 * scale
  
  const segs = {
    A: { pos: [0, 0, -h], args: [w, th, th] },
    B: { pos: [w/2, 0, -h/2], args: [th, th, h] },
    C: { pos: [w/2, 0, h/2], args: [th, th, h] },
    D: { pos: [0, 0, h], args: [w, th, th] },
    E: { pos: [-w/2, 0, h/2], args: [th, th, h] },
    F: { pos: [-w/2, 0, -h/2], args: [th, th, h] },
    G: { pos: [0, 0, 0], args: [w, th, th] },
  }
  
  const map = {
    '0': ['A','B','C','D','E','F'],
    '1': ['B','C'],
    '2': ['A','B','G','E','D'],
    '3': ['A','B','G','C','D'],
    '4': ['F','G','B','C'],
    '5': ['A','F','G','C','D'],
    '6': ['A','F','E','D','C','G'],
    '7': ['A','B','C'],
    '8': ['A','B','C','D','E','F','G'],
    '9': ['A','B','C','D','F','G'],
    'L': ['F','E','D'],
    'R': ['A','F','E','G','B']
  }
  
  const geometries = []
  
  chars.forEach((char, i) => {
    const offsetX = startOffset + i * charSpacing
    const active = map[char] || []
    
    active.forEach(s => {
      const geom = new THREE.BoxGeometry(...segs[s].args)
      geom.translate(segs[s].pos[0] + offsetX, segs[s].pos[1], segs[s].pos[2] + baseOffsetZ)
      geometries.push(geom)
    })
    
    if (char === 'R') {
      const geom = new THREE.BoxGeometry(th, th, h*1.1)
      geom.rotateY(0.38)
      geom.translate(w/4 + offsetX, 0, h/2 + baseOffsetZ)
      geometries.push(geom)
    }
  })
  
  return geometries
}

const SHARED_MATERIAL = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.6 })
const TEXT_MATERIAL = new THREE.MeshBasicMaterial({ color: "#00ffcc" })

export default function RunwayMarkings({ aeroways }) {
  const markings = useMemo(() => {
    const list = []
    
    aeroways.runways.forEach(points => {
      const pts = points.map(([lat, lon]) => getPosition(lat, lon, 0))
      if (pts.length < 2) return
      const p0 = pts[0]
      const p1 = pts[pts.length - 1]
      const length = Math.hypot(p1[0] - p0[0], p1[2] - p0[2])
      
      if (length > 5.0) {
        let trueHdg = Math.atan2(p1[0] - p0[0], p0[2] - p1[2]) * 180 / Math.PI
        if (trueHdg < 0) trueHdg += 360
        
        let str1 = ''
        let str2 = ''
        
        if (trueHdg > 70 && trueHdg < 110) {
           str1 = '08'
           str2 = '26'
        } else if (trueHdg > 250 && trueHdg < 290) {
           str1 = '26'
           str2 = '08'
        } else if (trueHdg > 110 && trueHdg < 160) {
           str1 = '13'
           str2 = '31'
        } else if (trueHdg > 290 && trueHdg < 340) {
           str1 = '31'
           str2 = '13'
        }
        
        if (str1 === '26' || str1 === '08') {
          const isNorth = p0[2] < 0
          if (str1 === '08') {
             str1 = isNorth ? '08L' : '08R'
             str2 = isNorth ? '26R' : '26L'
          } else {
             str1 = isNorth ? '26L' : '26R'
             str2 = isNorth ? '08R' : '08L'
          }
        }
        
        const dx = p1[0] - p0[0]
        const dz = p1[2] - p0[2]
        const dirX = dx / length
        const dirZ = dz / length
        const rotY0 = Math.atan2(-dirX, -dirZ)
        const rotY1 = Math.atan2(dirX, dirZ)
        
        // Build geometries for End 0
        const geoms0 = []
        for(let k=-5; k<=5; k++) {
          if (k===0) continue
          const geom = new THREE.PlaneGeometry(0.02, 0.3)
          geom.rotateX(-Math.PI/2)
          geom.translate(k * 0.04, 0, -0.2)
          geoms0.push(geom)
        }
        const tdzDistances = [1.5, 3.0, 4.5, 6.0]
        tdzDistances.forEach((d, idx) => {
          const blocks = idx === 1 ? [-0.2, -0.15, 0.15, 0.2] : (idx > 1 ? [-0.15, 0.15] : [-0.25, -0.2, 0.2, 0.25])
          blocks.forEach(b => {
            const geom = new THREE.PlaneGeometry(0.03, 0.25)
            geom.rotateX(-Math.PI/2)
            geom.translate(b, 0, -d)
            geoms0.push(geom)
          })
        })
        const numDashes = Math.floor(length / 0.5)
        for (let j = 4; j < numDashes - 4; j += 2) {
           const geom = new THREE.PlaneGeometry(0.015, 0.3)
           geom.rotateX(-Math.PI/2)
           geom.translate(0, 0, -j * 0.5)
           geoms0.push(geom)
        }
        
        const mergedMarkings0 = mergeGeometries(geoms0)
        const mergedText0 = mergeGeometries(buildRunwayTextGeometry(str1, -0.7))
        
        // Build geometries for End 1
        const geoms1 = []
        for(let k=-5; k<=5; k++) {
          if (k===0) continue
          const geom = new THREE.PlaneGeometry(0.02, 0.3)
          geom.rotateX(-Math.PI/2)
          geom.translate(k * 0.04, 0, -0.2)
          geoms1.push(geom)
        }
        tdzDistances.forEach((d, idx) => {
          const blocks = idx === 1 ? [-0.2, -0.15, 0.15, 0.2] : (idx > 1 ? [-0.15, 0.15] : [-0.25, -0.2, 0.2, 0.25])
          blocks.forEach(b => {
            const geom = new THREE.PlaneGeometry(0.03, 0.25)
            geom.rotateX(-Math.PI/2)
            geom.translate(b, 0, -d)
            geoms1.push(geom)
          })
        })
        
        const mergedMarkings1 = mergeGeometries(geoms1)
        const mergedText1 = mergeGeometries(buildRunwayTextGeometry(str2, -0.7))

        list.push({
          p0, p1, rotY0, rotY1, mergedMarkings0, mergedText0, mergedMarkings1, mergedText1
        })
      }
    })
    
    return list
  }, [aeroways])

  return (
    <group position={[0, 0.022, 0]}>
      {markings.map((rw, i) => (
        <group key={`rw-${i}`}>
          <mesh position={rw.p0} rotation={[0, rw.rotY0, 0]} geometry={rw.mergedMarkings0} material={SHARED_MATERIAL} />
          <mesh position={rw.p0} rotation={[0, rw.rotY0, 0]} geometry={rw.mergedText0} material={TEXT_MATERIAL} />
          <mesh position={rw.p1} rotation={[0, rw.rotY1, 0]} geometry={rw.mergedMarkings1} material={SHARED_MATERIAL} />
          <mesh position={rw.p1} rotation={[0, rw.rotY1, 0]} geometry={rw.mergedText1} material={TEXT_MATERIAL} />
        </group>
      ))}
    </group>
  )
}
