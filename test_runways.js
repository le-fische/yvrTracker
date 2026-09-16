const fs = require('fs');
const YVR_LAT = 49.1947;
const YVR_LON = -123.1839;
const SCALE = 10;
function getPosition(lat, lon, altitude) {
  const x = (lon - YVR_LON) * 73 * SCALE;
  const z = -(lat - YVR_LAT) * 111 * SCALE;
  const y = Math.max((altitude / 1000) * SCALE, 0.07);
  return [x, y, z];
}
const aeroways = JSON.parse(fs.readFileSync('./public/yvr_aeroways.json', 'utf8'));
aeroways.runways.forEach(points => {
  const pts = points.map(([lat, lon]) => getPosition(lat, lon, 0));
  if (pts.length < 2) return;
  const p0 = pts[0];
  const p1 = pts[pts.length - 1];
  const length = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
  if (length > 2.0) {
    let heading = Math.atan2(p1[0] - p0[0], p0[2] - p1[2]) * 180 / Math.PI;
    if (heading < 0) heading += 360;
    let hdg1 = Math.round(heading / 10);
    console.log(`Length: ${length}, Z: ${p0[2]}, Hdg: ${hdg1}`);
  }
});
