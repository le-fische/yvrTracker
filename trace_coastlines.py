from PIL import Image
import json

# Load the DEM image
img = Image.open('public/vancouver_dem.png').convert('L')
width, height = img.size
pixels = img.load()

# Threshold: 0 is water, >0 is land
# Let's find edge pixels
edges = []

for y in range(1, height - 1):
    for x in range(1, width - 1):
        if pixels[x, y] > 0:
            # Check neighbors
            if pixels[x-1, y] == 0 or pixels[x+1, y] == 0 or pixels[x, y-1] == 0 or pixels[x, y+1] == 0:
                edges.append((x, y))

# Convert pixel coordinates to geographic or local 3D coordinates.
# Our PlaneGeometry has width=1539.84, height=1531.39
# Positioned at [-156.61, -0.2, 51.65]
# Wait, it's simpler to just output the raw pixel coordinates [0 to 1]
# And let the frontend map them, or map them here.

coastlines_3d = []
for x, y in edges:
    # x ranges from 0 to width (768)
    # y ranges from 0 to height (768)
    # PlaneGeometry local coords:
    # local_x = (x / width - 0.5) * 1539.84
    # local_y = (0.5 - y / height) * 1531.39
    
    local_x = (x / width - 0.5) * 1539.84
    local_y = (0.5 - y / height) * 1531.39
    
    # World coords (Plane is rotated -90 on X, and positioned)
    world_x = -156.61 + local_x
    world_z = 51.65 - local_y
    
    coastlines_3d.append([world_x, 0.1, world_z])

with open('public/yvr_coastlines.json', 'w') as f:
    json.dump({'points': coastlines_3d}, f)

print(f"Generated {len(coastlines_3d)} coastline points.")
