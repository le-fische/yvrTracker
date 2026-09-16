import urllib.request
import json

query = """
[out:json];
(
  node["aeroway"="control_tower"](49.18,-123.20,49.20,-123.16);
  way["aeroway"="control_tower"](49.18,-123.20,49.20,-123.16);
  node["building"="control_tower"](49.18,-123.20,49.20,-123.16);
  way["building"="control_tower"](49.18,-123.20,49.20,-123.16);
);
out center;
"""

req = urllib.request.Request(
    'https://overpass-api.de/api/interpreter',
    data=query.encode('utf-8'),
    headers={'User-Agent': 'Mozilla/5.0'}
)

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        print("Found", len(data.get('elements', [])), "ATC towers")
        for el in data.get('elements', []):
            lat = el.get('lat') or el.get('center', {}).get('lat')
            lon = el.get('lon') or el.get('center', {}).get('lon')
            print(f"Coordinates: {lat}, {lon}")
except Exception as e:
    print("Error:", e)
