'use client'

import React, { useMemo } from 'react'
import { formatAltitude, formatSpeed } from '../core/units'
import { YVR_LAT, YVR_LON, KM_PER_DEG_LAT, KM_PER_DEG_LON } from '../core/constants'

export default function RosterSidebar({ flights, showOpsPanel, selectedAircraft, setSelectedAircraft, useMetric }) {
  const rosterFlights = useMemo(() => {
    if (!flights || flights.length === 0) return []
    return flights.slice().sort((a, b) => {
      const distA = Math.hypot((a.latitude - YVR_LAT) * KM_PER_DEG_LAT, (a.longitude - YVR_LON) * KM_PER_DEG_LON)
      const distB = Math.hypot((b.latitude - YVR_LAT) * KM_PER_DEG_LAT, (b.longitude - YVR_LON) * KM_PER_DEG_LON)
      return distA - distB
    }).slice(0, 40)
  }, [flights])

  if (showOpsPanel) return null;
  if (rosterFlights.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '24px',
      right: '24px',
      maxHeight: 'calc(100vh - 340px)',
      overflowY: 'auto',
      background: 'rgba(5, 15, 25, 0.75)',
      border: '1px solid rgba(0,255,204,0.3)',
      borderRadius: '12px',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      fontFamily: 'monospace',
      color: '#fff',
      zIndex: 10,
      width: '240px',
      padding: '12px 0'
    }}>
      <div style={{ padding: '0 16px 8px', borderBottom: '1px solid rgba(0,255,204,0.2)', marginBottom: '8px', color: '#00ffcc', fontSize: '12px', fontWeight: 'bold' }}>
        ACTIVE ROSTER ({rosterFlights.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rosterFlights.map(f => {
          const isSelected = selectedAircraft && selectedAircraft.id === f.id;
          const alt = formatAltitude(f.altitude, useMetric);
          const spd = formatSpeed(f.velocity, useMetric);
          return (
            <div 
              key={f.id}
              onClick={() => setSelectedAircraft(f)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 16px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(0,255,204,0.1)' : 'transparent',
                color: isSelected ? '#00ffcc' : '#fff',
                fontSize: '12px',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
              onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontWeight: 'bold' }}>{f.callsign || 'UNKNOWN'}</div>
              <div style={{ color: isSelected ? '#00ffcc' : '#888', textAlign: 'right' }}>
                {alt.value}{alt.unit} · {spd.value}{spd.unit}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
