import fs from 'fs'
import * as THREE from 'three'
import { GLTFExporter } from 'three-stdlib'

// YVR Coordinates
const YVR_LAT = 49.1947
const YVR_LON = -123.1839
const SCALE = 10

function getPosition(lat, lon, altitude) {
  const x = (lon - YVR_LON) * 73 * SCALE
  const z = -(lat - YVR_LAT) * 111 * SCALE
  const y = Math.max((altitude / 1000) * SCALE, 0.07)
  return [x, y, z]
}

function offsetPath(points, width) {
  const leftPath = []
  const rightPath = []
  for (let i = 0; i < points.length; i++) {
    const current = new THREE.Vector3(...points[i])
    let dir = new THREE.Vector3()
    if (i === 0) {
      dir.subVectors(new THREE.Vector3(...points[i+1]), current).normalize()
    } else if (i === points.length - 1) {
      dir.subVectors(current, new THREE.Vector3(...points[i-1])).normalize()
    } else {
      const d1 = new THREE.Vector3().subVectors(current, new THREE.Vector3(...points[i-1])).normalize()
      const d2 = new THREE.Vector3().subVectors(new THREE.Vector3(...points[i+1]), current).normalize()
      dir.addVectors(d1, d2).normalize()
    }
    if (isNaN(dir.x) || isNaN(dir.y) || isNaN(dir.z) || dir.length() < 0.0001) {
      dir.set(1, 0, 0)
    }
    
    const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
    const offset = normal.clone().multiplyScalar(width / 2)
    leftPath.push(current.clone().add(offset).toArray())
    rightPath.push(current.clone().sub(offset).toArray())
  }
  return { leftPath, rightPath }
}

const aeroways = JSON.parse(fs.readFileSync('./public/yvr_aeroways.json', 'utf8'))
const scene = new THREE.Scene()

// Materials
const pavementMaterial = new THREE.MeshBasicMaterial({ color: 0x050a0a, depthWrite: true })
const runwayEdgeMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 })
const taxiwayEdgeMat = new THREE.LineBasicMaterial({ color: 0x006644, linewidth: 2 })
const centerlineMat = new THREE.LineDashedMaterial({ color: 0xffffff, linewidth: 1, dashSize: 0.5, gapSize: 0.5 })

function addPath(pointsRaw, width, isRunway) {
  const pts = pointsRaw.map(([lat, lon]) => {
    const [x, , z] = getPosition(lat, lon, 0)
    return [x, 0.021, z]
  }).filter((p, i, arr) => {
    if (i === 0) return true
    const prev = arr[i - 1]
    const dist = Math.hypot(p[0] - prev[0], p[2] - prev[2])
    return dist > 0.001
  })

  if (pts.length < 2) return

  const { leftPath, rightPath } = offsetPath(pts, width)

  // 1. Solid Pavement
  const shape = new THREE.Shape()
  if (leftPath.length > 0) {
    leftPath.forEach((p, i) => {
      if (i === 0) shape.moveTo(p[0], -p[2])
      else shape.lineTo(p[0], -p[2])
    })
    for (let i = rightPath.length - 1; i >= 0; i--) {
      shape.lineTo(rightPath[i][0], -rightPath[i][2])
    }
  }

  const geometry = new THREE.ShapeGeometry(shape)
  const mesh = new THREE.Mesh(geometry, pavementMaterial)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.020
  scene.add(mesh)

  // 2. Edges
  const edgeMat = isRunway ? runwayEdgeMat : taxiwayEdgeMat
  
  const leftGeo = new THREE.BufferGeometry().setFromPoints(leftPath.map(p => new THREE.Vector3(p[0], 0.019, p[2])))
  const rightGeo = new THREE.BufferGeometry().setFromPoints(rightPath.map(p => new THREE.Vector3(p[0], 0.019, p[2])))
  
  const leftLine = new THREE.Line(leftGeo, edgeMat)
  const rightLine = new THREE.Line(rightGeo, edgeMat)
  scene.add(leftLine)
  scene.add(rightLine)

  // 3. Centerline
  const centerGeo = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], 0.021, p[2])))
  const centerLine = new THREE.Line(centerGeo, centerlineMat)
  centerLine.computeLineDistances()
  scene.add(centerLine)
}

aeroways.runways.forEach(pts => addPath(pts, 0.6, true))
aeroways.taxiways.forEach(pts => addPath(pts, 0.3, false))

// Export to GLTF
const exporter = new GLTFExporter()
exporter.parse(
  scene,
  function (gltf) {
    fs.writeFileSync('./public/airport_ground.glb', Buffer.from(gltf))
    console.log('Successfully baked airport_ground.glb')
  },
  function (error) {
    console.error('An error happened', error)
  },
  { binary: true }
)
