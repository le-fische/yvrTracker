import urllib.request
import json

query = """
[out:json];
(
  node["aeroway"="aerodrome"](49.18,-123.20,49.20,-123.16);
  nwr["man_made"="tower"](49.18,-123.20,49.20,-123.16);
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
        for el in data.get('elements', []):
            lat = el.get('lat') or el.get('center', {}).get('lat')
            lon = el.get('lon') or el.get('center', {}).get('lon')
            tags = el.get('tags', {})
            print(f"Element: {tags.get('name', 'Unknown')}, Type: {tags.get('tower:type', 'Unknown')}, aeroway: {tags.get('aeroway', 'Unknown')}, Lat: {lat}, Lon: {lon}")
except Exception as e:
    print(e)
