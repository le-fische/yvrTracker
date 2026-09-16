'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'

export function ConsoleMachine({ position, rotation, children, empty }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 5, 0, 0]}>
        <boxGeometry args={[0.01, 0.006, 0.001]} />
        <meshStandardMaterial color="#111822" roughness={0.7} metalness={0.4} />
        
        <mesh position={[0, 0, 0.00051]}>
          <planeGeometry args={[0.009, 0.005]} />
          <meshBasicMaterial color="#02050A" />
          
          <group position={[0, 0, 0.0001]}>
            {empty ? (
              <Text position={[0,0,0]} fontSize={0.0004} color="#112233" letterSpacing={0.1}>SYSTEM STANDBY</Text>
            ) : children}
          </group>
        </mesh>
      </mesh>
    </group>
  )
}

export function RadarMonitor({ flights }) {
  const sweepRef = useRef()
  const blipsRef = useRef()
  const YVR_LAT = 49.1939;
  const YVR_LON = -123.1840;
  const maxRadius = 0.002;
  
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (sweepRef.current) {
      sweepRef.current.rotation.z = -t * 2 
    }
  })

  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0003} color="#00ffcc" anchorX="left" anchorY="top">ACTIVE RADAR</Text>
      <group position={[0, -0.0005, 0]}>
        <mesh><ringGeometry args={[0.0009, 0.001, 32]} /><meshBasicMaterial color="#00ffcc" transparent opacity={0.1} /></mesh>
        <mesh><ringGeometry args={[0.0019, 0.002, 32]} /><meshBasicMaterial color="#00ffcc" transparent opacity={0.3} /></mesh>
        
        <group ref={sweepRef}>
          <mesh position={[0.001, 0, 0]}>
            <planeGeometry args={[0.002, 0.00005]} />
            <meshBasicMaterial color="#00ffcc" transparent opacity={0.8} />
          </mesh>
        </group>
        
        <group ref={blipsRef}>
          {flights && flights.map(f => {
            const dx = (f.longitude - YVR_LON) * 73; 
            const dy = (f.latitude - YVR_LAT) * 111; 
            const scale = maxRadius / 150; 
            const rx = dx * scale;
            const ry = dy * scale;
            if (Math.sqrt(rx*rx + ry*ry) > maxRadius) return null;
            return (
              <mesh key={f.id} position={[rx, ry, 0.0001]}>
                <circleGeometry args={[0.00006, 8]} />
                <meshBasicMaterial color="#fff" />
              </mesh>
            )
          })}
        </group>
      </group>
    </group>
  )
}

export function TargetLockMonitor({ flights }) {
  const closest = useMemo(() => {
    if (!flights || flights.length === 0) return null;
    return flights.slice().sort((a,b) => {
      const distA = Math.hypot(a.latitude - 49.1939, a.longitude - -123.1840)
      const distB = Math.hypot(b.latitude - 49.1939, b.longitude - -123.1840)
      return distA - distB
    })[0]
  }, [flights])

  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0004} color="#ff0044" anchorX="left" anchorY="top">TARGET LOCK</Text>
      {closest ? (
        <group>
          <Text position={[-0.004, 0.0008, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">PRIMARY TARGET</Text>
          <Text position={[-0.004, 0.0003, 0]} fontSize={0.0006} color="#fff" anchorX="left" anchorY="top">{closest.callsign}</Text>
          
          <Text position={[-0.004, -0.0005, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">ALTITUDE</Text>
          <Text position={[-0.004, -0.001, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">{Math.round(closest.altitude)} ft</Text>
          
          <Text position={[0.001, -0.0005, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">GROUND SPD</Text>
          <Text position={[0.001, -0.001, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">{Math.round(closest.velocity)} kts</Text>
        </group>
      ) : (
        <Text position={[-0.004, 0.0005, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">NO TARGETS</Text>
      )}
    </group>
  )
}

export function CommsMonitor() {
  const waveRef = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (waveRef.current) {
      const positions = waveRef.current.geometry.attributes.position.array
      for (let i = 0; i < 64; i++) {
        const x = (i / 64) * 0.008 - 0.004
        const y = Math.sin(x * 2000 + t * 10) * Math.cos(x * 1000 + t * 5) * 0.0005
        positions[i * 3] = x
        positions[i * 3 + 1] = y
        positions[i * 3 + 2] = 0
      }
      waveRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">COMMUNICATIONS</Text>
      <Text position={[-0.004, 0.0008, 0]} fontSize={0.0003} color="#fff" anchorX="left" anchorY="top">TWR 118.70</Text>
      <Text position={[-0.004, 0.0003, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">GND 121.70</Text>
      <Text position={[-0.004, -0.0002, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">APP 126.12</Text>
      <group position={[0, -0.0015, 0]}>
        <line ref={waveRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={64} array={new Float32Array(64 * 3)} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color="#00ffcc" />
        </line>
      </group>
    </group>
  )
}

export function RunwayMonitor() {
  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">ILS STATUS</Text>
      <group position={[0, -0.0005, 0]}>
        <mesh position={[0, 0.001, 0]}><planeGeometry args={[0.006, 0.0001]} /><meshBasicMaterial color="#555" /></mesh>
        <Text position={[-0.0035, 0.001, 0]} fontSize={0.0003} color="#00ffcc" anchorX="right" anchorY="middle">08L</Text>
        <Text position={[0.0035, 0.001, 0]} fontSize={0.0003} color="#00ffcc" anchorX="left" anchorY="middle">26R</Text>
        <mesh position={[0, -0.001, 0]}><planeGeometry args={[0.006, 0.0001]} /><meshBasicMaterial color="#555" /></mesh>
        <Text position={[-0.0035, -0.001, 0]} fontSize={0.0003} color="#00ffcc" anchorX="right" anchorY="middle">08R</Text>
        <Text position={[0.0035, -0.001, 0]} fontSize={0.0003} color="#00ffcc" anchorX="left" anchorY="middle">26L</Text>
      </group>
    </group>
  )
}

export function TimeMonitor() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const int = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(int)
  }, [])
  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">GLOBAL COORD</Text>
      <Text position={[-0.004, 0.0005, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">ZULU (UTC)</Text>
      <Text position={[-0.004, 0, 0]} fontSize={0.0006} color="#fff" anchorX="left" anchorY="top">{time.toISOString().substr(11, 8)}</Text>
      <Text position={[-0.004, -0.001, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">LOCAL (YVR)</Text>
      <Text position={[-0.004, -0.0015, 0]} fontSize={0.0005} color="#00ffcc" anchorX="left" anchorY="top">{time.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Vancouver' })}</Text>
    </group>
  )
}

export function FlightSearchMonitor({ flights, onSelect }) {
  const [searchTerm, setSearchTerm] = useState('')
  
  const filtered = useMemo(() => {
    if (!flights) return [];
    if (!searchTerm) return flights.slice(0, 10);
    return flights.filter(f => f.callsign.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 10)
  }, [flights, searchTerm])

  return (
    <group>
      <Text position={[-0.004, 0.002, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">FLIGHT SEARCH</Text>
      
      <Html 
        transform 
        position={[0, -0.0007, 0.0001]} 
        scale={0.00008}
        zIndexRange={[0, 0]}
      >
        <div style={{
          width: '100px', height: '60px', 
          background: 'transparent',
          color: '#00ffcc',
          fontFamily: 'monospace',
          fontSize: '5px',
          display: 'flex', flexDirection: 'column'
        }} onPointerDown={(e) => e.stopPropagation()}>
          <input 
            type="text" 
            placeholder="SEARCH CALLSIGN..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
               background: 'rgba(0, 255, 204, 0.1)',
               border: '0.5px solid rgba(0, 255, 204, 0.5)',
               color: 'white',
               fontSize: '5px',
               padding: '2px',
               marginBottom: '2px',
               outline: 'none',
               width: '100%',
               boxSizing: 'border-box'
            }}
          />
          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '1px' }}>
             {filtered.map(f => (
               <div 
                 key={f.id}
                 onClick={() => onSelect(f)}
                 style={{
                   display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                   padding: '2px 1px', cursor: 'pointer',
                   borderBottom: '0.2px solid rgba(255,255,255,0.1)'
                 }}
                 onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,204,0.3)'}
                 onMouseOut={e => e.currentTarget.style.background = 'transparent'}
               >
                 <span style={{ fontWeight: 'bold' }}>{f.callsign}</span>
                 <span style={{ color: 'white', fontSize: '4px' }}>{f.type}</span>
               </div>
             ))}
             {filtered.length === 0 && (
               <div style={{ color: '#888', textAlign: 'center', marginTop: '4px' }}>NO MATCHES</div>
             )}
          </div>
        </div>
      </Html>
    </group>
  )
}
