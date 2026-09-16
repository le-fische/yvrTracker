import json

with open('public/regional_coastlines.json', 'r') as f:
    osm_data = json.load(f)

osm_ways = osm_data['ways']
print("Original OSM ways:", len(osm_ways))

lengths = sorted([len(w) for w in osm_ways], reverse=True)
print("Top 20 lengths:", lengths[:20])

filtered = [w for w in osm_ways if len(w) > 50]
print("Filtered (len > 50):", len(filtered))

