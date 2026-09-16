import urllib.request
import json

# Try the nvkelso official repo
url = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson"
print("Downloading Natural Earth 10m coastline GeoJSON...")

req = urllib.request.Request(url, headers={'User-Agent': 'YVR-Tracker/1.0'})
with urllib.request.urlopen(req, timeout=60) as response:
    data = json.loads(response.read().decode('utf-8'))

print(f"Downloaded {len(data['features'])} coastline features globally.")

# Filter to Lower Mainland bounding box
lat_min, lat_max = 48.90, 49.45
lon_min, lon_max = -123.35, -122.70

ways = []
for feature in data['features']:
    geom = feature['geometry']
    coords = geom['coordinates']
    
    if geom['type'] == 'LineString':
        coord_lists = [coords]
    elif geom['type'] == 'MultiLineString':
        coord_lists = coords
    else:
        continue
    
    for line in coord_lists:
        in_bbox = any(
            lon_min <= lon <= lon_max and lat_min <= lat <= lat_max
            for lon, lat in line
        )
        if in_bbox:
            way = [[lat, lon] for lon, lat in line]
            ways.append(way)

print(f"Filtered to {len(ways)} coastline segments in the Vancouver area.")
print(f"Total coordinate points: {sum(len(w) for w in ways)}")

with open('public/coastlines.json', 'w') as f:
    json.dump({'ways': ways}, f)

print("Saved to public/coastlines.json")
