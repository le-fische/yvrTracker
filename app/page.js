// app/page.js
'use client'

import dynamic from 'next/dynamic'

// Dynamically import the Three.js component to avoid SSR issues with the Canvas
const AirportScene = dynamic(() => import('./components/AirportScene'), { ssr: false })

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', background: '#000000', position: 'relative', overflow: 'hidden' }}>
      <AirportScene />
    </main>
  )
}