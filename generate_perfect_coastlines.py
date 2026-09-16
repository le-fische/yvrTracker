import urllib.request
import json

cities = [
    "Vancouver", "Richmond", "Delta", "Surrey", "Burnaby", 
    "New Westminster", "Coquitlam", "Port Moody", "Port Coquitlam", 
    "West Vancouver", "District of North Vancouver", "City of North Vancouver",
    "University Endowment Lands"
]

relations = "".join([f'relation["name"="{c}"];' for c in cities])

query = f"""
[out:json];
(
  {relations}
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
        
        # Convert to World Coords
        YVR_LAT = 49.1947
        YVR_LON = -123.1839
        SCALE = 10
        
        def getPosition(lat, lon):
            x = (lon - YVR_LON) * 73 * SCALE
            z = -(lat - YVR_LAT) * 111 * SCALE
            return [x, z]
            
        ways = []
        for el in data.get('elements', []):
            if el['type'] == 'relation':
                for member in el.get('members', []):
                    if member['type'] == 'way' and 'geometry' in member:
                        # Only keep boundaries, drop administrative lines that are perfectly straight (optional)
                        ways.append([getPosition(g['lat'], g['lon']) for g in member['geometry']])
        
        with open('public/combined_coastlines.json', 'w') as f:
            json.dump({'ways': ways}, f)
        print(f"Saved {len(ways)} perfect municipal border segments.")
except Exception as e:
    print("Error:", e)
