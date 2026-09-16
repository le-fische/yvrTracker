const fs = require('fs');
let code = fs.readFileSync('app/components/AirportScene.jsx', 'utf8');
code = code.replace(/<LiveAircraft/g, '{false} && <LiveAircraft');
fs.writeFileSync('app/components/AirportScene.jsx', code);
