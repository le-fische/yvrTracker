const THREE = require('three');

function offsetPath(points, width) {
    const leftPath = [];
    const rightPath = [];
    
    // points is an array of THREE.Vector3
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        let dir = new THREE.Vector3();
        
        if (i === 0) {
            dir.subVectors(points[i+1], current).normalize();
        } else if (i === points.length - 1) {
            dir.subVectors(current, points[i-1]).normalize();
        } else {
            // Average direction
            const d1 = new THREE.Vector3().subVectors(current, points[i-1]).normalize();
            const d2 = new THREE.Vector3().subVectors(points[i+1], current).normalize();
            dir.addVectors(d1, d2).normalize();
        }
        
        // Normal vector (perpendicular in XZ plane)
        const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        
        const offset = normal.clone().multiplyScalar(width / 2);
        
        leftPath.push(current.clone().add(offset));
        rightPath.push(current.clone().sub(offset));
    }
    
    return { leftPath, rightPath };
}

// Test
const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(10, 0, 0),
    new THREE.Vector3(10, 0, 10)
];
const { leftPath, rightPath } = offsetPath(pts, 2);
console.log("Left Path:", leftPath.map(p => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`));
console.log("Right Path:", rightPath.map(p => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`));
