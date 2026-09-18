import urllib.request
import json

query = """
[out:json];
(
  relation["name"="Richmond"]["admin_level"="8"];
  relation["name"="Vancouver"]["admin_level"="8"];
  relation["name"="Delta"]["admin_level"="8"];
  relation["name"="Burnaby"]["admin_level"="8"];
  relation["name"="Surrey"]["admin_level"="8"];
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
            if el['type'] == 'relation':
                for member in el.get('members', []):
                    if member['type'] == 'way' and 'geometry' in member:
                        ways.append([[g['lat'], g['lon']] for g in member['geometry']])
        
        with open('public/boundary_coastlines.json', 'w') as f:
            json.dump({'ways': ways}, f)
        print(f"Saved {len(ways)} clean municipal boundary segments.")
except Exception as e:
    print("Error:", e)
