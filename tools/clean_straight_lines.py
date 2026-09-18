import json
import math

with open('public/coastlines.json') as f:
    data = json.load(f)

old_ways = data['ways']
new_ways = []
threshold = 0.05

for way in old_ways:
    current_way = [way[0]]
    for i in range(1, len(way)):
        p1 = way[i-1]
        p2 = way[i]
        dist = math.hypot(p1[0] - p2[0], p1[1] - p2[1])
        
        if dist > threshold:
            # The segment is too long and straight (likely a bounding box edge or US/Canada border)
            # Break the way here.
            if len(current_way) > 1:
                new_ways.append(current_way)
            current_way = [p2]
        else:
            current_way.append(p2)
    
    if len(current_way) > 1:
        new_ways.append(current_way)

print(f"Original ways: {len(old_ways)}")
print(f"New ways after breaking long straight lines: {len(new_ways)}")

with open('public/coastlines.json', 'w') as f:
    json.dump({'ways': new_ways}, f)

print("Saved to public/coastlines.json")
