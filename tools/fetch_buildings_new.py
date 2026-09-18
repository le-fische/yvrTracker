import urllib.request
import json

query = """
[out:json];
(
  way["building"](49.180,-123.200,49.205,-123.155);
);
out geom;
"""

req = urllib.request.Request(
    'https://overpass-api.de/api/interpreter',
    data=query.encode('utf-8'),
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        buildings = []
        for el in data.get('elements', []):
            if 'geometry' in el:
                buildings.append([[g['lat'], g['lon']] for g in el['geometry']])
        
        def get_area(points):
            area = 0
            for i in range(len(points)):
                j = (i + 1) % len(points)
                area += points[i][0] * points[j][1] - points[j][0] * points[i][1]
            return abs(area) / 2.0
            
        buildings.sort(key=lambda b: get_area(b), reverse=True)
        # Keep top 80 largest buildings (more than 12, less than 264)
        filtered = buildings[:80]
        
        with open('public/yvr_buildings.json', 'w') as f:
            json.dump({'buildings': filtered}, f)
        print(f"Saved {len(filtered)} buildings.")
except Exception as e:
    print(e)
