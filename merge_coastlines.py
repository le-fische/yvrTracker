import cv2
import json

# 1. Regenerate CV contours
img = cv2.imread('public/vancouver_dem.png', cv2.IMREAD_GRAYSCALE)
height, width = img.shape
_, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

cv_ways = []
for contour in contours:
    if len(contour) < 10:
        continue
    way = []
    for point in contour:
        x, y = point[0]
        local_x = (x / width - 0.5) * 1539.84
        local_y = (0.5 - y / height) * 1531.39
        world_x = -156.61 + local_x
        world_z = 51.65 - local_y
        way.append([world_x, world_z])
    way.append(way[0])
    cv_ways.append(way)

# 2. Load the Overpass chunks we successfully fetched
with open('public/regional_coastlines.json', 'r') as f:
    osm_data = json.load(f)
    osm_ways_geo = osm_data.get('ways', [])

# Convert OSM lat/lon to world coords
YVR_LAT = 49.1947
YVR_LON = -123.1839
SCALE = 10

def getPosition(lat, lon):
    x = (lon - YVR_LON) * 73 * SCALE
    z = -(lat - YVR_LAT) * 111 * SCALE
    return [x, z]

osm_ways = []
for way in osm_ways_geo:
    osm_ways.append([getPosition(lat, lon) for lat, lon in way])

# 3. Combine both
combined = cv_ways + osm_ways

with open('public/combined_coastlines.json', 'w') as f:
    json.dump({'ways': combined}, f)

print(f"Merged {len(cv_ways)} CV contours and {len(osm_ways)} OSM vectors.")
