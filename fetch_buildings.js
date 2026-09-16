const https = require('https');
const fs = require('fs');

const query = `
[out:json];
(
  way["aeroway"="terminal"](49.18,-123.20,49.20,-123.16);
  way["building"](49.18,-123.20,49.20,-123.16);
);
out geom;
`;

const req = https.request({
  hostname: 'overpass-api.de',
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const buildings = parsed.elements.map(el => {
      if (!el.geometry) return null;
      return el.geometry.map(g => [g.lat, g.lon]);
    }).filter(Boolean);
    
    fs.writeFileSync('public/yvr_buildings.json', JSON.stringify({ buildings }));
    console.log(`Saved ${buildings.length} buildings.`);
  });
});
req.write(query);
req.end();
