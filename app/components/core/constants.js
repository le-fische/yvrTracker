export const DEFAULT_FOV = 85
export const YVR_LAT = 49.1947
export const YVR_LON = -123.1839
export const SCALE = 10
export const KM_PER_DEG_LAT = 111.32
export const KM_PER_DEG_LON = 111.32 * Math.cos(YVR_LAT * Math.PI / 180)
export const AIRCRAFT_BASE_Y = -0.05

export function getPosition(lat, lon, altitude) {
  const x = (lon - YVR_LON) * KM_PER_DEG_LON * SCALE
  const z = -(lat - YVR_LAT) * KM_PER_DEG_LAT * SCALE
  const y = (altitude / 1000) * SCALE
  return [x, y, z]
}
