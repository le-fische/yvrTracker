'use client'

import React, { useState, useRef, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, useGLTF, OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const MODELS = [
  'a320', 'a333', 'a343', 'a359', 'a380', 'b738', 'b744', 'b763', 'b773', 'b789', 'q400', 'crj900', 'e190', 'citation'
]

const SHOWCASE_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#eef7ff',
  roughness: 0.3,
  metalness: 0.8,
})

function ModelViewer({ modelName }) {
  const { scene } = useGLTF(`/models/${modelName}.glb`, '/draco/')
  const groupRef = useRef()

  const { clone, scale } = React.useMemo(() => {
    const c = scene.clone()
    c.traverse(child => {
      if (child.isMesh) {
        child.material = SHOWCASE_MATERIAL
      }
    })
    
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3()
    box.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    
    return { clone: c, scale: 5 / maxDim }
  }, [scene])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005
    }
  })

  return (
    <group ref={groupRef} scale={scale} position={[0, -0.5, 0]}>
      <primitive object={clone} />
    </group>
  )
}

export default function AircraftShowcase({ onClose }) {
  const [index, setIndex] = useState(0)
  
  const handleNext = () => setIndex((i) => (i + 1) % MODELS.length)
  const handlePrev = () => setIndex((i) => (i - 1 + MODELS.length) % MODELS.length)

  return (
    <>
      <color attach="background" args={['#050810']} />
      
      <ambientLight intensity={0.5} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#00ffcc" />
      <spotLight position={[-10, 10, -10]} angle={0.15} penumbra={1} intensity={1} color="#ff0044" />

      <Suspense fallback={<Html center><div style={{ color: '#00ffcc', fontFamily: 'monospace' }}>LOADING MODEL...</div></Html>}>
        <ModelViewer modelName={MODELS[index]} key={MODELS[index]} />
      </Suspense>

      <ContactShadows position={[0, -0.5, 0]} opacity={0.5} scale={20} blur={2} far={4} />

      <OrbitControls autoRotate={false} minPolarAngle={0} maxPolarAngle={Math.PI / 2 + 0.1} minDistance={3} maxDistance={15} />

      <Html fullscreen zIndexRange={[100, 100]}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ margin: 0, color: 'white', fontFamily: 'monospace', letterSpacing: '2px', textShadow: '0 0 10px rgba(0,255,204,0.5)' }}>AIRCRAFT SHOWCASE</h1>
              <div style={{ color: '#00ffcc', fontFamily: 'monospace', fontSize: '14px', marginTop: '4px' }}>MODEL: {MODELS[index].toUpperCase()}</div>
            </div>
            <button 
              onClick={onClose}
              style={{ pointerEvents: 'auto', background: 'rgba(255,0,68,0.2)', border: '1px solid #ff0044', color: '#ff0044', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,0,68,0.4)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,0,68,0.2)'}
            >
              <X size={24} />
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px' }}>
            <button 
              onClick={handlePrev}
              style={{ pointerEvents: 'auto', background: 'rgba(0,255,204,0.1)', border: '1px solid #00ffcc', color: '#00ffcc', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', backdropFilter: 'blur(4px)' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,204,0.3)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(0,255,204,0.1)'}
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={handleNext}
              style={{ pointerEvents: 'auto', background: 'rgba(0,255,204,0.1)', border: '1px solid #00ffcc', color: '#00ffcc', width: '50px', height: '50px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s', backdropFilter: 'blur(4px)' }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(0,255,204,0.3)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(0,255,204,0.1)'}
            >
              <ChevronRight size={32} />
            </button>
          </div>

          <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontFamily: 'monospace', fontSize: '12px' }}>
            DRAG TO ROTATE · SCROLL TO ZOOM
          </div>
        </div>
      </Html>
    </>
  )
}
