import urllib.request
import json

query = """
[out:json];
(
  way["natural"="coastline"](49.00,-123.30,49.40,-122.80);
  way["natural"="water"](49.00,-123.30,49.40,-122.80);
  way["waterway"="riverbank"](49.00,-123.30,49.40,-122.80);
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
        coastlines = []
        for el in data.get('elements', []):
            if 'geometry' in el:
                coastlines.append([[g['lat'], g['lon']] for g in el['geometry']])
        
        with open('public/yvr_coastlines.json', 'w') as f:
            json.dump({'coastlines': coastlines}, f)
        print(f"Saved {len(coastlines)} coastline segments.")
except Exception as e:
    print("Error:", e)
