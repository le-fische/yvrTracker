import json

def get_area(points):
    area = 0
    for i in range(len(points)):
        j = (i + 1) % len(points)
        area += points[i][0] * points[j][1] - points[j][0] * points[i][1]
    return abs(area) / 2.0

with open('public/yvr_buildings.json', 'r') as f:
    data = json.load(f)

buildings = data['buildings']
buildings.sort(key=lambda b: get_area(b), reverse=True)

# Keep top 12 largest buildings
filtered = buildings[:12]

with open('public/yvr_buildings.json', 'w') as f:
    json.dump({'buildings': filtered}, f)

print(f"Kept {len(filtered)} out of {len(buildings)}")
