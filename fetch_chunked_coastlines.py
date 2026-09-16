import urllib.request
import json
import time

boxes = [
    (49.00, -123.30, 49.15, -123.05), # SW: Delta, Tsawwassen
    (49.00, -123.05, 49.15, -122.80), # SE: Surrey, White Rock
    (49.15, -123.30, 49.30, -123.05), # NW: Vancouver, Richmond, YVR
    (49.15, -123.05, 49.30, -122.80), # NE: Burnaby, Coquitlam
]

all_ways = []

for i, (s, w, n, e) in enumerate(boxes):
    print(f"Fetching chunk {i+1}...")
    query = f"""
    [out:json];
    (
      way["natural"="coastline"]({s},{w},{n},{e});
      way["waterway"="riverbank"]({s},{w},{n},{e});
      way["natural"="water"]({s},{w},{n},{e});
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
            for el in data.get('elements', []):
                if 'geometry' in el:
                    all_ways.append([[g['lat'], g['lon']] for g in el['geometry']])
    except Exception as ex:
        print(f"Chunk {i+1} failed: {ex}")
    time.sleep(2) # be nice to the API

with open('public/regional_coastlines.json', 'w') as f:
    json.dump({'ways': all_ways}, f)

print(f"Total vector paths saved: {len(all_ways)}")
