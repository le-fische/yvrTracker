'use client'

import React, { createContext, useState, useEffect } from 'react'

export const TimeOfDayContext = createContext({
  isDay: true,
  isNight: false,
  sunElevation: 1,
})

export function TimeOfDayProvider({ children }) {
  const [timeState, setTimeState] = useState({
    isDay: true,
    isNight: false,
    sunElevation: 1,
  })

  useEffect(() => {
    const updateTime = () => {
      const hour = new Date().toLocaleString('en-US', { timeZone: 'America/Vancouver', hour: 'numeric', hourCycle: 'h23' })
      const h = parseInt(hour, 10)
      
      const timeProgress = (h - 6) / 12; // 6am to 6pm
      const day = timeProgress > 0 && timeProgress < 1;
      
      setTimeState({
        isDay: day,
        isNight: !day,
        sunElevation: day ? Math.sin(timeProgress * Math.PI) : -0.5,
      });
    }
    updateTime()
    const int = setInterval(updateTime, 60000)
    return () => clearInterval(int)
  }, [])

  return (
    <TimeOfDayContext.Provider value={timeState}>
      {children}
    </TimeOfDayContext.Provider>
  )
}
