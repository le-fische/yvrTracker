import urllib.request
import json
import time

cities = ["Vancouver", "Richmond", "Delta", "Surrey", "Burnaby", "Coquitlam", "West Vancouver", "District of North Vancouver"]
all_ways = []

YVR_LAT = 49.1947
YVR_LON = -123.1839
SCALE = 10

def getPosition(lat, lon):
    x = (lon - YVR_LON) * 73 * SCALE
    z = -(lat - YVR_LAT) * 111 * SCALE
    return [x, z]

for city in cities:
    print(f"Fetching {city}...")
    query = f"""
    [out:json][timeout:60];
    relation["name"="{city}"]["admin_level"="8"];
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
            for el in data.get('elements', []):
                if el['type'] == 'relation':
                    for member in el.get('members', []):
                        if member['type'] == 'way' and 'geometry' in member:
                            all_ways.append([getPosition(g['lat'], g['lon']) for g in member['geometry']])
    except Exception as e:
        print(f"Failed {city}:", e)
    
    time.sleep(2)

with open('public/combined_coastlines.json', 'w') as f:
    json.dump({'ways': all_ways}, f)

print(f"Saved {len(all_ways)} segments.")
