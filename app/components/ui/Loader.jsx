'use client'

import { Html, useProgress } from '@react-three/drei'
import { motion } from 'framer-motion'
import { Crosshair } from 'lucide-react'

export default function Loader() {
  const { progress } = useProgress()
  return (
    <Html center zIndexRange={[100, 0]}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        style={{ color: '#00ffcc', fontFamily: 'monospace', fontSize: '24px', whiteSpace: 'nowrap', textShadow: '0 0 10px #00ffcc', background: 'rgba(0,0,0,0.8)', padding: '20px 40px', borderRadius: '8px', border: '1px solid #00ffcc' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Crosshair className="animate-spin" style={{ animation: 'spin 2s linear infinite' }} /> 
          RADAR INITIALIZING... {progress.toFixed(0)}%
        </div>
      </motion.div>
    </Html>
  )
}
