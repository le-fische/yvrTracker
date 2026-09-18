'use client'

import { useRef, useEffect, useState, useMemo, memo, Suspense, useContext } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { getPosition, SCALE } from '../core/constants'
import GLTFAircraft from './GLTFAircraft'
import { formatAltitude, formatSpeed } from '../core/units'
import { TimeOfDayContext } from '../core/TimeOfDayContext'

const PLAYBACK_DELAY_MS = 2500;
const BUFFER_SIZE = 6;
const TRAIL_POINTS = 20;

const LiveAircraft = memo(function LiveAircraft({ flight, showRoutes, onClick, isSelected, useMetric }) {
  const planeRef = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const { isNight } = useContext(TimeOfDayContext)

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
  const trailPositions = useRef(new Float32Array(TRAIL_POINTS * 3));
  const trailColorsArr = useRef(new Float32Array(TRAIL_POINTS * 3));
  const trailCount = useRef(0);
  const lastTrailTime = useRef(0);
  const geomRef = useRef();

  useEffect(() => {
    const newPos = getClampedPos(flight.latitude, flight.longitude, flight.altitude);
    const now = performance.now();
    
    bufferRef.current.push({
      time: now,
      pos: new THREE.Vector3(...newPos),
      heading: THREE.MathUtils.degToRad(flight.heading),
      velocity: flight.velocity
    });

    if (bufferRef.current.length > BUFFER_SIZE) {
      bufferRef.current.shift();
    }
  }, [flight.latitude, flight.longitude, flight.altitude, flight.heading, flight.velocity]);

  useFrame((state, delta) => {
    if (!planeRef.current) return;

    const renderTime = performance.now() - PLAYBACK_DELAY_MS; 
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
      const t = (renderTime - p0.time) / (p1.time - p0.time);
      planeRef.current.position.lerpVectors(p0.pos, p1.pos, t);
      
      let diff = p1.heading - p0.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      planeRef.current.rotation.y = -(p0.heading + diff * t);
    } else {
      if (renderTime > buffer[buffer.length - 1].time) {
        const last = buffer[buffer.length - 1];
        const dtSeconds = (renderTime - last.time) / 1000;
        
        const moveDist = (last.velocity / 100) * dtSeconds;
        
        const nextPos = last.pos.clone();
        nextPos.x += Math.sin(last.heading) * moveDist;
        nextPos.z += -Math.cos(last.heading) * moveDist;
        
        planeRef.current.position.copy(nextPos);
        planeRef.current.rotation.y = -last.heading;
      } else {
        planeRef.current.position.copy(buffer[0].pos);
        planeRef.current.rotation.y = -buffer[0].heading;
      }
    }

    if (!showRoutes) return;

    const now = performance.now();
    if (now - lastTrailTime.current > 200) {
      lastTrailTime.current = now;
      
      const count = trailCount.current;
      const pts = trailPositions.current;
      const cols = trailColorsArr.current;

      const currentPos = planeRef.current.position;
      const shouldAdd = count === 0 || 
          Math.hypot(currentPos.x - pts[(count-1)*3], currentPos.y - pts[(count-1)*3+1], currentPos.z - pts[(count-1)*3+2]) > 0.001;

      if (shouldAdd) {
        if (count >= TRAIL_POINTS) {
          pts.copyWithin(0, 3, TRAIL_POINTS * 3);
          cols.copyWithin(0, 3, TRAIL_POINTS * 3);
          trailCount.current = TRAIL_POINTS - 1;
        }

        const idx = trailCount.current * 3;
        pts[idx] = currentPos.x;
        pts[idx + 1] = currentPos.y;
        pts[idx + 2] = currentPos.z;

        const altMeters = (currentPos.y / SCALE) * 1000;
        const altRatio = Math.max(0, Math.min(1, altMeters / 12000));
        const c = new THREE.Color().setHSL(0.6 - (altRatio * 0.6), 1, 0.5);
        cols[idx] = c.r;
        cols[idx + 1] = c.g;
        cols[idx + 2] = c.b;

        trailCount.current++;

        if (geomRef.current) {
          geomRef.current.attributes.position.needsUpdate = true;
          geomRef.current.attributes.color.needsUpdate = true;
        }
      }
    }

    if (geomRef.current) {
      geomRef.current.setDrawRange(0, trailCount.current);
    }
  });

  const [initialPos] = useState(() => {
    const pos = getClampedPos(flight.latitude, flight.longitude, flight.altitude);
    return pos;
  })

  // Dynamic model mapping based on ICAO type
  const modelPath = useMemo(() => {
    const t = (flight.type || '').toUpperCase()
    const cat = flight.category
    
    // Tier 1: Exact/prefix ICAO type match
    if (cat === 'A7' || (t.startsWith('H') && t.length === 4)) return '/models/heli.glb'
    if (t === 'S76' || t === 'B06' || t === 'AS50' || t === 'EC30') return '/models/heli.glb'

    if (t.startsWith('A318')) return '/models/a318.glb'
    if (t.startsWith('A319') || t === 'A19N') return '/models/a319.glb'
    if (t.startsWith('A320') || t === 'A32' || t === 'A20N') return '/models/a320.glb'
    if (t.startsWith('A321') || t === 'A21N') return '/models/a321.glb'
    if (t.startsWith('A332') || t.startsWith('A33')) return '/models/a332.glb'
    if (t.startsWith('A333')) return '/models/a333.glb'
    if (t.startsWith('A343') || t.startsWith('A34')) return '/models/a343.glb'
    if (t.startsWith('A346')) return '/models/a346.glb'
    if (t.startsWith('A359') || t.startsWith('A35')) return '/models/a359.glb'
    if (t.startsWith('A380') || t.startsWith('A38')) return '/models/a380.glb'
    
    if (t.startsWith('B736') || t === 'B37M') return '/models/b736.glb'
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
    if (t.startsWith('E19') || t === 'E290' || t === 'E295') return '/models/e190.glb'
    if (t.startsWith('AT4') || t.startsWith('ATR') || t.startsWith('B190') || t.startsWith('BE') || t === 'B350') return '/models/atr42.glb'
    if (t.startsWith('BCS1') || t === 'A221') return '/models/cs100.glb'
    if (t.startsWith('BCS3') || t.startsWith('BCS') || t === 'A223') return '/models/cs300.glb'
    if (t.startsWith('DH8D') || t === 'Q400' || t.startsWith('DH8') || t === 'C208') return '/models/q400.glb'
    if (t.startsWith('PA28') || t.startsWith('P28') || t.startsWith('C1') || t.startsWith('C20') || t === 'C210' || t === 'PC12') return '/models/pa28.glb' 
    if (t.startsWith('C2') || t.startsWith('C5') || t.startsWith('C6') || t.startsWith('C7') || t.startsWith('GLF') || t.startsWith('FA') || t.startsWith('E5') || t === 'CL30' || t === 'CL35' || t === 'CL60' || t === 'GLEX' || t === 'GL7T') return '/models/citation.glb' 
    if (t === 'A3ST') return '/models/beluga.glb'
    if (t.startsWith('RJ') || t.startsWith('BAE')) return '/models/bae146.glb'
    if (t.startsWith('ASK') || t.startsWith('GLID')) return '/models/ask21.glb'
    if (t === 'A225') return '/models/an225.glb'
    
    // Inferred String Fallbacks
    if (t === 'LIGHT AIRCRAFT' || t === 'HIGH PERFORMANCE') return '/models/pa28.glb'
    if (t === 'SMALL COMMUTER') return '/models/q400.glb'
    if (t === 'LARGE JET' || t === 'HIGH VORTEX JET') return '/models/b738.glb'
    if (t === 'HEAVY JET') return '/b777_final.glb'
    if (t === 'HELICOPTER') return '/models/heli.glb'
    
    // Tier 2: Category Fallback
    if (cat === 'A1') return '/models/pa28.glb'
    if (cat === 'A2') return '/models/q400.glb'
    if (cat === 'A3') return '/models/b738.glb'
    if (cat === 'A4') return '/models/b763.glb'
    if (cat === 'A5') return '/models/b773.glb'
    if (cat === 'A6') return '/models/citation.glb'
    if (cat === 'A7') return '/models/heli.glb'

    // Tier 3: Final Default
    return '/b777_final.glb'
  }, [flight.type, flight.callsign, flight.category])

  return (
    <group>
      <group ref={planeRef} position={initialPos} onClick={(e) => { e.stopPropagation(); onClick && onClick(flight); }}>
        <mesh visible={false}><sphereGeometry args={[1.5]} /><meshBasicMaterial /></mesh>

        <Suspense fallback={null}>
          <GLTFAircraft modelPath={modelPath} scale={0.01} position={[0, -0.05, 0]} isNight={isNight} />
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
                  <div style={{ color: '#aaa' }}>{formatAltitude(flight.altitude, useMetric).value} {formatAltitude(flight.altitude, useMetric).unit}</div>
                  <div style={{ fontSize: '9px', color: '#aaa' }}>{formatSpeed(flight.velocity, useMetric).value} {formatSpeed(flight.velocity, useMetric).unit}</div>
                </>
              )}
            </div>
          </Html>
        )}
      </group>
      
      {showRoutes && (
        <line>
          <bufferGeometry ref={geomRef}>
            <bufferAttribute
              attach="attributes-position"
              args={[trailPositions.current, 3]}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[trailColorsArr.current, 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial attach="material" vertexColors transparent opacity={isSelected ? 0.8 : 0.4} />
        </line>
      )}
    </group>
  )
})

export default LiveAircraft
