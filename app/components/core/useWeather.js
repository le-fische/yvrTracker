'use client'

import { useState, useEffect } from 'react'

export function useWeather() {
  const [weather, setWeather] = useState(null)
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=49.1939&longitude=-123.1840&current_weather=true')
      .then(res => res.json())
      .then(data => setWeather(data.current_weather))
      .catch(err => console.error("Weather fetch error", err))
  }, [])
  return weather
}
