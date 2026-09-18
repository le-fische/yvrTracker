const https = require('https');
const fs = require('fs');

const query = `
[out:json];
(
  way["aeroway"="taxiway"](49.17,-123.22,49.21,-123.13);
  way["aeroway"="runway"](49.17,-123.22,49.21,-123.13);
  way["aeroway"="apron"](49.17,-123.22,49.21,-123.13);
);
out geom;
`;

const options = {
  hostname: 'lz4.overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'YVRTracker/1.0'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const elements = json.elements || [];
      const out = { taxiways: [], aprons: [], runways: [] };
      
      elements.forEach(el => {
        if (el.type === 'way' && el.geometry) {
          const coords = el.geometry.map(g => [g.lat, g.lon]);
          if (el.tags && el.tags.aeroway === 'taxiway') out.taxiways.push(coords);
          if (el.tags && el.tags.aeroway === 'apron') out.aprons.push(coords);
          if (el.tags && el.tags.aeroway === 'runway') out.runways.push(coords);
        }
      });
      
      fs.writeFileSync('public/yvr_aeroways.json', JSON.stringify(out));
      console.log('Successfully saved to public/yvr_aeroways.json. Found ' + out.taxiways.length + ' taxiways, ' + out.aprons.length + ' aprons, ' + out.runways.length + ' runways.');
    } catch(e) {
      console.error('Parse error or rate limit:', data.substring(0, 200));
    }
  });
});

req.on('error', (e) => console.error(e));
req.write(query);
req.end();
