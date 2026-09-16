const fs = require('fs');
fetch('https://opendata.adsb.fi/api/v3/lat/49.1947/lon/-123.1839/dist/50').then(r=>r.json()).then(data => {
  data.ac.forEach(ac => {
    const altFeet = typeof ac.alt_geom === 'number' ? ac.alt_geom : (typeof ac.alt_baro === 'number' ? ac.alt_baro : 0)
    let parsedAltitude = Math.max(0, parseFloat(altFeet) * 0.3048)
    if (isNaN(parsedAltitude)) parsedAltitude = 0
    let parsedVelocity = parseFloat(typeof ac.gs === 'number' ? ac.gs : 0) * 0.514444
    console.log(`Callsign: ${ac.flight}, AltFeet: ${altFeet}, ParsedAlt: ${parsedAltitude}, Velocity: ${parsedVelocity}`);
  })
})
