'use client'

import React, { useState, useMemo, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'

// Core & Environment
import { useWeather } from './core/useWeather'
import FlightManager from './core/FlightManager'
import EnvironmentLighting from './environment/EnvironmentLighting'
import RealYVRAirport from './environment/RealYVRAirport'

// Tower & Camera
import ATCTowerInterior from './tower/ATCTowerInterior'
import CameraController from './camera/CameraController'

// UI
import ControlPanel from './ui/ControlPanel'
import TelemetryHUD from './ui/TelemetryHUD'
import Loader from './ui/Loader'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) {
    console.error("Caught by ErrorBoundary:", error, errorInfo);
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: 'black', padding: '20px', fontFamily: 'monospace', height: '100vh', width: '100vw', overflow: 'auto' }}>
          <h2>Something crashed!</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>{this.state.error && this.state.error.toString()}</summary>
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [useMetric, setUseMetric] = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)
  const [resetCamera, setResetCamera] = useState(0)
  const [cameraMode, setCameraMode] = useState('GLOBAL')
  const [chaseViewIndex, setChaseViewIndex] = useState(0)
  const [flights, setFlights] = useState([])
  const [showOpsPanel, setShowOpsPanel] = useState(false)

  const weather = useWeather();
  const activeRunways = useMemo(() => {
    const activeTraffic = flights.find(f => f.status === 'ON FINAL APPROACH' || f.status === 'CLIMBING OUT');
    if (activeTraffic) {
      if (activeTraffic.heading > 30 && activeTraffic.heading < 150) return '08L / 08R (East)';
      if (activeTraffic.heading > 210 && activeTraffic.heading < 330) return '26L / 26R (West)';
    }
    if (weather) {
      if (weather.winddirection > 30 && weather.winddirection < 150) return '08L / 08R (East)';
      return '26L / 26R (West)';
    }
    return 'CALCULATING...';
  }, [flights, weather]);

  const inboundFlights = useMemo(() => flights.filter(f => f.status === 'ON FINAL APPROACH' || f.status === 'DESCENDING'), [flights]);
  const outboundFlights = useMemo(() => flights.filter(f => f.status === 'CLIMBING OUT' || f.status === 'CLIMBING' || f.status === 'TAXIING'), [flights]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (key === 'c' && selectedAircraft && cameraMode === 'GLOBAL') {
        setChaseViewIndex(prev => (prev + 1) % 5)
      } else if (key === 'x' && selectedAircraft) {
        setSelectedAircraft(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAircraft, cameraMode])

  useEffect(() => {
    setChaseViewIndex(0)
  }, [selectedAircraft])

  return (
    <ErrorBoundary>
      <ControlPanel 
        showRoutes={showRoutes} setShowRoutes={setShowRoutes}
        cameraMode={cameraMode} setCameraMode={setCameraMode}
        useMetric={useMetric} setUseMetric={setUseMetric}
        showOpsPanel={showOpsPanel} setShowOpsPanel={setShowOpsPanel}
        weather={weather} activeRunways={activeRunways}
        inboundFlights={inboundFlights} outboundFlights={outboundFlights}
        setSelectedAircraft={setSelectedAircraft} setResetCamera={setResetCamera}
      />

      <Canvas gl={{ logarithmicDepthBuffer: true }} style={{ background: '#020202' }}>
        <PerspectiveCamera makeDefault position={[-11, 10, -15]} near={0.001} far={2000} fov={85} />
        
        <CameraController cameraMode={cameraMode} selectedAircraftId={selectedAircraft?.id} resetTrigger={resetCamera} chaseViewIndex={chaseViewIndex} />
        <EnvironmentLighting />
        
        <Suspense fallback={<Loader />}>
          <RealYVRAirport />
          <FlightManager 
            useMetric={useMetric} 
            onSelect={setSelectedAircraft} 
            selectedAircraft={selectedAircraft}
            showRoutes={showRoutes}
            onFlightsUpdate={setFlights}
          />
          {cameraMode === 'TOWER' && !selectedAircraft && (
            <ATCTowerInterior weather={weather} activeRunways={activeRunways} inboundFlights={inboundFlights} outboundFlights={outboundFlights} flights={flights} onSelect={setSelectedAircraft} />
          )}
        </Suspense>
      </Canvas>

      {!showOpsPanel && <TelemetryHUD aircraft={selectedAircraft} onClose={() => setSelectedAircraft(null)} useMetric={useMetric} chaseViewIndex={chaseViewIndex} />}

      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 1; box-shadow: 0 0 10px #ff0044; }
          50% { opacity: 0.5; box-shadow: 0 0 2px #ff0044; }
          100% { opacity: 1; box-shadow: 0 0 10px #ff0044; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </ErrorBoundary>
  )
}