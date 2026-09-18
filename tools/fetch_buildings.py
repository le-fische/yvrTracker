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
        
        with open('public/yvr_buildings.json', 'w') as f:
            json.dump({'buildings': buildings}, f)
        print(f"Saved {len(buildings)} buildings.")
except Exception as e:
    print(e)
