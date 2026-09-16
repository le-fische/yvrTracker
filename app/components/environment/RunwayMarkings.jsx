'use client'

import { useMemo } from 'react'
import { getPosition } from '../core/constants'

function SevenSegmentChar({ char, scale = 1, color = "#00ffcc" }) {
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
  
  const active = map[char] || []
  
  return (
    <group>
      {active.map(s => (
        <mesh key={s} position={segs[s].pos}>
          <boxGeometry args={segs[s].args} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {char === 'R' && (
        <mesh position={[w/4, 0, h/2]} rotation={[0, 0.38, 0]}>
          <boxGeometry args={[th, th, h*1.1]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}

function RunwayText({ str, position }) {
  const chars = str.split('')
  const charSpacing = 0.15
  const totalWidth = (chars.length - 1) * charSpacing
  const startOffset = -totalWidth / 2
  
  return (
    <group position={position}>
      {chars.map((c, i) => {
        const offset = startOffset + i * charSpacing
        return (
          <group key={i} position={[offset, 0, 0]}>
             <SevenSegmentChar char={c} scale={0.12} />
          </group>
        )
      })}
    </group>
  )
}

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
        
        list.push({
          p0, p1, length, rotY0, rotY1, str1, str2
        })
      }
    })
    
    return list
  }, [aeroways])

  return (
    <group position={[0, 0.022, 0]}>
      {markings.map((rw, i) => {
        const keys = []
        for(let k=-5; k<=5; k++) {
          if (k===0) continue
          keys.push(
            <mesh key={`tk-${k}`} position={[k * 0.04, 0, -0.2]} rotation={[-Math.PI/2, 0, 0]}>
              <planeGeometry args={[0.02, 0.3]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
            </mesh>
          )
        }

        const tdzDistances = [1.5, 3.0, 4.5, 6.0]
        const tdz = []
        tdzDistances.forEach((d, idx) => {
          const blocks = idx === 1 ? [-0.2, -0.15, 0.15, 0.2] : (idx > 1 ? [-0.15, 0.15] : [-0.25, -0.2, 0.2, 0.25])
          blocks.forEach(b => {
            tdz.push(
              <mesh key={`tdz-${d}-${b}`} position={[b, 0, -d]} rotation={[-Math.PI/2, 0, 0]}>
                <planeGeometry args={[0.03, 0.25]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
              </mesh>
            )
          })
        })

        const centerlines = []
        const numDashes = Math.floor(rw.length / 0.5)
        for (let j = 4; j < numDashes - 4; j += 2) {
           centerlines.push(
             <mesh key={`cl-${j}`} position={[0, 0, -j * 0.5]} rotation={[-Math.PI/2, 0, 0]}>
               <planeGeometry args={[0.015, 0.3]} />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
             </mesh>
           )
        }
        
        return (
          <group key={`rw-${i}`}>
            <group position={rw.p0} rotation={[0, rw.rotY0, 0]}>
              {keys}
              {tdz}
              {centerlines}
              <RunwayText str={rw.str1} position={[0, 0, -0.7]} />
            </group>

            <group position={rw.p1} rotation={[0, rw.rotY1, 0]}>
              {keys}
              {tdz}
              <RunwayText str={rw.str2} position={[0, 0, -0.7]} />
            </group>
          </group>
        )
      })}
    </group>
  )
}
