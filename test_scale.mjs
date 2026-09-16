import * as THREE from 'three';
import fs from 'fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Setup mock DOM for three.js loader
import { JSDOM } from 'jsdom';
const { window } = new JSDOM();
global.window = window;
global.document = window.document;

// Custom reading of GLB without full loader if possible, or we can just use three's parse
const toArrayBuffer = (buffer) => {
  const ab = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
};

const loader = new GLTFLoader();
const parseGLB = (file) => {
  const data = fs.readFileSync(file);
  loader.parse(toArrayBuffer(data), '', (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    console.log(`${file}: length(Z)=${size.z.toFixed(2)}, width(X)=${size.x.toFixed(2)}, height(Y)=${size.y.toFixed(2)}`);
  }, (err) => console.error(err));
}

const models = fs.readdirSync('public/models').filter(f => f.endsWith('.glb') || f.endsWith('.gltf'));
models.forEach(m => parseGLB('public/models/' + m));
