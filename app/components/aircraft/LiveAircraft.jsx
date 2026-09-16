'use client'

import { useRef, useEffect, useState, useMemo, memo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Html } from '@react-three/drei'
import * as THREE from 'three'
import { getPosition } from '../core/constants'
import GLTFAircraft from './GLTFAircraft'

const LiveAircraft = memo(function LiveAircraft({ flight, showRoutes, onClick, isSelected, useMetric }) {
  const planeRef = useRef()
  const [isHovered, setIsHovered] = useState(false)

  // Register plane reference for global camera tracking
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.aircraftRefs) window.aircraftRefs = {}
    if (planeRef.current) {
      window.aircraftRefs[flight.id] = planeRef.current
    }
    return () => {
      if (typeof window !== 'undefined' && window.aircraftRefs) {
        delete window.aircraftRefs[flight.id]
      }
    }
  }, [flight.id])

  const getClampedPos = (lat, lon, alt) => {
    const [x, y, z] = getPosition(lat, lon, alt)
    return [x, Math.max(y, 0.09), z] // Clamp so aircraft wheels sit on runway surface
  }
  
  const bufferRef = useRef([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const newPos = getClampedPos(flight.latitude, flight.longitude, flight.altitude);
    const now = performance.now();
    
    bufferRef.current.push({
      time: now,
      pos: new THREE.Vector3(...newPos),
      heading: THREE.MathUtils.degToRad(flight.heading),
      velocity: flight.velocity
    });

    if (bufferRef.current.length > 10) {
      bufferRef.current.shift();
    }
  }, [flight.latitude, flight.longitude, flight.altitude, flight.heading, flight.velocity]);

  // Sample actual rendered position every 1.5 seconds to build a smooth trail
  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        if (!planeRef.current) return prev;
        const pos = planeRef.current.position.clone();
        if (prev.length > 0) {
          const last = prev[prev.length - 1];
          if (last.distanceTo(pos) < 0.05) return prev;
        }
        const newHistory = [...prev, pos];
        if (newHistory.length > 80) newHistory.shift(); // keep last 2 mins
        return newHistory;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useFrame((state, delta) => {
    if (!planeRef.current) return;

    // Playback buffer: render everything 6.0 seconds in the past for perfect interpolation
    const renderTime = performance.now() - 6000; 
    const buffer = bufferRef.current;

    if (buffer.length === 0) return;

    let p0 = buffer[0];
    let p1 = buffer[buffer.length - 1];
    
    let found = false;
    for (let i = buffer.length - 1; i >= 1; i--) {
      if (buffer[i-1].time <= renderTime && buffer[i].time > renderTime) {
        p0 = buffer[i-1];
        p1 = buffer[i];
        found = true;
        break;
      }
    }

    if (found) {
      // Interpolate exactly between p0 and p1
      const t = (renderTime - p0.time) / (p1.time - p0.time);
      planeRef.current.position.lerpVectors(p0.pos, p1.pos, t);
      
      // Interpolate rotation
      let diff = p1.heading - p0.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      planeRef.current.rotation.y = -(p0.heading + diff * t);
    } else {
      // Out of bounds. Extrapolate or clamp.
      if (renderTime > buffer[buffer.length - 1].time) {
        // Extrapolate forward from the last known point using velocity
        const last = buffer[buffer.length - 1];
        const dtSeconds = (renderTime - last.time) / 1000;
        
        // velocity is in m/s, scale is 1 unit = 100 meters
        const moveDist = (last.velocity / 100) * dtSeconds;
        
        const nextPos = last.pos.clone();
        nextPos.x += Math.sin(last.heading) * moveDist;
        nextPos.z += -Math.cos(last.heading) * moveDist;
        
        planeRef.current.position.copy(nextPos);
        planeRef.current.rotation.y = -last.heading;
      } else {
        // RenderTime is before oldest point, just snap to it
        planeRef.current.position.copy(buffer[0].pos);
        planeRef.current.rotation.y = -buffer[0].heading;
      }
    }
  });

  const validHistory = useMemo(() => {
    const pts = history.map(p => [p.x, p.y, p.z])
    return pts.filter((p, i, arr) => {
      if (i === 0) return true
      const prev = arr[i - 1]
      const dist = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2])
      return dist > 0.001
    })
  }, [history])

  const trailColors = useMemo(() => {
    return validHistory.map(p => {
      // Inverse scale to get raw altitude in meters: y = (altitude / 1000) * 10
      const altMeters = (p[1] / 10) * 1000;
      const altRatio = Math.max(0, Math.min(1, altMeters / 12000)); // 0m to 12,000m
      const c = new THREE.Color();
      // Blue (0.6) near ground -> Green (0.3) mid -> Red (0.0) high
      c.setHSL(0.6 - (altRatio * 0.6), 1, 0.5);
      return [c.r, c.g, c.b];
    });
  }, [validHistory])

  const [initialPos] = useState(() => {
    const pos = getClampedPos(flight.latitude, flight.longitude, flight.altitude);
    return pos;
  })

  // Dynamic model mapping based on ICAO type
  const modelPath = useMemo(() => {
    const t = (flight.type || '').toUpperCase()
    
    if (flight.callsign && flight.callsign.includes('FALCON')) return '/models/millennium_falcon.gltf'
    if (flight.category === 'A7' || (t.startsWith('H') && t.length === 4)) return '/models/heli.glb'
    if (t.startsWith('A318')) return '/models/a318.glb'
    if (t.startsWith('A319')) return '/models/a319.glb'
    if (t.startsWith('A320') || t === 'A32') return '/models/a320.glb'
    if (t.startsWith('A321')) return '/models/a321.glb'
    if (t.startsWith('A332') || t.startsWith('A33')) return '/models/a332.glb'
    if (t.startsWith('A333')) return '/models/a333.glb'
    if (t.startsWith('A343') || t.startsWith('A34')) return '/models/a343.glb'
    if (t.startsWith('A346')) return '/models/a346.glb'
    if (t.startsWith('A359') || t.startsWith('A35')) return '/models/a359.glb'
    if (t.startsWith('A380') || t.startsWith('A38')) return '/models/a380.glb'
    
    if (t.startsWith('B736')) return '/models/b736.glb'
    if (t.startsWith('B737')) return '/models/b737.glb'
    if (t.startsWith('B738') || t.startsWith('B38')) return '/models/b738.glb'
    if (t.startsWith('B739') || t.startsWith('B39')) return '/models/b739.glb'
    if (t.startsWith('B73')) return '/models/b738.glb'
    if (t.startsWith('B744') || t.startsWith('B74')) return '/models/b744.glb'
    if (t.startsWith('B748')) return '/models/b748.glb'
    if (t.startsWith('B752') || t.startsWith('B75')) return '/models/b752.glb'
    if (t.startsWith('B753')) return '/models/b753.glb'
    if (t.startsWith('B762')) return '/models/b762.glb'
    if (t.startsWith('B763') || t.startsWith('B76')) return '/models/b763.glb'
    if (t.startsWith('B764')) return '/models/b764.glb'
    if (t.startsWith('B772')) return '/models/b772.glb'
    if (t.startsWith('B773') || t.startsWith('B77') || t === 'B77W') return '/models/b773.glb'
    if (t.startsWith('B788')) return '/models/b788.glb'
    if (t.startsWith('B789') || t.startsWith('B78')) return '/models/b789.glb'
    
    if (t.startsWith('CRJ7')) return '/models/crj700.glb'
    if (t.startsWith('CRJ')) return '/models/crj900.glb'
    if (t.startsWith('E17') || t.startsWith('E75')) return '/models/e170.glb'
    if (t.startsWith('E19') || t.startsWith('E19')) return '/models/e190.glb'
    if (t.startsWith('AT4') || t.startsWith('ATR') || t.startsWith('B190') || t.startsWith('BE')) return '/models/atr42.glb'
    if (t.startsWith('BCS1')) return '/models/cs100.glb'
    if (t.startsWith('BCS3') || t.startsWith('BCS')) return '/models/cs300.glb'
    if (t.startsWith('DH8D') || t === 'Q400' || t.startsWith('DH8')) return '/models/q400.glb'
    if (t.startsWith('PA28') || t.startsWith('P28') || t.startsWith('C1') || t.startsWith('C20')) return '/models/pa28.glb' 
    if (t.startsWith('C2') || t.startsWith('C5') || t.startsWith('C6') || t.startsWith('C7') || t.startsWith('GLF') || t.startsWith('FA') || t.startsWith('E5')) return '/models/citation.glb' 
    if (t === 'A3ST') return '/models/beluga.glb'
    if (t.startsWith('RJ') || t.startsWith('BAE')) return '/models/bae146.glb'
    if (t.startsWith('ASK') || t.startsWith('GLID')) return '/models/ask21.glb'
    if (t === 'A225') return '/models/an225.gltf'
    
    // Inferred Category Fallbacks
    if (t === 'LIGHT AIRCRAFT' || t === 'HIGH PERFORMANCE') return '/models/pa28.glb'
    if (t === 'SMALL COMMUTER') return '/models/q400.glb'
    if (t === 'LARGE JET' || t === 'HIGH VORTEX JET') return '/models/b738.glb'
    if (t === 'HEAVY JET') return '/b777_final.glb'
    if (t === 'HELICOPTER') return '/models/heli.glb'
    
    return '/b777_final.glb'
  }, [flight.type, flight.callsign, flight.category])

  return (
    <group>
      <group ref={planeRef} position={initialPos} onClick={(e) => { e.stopPropagation(); onClick && onClick(flight); }}>
        <mesh visible={false}><sphereGeometry args={[1.5]} /><meshBasicMaterial /></mesh>

        <Suspense fallback={null}>
          <GLTFAircraft modelPath={modelPath} scale={0.01} position={[0, -0.05, 0]} isNight={typeof window !== 'undefined' ? window.isNightTime : false} />
        </Suspense>
        
        {!isSelected && (
          <Html position={[0.4, 0.1, 0]} zIndexRange={[0, 0]} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
            <div 
              onClick={(e) => { e.stopPropagation(); onClick && onClick(flight); }} 
              onPointerOver={() => setIsHovered(true)}
              onPointerOut={() => setIsHovered(false)}
              style={{ 
                color: '#00ffcc', 
                fontFamily: 'monospace', 
                fontSize: '11px', 
                whiteSpace: 'nowrap', 
                userSelect: 'none', 
                textShadow: '0 0 2px black', 
                background: isHovered ? 'rgba(0,40,80,0.8)' : 'transparent', 
                padding: '4px 8px', 
                borderRadius: '2px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'all 0.2s ease',
                backdropFilter: isHovered ? 'blur(4px)' : 'none',
                position: 'relative'
              }}
            >
              <div style={{ color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{flight.callsign}</span> 
                <span style={{ color: '#aaa', fontSize: '10px', fontWeight: 'normal' }}>
                  {flight.type || 'UNK'}
                </span>
              </div>
              {isHovered && (
                <>
                  <div style={{ color: '#aaa' }}>{useMetric ? Math.round(flight.altitude) : Math.round(flight.altitude * 3.28084)} {useMetric ? 'm' : 'ft'}</div>
                  <div style={{ fontSize: '9px', color: '#aaa' }}>{useMetric ? Math.round(flight.velocity * 3.6) : Math.round(flight.velocity * 1.94384)} {useMetric ? 'km/h' : 'kts'}</div>
                </>
              )}
            </div>
          </Html>
        )}
      </group>
      
      {showRoutes && validHistory.length > 1 && (
        <Line points={validHistory} vertexColors={trailColors} lineWidth={isSelected ? 3 : 2} transparent opacity={isSelected ? 0.8 : 0.4} />
      )}
    </group>
  )
})

export default LiveAircraft
