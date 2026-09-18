'use client'

import { useState, useEffect } from 'react'
import { YVR_LAT, YVR_LON } from './constants'
import LiveAircraft from '../aircraft/LiveAircraft'

export default function FlightManager({ useMetric, onSelect, selectedAircraft, showRoutes, onFlightsUpdate }) {
  const [flights, setFlights] = useState([])

  useEffect(() => {
    const eventSource = new EventSource('/api/adsb');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (Array.isArray(data.ac)) {
          const activeTracks = data.ac.map(ac => {
            const altFeet = typeof ac.alt_geom === 'number' ? ac.alt_geom : (typeof ac.alt_baro === 'number' ? ac.alt_baro : 0)
            let parsedAltitude = Math.max(0, parseFloat(altFeet) * 0.3048)
            if (isNaN(parsedAltitude)) parsedAltitude = 0

            let parsedHeading = parseFloat(ac.track || ac.true_heading || ac.mag_heading || 0)
            if (isNaN(parsedHeading)) parsedHeading = 0

            const speedKnots = typeof ac.gs === 'number' ? ac.gs : 0
            let parsedVelocity = parseFloat(speedKnots) * 0.514444
            if (isNaN(parsedVelocity)) parsedVelocity = 0

            const dLat = (parseFloat(ac.lat) - YVR_LAT) * 111;
            const dLon = (parseFloat(ac.lon) - YVR_LON) * 73;
            const distKm = Math.hypot(dLat, dLon);
            const vSpeed = ac.baro_rate || ac.geom_rate || 0;
            
            let status = 'EN ROUTE';
            if (distKm < 50) { 
              if (parsedAltitude < 150 && speedKnots < 50) {
                status = 'TAXIING';
              } else if (parsedAltitude < 2000 && speedKnots < 180 && vSpeed < -100) {
                status = 'ON FINAL APPROACH';
              } else if (parsedAltitude < 4000 && vSpeed > 200) {
                status = 'CLIMBING OUT';
              } else if (parsedAltitude < 4000 && vSpeed < -200) {
                status = 'DESCENDING';
              } else {
                status = 'IN TERMINAL AIRSPACE';
              }
            } else {
              if (vSpeed > 400) status = 'CLIMBING';
              else if (vSpeed < -400) status = 'DESCENDING';
              else status = 'CRUISING';
            }

              let inferredType = ac.t;
              if (!inferredType) {
                switch(ac.category) {
                  case 'A1': inferredType = 'Light Aircraft'; break;
                  case 'A2': inferredType = 'Small Commuter'; break;
                  case 'A3': inferredType = 'Large Jet'; break;
                  case 'A4': inferredType = 'High Vortex Jet'; break;
                  case 'A5': inferredType = 'Heavy Jet'; break;
                  case 'A6': inferredType = 'High Performance'; break;
                  case 'A7': inferredType = 'Helicopter'; break;
                  default: inferredType = 'Unknown'; break;
                }
              }

              return {
                id: ac.hex,
                callsign: ac.flight ? ac.flight.trim() : ac.r || ac.hex,
                longitude: parseFloat(ac.lon),
                latitude: parseFloat(ac.lat),
                altitude: parsedAltitude,
                heading: parsedHeading,
                velocity: parsedVelocity,
                desc: ac.desc,
                ownOp: ac.ownOp,
                type: inferredType,
                category: ac.category || 'N/A',
                registration: ac.r || null,
              status: status
            }
          }).filter(f => !isNaN(f.latitude) && !isNaN(f.longitude))

          setFlights(activeTracks)
          if (onFlightsUpdate) onFlightsUpdate(activeTracks)
        }
      } catch (err) {
        console.error("Failed to parse ADSB data from SSE:", err)
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
    };

    const handleContextLost = (e) => {
      e.preventDefault();
      console.error("WEBGL CONTEXT LOST DETECTED!");
    };
    window.addEventListener("webglcontextlost", handleContextLost, false);

    return () => {
      eventSource.close();
      window.removeEventListener("webglcontextlost", handleContextLost);
    }
  }, [onFlightsUpdate])

  return (
    <group>
      {flights.map(flight => (
        <LiveAircraft 
          key={flight.id} 
          flight={flight} 
          showRoutes={showRoutes}
          onClick={onSelect}
          isSelected={selectedAircraft && selectedAircraft.id === flight.id}
          useMetric={useMetric}
        />
      ))}
    </group>
  )
}
