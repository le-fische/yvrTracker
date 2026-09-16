import json

def get_area(points):
    area = 0
    for i in range(len(points)):
        j = (i + 1) % len(points)
        area += points[i][0] * points[j][1] - points[j][0] * points[i][1]
    return abs(area) / 2.0

with open('public/yvr_buildings.json', 'r') as f:
    data = json.load(f)

# we need to re-fetch because I overwrote yvr_buildings.json with 12 buildings!
# Ah, I overwrote it. Let's re-fetch from Overpass.
