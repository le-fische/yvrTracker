const fs = require('fs');
let code = fs.readFileSync('app/components/AirportScene.jsx', 'utf8');
code = code.replace(/showRoutes && validHistory\.length > 1/g, 'false');
fs.writeFileSync('app/components/AirportScene.jsx', code);
