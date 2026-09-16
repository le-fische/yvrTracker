export const YVR_LAT = 49.1947
export const YVR_LON = -123.1839
export const SCALE = 10

export function getPosition(lat, lon, altitude) {
  const x = (lon - YVR_LON) * 73 * SCALE
  const z = -(lat - YVR_LAT) * 111 * SCALE
  const y = (altitude / 1000) * SCALE
  return [x, y, z]
}
