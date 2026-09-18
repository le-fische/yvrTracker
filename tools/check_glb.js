const fs = require('fs');
const { gltfLoader } = require('three/examples/jsm/loaders/GLTFLoader.js');
// Wait, we don't have three/examples/jsm in node without compilation.
// We can use the gltf-pipeline or just raw JSON parsing to see min/max.
const gltf = JSON.parse(fs.readFileSync('public/airplane.gltf', 'utf8'));
const posAccessor = gltf.accessors[0]; // Usually the first accessor is position of the main mesh
console.log('min:', posAccessor.min);
console.log('max:', posAccessor.max);
