// Display conversions. FlightManager normalizes all telemetry to SI at ingest:
// altitude in metres, velocity in m/s. Convert only at the display layer.

export function formatAltitude(metres, useMetric) {
  return useMetric
    ? { value: Math.round(metres), unit: 'm' }
    : { value: Math.round(metres * 3.28084), unit: 'ft' }
}

export function formatSpeed(metresPerSecond, useMetric) {
  return useMetric
    ? { value: Math.round(metresPerSecond * 3.6), unit: 'km/h' }
    : { value: Math.round(metresPerSecond * 1.94384), unit: 'kts' }
}
