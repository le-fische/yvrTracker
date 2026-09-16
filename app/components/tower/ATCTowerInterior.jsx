'use client'

import * as THREE from 'three'
import { Text, Edges } from '@react-three/drei'
import { 
  ConsoleMachine, 
  RadarMonitor, 
  TargetLockMonitor, 
  CommsMonitor, 
  RunwayMonitor, 
  TimeMonitor, 
  FlightSearchMonitor 
} from './TowerMonitors'

export default function ATCTowerInterior({ weather, activeRunways, inboundFlights, outboundFlights, flights, onSelect }) {
  return (
    <group position={[4.06, 0.7, -0.25]} scale={1.8}>
      {/* Floor */}
      <mesh position={[0, -0.015, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.001, 16]} />
        <meshStandardMaterial color="#050a10" roughness={0.9} />
        <Edges color="#00ffcc" transparent opacity={0.2} />
      </mesh>
      
      {/* Ceiling */}
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.001, 16]} />
        <meshStandardMaterial color="#03060a" roughness={0.9} />
        <Edges color="#00ffcc" transparent opacity={0.2} />
      </mesh>

      {/* Center Stairwell Hub */}
      <mesh position={[0, -0.015, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.015, 16]} />
        <meshStandardMaterial color="#080f15" roughness={0.8} />
      </mesh>

      {/* 360 Wrap-around Flat Desk Ring */}
      <mesh position={[0, -0.011, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.0005, 16, 1, true]} />
        <meshStandardMaterial color="#1a2b3c" roughness={0.6} side={THREE.DoubleSide} />
        <Edges color="#00ffcc" transparent opacity={0.4} />
      </mesh>

      {/* 360 Window Struts */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.022, 0, Math.sin(angle) * 0.022]} rotation={[0, -angle, 0]}>
            <boxGeometry args={[0.001, 0.03, 0.001]} />
            <meshStandardMaterial color="#112233" metalness={0.8} roughness={0.2} />
          </mesh>
        )
      })}

      {/* 360 Slanted Monitor Bay Consoles */}
      <group position={[0, 0, 0]}>
        {/* Monitor 1: Radar/Ops (Center) */}
        <ConsoleMachine position={[0, -0.01, -0.014]} rotation={[0, 0, 0]}>
          <Text position={[-0.004, 0.002, 0]} fontSize={0.0005} color="#00ffcc" anchorX="left" anchorY="top">YVR OPERATIONS</Text>
          <Text position={[-0.004, 0.0008, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">ACTIVE RUNWAYS</Text>
          <Text position={[-0.004, 0.0003, 0]} fontSize={0.0008} color="#fff" anchorX="left" anchorY="top">{activeRunways || 'SCANNING...'}</Text>
          <Text position={[-0.004, -0.001, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">TOWER STATUS</Text>
          <Text position={[-0.004, -0.0015, 0]} fontSize={0.0004} color="#00ffcc" anchorX="left" anchorY="top">LIVE TELEMETRY</Text>
        </ConsoleMachine>

        {/* Monitor 2: Weather (Left) */}
        <ConsoleMachine position={[-0.01, -0.01, -0.01]} rotation={[0, Math.PI / 4, 0]}>
          <Text position={[-0.004, 0.002, 0]} fontSize={0.0005} color="#00ffcc" anchorX="left" anchorY="top">METAR DATA</Text>
          {weather ? (
            <group>
              <Text position={[-0.004, 0.0005, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">TEMPERATURE</Text>
              <Text position={[-0.004, 0, 0]} fontSize={0.0006} color="#fff" anchorX="left" anchorY="top">{weather.temperature}°C</Text>
              <Text position={[-0.004, -0.001, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">WIND SPEED</Text>
              <Text position={[-0.004, -0.0015, 0]} fontSize={0.0005} color="#00ffcc" anchorX="left" anchorY="top">{weather.windspeed} km/h</Text>
              <Text position={[0.001, -0.001, 0]} fontSize={0.00025} color="#888" anchorX="left" anchorY="top">DIRECTION</Text>
              <Text position={[0.001, -0.0015, 0]} fontSize={0.0005} color="#00ffcc" anchorX="left" anchorY="top">{weather.winddirection}°</Text>
            </group>
          ) : (
            <Text position={[-0.004, 0.0005, 0]} fontSize={0.0003} color="#888" anchorX="left" anchorY="top">FETCHING...</Text>
          )}
        </ConsoleMachine>

        {/* Monitor 3: Interactive Flight Search (Right) */}
        <ConsoleMachine position={[0.01, -0.01, -0.01]} rotation={[0, -Math.PI / 4, 0]}>
          <FlightSearchMonitor flights={flights} onSelect={onSelect} />
        </ConsoleMachine>

        {/* Active Console Suite Ring */}
        <ConsoleMachine position={[0.014, -0.01, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <TimeMonitor />
        </ConsoleMachine>
        
        <ConsoleMachine position={[-0.014, -0.01, 0]} rotation={[0, Math.PI / 2, 0]}>
          <RunwayMonitor />
        </ConsoleMachine>
        
        <ConsoleMachine position={[0.01, -0.01, 0.01]} rotation={[0, -Math.PI * 0.75, 0]}>
          <CommsMonitor />
        </ConsoleMachine>
        
        <ConsoleMachine position={[-0.01, -0.01, 0.01]} rotation={[0, Math.PI * 0.75, 0]}>
          <TargetLockMonitor flights={flights} />
        </ConsoleMachine>
        
        <ConsoleMachine position={[0, -0.01, 0.014]} rotation={[0, Math.PI, 0]}>
          <RadarMonitor flights={flights} />
        </ConsoleMachine>
      </group>
    </group>
  )
}
