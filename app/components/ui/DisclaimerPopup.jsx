'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

export default function DisclaimerPopup() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem('yvr_disclaimer_ack')) {
        setIsVisible(true)
      }
    } catch (e) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    try {
      localStorage.setItem('yvr_disclaimer_ack', '1')
    } catch (e) {}
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, background: 'rgba(2, 5, 10, 0.6)', backdropFilter: 'blur(4px)'
          }}
        >
          <div style={{
            background: 'rgba(5, 15, 25, 0.85)', border: '1px solid rgba(0,255,204,0.4)',
            borderRadius: '12px', padding: '24px', color: '#00ffcc', fontFamily: 'monospace',
            maxWidth: '500px', boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
            position: 'relative'
          }}>
            <button 
              onClick={handleDismiss}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'rgba(0,255,204,0.1)', border: 'none', color: '#00ffcc',
                cursor: 'pointer', padding: '6px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,255,204,0.2)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,255,204,0.1)'}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', borderBottom: '1px solid rgba(0,255,204,0.2)', paddingBottom: '16px' }}>
              <AlertTriangle size={28} color="#ffaa00" />
              <h2 style={{ margin: 0, color: 'white', fontSize: '20px', letterSpacing: '1px' }}>IMPORTANT DISCLAIMER</h2>
            </div>
            
            <p style={{ color: '#eef7ff', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              This application is for <strong>entertainment and visualization purposes only</strong>. 
              The ADS-B flight data provided by <code style={{ background: 'rgba(0,255,204,0.1)', padding: '1px 4px', borderRadius: '3px' }}>opendata.adsb.fi</code> may be delayed, incomplete, or inaccurate.
            </p>
            
            <p style={{ color: '#ff4444', fontSize: '14px', lineHeight: '1.6', fontWeight: 'bold', marginBottom: '24px' }}>
              DO NOT use this application for real-world navigation, aviation safety, or operational decisions.
            </p>

            <div style={{ background: 'rgba(0,255,204,0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0,255,204,0.1)' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#888', textAlign: 'center' }}>
                Built with assistance from <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>Google Gemini</span>
              </p>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                width: '100%', marginTop: '20px', background: '#00ffcc', color: '#000',
                border: 'none', padding: '12px', borderRadius: '6px', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer', letterSpacing: '1px'
              }}
            >
              I UNDERSTAND & AGREE
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
