const fs = require('fs');
let code = fs.readFileSync('app/components/AirportScene.jsx', 'utf8');
code = code.replace(/wireframe=\{true\}/g, 'wireframe={false}');
fs.writeFileSync('app/components/AirportScene.jsx', code);
