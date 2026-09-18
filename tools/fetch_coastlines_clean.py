import urllib.request
import json
import time
import sys

# The Lower Mainland area, chunked into small 0.1x0.1 degree boxes
# to prevent Overpass API timeouts
lat_min, lat_max = 48.95, 49.40
lon_min, lon_max = -123.30, -122.75

chunk_size = 0.1
all_ways = []
seen_ids = set()  # deduplicate ways that span multiple chunks

lat = lat_min
while lat < lat_max:
    lon = lon_min
    while lon < lon_max:
        s, w = lat, lon
        n, e = min(lat + chunk_size, lat_max), min(lon + chunk_size, lon_max)
        
        label = f"({s:.2f},{w:.2f})->({n:.2f},{e:.2f})"
        print(f"Fetching chunk {label}...", end=" ", flush=True)
        
        # ONLY natural=coastline — this is the curated land/water boundary in OSM
        query = f"""[out:json][timeout:30];way["natural"="coastline"]({s},{w},{n},{e});out geom;"""
        
        req = urllib.request.Request(
            'https://overpass-api.de/api/interpreter',
            data=query.encode('utf-8'),
            headers={'User-Agent': 'YVR-Tracker/1.0'}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                data = json.loads(response.read().decode('utf-8'))
                count = 0
                for el in data.get('elements', []):
                    if el['id'] not in seen_ids and 'geometry' in el:
                        seen_ids.add(el['id'])
                        coords = [[g['lat'], g['lon']] for g in el['geometry']]
                        all_ways.append(coords)
                        count += 1
                print(f"OK ({count} new ways)")
        except Exception as ex:
            print(f"FAILED: {ex}")
        
        time.sleep(1.5)  # be polite to the API
        lon += chunk_size
    lat += chunk_size

print(f"\nTotal unique coastline ways: {len(all_ways)}")
print(f"Total coordinate points: {sum(len(w) for w in all_ways)}")

with open('public/coastlines.json', 'w') as f:
    json.dump({'ways': all_ways}, f)

print("Saved to public/coastlines.json")
