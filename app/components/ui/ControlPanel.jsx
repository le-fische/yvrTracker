'use client'

import { MapPin, X } from 'lucide-react'

export default function ControlPanel({ 
  showRoutes, setShowRoutes, 
  cameraMode, setCameraMode, 
  useMetric, setUseMetric, 
  showOpsPanel, setShowOpsPanel,
  weather, activeRunways, inboundFlights, outboundFlights,
  setSelectedAircraft, setResetCamera
}) {
  return (
    <>
      <div style={{
        position: 'absolute', top: 24, left: 24, zIndex: 10,
        background: 'rgba(5, 15, 25, 0.75)',
        border: '1px solid rgba(0,255,204,0.3)', borderRadius: '12px',
        padding: '20px', color: '#00ffcc', fontFamily: 'monospace',
        backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '300px'
      }}>
        {/* Branding */}
        <div style={{ borderBottom: '1px solid rgba(0,255,204,0.2)', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff0044', boxShadow: '0 0 10px #ff0044', animation: 'pulse 2s infinite' }}></div>
            <h1 style={{ margin: 0, fontSize: '20px', textTransform: 'uppercase', letterSpacing: '2px', color: 'white', textShadow: '0 0 8px rgba(255,255,255,0.4)' }}>YVR TRACKER</h1>
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>LIVE ADS-B TELEMETRY FEED</div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Toggle Routes */}
          <div 
            onClick={() => setShowRoutes(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: showRoutes ? 'white' : '#888', transition: 'color 0.2s' }}
          >
            <span>SHOW TRAILS</span>
            <div style={{ width: '40px', height: '20px', background: showRoutes ? '#00ffcc' : 'rgba(0,255,204,0.1)', borderRadius: '10px', position: 'relative', transition: 'background 0.3s' }}>
              <div style={{ width: '16px', height: '16px', background: showRoutes ? '#000' : '#888', borderRadius: '50%', position: 'absolute', top: '2px', left: showRoutes ? '22px' : '2px', transition: 'left 0.3s' }}></div>
            </div>
          </div>

          {/* Camera Mode Control */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '4px', gap: '4px' }}>
            <button 
              onClick={() => { setCameraMode('GLOBAL'); setSelectedAircraft(null); }}
              style={{ flex: 1, background: cameraMode === 'GLOBAL' ? '#00ffcc' : 'transparent', color: cameraMode === 'GLOBAL' ? '#000' : '#888', border: 'none', padding: '6px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              GLOBAL VIEW
            </button>
            <button 
              onClick={() => { setCameraMode('TOWER'); setSelectedAircraft(null); }}
              style={{ flex: 1, background: cameraMode === 'TOWER' ? '#00ffcc' : 'transparent', color: cameraMode === 'TOWER' ? '#000' : '#888', border: 'none', padding: '6px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              TOWER VIEW
            </button>
          </div>

          {/* Unit Segmented Control */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', padding: '4px', gap: '4px' }}>
            <button 
              onClick={() => setUseMetric(false)}
              style={{ flex: 1, background: !useMetric ? '#00ffcc' : 'transparent', color: !useMetric ? '#000' : '#888', border: 'none', padding: '6px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              IMPERIAL
            </button>
            <button 
              onClick={() => setUseMetric(true)}
              style={{ flex: 1, background: useMetric ? '#00ffcc' : 'transparent', color: useMetric ? '#000' : '#888', border: 'none', padding: '6px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}
            >
              METRIC
            </button>
          </div>

          <button 
            onClick={() => setShowOpsPanel(prev => !prev)}
            style={{ width: '100%', background: showOpsPanel ? '#00ffcc' : 'rgba(0,255,204,0.1)', color: showOpsPanel ? '#000' : '#00ffcc', border: '1px solid rgba(0,255,204,0.3)', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', transition: 'all 0.2s', marginTop: '4px' }}
          >
            AIRPORT OPS
          </button>
        </div>
      </div>

      {cameraMode === 'GLOBAL' && (
        <button 
          onClick={() => { setResetCamera(c => c + 1); setSelectedAircraft(null); }}
          style={{
            position: 'absolute', bottom: 24, left: 24, zIndex: 10,
            background: 'rgba(5, 15, 25, 0.75)', border: '1px solid rgba(0,255,204,0.3)',
            color: '#00ffcc', padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px',
            backdropFilter: 'blur(8px)', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,255,204,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(5, 15, 25, 0.75)'}
        >
          <MapPin size={16} /> RECENTER TOWER
        </button>
      )}

      {showOpsPanel && (
        <div style={{
          position: 'absolute', top: 24, right: 24, zIndex: 30,
          background: 'rgba(5, 15, 25, 0.9)', border: '1px solid rgba(0,255,204,0.3)',
          borderRadius: '12px', padding: '24px', color: '#00ffcc',
          fontFamily: 'monospace', width: '320px', backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,255,204,0.3)', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '20px', letterSpacing: '1px' }}>AIRPORT OPS</h3>
            <button onClick={() => setShowOpsPanel(false)} style={{ background: 'none', border: 'none', color: '#00ffcc', cursor: 'pointer' }}><X size={20} /></button>
          </div>

          <div style={{ background: 'rgba(0,255,204,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(0,255,204,0.1)' }}>
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>LIVE WEATHER (YVR)</div>
            {weather ? (
              <>
                <div style={{ fontSize: '16px', color: 'white', fontWeight: 'bold' }}>{weather.temperature}°C</div>
                <div style={{ fontSize: '13px', color: '#aaa', marginTop: '4px' }}>WIND: {weather.windspeed} km/h @ {weather.winddirection}°</div>
              </>
            ) : <div style={{ color: '#888' }}>FETCHING...</div>}
          </div>

          <div style={{ background: 'rgba(0,255,204,0.05)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(0,255,204,0.1)' }}>
            <div style={{ color: '#888', fontSize: '11px', marginBottom: '4px' }}>ACTIVE RUNWAYS (AUTO-INFERRED)</div>
            <div style={{ fontSize: '20px', color: '#00ffcc', fontWeight: 'bold' }}>{activeRunways}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ color: '#888', fontSize: '11px', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '8px', fontWeight: 'bold' }}>INBOUND ({inboundFlights.length})</div>
              {inboundFlights.length === 0 ? <div style={{ color: '#555', fontSize: '12px' }}>NONE</div> : inboundFlights.slice(0, 8).map(f => (
                <div key={f.id} style={{ fontSize: '12px', color: 'white', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.callsign}</span>
                  <span style={{ color: '#00ffcc' }}>{f.type}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: '#888', fontSize: '11px', borderBottom: '1px solid #333', paddingBottom: '6px', marginBottom: '8px', fontWeight: 'bold' }}>OUTBOUND ({outboundFlights.length})</div>
              {outboundFlights.length === 0 ? <div style={{ color: '#555', fontSize: '12px' }}>NONE</div> : outboundFlights.slice(0, 8).map(f => (
                <div key={f.id} style={{ fontSize: '12px', color: 'white', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{f.callsign}</span>
                  <span style={{ color: '#00ffcc' }}>{f.type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
