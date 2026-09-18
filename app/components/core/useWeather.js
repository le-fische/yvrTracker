'use client'

import { useState, useEffect } from 'react'
import { YVR_LAT, YVR_LON } from './constants'

export function useWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${YVR_LAT}&longitude=${YVR_LON}&current_weather=true`)
      .then(res => res.json())
      .then(data => setWeather(data.current_weather))
      .catch(err => console.error("Weather fetch error", err))
  }, [])
  return weather
}
