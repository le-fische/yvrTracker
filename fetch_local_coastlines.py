import urllib.request
import json

query = """
[out:json];
(
  way["natural"="coastline"](49.10,-123.25,49.25,-123.00);
  way["waterway"="riverbank"](49.10,-123.25,49.25,-123.00);
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
        ways = []
        for el in data.get('elements', []):
            if 'geometry' in el:
                ways.append([[g['lat'], g['lon']] for g in el['geometry']])
        
        with open('public/yvr_coastlines.json', 'w') as f:
            json.dump({'ways': ways}, f)
        print(f"Saved {len(ways)} vector coastline segments.")
except Exception as e:
    print("Error:", e)
