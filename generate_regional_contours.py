import cv2
import json
import numpy as np

# Load DEM
img = cv2.imread('public/vancouver_dem.png', cv2.IMREAD_GRAYSCALE)
height, width = img.shape

# Threshold: water is exactly 0, land is > 0
_, thresh = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY)

# Find contours
contours, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

ways = []
for contour in contours:
    # Filter out tiny noise contours (e.g., small lakes or artifacts)
    if len(contour) < 10:
        continue
        
    way = []
    # OpenCV contours are (X, Y)
    for point in contour:
        x, y = point[0]
        
        # Convert pixel to local 3D coords matching PlaneGeometry
        # Plane width=1539.84, height=1531.39
        # Plane is positioned at [-156.61, -0.2, 51.65]
        local_x = (x / width - 0.5) * 1539.84
        local_y = (0.5 - y / height) * 1531.39
        
        world_x = -156.61 + local_x
        world_z = 51.65 - local_y
        
        way.append([world_x, world_z])
    
    # Close the contour explicitly if it's a closed loop
    way.append(way[0])
    ways.append(way)

with open('public/regional_coastlines.json', 'w') as f:
    json.dump({'ways': ways}, f)

print(f"Extracted {len(ways)} vector coastline contours.")
