import json
import math

with open('public/coastlines.json') as f:
    data = json.load(f)

ways = data['ways']

segments = []
for way in ways:
    for i in range(len(way) - 1):
        p1 = way[i]
        p2 = way[i+1]
        dist = math.hypot(p1[0] - p2[0], p1[1] - p2[1])
        segments.append((dist, p1, p2))

segments.sort(key=lambda x: x[0], reverse=True)

print("Top 20 longest segments:")
for i, (dist, p1, p2) in enumerate(segments[:20]):
    print(f"{i+1:2d}: dist={dist:.4f} from ({p1[0]:.4f}, {p1[1]:.4f}) to ({p2[0]:.4f}, {p2[1]:.4f})")
