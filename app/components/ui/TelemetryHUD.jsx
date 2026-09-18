'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Plane, Activity, Info, X, Navigation } from 'lucide-react'
import { formatAltitude, formatSpeed } from '../core/units'
import { CAMERA_VIEWS } from '../camera/views'

export default function TelemetryHUD({ aircraft, onClose, useMetric, chaseViewIndex, setChaseViewIndex }) {
  return (
    <AnimatePresence>
      {aircraft && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            position: 'absolute', bottom: 24, right: 24, zIndex: 20,
            width: chaseViewIndex > 0 ? 250 : 360, background: 'rgba(5, 15, 25, 0.75)',
            border: '1px solid rgba(0,255,204,0.3)', borderRadius: '12px',
            color: '#00ffcc', fontFamily: 'monospace', padding: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0,255,204,0.2)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plane size={24} color="white" />
                <h2 style={{ margin: 0, fontSize: '26px', color: 'white', textShadow: '0 0 8px rgba(255,255,255,0.4)', letterSpacing: '1px' }}>{aircraft.callsign}</h2>
              </div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Info size={12} /> REG: {aircraft.registration || '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', paddingLeft: '16px' }}>ICAO: {aircraft.id.toUpperCase()}</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,255,204,0.1)', border: 'none', color: '#00ffcc', cursor: 'pointer', padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,255,204,0.2)'} onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0,255,204,0.1)'}>
              <X size={18} />
            </button>
          </div>
          
          {/* Dynamic Flight Status Banner */}
          <div style={{ 
            background: aircraft.status === 'TAXIING' ? 'rgba(255, 165, 0, 0.2)' : 
                       ((aircraft.status || '').includes('APPROACH') ? 'rgba(255, 50, 50, 0.2)' : 'rgba(0, 255, 204, 0.15)'), 
            color: aircraft.status === 'TAXIING' ? '#ffa500' : 
                  ((aircraft.status || '').includes('APPROACH') ? '#ff4444' : '#00ffcc'), 
            padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', 
            marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
            border: `1px solid ${aircraft.status === 'TAXIING' ? 'rgba(255,165,0,0.4)' : ((aircraft.status || '').includes('APPROACH') ? 'rgba(255,50,50,0.4)' : 'rgba(0,255,204,0.3)')}`
          }}>
            <Activity size={16} /> [ {aircraft.status || 'UNKNOWN'} ]
          </div>
          
          <div style={{ fontSize: '14px', marginBottom: '16px', color: '#eef7ff', padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{aircraft.desc || 'Unknown Aircraft'}</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{aircraft.ownOp || 'Unknown Operator'}</div>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', letterSpacing: '1px' }}>CAMERA VIEW (PRESS C)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              {CAMERA_VIEWS.map((view, idx) => (
                <button
                  key={view.id}
                  onClick={() => setChaseViewIndex && setChaseViewIndex(idx)}
                  style={{
                    background: chaseViewIndex === idx ? 'rgba(0,255,204,0.3)' : 'rgba(0,0,0,0.4)',
                    border: `1px solid ${chaseViewIndex === idx ? '#00ffcc' : 'rgba(0,255,204,0.1)'}`,
                    color: chaseViewIndex === idx ? '#fff' : '#aaa',
                    padding: '6px 4px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { if (chaseViewIndex !== idx) e.currentTarget.style.background = 'rgba(0,255,204,0.1)' }}
                  onMouseOut={(e) => { if (chaseViewIndex !== idx) e.currentTarget.style.background = 'rgba(0,0,0,0.4)' }}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
            <div style={{ background: 'rgba(0,255,204,0.05)', border: '1px solid rgba(0,255,204,0.1)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: '#888', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={14} /> ALTITUDE
              </div>
              <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
                {formatAltitude(aircraft.altitude, useMetric).value} 
                <span style={{fontSize:'12px', color:'#00ffcc', marginLeft:'4px'}}>{formatAltitude(aircraft.altitude, useMetric).unit.toUpperCase()}</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0,255,204,0.05)', border: '1px solid rgba(0,255,204,0.1)', padding: '12px', borderRadius: '8px' }}>
              <div style={{ color: '#888', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Activity size={14} /> GROUND SPEED
              </div>
              <div style={{ fontSize: '20px', color: 'white', fontWeight: 'bold' }}>
                {formatSpeed(aircraft.velocity, useMetric).value} 
                <span style={{fontSize:'12px', color:'#00ffcc', marginLeft:'4px'}}>{formatSpeed(aircraft.velocity, useMetric).unit.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '12px', textAlign: 'center' }}>
            {chaseViewIndex > 0 && CAMERA_VIEWS[chaseViewIndex]?.id === 'COCKPIT' ? 'DRAG TO LOOK AROUND · ' : ''}PRESS X TO DESELECT
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
